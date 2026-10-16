import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LaserStatus } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { LaserService } from '../../../services/laser/laser.service';
import { LaserJobService } from '../../../services/laser/laser-job.service';
import { formatMm } from '../shared/lz-format';

@Component({
  selector: 'app-laser-camera',
  template: `
    <div class="lz-screen">
      <div class="lz-screen__canvas">
        <lz-camera class="cam" [url]="url"></lz-camera>
        <lz-status-bar [back]="true" [title]="'Câmara' | lzt" [overlay]="true"></lz-status-bar>
        <div class="pos lz-mono">X {{ fmt(status?.wpos?.x) }} &nbsp;Y {{ fmt(status?.wpos?.y) }}</div>
        <div class="bar">
          <button class="lz-btn dark" [class.lz-btn--disabled]="!canMove" (click)="go('/jog')">
            <lz-icon name="move"></lz-icon>{{ 'Mover' | lzt }}
          </button>
          <button class="lz-btn lz-btn--amber" [class.lz-btn--disabled]="!canMove" (click)="setOrigin()">
            <lz-icon name="target"></lz-icon>{{ 'Origem aqui' | lzt }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .cam {
        position: absolute;
        inset: 0;
      }
      .pos {
        position: absolute;
        right: calc(12 * var(--u));
        top: calc(54 * var(--u));
        background: rgb(17 19 21 / 85%);
        border-radius: calc(8 * var(--u));
        padding: calc(6 * var(--u)) calc(12 * var(--u));
        font-size: calc(17 * var(--u));
      }
      .bar {
        position: absolute;
        right: calc(12 * var(--u));
        bottom: calc(12 * var(--u));
        display: flex;
        gap: calc(10 * var(--u));
      }
      .bar .lz-btn {
        height: calc(64 * var(--u));
        padding: 0 calc(22 * var(--u));
      }
      .dark {
        background: rgb(35 39 43 / 92%);
      }
    `,
  ],
  standalone: false,
})
export class LaserCameraComponent implements OnInit, OnDestroy {
  public url: string;
  public status: LaserStatus;
  public fmt = formatMm;
  private sub: Subscription;

  public constructor(
    private laserService: LaserService,
    private jobService: LaserJobService,
    private configService: ConfigService,
    private router: Router,
  ) {
    const camera = this.configService.getLaser().camera;
    this.url = camera.enabled ? camera.url : '';
  }

  public ngOnInit(): void {
    this.sub = this.laserService.getStatus().subscribe(status => (this.status = status));
  }

  public ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  public get canMove(): boolean {
    return this.laserService.canMove;
  }

  public setOrigin(): void {
    this.laserService.setOriginHere();
    this.jobService.resetFramed();
  }

  public go(path: string): void {
    this.router.navigate([path]);
  }
}
