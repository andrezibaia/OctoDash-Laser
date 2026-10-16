import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { JobStatus, LaserState, LaserStatus, ParsedGcode } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { segmentIndexAt } from '../../../services/laser/gcode-parser';
import { LaserService } from '../../../services/laser/laser.service';
import { tr } from '../../../services/laser/laser-i18n';
import { LaserJobService } from '../../../services/laser/laser-job.service';
import { SocketService } from '../../../services/socket/socket.service';
import { formatDuration, formatSize } from '../shared/lz-format';

const VIEW_KEY = 'lz-job-view';

@Component({
  selector: 'app-laser-running',
  templateUrl: './laser-running.component.html',
  styleUrls: ['./laser-running.component.scss'],
  standalone: false,
})
export class LaserRunningComponent implements OnInit, OnDestroy {
  public status: LaserStatus;
  public job: JobStatus;
  public parsed: ParsedGcode = null;
  public progressIndex = -1;
  public view: 'map' | 'camera' = 'map';
  public cameraUrl = '';
  public cameraEnabled = true;
  public finished: 'done' | 'stopped' | null = null;
  public fmtTime = formatDuration;
  public fmtSize = formatSize;
  public LaserState = LaserState;
  private parsedFor = '';
  private lastActiveJob: JobStatus = null;
  private wasActive = false;
  private subs = new Subscription();

  public constructor(
    private laserService: LaserService,
    private jobService: LaserJobService,
    private socketService: SocketService,
    private configService: ConfigService,
    private router: Router,
  ) {
    const camera = this.configService.getLaser().camera;
    this.cameraEnabled = camera.enabled && !!camera.url;
    this.cameraUrl = camera.url;
    this.view = localStorage.getItem(VIEW_KEY) === 'camera' && this.cameraEnabled ? 'camera' : 'map';
  }

  public ngOnInit(): void {
    this.subs.add(
      this.laserService.getStatus().subscribe(status => {
        this.status = status;
        if (status.jobActive) {
          this.wasActive = true;
          this.finished = null;
        } else if (this.wasActive && !this.finished) {
          // job just ended: freeze the last numbers we saw while it was running
          this.wasActive = false;
          this.finished = (this.lastActiveJob?.progress ?? 0) >= 99 ? 'done' : 'stopped';
          if (this.lastActiveJob) this.job = { ...this.lastActiveJob };
          if (this.finished === 'done' && this.parsed) this.progressIndex = this.parsed.segmentCount - 1;
        }
      }),
    );
    this.subs.add(
      this.socketService.getJobStatusSubscribable().subscribe(job => {
        if (!job) return;
        // keep the last numbers on screen once the job has ended (OctoPrint resets them)
        if (this.finished && this.job) return;
        this.job = { ...job };
        if (this.status?.jobActive) this.lastActiveJob = { ...job };
        this.loadParsed(job.fullPath);
        this.updateProgress();
      }),
    );
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private loadParsed(fullPath: string): void {
    if (!fullPath || fullPath === this.parsedFor || fullPath.endsWith('/undefined')) return;
    this.parsedFor = fullPath;
    this.jobService.findByPath(fullPath).then(file => {
      if (!file) return;
      this.jobService.getParsed(file).then(parsed => {
        if (this.parsedFor === fullPath) {
          this.parsed = parsed;
          this.updateProgress();
        }
      });
    });
  }

  private updateProgress(): void {
    if (!this.parsed || !this.job || this.job.filepos === null || this.job.filepos === undefined) return;
    this.progressIndex = segmentIndexAt(this.parsed, this.job.filepos);
  }

  public get active(): boolean {
    return !!this.status?.jobActive;
  }

  public get paused(): boolean {
    return this.status?.state === LaserState.paused;
  }

  public get percent(): number {
    if (this.finished === 'done') return 100;
    return Math.max(0, Math.min(100, Math.round(this.job?.progress ?? 0)));
  }

  public get endsAt(): string {
    const left = this.timeLeft;
    if (left === null || !this.active) return '';
    const d = new Date(Date.now() + left * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  public get pausing(): boolean {
    return !!this.status?.pausing;
  }

  public get headline(): string {
    if (this.finished === 'done') return tr('Concluído');
    if (this.finished === 'stopped') return tr('Parado');
    if (!this.active) return tr('Sem trabalho em curso');
    if (this.pausing) return tr('A pausar…');
    return tr(this.paused ? 'Em pausa' : 'A trabalhar');
  }

  /**
   * Remaining time from our own G-code estimate (handles arcs and rapids), scaled by the
   * share of segments still to run; falls back to OctoPrint's estimate.
   */
  public get timeLeft(): number | null {
    if (!this.active) return null;
    if (this.parsed && this.parsed.segmentCount > 0 && this.progressIndex >= 0) {
      const done = (this.progressIndex + 1) / this.parsed.segmentCount;
      return Math.max(0, this.parsed.estimatedSeconds * (1 - done));
    }
    return this.job?.printTimeLeftSeconds ?? null;
  }

  public setView(view: 'map' | 'camera'): void {
    this.view = view;
    localStorage.setItem(VIEW_KEY, view);
  }

  public togglePause(): void {
    if (this.pausing) return;
    if (this.paused) this.jobService.resume();
    else this.jobService.pause();
  }

  public stop(): void {
    this.jobService.cancel();
  }

  public goHome(): void {
    this.router.navigate(['/main-screen']);
  }

  public again(): void {
    this.router.navigate(['/jobs'], { queryParams: { keep: 1 } });
  }
}
