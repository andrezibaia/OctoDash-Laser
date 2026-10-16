import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { LaserState, LaserStatus } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { LaserService } from '../../../services/laser/laser.service';
import { LaserJobService } from '../../../services/laser/laser-job.service';
import { formatMm } from '../shared/lz-format';

const STEP_KEY = 'lz-jog-step';

interface PadButton {
  dx: number;
  dy: number;
  icon: string;
  diagonal: boolean;
}

@Component({
  selector: 'app-laser-jog',
  templateUrl: './laser-jog.component.html',
  styleUrls: ['./laser-jog.component.scss'],
  standalone: false,
})
export class LaserJogComponent implements OnInit, OnDestroy {
  public status: LaserStatus;
  public steps: number[];
  /** Selected step in mm, or 0 for continuous */
  public step: number;
  public feedMmS: number;
  public testFireLabel: string;
  public pad: (PadButton | null)[];
  public fmt = formatMm;
  public LaserState = LaserState;
  private holdingPad = false;
  private subs = new Subscription();

  public constructor(
    private laserService: LaserService,
    private jobService: LaserJobService,
    private configService: ConfigService,
  ) {
    const laser = this.configService.getLaser();
    this.steps = laser.jog.steps;
    const saved = localStorage.getItem(STEP_KEY);
    this.step =
      saved !== null && (Number(saved) === 0 || this.steps.includes(Number(saved)))
        ? Number(saved)
        : laser.jog.defaultStep;
    this.feedMmS = Math.round(laser.jog.feed / 60);
    this.testFireLabel = `${laser.testFire.power}% · ${laser.testFire.durationMs} ms`;

    const invert = this.configService.getCurrentConfig().octodash?.invertAxisControl;
    const up = (laser.bed.yAxisUp ? 1 : -1) * (invert?.y ? -1 : 1);
    const r = invert?.x ? -1 : 1;
    this.pad = [
      { dx: -r, dy: up, icon: 'ul', diagonal: true },
      { dx: 0, dy: up, icon: 'up', diagonal: false },
      { dx: r, dy: up, icon: 'ur', diagonal: true },
      { dx: -r, dy: 0, icon: 'left', diagonal: false },
      null,
      { dx: r, dy: 0, icon: 'right', diagonal: false },
      { dx: -r, dy: -up, icon: 'dl', diagonal: true },
      { dx: 0, dy: -up, icon: 'down', diagonal: false },
      { dx: r, dy: -up, icon: 'dr', diagonal: true },
    ];
  }

  public ngOnInit(): void {
    this.subs.add(this.laserService.getStatus().subscribe(status => (this.status = status)));
  }

  public ngOnDestroy(): void {
    this.laserService.jogStop();
    this.subs.unsubscribe();
  }

  public get canMove(): boolean {
    return this.laserService.canMove;
  }

  public get continuous(): boolean {
    return this.step === 0;
  }

  public setStep(step: number): void {
    this.step = step;
    localStorage.setItem(STEP_KEY, String(step));
  }

  public padDown(button: PadButton, event: PointerEvent): void {
    event.preventDefault();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // pointer already gone — the move is still sent; release is handled by pointerup
    }
    if (this.continuous) {
      this.holdingPad = true;
      this.laserService.jogStart(button.dx, button.dy);
    } else {
      this.laserService.jogStep(button.dx * this.step, button.dy * this.step);
    }
  }

  public padUp(): void {
    if (this.holdingPad) {
      this.holdingPad = false;
      this.laserService.jogStop();
    }
  }

  public goToOrigin(): void {
    this.laserService.goToOrigin();
  }

  public setOrigin(): void {
    this.laserService.setOriginHere();
    this.jobService.resetFramed();
  }

  public home(): void {
    this.laserService.home();
  }

  public unlock(): void {
    this.laserService.unlock();
  }

  public testFire(): void {
    this.laserService.testFire();
  }
}
