import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LaserJobFile, LaserStatus } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { LaserService } from '../../../services/laser/laser.service';
import { tr } from '../../../services/laser/laser-i18n';
import { LaserJobService, SelectedJob } from '../../../services/laser/laser-job.service';
import { formatDate, formatMinutes, formatSize } from '../shared/lz-format';

@Component({
  selector: 'app-laser-jobs',
  templateUrl: './laser-jobs.component.html',
  styleUrls: ['./laser-jobs.component.scss'],
  standalone: false,
})
export class LaserJobsComponent implements OnInit, OnDestroy {
  public files: LaserJobFile[] = null;
  public loadError = '';
  public selected: SelectedJob;
  public status: LaserStatus;
  public fmtDate = formatDate;
  public fmtSize = formatSize;
  private maxPower: number;
  private subs = new Subscription();

  public constructor(
    private jobService: LaserJobService,
    private laserService: LaserService,
    private configService: ConfigService,
    private router: Router,
  ) {
    this.maxPower = this.configService.getLaser().maxPower;
  }

  public ngOnInit(): void {
    this.subs.add(this.jobService.getSelected().subscribe(selected => (this.selected = selected)));
    this.subs.add(this.laserService.getStatus().subscribe(status => (this.status = status)));
    this.load();
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  public load(): void {
    this.loadError = '';
    this.jobService.listJobs().subscribe({
      next: files => {
        this.files = files;
        const current = this.selected?.file;
        const stillThere = current && files.find(f => f.path === current.path && f.date === current.date);
        if (!stillThere && files.length) {
          this.jobService.select(files[0]);
        }
      },
      error: err => {
        this.files = [];
        this.loadError = err?.message ?? tr('Erro ao ler os ficheiros');
      },
    });
  }

  public select(file: LaserJobFile): void {
    this.jobService.select(file);
  }

  public isSelected(file: LaserJobFile): boolean {
    return this.selected?.file?.path === file.path;
  }

  public get size(): string {
    const b = this.selected?.parsed?.burnBounds ?? this.selected?.parsed?.moveBounds;
    if (!b) return '—';
    return `${Math.round(b.maxX - b.minX)}×${Math.round(b.maxY - b.minY)}`;
  }

  public get time(): string {
    return this.selected?.parsed ? formatMinutes(this.selected.parsed.estimatedSeconds) : '—';
  }

  public get power(): string {
    const p = this.selected?.parsed;
    if (!p || p.powerMax <= 0) return '—';
    const pct = (v: number) => Math.round((v / this.maxPower) * 100);
    return pct(p.powerMin) === pct(p.powerMax) ? `${pct(p.powerMax)}%` : `${pct(p.powerMin)}–${pct(p.powerMax)}%`;
  }

  public get fits(): boolean | null {
    const p = this.selected?.parsed;
    return p ? this.laserService.fitsOnBed(p.burnBounds ?? p.moveBounds) : null;
  }

  public get canFrame(): boolean {
    return !!this.selected?.parsed && this.laserService.canMove && (this.selected.parsed.burnBounds ?? null) !== null;
  }

  public frame(): void {
    const p = this.selected?.parsed;
    if (!p || !this.canFrame) return;
    this.laserService.frame(p.burnBounds ?? p.moveBounds);
    this.jobService.markFramed();
  }

  public prepare(): void {
    if (!this.selected?.parsed) return;
    this.router.navigate(['/prepare']);
  }
}
