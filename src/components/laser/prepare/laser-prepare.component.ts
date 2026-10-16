import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LaserState, LaserStatus } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { LaserService } from '../../../services/laser/laser.service';
import { tr } from '../../../services/laser/laser-i18n';
import { LaserJobService, SelectedJob } from '../../../services/laser/laser-job.service';
import { formatMinutes } from '../shared/lz-format';
import { LASER_STATE_LABEL } from '../shared/lz-status-bar.component';

interface CheckRow {
  id: string;
  title: string;
  detail: string;
  state: 'ok' | 'warn' | 'bad' | 'optional';
  action?: { label: string; run: () => void; disabled?: boolean };
  manual?: boolean;
}

@Component({
  selector: 'app-laser-prepare',
  templateUrl: './laser-prepare.component.html',
  styleUrls: ['./laser-prepare.component.scss'],
  standalone: false,
})
export class LaserPrepareComponent implements OnInit, OnDestroy {
  public selected: SelectedJob;
  public status: LaserStatus;
  public rows: CheckRow[] = [];
  public confirmedManual = new Set<number>();
  public starting = false;
  private manualItems: string[];
  private subs = new Subscription();

  public constructor(
    private jobService: LaserJobService,
    private laserService: LaserService,
    private configService: ConfigService,
    private router: Router,
  ) {
    this.manualItems = this.configService.getLaser().checklist ?? [];
  }

  public ngOnInit(): void {
    if (!this.jobService.selectedSnapshot?.parsed) {
      this.router.navigate(['/jobs']);
      return;
    }
    this.subs.add(
      this.jobService.getSelected().subscribe(selected => {
        this.selected = selected;
        this.buildRows();
      }),
    );
    this.subs.add(
      this.laserService.getStatus().subscribe(status => {
        this.status = status;
        this.buildRows();
      }),
    );
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private buildRows(): void {
    if (!this.selected?.parsed || !this.status) return;
    const parsed = this.selected.parsed;
    const bounds = parsed.burnBounds ?? parsed.moveBounds;
    const rows: CheckRow[] = [];

    const ready = this.status.state === LaserState.idle;
    const moving = [LaserState.jogging, LaserState.homing].includes(this.status.state);
    rows.push({
      id: 'machine',
      title: ready ? tr('Máquina pronta') : tr('Máquina: {state}', { state: tr(LASER_STATE_LABEL[this.status.state]) }),
      detail: tr(ready ? 'GRBL em Idle' : moving ? 'aguarde que pare' : 'o firmware pode recusar o trabalho'),
      state: ready ? 'ok' : moving ? 'warn' : 'bad',
      action:
        this.status.state === LaserState.alarm ? { label: 'Home', run: () => this.laserService.home() } : undefined,
    });

    const fits = this.laserService.fitsOnBed(bounds);
    const wco = this.status.wco;
    const range = bounds
      ? `X ${Math.round(bounds.minX + wco.x)}→${Math.round(bounds.maxX + wco.x)} · Y ${Math.round(bounds.minY + wco.y)}→${Math.round(bounds.maxY + wco.y)}`
      : '';
    rows.push({
      id: 'bed',
      title: tr(
        fits === false ? 'Sai fora da área de trabalho' : fits ? 'Dentro da área de trabalho' : 'Área por verificar',
      ),
      detail: fits === null ? tr('posição desconhecida — faça Home') : range,
      state: fits === false ? 'bad' : fits ? 'ok' : 'warn',
    });

    rows.push({
      id: 'frame',
      title: tr(this.selected.framed ? 'Enquadrado' : 'Enquadramento por fazer'),
      detail: tr(this.selected.framed ? 'contorno percorrido com o laser desligado' : 'opcional'),
      state: this.selected.framed ? 'ok' : 'optional',
      action: this.selected.framed
        ? undefined
        : { label: tr('Enquadrar'), run: () => this.frame(), disabled: !this.laserService.canMove },
    });

    this.manualItems.forEach((item, index) => {
      const done = this.confirmedManual.has(index);
      rows.push({
        id: `manual-${index}`,
        title: tr(item),
        detail: tr(done ? 'confirmado' : 'tocar para confirmar'),
        state: done ? 'ok' : 'warn',
        manual: true,
      });
    });

    this.rows = rows;
  }

  public toggleManual(row: CheckRow): void {
    if (!row.manual) return;
    const index = Number(row.id.replace('manual-', ''));
    if (this.confirmedManual.has(index)) this.confirmedManual.delete(index);
    else this.confirmedManual.add(index);
    this.buildRows();
  }

  public frame(): void {
    const parsed = this.selected?.parsed;
    if (!parsed) return;
    this.laserService.frame(parsed.burnBounds ?? parsed.moveBounds);
    this.jobService.markFramed();
  }

  public get warnings(): number {
    return this.rows.filter(row => row.state === 'warn' || row.state === 'bad').length;
  }

  public get slideLabel(): string {
    if (this.starting) return tr('A iniciar…');
    if (!this.warnings) return tr('Deslizar para iniciar');
    return tr(this.warnings > 1 ? 'Iniciar mesmo assim · {n} avisos' : 'Iniciar mesmo assim · {n} aviso', {
      n: this.warnings,
    });
  }

  public get summary(): string {
    const p = this.selected?.parsed;
    if (!p) return '';
    const b = p.burnBounds ?? p.moveBounds;
    const size = b ? `${Math.round(b.maxX - b.minX)}×${Math.round(b.maxY - b.minY)} mm` : '';
    const passes = p.passes > 1 ? ' · ' + tr('{n} passagens', { n: p.passes }) : '';
    return `${size} · ${formatMinutes(p.estimatedSeconds)}${passes}`;
  }

  public start(): void {
    if (this.starting || !this.selected?.file) return;
    this.starting = true;
    this.jobService.start(this.selected.file).then(ok => {
      this.starting = false;
      if (ok) this.router.navigate(['/job']);
    });
  }
}
