import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { Bounds, LaserStatus, ParsedGcode, XY } from '../../../model';
import { BedGeometry } from '../../../services/laser/bed-geometry';
import { LaserService } from '../../../services/laser/laser.service';

const COLORS = {
  grid: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.09)',
  label: '#5f676f',
  pathDim: '#3d444b',
  path: '#ffad33',
  travel: 'rgba(98,198,242,0.18)',
  bounds: 'rgba(255,173,51,0.9)',
  boundsFill: 'rgba(255,173,51,0.07)',
  boundsBad: 'rgba(255,74,61,0.95)',
  origin: '#ffad33',
  head: '#62c6f2',
  home: 'rgba(232,236,240,0.55)',
};

/**
 * Bed map: grid, job toolpath (optionally with progress), work origin and laser head.
 * Two stacked canvases: a base layer (grid + path, redrawn rarely and extended
 * incrementally for progress) and an overlay (origin + head, redrawn on every status).
 */
@Component({
  selector: 'lz-bed-map',
  template: `
    <canvas #base class="layer"></canvas>
    <canvas #overlay class="layer"></canvas>
    @if (showLabels) {
      <span class="lbl lbl--size lz-mono" [class.lbl--left]="homeCorner === 'top-right'">{{ sizeLabel }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        background: var(--lz-s1);
        border: calc(1 * var(--u)) solid var(--lz-line);
        border-radius: calc(8 * var(--u));
        overflow: hidden;
      }
      .layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .lbl {
        position: absolute;
        font-size: calc(11 * var(--u));
        color: var(--lz-dim);
        pointer-events: none;
      }
      .lbl--size {
        right: calc(6 * var(--u));
        top: calc(4 * var(--u));
      }
      .lbl--size.lbl--left {
        right: auto;
        left: calc(6 * var(--u));
      }
    `,
  ],
  standalone: false,
})
export class LzBedMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('base') private baseCanvas: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlay') private overlayCanvas: ElementRef<HTMLCanvasElement>;

  @Input() public parsed: ParsedGcode | null = null;
  /** Index of the last completed segment; -1 = no progress shown (full path in amber). */
  @Input() public progressIndex = -1;
  @Input() public showProgress = false;
  @Input() public showTravel = false;
  @Input() public showLabels = true;
  @Input() public highlightBounds = true;
  /** When true, the head is drawn at the progress position instead of the live position. */
  @Input() public headFromProgress = false;

  public sizeLabel = '';
  public homeCorner = 'top-left';

  private status: LaserStatus;
  private bed: BedGeometry;
  private sub: Subscription;
  private geoSub: Subscription;
  private resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private baseKey = '';
  private drawnProgress = -1;
  private pendingFrame: number = null;

  public constructor(
    private host: ElementRef<HTMLElement>,
    private laserService: LaserService,
    private zone: NgZone,
  ) {
    this.setGeometry(this.laserService.geometry);
  }

  private setGeometry(bed: BedGeometry): void {
    this.bed = bed;
    this.sizeLabel = `${bed.width}×${bed.height}`;
    this.homeCorner = bed.homeCorner;
  }

  public ngAfterViewInit(): void {
    this.sub = this.laserService.getStatus().subscribe(status => {
      const wcoChanged = !this.status || this.status.wco.x !== status.wco.x || this.status.wco.y !== status.wco.y;
      this.status = status;
      if (wcoChanged) this.baseKey = '';
      this.scheduleDraw();
    });
    this.geoSub = this.laserService.getGeometry().subscribe(bed => {
      this.setGeometry(bed);
      this.baseKey = '';
      this.scheduleDraw();
    });
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        this.baseKey = '';
        this.scheduleDraw();
      });
      this.resizeObserver.observe(this.host.nativeElement);
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['parsed'] || changes['showProgress'] || changes['showTravel'] || changes['highlightBounds']) {
      this.baseKey = '';
    }
    this.scheduleDraw();
  }

  public ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.geoSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
  }

  private scheduleDraw(): void {
    if (this.pendingFrame !== null || !this.baseCanvas) return;
    this.zone.runOutsideAngular(() => {
      this.pendingFrame = requestAnimationFrame(() => {
        this.pendingFrame = null;
        this.draw();
      });
    });
  }

  //==== geometry ====//

  private layout(): boolean {
    const rect = this.host.nativeElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const dpr = window.devicePixelRatio || 1;
    if (rect.width !== this.width || rect.height !== this.height || dpr !== this.dpr) {
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = dpr;
      for (const canvas of [this.baseCanvas.nativeElement, this.overlayCanvas.nativeElement]) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      this.baseKey = '';
    }
    const bed = this.bed;
    const pad = 10;
    this.scale = Math.min((this.width - pad * 2) / bed.width, (this.height - pad * 2) / bed.height);
    this.offsetX = (this.width - bed.width * this.scale) / 2;
    this.offsetY = (this.height - bed.height * this.scale) / 2;
    return true;
  }

  /** Machine coordinates → canvas CSS pixels */
  private toScreen(mx: number, my: number): [number, number] {
    const bed = this.bed;
    const sx = bed.xRight
      ? this.offsetX + (mx - bed.xMin) * this.scale
      : this.offsetX + (bed.xMin + bed.width - mx) * this.scale;
    const sy = bed.yUp
      ? this.offsetY + (bed.yMin + bed.height - my) * this.scale
      : this.offsetY + (my - bed.yMin) * this.scale;
    return [sx, sy];
  }

  private get wco(): XY {
    return this.status?.wco ?? { x: 0, y: 0 };
  }

  //==== drawing ====//

  private draw(): void {
    if (!this.layout()) return;
    const key = `${this.width}x${this.height}|${this.wco.x},${this.wco.y}|${this.showProgress}|${this.showTravel}|${JSON.stringify(this.bed)}`;
    if (key !== this.baseKey) {
      this.baseKey = key;
      this.drawnProgress = -1;
      this.drawBase();
    }
    if (this.showProgress && this.parsed && this.progressIndex > this.drawnProgress) {
      this.drawPathRange(this.baseCtx(), this.drawnProgress + 1, this.progressIndex, COLORS.path);
      this.drawnProgress = this.progressIndex;
    } else if (this.showProgress && this.progressIndex < this.drawnProgress) {
      this.baseKey = '';
      this.draw();
      return;
    }
    this.drawOverlay();
  }

  private baseCtx(): CanvasRenderingContext2D {
    const ctx = this.baseCanvas.nativeElement.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return ctx;
  }

  private drawBase(): void {
    const ctx = this.baseCtx();
    ctx.clearRect(0, 0, this.width, this.height);
    const bed = this.bed;

    // grid every 10 mm, stronger every 50 mm
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= bed.width + 0.001; gx += 10) {
      const [x] = this.toScreen(bed.xMin + gx, bed.yMin);
      ctx.strokeStyle = gx % 50 === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, this.offsetY);
      ctx.lineTo(Math.round(x) + 0.5, this.offsetY + bed.height * this.scale);
      ctx.stroke();
    }
    for (let gy = 0; gy <= bed.height + 0.001; gy += 10) {
      const [, y] = this.toScreen(bed.xMin, bed.yMin + gy);
      ctx.strokeStyle = gy % 50 === 0 ? COLORS.gridMajor : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, Math.round(y) + 0.5);
      ctx.lineTo(this.offsetX + bed.width * this.scale, Math.round(y) + 0.5);
      ctx.stroke();
    }

    if (!this.parsed) return;

    const bounds = this.parsed.burnBounds ?? this.parsed.moveBounds;
    if (bounds && this.highlightBounds) {
      this.drawBounds(ctx, bounds);
    }

    if (this.showTravel) {
      this.drawPathRange(ctx, 0, this.parsed.segmentCount - 1, COLORS.travel, 0);
    }
    this.drawPathRange(ctx, 0, this.parsed.segmentCount - 1, this.showProgress ? COLORS.pathDim : COLORS.path);
  }

  private drawBounds(ctx: CanvasRenderingContext2D, b: Bounds): void {
    const fits = this.laserService.fitsOnBed(b);
    const [x0, y0] = this.toScreen(b.minX + this.wco.x, b.minY + this.wco.y);
    const [x1, y1] = this.toScreen(b.maxX + this.wco.x, b.maxY + this.wco.y);
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    ctx.fillStyle = fits === false ? 'rgba(255,74,61,0.08)' : COLORS.boundsFill;
    ctx.fillRect(left, top, w, h);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = fits === false ? COLORS.boundsBad : COLORS.bounds;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, top, w, h);
    ctx.setLineDash([]);
  }

  /** Draw segments [from, to]; burnFilter 1 = only burning moves, 0 = only travel moves. */
  private drawPathRange(ctx: CanvasRenderingContext2D, from: number, to: number, color: string, burnFilter = 1): void {
    if (!this.parsed || to < from) return;
    const s = this.parsed.segments;
    const wx = this.wco.x;
    const wy = this.wco.y;
    ctx.strokeStyle = color;
    ctx.lineWidth = burnFilter ? 1.6 : 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let lastX = NaN;
    let lastY = NaN;
    for (let i = Math.max(from, 0); i <= Math.min(to, this.parsed.segmentCount - 1); i++) {
      const k = i * 5;
      if (s[k + 4] !== burnFilter) continue;
      const [ax, ay] = this.toScreen(s[k] + wx, s[k + 1] + wy);
      const [bx, by] = this.toScreen(s[k + 2] + wx, s[k + 3] + wy);
      if (Math.abs(ax - lastX) > 0.3 || Math.abs(ay - lastY) > 0.3) ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      lastX = bx;
      lastY = by;
    }
    ctx.stroke();
  }

  /** Home position: small house glyph where the head parks after $H */
  private drawHome(ctx: CanvasRenderingContext2D): void {
    const home = this.bed.home;
    if (!home) return;
    const [hx, hy] = this.toScreen(home.x, home.y);
    const s = 7;
    ctx.save();
    ctx.strokeStyle = COLORS.home;
    ctx.fillStyle = 'rgba(232,236,240,0.12)';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - s, hy - 1);
    ctx.lineTo(hx, hy - s - 2);
    ctx.lineTo(hx + s, hy - 1);
    ctx.lineTo(hx + s - 1.5, hy - 1);
    ctx.lineTo(hx + s - 1.5, hy + s);
    ctx.lineTo(hx - s + 1.5, hy + s);
    ctx.lineTo(hx - s + 1.5, hy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Small mono label placed on the side of (x, y) that points into the bed */
  private drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    const midX = this.offsetX + (this.bed.width * this.scale) / 2;
    const midY = this.offsetY + (this.bed.height * this.scale) / 2;
    ctx.save();
    ctx.font = `500 ${Math.round(Math.max(10, this.scale * 3.4))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = x <= midX ? 'left' : 'right';
    ctx.textBaseline = y <= midY ? 'top' : 'bottom';
    ctx.fillText(text, x + (x <= midX ? 10 : -10), y + (y <= midY ? 8 : -8));
    ctx.restore();
  }

  private drawOverlay(): void {
    const ctx = this.overlayCanvas.nativeElement.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawHome(ctx);

    // work origin (diamond) + "0,0" label next to it, inside the bed
    if (this.status?.wcoKnown || this.status?.mpos) {
      const [ox, oy] = this.toScreen(this.wco.x, this.wco.y);
      ctx.strokeStyle = COLORS.origin;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 7);
      ctx.lineTo(ox + 7, oy);
      ctx.lineTo(ox, oy + 7);
      ctx.lineTo(ox - 7, oy);
      ctx.closePath();
      ctx.stroke();
      if (this.showLabels) this.drawLabel(ctx, '0,0', ox, oy, COLORS.origin);
    }

    // head (crosshair)
    let head: XY = null;
    if (this.headFromProgress && this.parsed && this.progressIndex >= 0) {
      const k = Math.min(this.progressIndex, this.parsed.segmentCount - 1) * 5;
      head = { x: this.parsed.segments[k + 2] + this.wco.x, y: this.parsed.segments[k + 3] + this.wco.y };
    } else if (this.status?.mpos) {
      head = this.status.mpos;
    }
    if (head) {
      const [hx, hy] = this.toScreen(head.x, head.y);
      const color = this.headFromProgress ? COLORS.path : COLORS.head;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 13, hy);
      ctx.lineTo(hx - 5, hy);
      ctx.moveTo(hx + 5, hy);
      ctx.lineTo(hx + 13, hy);
      ctx.moveTo(hx, hy - 13);
      ctx.lineTo(hx, hy - 5);
      ctx.moveTo(hx, hy + 5);
      ctx.lineTo(hx, hy + 13);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
