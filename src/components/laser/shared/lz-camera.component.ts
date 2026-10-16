import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';

/**
 * Live camera (MJPEG, e.g. go2rtc). The stream is torn down on destroy so the Pi
 * doesn't keep decoding frames for a hidden view.
 */
@Component({
  selector: 'lz-camera',
  template: `
    @if (url && !failed) {
      <img #img [src]="src" [alt]="'Câmara' | lzt" (error)="onError()" (load)="loaded = true" />
    }
    @if (!url) {
      <div class="msg">
        <lz-icon name="camera" size="lg"></lz-icon>
        <span>{{ 'Câmara não configurada' | lzt }}</span>
      </div>
    } @else if (failed) {
      <div class="msg">
        <lz-icon name="camera" size="lg"></lz-icon>
        <span>{{ 'Câmara indisponível' | lzt }}</span>
        <button class="lz-btn retry" (click)="retry()">{{ 'Tentar de novo' | lzt }}</button>
      </div>
    } @else if (!loaded) {
      <div class="msg">
        <span class="loading-dots">{{ 'A ligar à câmara' | lzt }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        background: #000;
        overflow: hidden;
      }
      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .msg {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: calc(10 * var(--u));
        color: var(--lz-muted);
        font-size: calc(16 * var(--u));
      }
      .retry {
        height: calc(48 * var(--u));
        padding: 0 calc(20 * var(--u));
      }
    `,
  ],
  standalone: false,
})
export class LzCameraComponent implements OnChanges, OnDestroy {
  @ViewChild('img') private img: ElementRef<HTMLImageElement>;
  @Input() public url: string;

  public src = '';
  public failed = false;
  public loaded = false;

  public ngOnChanges(): void {
    this.retry();
  }

  public retry(): void {
    this.failed = false;
    this.loaded = false;
    if (!this.url) return;
    const sep = this.url.includes('?') ? '&' : '?';
    this.src = `${this.url}${sep}_=${Date.now()}`;
  }

  public onError(): void {
    this.failed = true;
  }

  public ngOnDestroy(): void {
    if (this.img?.nativeElement) {
      this.img.nativeElement.src = 'about:blank';
    }
  }
}
