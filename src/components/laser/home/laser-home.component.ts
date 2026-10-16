import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LaserState, LaserStatus } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { LaserService } from '../../../services/laser/laser.service';
import { tr } from '../../../services/laser/laser-i18n';
import { LaserJobService, SelectedJob } from '../../../services/laser/laser-job.service';
import { SystemService } from '../../../services/system/system.service';
import { ALARM_LOCKED, GRBL_ALARMS } from '../shared/lz-alarms';
import { formatMinutes, formatMm } from '../shared/lz-format';

const VIEW_KEY = 'lz-home-view';

@Component({
  selector: 'app-laser-home',
  templateUrl: './laser-home.component.html',
  styleUrls: ['./laser-home.component.scss'],
  standalone: false,
})
export class LaserHomeComponent implements OnInit, OnDestroy {
  public status: LaserStatus;
  public selected: SelectedJob;
  public view: 'map' | 'camera' = 'map';
  public cameraUrl = '';
  public cameraEnabled = true;
  public LaserState = LaserState;
  public fmt = formatMm;
  private subs = new Subscription();

  public constructor(
    private laserService: LaserService,
    private jobService: LaserJobService,
    private configService: ConfigService,
    private systemService: SystemService,
    private router: Router,
  ) {
    const camera = this.configService.getLaser().camera;
    this.cameraEnabled = camera.enabled && !!camera.url;
    this.cameraUrl = camera.url;
    const saved = localStorage.getItem(VIEW_KEY);
    this.view = saved === 'camera' && this.cameraEnabled ? 'camera' : 'map';
  }

  public ngOnInit(): void {
    this.subs.add(this.laserService.getStatus().subscribe(status => (this.status = status)));
    this.subs.add(this.jobService.getSelected().subscribe(selected => (this.selected = selected)));
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  public setView(view: 'map' | 'camera'): void {
    this.view = view;
    localStorage.setItem(VIEW_KEY, view);
  }

  public get jobSubtitle(): string {
    const sel = this.selected;
    if (sel?.file) {
      const time = sel.parsed ? ` · ${formatMinutes(sel.parsed.estimatedSeconds)}` : '';
      return tr('selecionado: {name}', { name: sel.file.display }) + time;
    }
    const last = this.jobService.getLastJob();
    return last ? tr('último: {name}', { name: last.display }) : tr('ficheiros enviados pelo RayForge');
  }

  public get blocked(): 'alarm' | 'door' | 'offline' | null {
    switch (this.status?.state) {
      case LaserState.alarm:
        return 'alarm';
      case LaserState.door:
        return 'door';
      case LaserState.offline:
        return 'offline';
      default:
        return null;
    }
  }

  public get alarm(): { title: string; help: string } {
    const code = this.status?.alarmCode;
    const alarm = (code && GRBL_ALARMS[code]) || ALARM_LOCKED;
    return { title: tr(alarm.title), help: tr(alarm.help) };
  }

  public get alarmCode(): number | null {
    return this.status?.alarmCode ?? null;
  }

  public get canMove(): boolean {
    return this.laserService.canMove;
  }

  public openJobs(): void {
    if (this.selected?.file) {
      this.router.navigate(['/jobs'], { queryParams: { keep: 1 } });
    } else {
      this.router.navigate(['/jobs']);
    }
  }

  public go(path: string): void {
    this.router.navigate([path]);
  }

  public home(): void {
    this.laserService.home();
  }

  public unlock(): void {
    this.laserService.unlock();
  }

  public goToOrigin(): void {
    this.laserService.goToOrigin();
  }

  public connect(): void {
    this.systemService.connectPrinter();
  }
}
