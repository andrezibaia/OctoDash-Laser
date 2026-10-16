import { Directive, ElementRef, EventEmitter, HostListener, Input, NgZone, OnDestroy, Output } from '@angular/core';

/**
 * Press-and-hold to trigger. While held, the host gets the CSS custom property
 * --hold (0..1) and the class "lz-holding", so the button can render a fill.
 * Releasing early cancels. Used for Stop (1 s) and the test fire pulse.
 */
@Directive({
  selector: '[lzHold]',
  standalone: false,
})
export class LzHoldDirective implements OnDestroy {
  @Input() public lzHoldMs = 1000;
  @Input() public lzHoldDisabled = false;
  @Output() public lzHold = new EventEmitter<void>();

  private start = 0;
  private frame: number = null;
  private fired = false;

  public constructor(
    private element: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  @HostListener('pointerdown', ['$event'])
  public onDown(event: PointerEvent): void {
    if (this.lzHoldDisabled) return;
    event.preventDefault();
    try {
      this.element.nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore: capture is only a convenience
    }
    this.start = performance.now();
    this.fired = false;
    this.element.nativeElement.classList.add('lz-holding');
    this.zone.runOutsideAngular(() => this.tick());
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  @HostListener('lostpointercapture')
  public onUp(): void {
    this.reset();
  }

  private tick(): void {
    const progress = Math.min((performance.now() - this.start) / this.lzHoldMs, 1);
    this.element.nativeElement.style.setProperty('--hold', String(progress));
    if (progress >= 1) {
      if (!this.fired) {
        this.fired = true;
        this.zone.run(() => this.lzHold.emit());
      }
      this.reset();
      return;
    }
    this.frame = requestAnimationFrame(() => this.tick());
  }

  private reset(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.element.nativeElement.classList.remove('lz-holding');
    this.element.nativeElement.style.setProperty('--hold', '0');
  }

  public ngOnDestroy(): void {
    this.reset();
  }
}
