import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LaserState, LaserStatus } from '../../../model';
import { LaserService } from '../../../services/laser/laser.service';

export const LASER_STATE_LABEL: Record<LaserState, string> = {
  [LaserState.offline]: 'Sem ligação',
  [LaserState.connecting]: 'A ligar',
  [LaserState.idle]: 'Pronto',
  [LaserState.running]: 'A trabalhar',
  [LaserState.paused]: 'Em pausa',
  [LaserState.jogging]: 'Em movimento',
  [LaserState.homing]: 'Home',
  [LaserState.alarm]: 'Alarme',
  [LaserState.door]: 'Porta aberta',
  [LaserState.sleep]: 'Em repouso',
  [LaserState.check]: 'Verificação',
  [LaserState.unknown]: '—',
};

export const LASER_STATE_TONE: Record<LaserState, 'green' | 'amber' | 'red' | 'cyan' | 'grey'> = {
  [LaserState.offline]: 'red',
  [LaserState.connecting]: 'grey',
  [LaserState.idle]: 'green',
  [LaserState.running]: 'amber',
  [LaserState.paused]: 'cyan',
  [LaserState.jogging]: 'cyan',
  [LaserState.homing]: 'cyan',
  [LaserState.alarm]: 'red',
  [LaserState.door]: 'red',
  [LaserState.sleep]: 'grey',
  [LaserState.check]: 'cyan',
  [LaserState.unknown]: 'grey',
};

@Component({
  selector: 'lz-status-bar',
  template: `
    <div class="bar" [class.bar--overlay]="overlay">
      @if (back) {
        <button class="back" (click)="goBack()" aria-label="Voltar"><lz-icon name="back"></lz-icon></button>
      }
      @if (title) {
        <div class="title">
          {{ title }}
          @if (subtitle) {
            <span class="title__sub">· {{ subtitle }}</span>
          }
        </div>
      }
      <div class="pill pill--{{ tone }}" [class.pill--lead]="!back && !title"><i></i>{{ label }}</div>
      <div class="right">
        <ng-content></ng-content>
        @if (status?.airAssist) {
          <div class="chip chip--on"><lz-icon name="wind" size="sm"></lz-icon>Ar</div>
        }
        <div class="clock lz-mono">{{ clock }}</div>
      </div>
    </div>
  `,
  styleUrls: ['./lz-status-bar.component.scss'],
  standalone: false,
})
export class LzStatusBarComponent implements OnInit, OnDestroy {
  @Input() public back = false;
  @Input() public backTo = '/main-screen';
  @Input() public title: string;
  @Input() public subtitle: string;
  @Input() public overlay = false;

  public status: LaserStatus;
  public clock = '';
  private sub: Subscription;
  private clockTimer: ReturnType<typeof setInterval>;

  public constructor(
    private laserService: LaserService,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.sub = this.laserService.getStatus().subscribe(status => (this.status = status));
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 10000);
  }

  public ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearInterval(this.clockTimer);
  }

  private updateClock(): void {
    const now = new Date();
    this.clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  public get label(): string {
    if (this.status?.pausing) return 'A pausar';
    return this.status ? LASER_STATE_LABEL[this.status.state] : '';
  }

  public get tone(): string {
    return this.status ? LASER_STATE_TONE[this.status.state] : 'grey';
  }

  public goBack(): void {
    this.router.navigate([this.backTo]);
  }
}
