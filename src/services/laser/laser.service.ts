import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { Bounds, LaserState, LaserStatus, PrinterState, PrinterStatus, XY } from '../../model';
import { ConfigService } from '../config.service';
import { NotificationService } from '../notification.service';
import { SocketService } from '../socket/socket.service';
import { tr } from './laser-i18n';

const BGS_PLUGIN = 'bettergrblsupport';

interface BgsGrblState {
  type: string;
  mode?: 'MPos' | 'WPos' | string;
  state?: string;
  x?: number;
  y?: number;
  speed?: number;
  power?: number;
  coolant?: string;
}

/**
 * Laser state + GRBL commands on top of OctoPrint and the Better Grbl Support plugin.
 *
 * Position: BGS reports X/Y as MPos or WPos depending on GRBL's $10. The work offset (WCO)
 * is not forwarded by BGS, so it is read from the raw status lines in OctoPrint's log
 * stream ("<Idle|MPos:...|WCO:x,y,z>"), which GRBL includes periodically and right after
 * any offset change. Until a WCO is seen it is assumed to be 0,0.
 */
@Injectable({
  providedIn: 'root',
})
export class LaserService implements OnDestroy {
  private subscriptions = new Subscription();
  private statusSubject: BehaviorSubject<LaserStatus>;
  private printerState: PrinterState = PrinterState.connecting;
  private lastReportedMode: string = null;
  private lastReportedXY: XY = null;

  private pollTimer: ReturnType<typeof setInterval> = null;
  private pollUntil = 0;
  private pollInFlight = false;

  private continuousJogActive = false;
  private continuousTimer: ReturnType<typeof setInterval> = null;
  private continuousDir: XY = null;
  private queuedOffset: XY = { x: 0, y: 0 };
  private jogStartPos: XY = null;

  public constructor(
    private socketService: SocketService,
    private configService: ConfigService,
    private notificationService: NotificationService,
    private http: HttpClient,
    private zone: NgZone,
  ) {
    this.statusSubject = new BehaviorSubject<LaserStatus>({
      state: LaserState.connecting,
      grblState: '',
      mpos: null,
      wpos: null,
      wco: { x: 0, y: 0 },
      wcoKnown: false,
      feed: 0,
      power: 0,
      airAssist: false,
      jobActive: false,
      pausing: false,
      alarmCode: null,
      updated: 0,
    });

    this.subscriptions.add(
      this.socketService.getPrinterStatusSubscribable().subscribe((status: PrinterStatus) => {
        if (!status) return;
        this.printerState = status.status;
        this.publish({});
      }),
    );

    this.subscriptions.add(
      this.socketService.getPluginMessageSubscribable().subscribe(message => {
        if (message.plugin === BGS_PLUGIN) {
          this.handleBgsMessage(message.data as BgsGrblState);
        }
      }),
    );

    this.subscriptions.add(this.socketService.getLogLinesSubscribable().subscribe(lines => this.handleLogLines(lines)));
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopPolling();
    this.jogStopTimer();
  }

  //==== Status ====//

  public getStatus(): Observable<LaserStatus> {
    return this.statusSubject.asObservable();
  }

  public getStateChanges(): Observable<LaserState> {
    return this.statusSubject.pipe(
      map(status => status.state),
      distinctUntilChanged(),
    );
  }

  public get snapshot(): LaserStatus {
    return this.statusSubject.value;
  }

  private handleBgsMessage(data: BgsGrblState): void {
    if (!data || data.type !== 'grbl_state') return;
    const patch: Partial<LaserStatus> = {};

    if (data.state !== undefined) patch.grblState = String(data.state);
    if (data.speed !== undefined) patch.feed = Number(data.speed);
    if (data.power !== undefined) patch.power = Number(data.power);
    if (data.coolant !== undefined) patch.airAssist = data.coolant === 'M8' || data.coolant === 'M7';

    if (data.x !== undefined && data.y !== undefined && data.mode) {
      this.lastReportedMode = data.mode;
      this.lastReportedXY = { x: Number(data.x), y: Number(data.y) };
      Object.assign(patch, this.computePositions(this.statusSubject.value.wco));
    }

    this.publish(patch);
  }

  private handleLogLines(lines: string[]): void {
    let wco: XY = null;
    let raw: { state: string; mode: string; xy: XY } = null;
    let alarmCode: number = null;
    for (const line of lines) {
      const alarm = line.match(/ALARM:(\d+)/);
      if (alarm && !line.includes('<')) alarmCode = Number(alarm[1]);
      const wcoMatch = line.match(/WCO:(-?[\d.]+),(-?[\d.]+)/);
      if (wcoMatch) {
        wco = { x: Number(wcoMatch[1]), y: Number(wcoMatch[2]) };
      }
      const statusMatch = line.match(/<([A-Za-z]+(?::\d)?)\|([MW]Pos):(-?[\d.]+),(-?[\d.]+)/);
      if (statusMatch) {
        raw = {
          state: statusMatch[1],
          mode: statusMatch[2],
          xy: { x: Number(statusMatch[3]), y: Number(statusMatch[4]) },
        };
      }
    }
    const patch: Partial<LaserStatus> = {};
    if (alarmCode !== null) {
      // GRBL may stop answering status queries after a critical alarm: flag it right away
      patch.alarmCode = alarmCode;
      patch.grblState = 'Alarm';
      this.publish(patch);
    }
    if (raw) {
      // The raw status line can arrive before BGS's own message; use it to keep the DRO snappy.
      this.lastReportedMode = raw.mode;
      this.lastReportedXY = raw.xy;
      patch.grblState = raw.state;
    }
    if (wco) {
      patch.wco = wco;
      patch.wcoKnown = true;
    }
    if (raw && !raw.state.toLowerCase().startsWith('alarm')) patch.alarmCode = null;
    if (raw || wco) {
      Object.assign(patch, this.computePositions(wco ?? this.statusSubject.value.wco));
      this.publish(patch);
    }
  }

  private computePositions(wco: XY): Partial<LaserStatus> {
    if (!this.lastReportedXY) return {};
    const xy = this.lastReportedXY;
    if (this.lastReportedMode === 'WPos') {
      return { wpos: { ...xy }, mpos: { x: xy.x + wco.x, y: xy.y + wco.y } };
    }
    return { mpos: { ...xy }, wpos: { x: xy.x - wco.x, y: xy.y - wco.y } };
  }

  private publish(patch: Partial<LaserStatus>): void {
    const next: LaserStatus = { ...this.statusSubject.value, ...patch, updated: Date.now() };
    next.jobActive = [
      PrinterState.printing,
      PrinterState.paused,
      PrinterState.pausing,
      PrinterState.starting,
      PrinterState.resuming,
      PrinterState.finishing,
      PrinterState.cancelling,
    ].includes(this.printerState);
    next.pausing = this.printerState === PrinterState.pausing;
    next.state = this.deriveState(next);
    this.zone.run(() => this.statusSubject.next(next));

    if ([LaserState.jogging, LaserState.homing].includes(next.state)) {
      this.ensurePolling(1500);
    }
  }

  private deriveState(status: LaserStatus): LaserState {
    // OctoPrint states without a PrinterState mapping ("Offline", "Offline after error", "Error")
    if (this.printerState === undefined || this.printerState === null) return LaserState.offline;
    switch (this.printerState) {
      case PrinterState.closed:
      case PrinterState.socketDead:
        return LaserState.offline;
      case PrinterState.connecting:
      case PrinterState.reconnecting:
        return LaserState.connecting;
      default:
        break;
    }
    const grbl = (status.grblState || '').toLowerCase();
    if (grbl.startsWith('alarm')) return LaserState.alarm;
    if (grbl.startsWith('door')) return LaserState.door;
    if (this.printerState === PrinterState.paused || this.printerState === PrinterState.pausing)
      return LaserState.paused;
    if (grbl.startsWith('hold')) return LaserState.paused;
    if (
      [
        PrinterState.printing,
        PrinterState.starting,
        PrinterState.resuming,
        PrinterState.finishing,
        PrinterState.cancelling,
      ].includes(this.printerState)
    ) {
      return LaserState.running;
    }
    // GRBL "Run" outside an OctoPrint job = a move we sent (framing, go to origin)
    if (grbl.startsWith('run')) return LaserState.jogging;
    if (grbl.startsWith('jog')) return LaserState.jogging;
    if (grbl.startsWith('home')) return LaserState.homing;
    if (grbl.startsWith('sleep')) return LaserState.sleep;
    if (grbl.startsWith('check')) return LaserState.check;
    if (grbl.startsWith('idle')) return LaserState.idle;
    return this.printerState === PrinterState.operational ? LaserState.idle : LaserState.unknown;
  }

  //==== Fast status polling ====//
  // OctoPrint only polls GRBL once per second at best (via BGS's M105 rewrite). While the head
  // is moving outside a job we ask for "?" directly so the DRO and map follow the head.

  public ensurePolling(durationMs: number): void {
    this.pollUntil = Math.max(this.pollUntil, Date.now() + durationMs);
    if (this.pollTimer) return;
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => {
        if (Date.now() > this.pollUntil || this.snapshot.jobActive) {
          this.stopPolling();
          return;
        }
        if (this.pollInFlight) return;
        this.pollInFlight = true;
        this.http
          .post(
            this.configService.getApiURL('printer/command'),
            { commands: ['?'] },
            this.configService.getHTTPHeaders(),
          )
          .subscribe({ complete: () => (this.pollInFlight = false), error: () => (this.pollInFlight = false) });
      }, 250);
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  //==== Commands ====//

  public send(commands: string[], pollMs = 0): void {
    this.http
      .post(this.configService.getApiURL('printer/command'), { commands }, this.configService.getHTTPHeaders())
      .subscribe({
        error: err =>
          this.notificationService.error(tr('Não foi possível enviar o comando'), err?.message ?? String(err)),
      });
    if (pollMs) this.ensurePolling(pollMs);
  }

  public get canMove(): boolean {
    return [LaserState.idle, LaserState.jogging].includes(this.snapshot.state);
  }

  public home(): void {
    this.send(['$H'], 30000);
  }

  public unlock(): void {
    this.send(['$X'], 1000);
  }

  /** Relative jog by a fixed step, clamped to the bed when the position is known. */
  public jogStep(dx: number, dy: number): void {
    if (!this.canMove) return;
    const [cx, cy] = this.clampDelta(dx, dy);
    if (Math.abs(cx) < 1e-6 && Math.abs(cy) < 1e-6) return;
    this.send([this.jogCommand(cx, cy)], 4000);
  }

  /**
   * GRBL real-time "jog cancel" (0x85) sent inside an ordinary line. OctoPrint drops lines that
   * are only whitespace (Python treats U+0085 as whitespace) and BGS rewrites lines starting
   * with "?", so the byte travels between "M5" and "S0": GRBL acts on 0x85 the moment it
   * arrives, then runs "M5 S0" (laser off) once idle. Needs OctoPrint's latin_1 serial
   * encoding, which Better Grbl Support sets.
   */
  public static readonly JOG_CANCEL_LINE = 'M5 \u0085 S0';

  /**
   * Continuous jog: while the finger is down, short $J segments are queued (each ~300 ms of
   * travel at jog speed). A new segment is only sent when less than about one segment is still
   * pending, so on release the head stops at once (jog cancel) or, at worst, after one segment.
   * No tracked GRBL query ($I, $#, $G) is ever sent: those desynchronise BGS's response
   * tracking and stall its status polling.
   */
  public jogStart(dirX: number, dirY: number): void {
    if (!this.canMove) return;
    this.jogStopTimer();
    this.continuousDir = { x: Math.sign(dirX), y: Math.sign(dirY) };
    this.continuousJogActive = true;
    this.queuedOffset = { x: 0, y: 0 };
    this.jogStartPos = this.snapshot.mpos ? { ...this.snapshot.mpos } : null;
    const laser = this.configService.getLaser();
    const segment = Math.max((laser.jog.feed / 60) * 0.3, 0.2);

    const tick = () => {
      if (!this.continuousJogActive) return;
      const sent = Math.hypot(this.queuedOffset.x, this.queuedOffset.y);
      const live = this.snapshot.mpos;
      if (this.jogStartPos && live) {
        const travelled = Math.hypot(live.x - this.jogStartPos.x, live.y - this.jogStartPos.y);
        if (sent - travelled > segment * 1.2) return; // enough already queued
      } else if (sent >= laser.jog.continuousMax) {
        return; // unknown position: cap the total distance
      }
      const norm = this.continuousDir.x !== 0 && this.continuousDir.y !== 0 ? Math.SQRT1_2 : 1;
      const [cx, cy] = this.clampDelta(
        this.continuousDir.x * segment * norm,
        this.continuousDir.y * segment * norm,
        true,
      );
      if (Math.abs(cx) < 1e-3 && Math.abs(cy) < 1e-3) return; // at the bed edge
      this.send([this.jogCommand(cx, cy)], 1500);
      this.queuedOffset = { x: this.queuedOffset.x + cx, y: this.queuedOffset.y + cy };
    };
    tick();
    this.ensurePolling(60000);
    this.zone.runOutsideAngular(() => (this.continuousTimer = setInterval(tick, 100)));
  }

  public jogStop(): void {
    if (!this.continuousJogActive) return;
    this.continuousJogActive = false;
    this.jogStopTimer();
    this.send([LaserService.JOG_CANCEL_LINE], 2000);
  }

  private jogStopTimer(): void {
    if (this.continuousTimer) clearInterval(this.continuousTimer);
    this.continuousTimer = null;
  }

  private jogCommand(dx: number, dy: number): string {
    const feed = this.configService.getLaser().jog.feed;
    const parts = ['$J=G91 G21'];
    if (Math.abs(dx) > 1e-6) parts.push(`X${dx.toFixed(3)}`);
    if (Math.abs(dy) > 1e-6) parts.push(`Y${dy.toFixed(3)}`);
    parts.push(`F${Math.round(feed)}`);
    return parts.join(' ');
  }

  /**
   * Limit a relative move so the head stays on the bed. When moving diagonally and one axis is
   * clamped, the other is clamped proportionally (keeps the direction for continuous jogs).
   */
  private clampDelta(dx: number, dy: number, keepDirection = false): [number, number] {
    const live = this.snapshot.mpos;
    if (!live) return [dx, dy];
    const mpos =
      this.continuousJogActive && this.jogStartPos
        ? { x: this.jogStartPos.x + this.queuedOffset.x, y: this.jogStartPos.y + this.queuedOffset.y }
        : live;
    const bed = this.configService.getLaser().bed;
    // Never move further out of the bed; moving back towards it is always allowed.
    const limit = (pos: number, delta: number, min: number, size: number) => {
      if (delta < 0) return pos <= min ? 0 : Math.max(delta, min - pos);
      if (delta > 0) return pos >= min + size ? 0 : Math.min(delta, min + size - pos);
      return 0;
    };
    let cx = limit(mpos.x, dx, bed.xMin, bed.width);
    let cy = limit(mpos.y, dy, bed.yMin, bed.height);
    if (keepDirection && dx !== 0 && dy !== 0) {
      const ratio = Math.max(0, Math.min(cx / dx, cy / dy));
      cx = dx * ratio;
      cy = dy * ratio;
    }
    return [cx, cy];
  }

  /** Make the current head position the work origin (G54 X0 Y0). */
  public setOriginHere(): void {
    if (!this.canMove) return;
    this.send(['G10 L20 P1 X0 Y0'], 1500);
    const mpos = this.snapshot.mpos;
    if (mpos) {
      // Optimistic update; GRBL confirms with a WCO field in its next status report.
      this.publish({ wco: { ...mpos }, wcoKnown: true, wpos: { x: 0, y: 0 } });
    }
  }

  public goToOrigin(): void {
    if (!this.canMove) return;
    this.send(['M5', 'G90 G0 X0 Y0'], 8000);
  }

  /**
   * Trace the job's bounding box with the laser off (G0 only, after M5), then return to where
   * the head was. Bounds are in work coordinates.
   */
  public frame(bounds: Bounds): void {
    if (!this.canMove || !bounds) return;
    const start = this.snapshot.wpos;
    const f = (n: number) => n.toFixed(3);
    const commands = [
      'M5',
      'G90',
      `G0 X${f(bounds.minX)} Y${f(bounds.minY)}`,
      `G0 X${f(bounds.maxX)} Y${f(bounds.minY)}`,
      `G0 X${f(bounds.maxX)} Y${f(bounds.maxY)}`,
      `G0 X${f(bounds.minX)} Y${f(bounds.maxY)}`,
      `G0 X${f(bounds.minX)} Y${f(bounds.minY)}`,
    ];
    if (start) commands.push(`G0 X${f(start.x)} Y${f(start.y)}`);
    this.send(commands, 30000);
  }

  /** Whether a job (bounds in work coordinates) fits on the bed with the current origin. */
  public fitsOnBed(bounds: Bounds): boolean | null {
    if (!bounds) return null;
    const status = this.snapshot;
    if (!status.wcoKnown && !status.mpos) return null;
    const bed = this.configService.getLaser().bed;
    const wco = status.wco;
    const eps = 0.001;
    return (
      bounds.minX + wco.x >= bed.xMin - eps &&
      bounds.maxX + wco.x <= bed.xMin + bed.width + eps &&
      bounds.minY + wco.y >= bed.yMin - eps &&
      bounds.maxY + wco.y <= bed.yMin + bed.height + eps
    );
  }

  /**
   * Short test pulse with firmware timing: in GRBL laser mode ($32=1) the beam only fires while
   * moving, so the pulse is a 0.1 mm G1 move whose feed makes it last testFire.durationMs.
   */
  public testFire(): void {
    if (!this.canMove) return;
    const laser = this.configService.getLaser();
    const s = Math.round((laser.testFire.power / 100) * laser.maxPower);
    const feed = (0.1 * 60000) / laser.testFire.durationMs;
    this.send(['G91', `M3 S${s}`, `G1 X0.1 F${feed.toFixed(3)}`, 'M5', 'G90'], 2000);
  }
}
