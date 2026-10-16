import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IconName } from '@fortawesome/fontawesome-svg-core';

import { CustomAction } from '../../../model';
import { ConfigService } from '../../../services/config.service';
import { ElectronService } from '../../../services/electron.service';
import { LaserService } from '../../../services/laser/laser.service';
import { NotificationService } from '../../../services/notification.service';
import { SystemService } from '../../../services/system/system.service';

@Component({
  selector: 'app-laser-more',
  templateUrl: './laser-more.component.html',
  styleUrls: ['./laser-more.component.scss'],
  standalone: false,
})
export class LaserMoreComponent implements OnDestroy {
  public customActions: CustomAction[];
  public cameraEnabled: boolean;
  /** Index (or key) of the action waiting for a second tap */
  public armed: string = null;
  private armTimer: ReturnType<typeof setTimeout>;

  public constructor(
    private laserService: LaserService,
    private configService: ConfigService,
    private systemService: SystemService,
    private electronService: ElectronService,
    private notificationService: NotificationService,
    private router: Router,
  ) {
    // Hide custom buttons that duplicate built-in screens/buttons (e.g. $H, $X, camera, reload)
    const builtIn = /^(\$H|\$X|\[!RELOAD\]|\[!SHUTDOWN\]|\[!REBOOT\]|\[!WEB\].*|G10 L20 P1 X0 Y0|G90;\s*G0 X0 Y0)$/i;
    this.customActions = (this.configService.getCustomActions() ?? []).filter(
      action => !builtIn.test(action.command.trim()),
    );
    const camera = this.configService.getLaser().camera;
    this.cameraEnabled = camera.enabled && !!camera.url;
  }

  public ngOnDestroy(): void {
    clearTimeout(this.armTimer);
  }

  public get canMove(): boolean {
    return this.laserService.canMove;
  }

  public icon(name: string): IconName {
    return name as IconName;
  }

  /** Two-tap confirmation: first tap arms the button for 3 s, second tap runs it. */
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

  public go(path: string): void {
    this.router.navigate([path]);
  }

  public goToOrigin(): void {
    this.laserService.goToOrigin();
  }

  public unlock(): void {
    this.laserService.unlock();
  }

  public reloadScreen(): void {
    this.electronService.send('reload');
  }

  public restartOctoPrint(): void {
    this.confirmThen('restart', () => this.systemService.sendCommand('restart'));
  }

  public shutdown(): void {
    this.confirmThen('shutdown', () => this.systemService.sendCommand('shutdown'));
  }

  public runCustom(action: CustomAction, index: number): void {
    const run = () => this.executeCustom(action.command);
    if (action.confirm) this.confirmThen(`custom-${index}`, run);
    else run();
  }

  private executeCustom(command: string): void {
    const parts = command
      .split(';')
      .map(part => part.trim())
      .filter(Boolean);
    const gcodes = parts.filter(part => !part.startsWith('[!'));
    const specials = parts.filter(part => part.startsWith('[!'));
    for (const special of specials) {
      const name = special.match(/\[!([\w_]+)\]/)?.[1];
      switch (name) {
        case 'RELOAD':
          this.systemService.sendCommand('restart');
          break;
        case 'REBOOT':
          this.systemService.sendCommand('reboot');
          break;
        case 'SHUTDOWN':
          this.systemService.sendCommand('shutdown');
          break;
        case 'STOPDASHBOARD':
          window.close();
          break;
        case 'WEB':
          this.router.navigate(['/camera']);
          break;
        default:
          this.notificationService.warn('Comando especial não suportado', special);
      }
    }
    if (gcodes.length) this.laserService.send(gcodes, 3000);
  }
}
