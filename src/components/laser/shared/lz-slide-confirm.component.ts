import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

/** Slide-to-confirm control: the knob must be dragged past 85 % of the track. */
@Component({
  selector: 'lz-slide-confirm',
  template: `
    <div
      #track
      class="track"
      [class.track--warn]="tone === 'warn'"
      [class.track--disabled]="disabled"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up()"
      (pointercancel)="up()">
      <div class="fill" [style.width.px]="offset + knobSize"></div>
      <span class="label" [style.opacity]="1 - progress * 1.4">{{ label }}</span>
      <div class="knob" [class.knob--dragging]="dragging" [style.transform]="'translateX(' + offset + 'px)'">
        <lz-icon name="play"></lz-icon>
      </div>
    </div>
  `,
  styleUrls: ['./lz-slide-confirm.component.scss'],
  standalone: false,
})
export class LzSlideConfirmComponent {
  @ViewChild('track') private track: ElementRef<HTMLElement>;
  @Input() public label = 'Deslizar para iniciar';
  @Input() public tone: 'normal' | 'warn' = 'normal';
  @Input() public disabled = false;
  @Output() public confirmed = new EventEmitter<void>();

  public offset = 0;
  public dragging = false;
  public knobSize = 60;
  private startX = 0;
  private maxOffset = 1;

  public get progress(): number {
    return this.offset / this.maxOffset;
  }

  public down(event: PointerEvent): void {
    if (this.disabled) return;
    const trackEl = this.track.nativeElement;
    const knob = trackEl.querySelector('.knob') as HTMLElement;
    const knobRect = knob.getBoundingClientRect();
    if (event.clientX > knobRect.right + 20) return; // must grab the knob (or just next to it)
    try {
      trackEl.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
    this.knobSize = knobRect.width;
    this.maxOffset = trackEl.getBoundingClientRect().width - knobRect.width - 10;
    this.startX = event.clientX - this.offset;
    this.dragging = true;
  }

  public move(event: PointerEvent): void {
    if (!this.dragging) return;
    this.offset = Math.min(Math.max(event.clientX - this.startX, 0), this.maxOffset);
  }

  public up(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.offset >= this.maxOffset * 0.85) {
      this.offset = this.maxOffset;
      this.confirmed.emit();
      setTimeout(() => (this.offset = 0), 600);
    } else {
      this.offset = 0;
    }
  }
}
