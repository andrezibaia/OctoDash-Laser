import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';

import { LaserService } from './laser.service';

/**
 * Brings the "job running" screen forward whenever a job starts — including jobs started
 * remotely (RayForge, OctoPrint web UI) — unless the user is in settings or setup.
 */
@Injectable({
  providedIn: 'root',
})
export class LaserNavigatorService {
  private sub: Subscription;
  private currentUrl = '';

  public constructor(
    private laserService: LaserService,
    private router: Router,
  ) {}

  public start(): void {
    if (this.sub) return;
    this.currentUrl = this.router.url;
    this.sub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => (this.currentUrl = event.urlAfterRedirects));

    this.sub.add(
      this.laserService
        .getStatus()
        .pipe(
          map(status => status.jobActive),
          distinctUntilChanged(),
          filter(active => active),
        )
        .subscribe(() => {
          const url = this.currentUrl || this.router.url;
          const busy = ['/job', '/settings', '/no-config', '/invalid-config', '/standby'].some(path =>
            url.startsWith(path),
          );
          if (!busy) this.router.navigate(['/job']);
        }),
    );
  }
}
