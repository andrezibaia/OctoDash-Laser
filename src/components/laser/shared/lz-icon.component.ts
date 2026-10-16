import { Component, Input } from '@angular/core';

type Shape =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number };

const p = (d: string): Shape => ({ t: 'path', d });
const c = (cx: number, cy: number, r: number): Shape => ({ t: 'circle', cx, cy, r });
const r = (x: number, y: number, w: number, h: number, rx = 0): Shape => ({ t: 'rect', x, y, w, h, rx });

export const LZ_ICONS: Record<string, Shape[]> = {
  home: [p('M3 11l9-7 9 7'), p('M5 10v10h14V10'), p('M10 20v-6h4v6')],
  unlock: [r(4, 11, 16, 10, 2), p('M8 11V7a4 4 0 0 1 7.5-2')],
  move: [p('M12 2v20M2 12h20'), p('M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3')],
  folder: [p('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')],
  camera: [p('M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), c(12, 13, 4)],
  map: [r(3, 4, 18, 16, 2), p('M3 10h18M3 15h18M9 4v16M15 4v16')],
  target: [c(12, 12, 8), c(12, 12, 2.5), p('M12 1v4M12 19v4M1 12h4M19 12h4')],
  pin: [p('M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z'), c(12, 10, 2.5)],
  bolt: [p('M13 2L4 14h7l-1 8 9-12h-7z')],
  wind: [p('M3 8h11a3 3 0 1 0-3-3'), p('M3 12h16a3 3 0 1 1-3 3'), p('M3 16h7')],
  pause: [r(6, 4, 4, 16, 1), r(14, 4, 4, 16, 1)],
  play: [p('M7 4l13 8-13 8z')],
  stop: [r(5, 5, 14, 14, 2)],
  gear: [
    c(12, 12, 3),
    p(
      'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 ' +
        '1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1' +
        '.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7' +
        ' 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0' +
        ' 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    ),
  ],
  frame: [p('M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4')],
  check: [p('M5 12.5l4.5 4.5L19 7')],
  x: [p('M6 6l12 12M18 6L6 18')],
  back: [p('M15 5l-7 7 7 7')],
  up: [p('M12 19V5M6 11l6-6 6 6')],
  down: [p('M12 5v14M6 13l6 6 6-6')],
  left: [p('M19 12H5M11 6l-6 6 6 6')],
  right: [p('M5 12h14M13 6l6 6-6 6')],
  ul: [p('M17 17L7 7M7 15V7h8')],
  ur: [p('M7 17L17 7M9 7h8v8')],
  dl: [p('M17 7L7 17M15 17H7V9')],
  dr: [p('M7 7l10 10M17 9v8H9')],
  alert: [p('M12 3l10 18H2z'), p('M12 10v5M12 18v.5')],
  dots: [c(5, 12, 1.3), c(12, 12, 1.3), c(19, 12, 1.3)],
  door: [r(3, 11, 18, 9, 1.5), p('M3 11l3-6h12l3 6')],
  power: [p('M12 3v9'), p('M6.3 6.3a8 8 0 1 0 11.4 0')],
  reload: [p('M20 12a8 8 0 1 1-2.3-5.7'), p('M20 4v5h-5')],
  list: [p('M8 6h12M8 12h12M8 18h12'), c(4, 6, 0.8), c(4, 12, 0.8), c(4, 18, 0.8)],
};

@Component({
  selector: 'lz-icon',
  template: `<svg
    viewBox="0 0 24 24"
    class="lz-icon"
    [class.lz-icon--sm]="size === 'sm'"
    [class.lz-icon--lg]="size === 'lg'"
    aria-hidden="true">
    @for (s of shapes; track $index) {
      @switch (s.t) {
        @case ('path') {
          <svg:path [attr.d]="$any(s).d" />
        }
        @case ('circle') {
          <svg:circle [attr.cx]="$any(s).cx" [attr.cy]="$any(s).cy" [attr.r]="$any(s).r" />
        }
        @case ('rect') {
          <svg:rect
            [attr.x]="$any(s).x"
            [attr.y]="$any(s).y"
            [attr.width]="$any(s).w"
            [attr.height]="$any(s).h"
            [attr.rx]="$any(s).rx" />
        }
      }
    }
  </svg>`,
  styles: [':host { display: inline-flex; }'],
  standalone: false,
})
export class LzIconComponent {
  @Input() public name: string;
  @Input() public size: 'sm' | 'md' | 'lg' = 'md';

  public get shapes(): Shape[] {
    return LZ_ICONS[this.name] ?? [];
  }
}
