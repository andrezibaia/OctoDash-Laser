import { Component, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { cloneDeep, uniq } from 'lodash-es';

import { ConfigSchema as Config } from '../../../model/config.model';
import { AppService } from '../../../services/app.service';
import { ConfigService } from '../../../services/config.service';
import { ElectronService } from '../../../services/electron.service';
import {
  BedGeometry,
  computeGeometry,
  GrblHoming,
  HOME_CORNERS,
  HomeCorner,
} from '../../../services/laser/bed-geometry';
import { LaserService } from '../../../services/laser/laser.service';
import { tr } from '../../../services/laser/laser-i18n';
import { NotificationService } from '../../../services/notification.service';

type SectionId = 'machine' | 'motion' | 'laser' | 'camera' | 'screen' | 'connection' | 'about';

/**
 * OctoDash-Laser settings: only options that matter for a GRBL laser, in the laser design system.
 * Replaces the OctoDash settings overlay (temperatures, filament, extruder, printer plugins…).
 * Saving writes the config through Electron and reloads the app, like OctoDash does.
 */
@Component({
  selector: 'app-laser-settings',
  templateUrl: './laser-settings.component.html',
  styleUrls: ['./laser-settings.component.scss'],
  standalone: false,
})
export class LaserSettingsComponent implements OnDestroy {
  public readonly sections: { id: SectionId; label: string; icon: string }[] = [
    { id: 'machine', label: 'Máquina', icon: 'frame' },
    { id: 'motion', label: 'Movimento', icon: 'move' },
    { id: 'laser', label: 'Laser', icon: 'bolt' },
    { id: 'camera', label: 'Câmara', icon: 'camera' },
    { id: 'screen', label: 'Ecrã', icon: 'gear' },
    { id: 'connection', label: 'Ligação', icon: 'reload' },
    { id: 'about', label: 'Sobre', icon: 'list' },
  ];
  public section: SectionId = 'machine';
  public config: Config;
  public stepsText: string;
  public newChecklistItem = '';
  public showToken = false;
  public saving = false;
  public armed: string = null;
  public version: string;
  public readonly corners: HomeCorner[] = HOME_CORNERS;
  public grbl: GrblHoming | null;

  private armTimer: ReturnType<typeof setTimeout>;
  private readonly onSaved = () => this.zone.run(() => this.electronService.send('reload'));
  private readonly onSaveFail = (_event: unknown, errors: string[]) =>
    this.zone.run(() => {
      this.saving = false;
      this.notificationService.error(tr('Não foi possível guardar'), (errors ?? []).join('\n'));
    });

  public constructor(
    private configService: ConfigService,
    private electronService: ElectronService,
    private notificationService: NotificationService,
    private appService: AppService,
    private router: Router,
    private zone: NgZone,
    private laserService: LaserService,
  ) {
    this.config = cloneDeep(this.configService.getCurrentConfig());
    this.config.laser.language = this.config.laser.language ?? 'pt';
    this.stepsText = this.config.laser.jog.steps.join(' · ');
    this.version = this.appService.getVersion();
    this.config.laser.bed.homeCorner = this.config.laser.bed.homeCorner ?? 'top-left';
    this.grbl = this.laserService.grblHomingSettings;
    this.laserService.refreshGrblSettings();
    this.electronService.on('configSaved', this.onSaved);
    this.electronService.on('configSaveFail', this.onSaveFail);
  }

  public ngOnDestroy(): void {
    clearTimeout(this.armTimer);
    this.electronService.removeListener('configSaved', this.onSaved);
    this.electronService.removeListener('configSaveFail', this.onSaveFail);
  }

  /** Geometry the map and jog would use with the values currently on screen */
  public get preview(): BedGeometry {
    return computeGeometry(this.config.laser.bed, this.grbl, this.laserService.learnedHomePosition);
  }

  public cornerLabel(corner: string): string {
    const labels: Record<string, string> = {
      'top-left': 'Atrás à esquerda',
      'top-right': 'Atrás à direita',
      'bottom-left': 'À frente à esquerda',
      'bottom-right': 'À frente à direita',
    };
    return tr(labels[corner] ?? labels['top-left']);
  }

  public fmt(n: number): string {
    const r = Math.round(n * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('-', '−');
  }

  public get dirty(): boolean {
    return !this.configService.isEqualToCurrentConfig(this.config);
  }

  // ---- generic helpers -------------------------------------------------------------------

  /** Adds delta to obj[key], clamped and rounded to the step's precision. */
  public step(obj: Record<string, number>, key: string, delta: number, min: number, max: number): void {
    const decimals = (String(delta).split('.')[1] ?? '').length;
    const next = Math.min(max, Math.max(min, (Number(obj[key]) || 0) + delta));
    obj[key] = Number(next.toFixed(decimals));
  }

  public setNumber(obj: Record<string, number>, key: string, value: string, min: number, max: number): void {
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isNaN(n)) obj[key] = Math.min(max, Math.max(min, n));
  }

  /** Jog speed is stored in mm/min but shown in mm/s, like on the jog screen */
  public get jogSpeed(): number {
    return Math.round(this.config.laser.jog.feed / 60);
  }

  public stepJogSpeed(delta: number): void {
    this.config.laser.jog.feed = Math.min(200, Math.max(1, this.jogSpeed + delta)) * 60;
  }

  public setJogSpeed(value: string): void {
    const n = Number(value);
    if (n > 0) this.config.laser.jog.feed = Math.min(200, Math.round(n)) * 60;
  }

  public applySteps(): void {
    const steps = uniq(
      this.stepsText
        .split(/[\s;·|]+|,(?!\d)/)
        .map(s => Number(s.replace(',', '.')))
        .filter(n => n > 0 && n <= 1000),
    ).sort((a, b) => a - b);
    if (steps.length) {
      this.config.laser.jog.steps = steps.slice(0, 6);
      if (!steps.includes(this.config.laser.jog.defaultStep)) {
        this.config.laser.jog.defaultStep = steps[Math.min(2, steps.length - 1)];
      }
    }
    this.stepsText = this.config.laser.jog.steps.join(' · ');
  }

  public removeChecklist(index: number): void {
    this.config.laser.checklist.splice(index, 1);
  }

  public addChecklist(): void {
    const item = this.newChecklistItem.trim();
    if (item) this.config.laser.checklist.push(item);
    this.newChecklistItem = '';
  }

  public tr(text: string): string {
    return tr(text);
  }

  /** Two-tap confirmation: first tap arms for 3 s, second runs */
  private confirmThen(key: string, run: () => void): void {
    if (this.armed === key) {
      this.armed = null;
      clearTimeout(this.armTimer);
      run();
      return;
    }
    this.armed = key;
    clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => (this.armed = null), 3000);
  }

  // ---- actions ---------------------------------------------------------------------------

  public back(): void {
    if (!this.dirty) {
      this.router.navigate(['/more']);
      return;
    }
    this.confirmThen('discard', () => this.router.navigate(['/more']));
  }

  public save(): void {
    if (!this.dirty || this.saving) return;
    this.applySteps();
    this.saving = true;
    this.configService.saveConfig(this.config);
  }

  public resetConfig(): void {
    this.confirmThen('reset', () => {
      this.electronService.send('resetConfig');
      this.electronService.send('reload');
    });
  }
}
