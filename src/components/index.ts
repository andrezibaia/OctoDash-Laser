import { ActionCenterComponent } from './action-center/action-center.component';
import { AppComponent } from './app.component';
import { ControlComponent } from './control/control.component';
import { ChangeFilamentComponent } from './filament/change-filament/change-filament.component';
import { ChooseFilamentComponent } from './filament/choose-filament/choose-filament.component';
import { ChooseToolComponent } from './filament/choose-tool/choose-tool.component';
import { FilamentComponent } from './filament/filament.component';
import { HeatNozzleComponent } from './filament/heat-nozzle/heat-nozzle.component';
import { MoveFilamentComponent } from './filament/move-filament/move-filament.component';
import { PurgeFilamentComponent } from './filament/purge-filament/purge-filament.component';
import { FilesComponent } from './files/files.component';
import { LaserCameraComponent } from './laser/camera/laser-camera.component';
import { LaserHomeComponent } from './laser/home/laser-home.component';
import { LaserJobsComponent } from './laser/jobs/laser-jobs.component';
import { LaserJogComponent } from './laser/jog/laser-jog.component';
import { LaserMoreComponent } from './laser/more/laser-more.component';
import { LaserPrepareComponent } from './laser/prepare/laser-prepare.component';
import { LaserRunningComponent } from './laser/running/laser-running.component';
import { LzBedMapComponent } from './laser/shared/lz-bed-map.component';
import { LzCameraComponent } from './laser/shared/lz-camera.component';
import { LzHoldDirective } from './laser/shared/lz-hold.directive';
import { LzIconComponent } from './laser/shared/lz-icon.component';
import { LzSlideConfirmComponent } from './laser/shared/lz-slide-confirm.component';
import { LzStatusBarComponent } from './laser/shared/lz-status-bar.component';
import { BottomBarComponent } from './main-screen/bottom-bar/bottom-bar.component';
import { HeightProgressComponent } from './main-screen/job-status/height-progress/height-progress.component';
import { JobStatusComponent } from './main-screen/job-status/job-status.component';
import { MainMenuComponent } from './main-screen/main-menu/main-menu.component';
import { MainScreenComponent } from './main-screen/main-screen.component';
import { PrintControlComponent } from './main-screen/print-control/print-control.component';
import { PrinterStatusComponent } from './main-screen/printer-status/printer-status.component';
import { NotificationComponent } from './notification/notification.component';
import { ResetComponent } from './reset/reset.component';
import { SettingsComponent } from './settings/settings.component';
import { SettingsIconComponent } from './settings/settings-icon/settings-icon.component';
import { DiscoverOctoprintComponent } from './setup/discover-octoprint/discover-octoprint.component';
import { ExtruderInformationComponent } from './setup/extruder-information/extruder-information.component';
import { ConfigInvalidComponent } from './setup/invalid-config/invalid-config.component';
import { OctoprintAuthenticationComponent } from './setup/octoprint-authentication/octoprint-authentication.component';
import { PersonalizationComponent } from './setup/personalization/personalization.component';
import { PluginsComponent } from './setup/plugins/plugins.component';
import { ConfigSetupComponent } from './setup/setup.component';
import { WelcomeComponent } from './setup/welcome/welcome.component';
import { HotendIconComponent } from './shared/hotend-icon/hotend-icon.component';
import { QuickControlComponent } from './shared/quick-control/quick-control.component';
import { QuickControlModalComponent } from './shared/quick-control-modal-component/quick-control-modal.component';
import { BedQuickControlComponent } from './shared/smart-quick-control-component/bed-quick-control-component/bed-quick-control.component';
import { FanQuickControlComponent } from './shared/smart-quick-control-component/fan-quick-control-component/fan-quick-control.component';
import { HotendQuickControlComponent } from './shared/smart-quick-control-component/hotend-quick-control/hotend-quick-control.component';
import { ToggleSwitchComponent } from './shared/toggle-switch/toggle-switch.component';
import { TopBarComponent } from './shared/top-bar/top-bar.component';
import { StandbyComponent } from './standby/standby.component';
import { UpdateComponent } from './update/update.component';

export default [
  AppComponent,
  ActionCenterComponent,
  ControlComponent,
  ChangeFilamentComponent,
  ChooseFilamentComponent,
  ChooseToolComponent,
  FilamentComponent,
  HeatNozzleComponent,
  MoveFilamentComponent,
  PurgeFilamentComponent,
  FilesComponent,
  BottomBarComponent,
  HeightProgressComponent,
  JobStatusComponent,
  MainMenuComponent,
  MainScreenComponent,
  PrintControlComponent,
  PrinterStatusComponent,
  NotificationComponent,
  ResetComponent,
  SettingsComponent,
  SettingsIconComponent,
  DiscoverOctoprintComponent,
  ExtruderInformationComponent,
  ConfigInvalidComponent,
  OctoprintAuthenticationComponent,
  PersonalizationComponent,
  PluginsComponent,
  ConfigSetupComponent,
  WelcomeComponent,
  HotendIconComponent,
  ToggleSwitchComponent,
  TopBarComponent,
  StandbyComponent,
  UpdateComponent,
  QuickControlComponent,
  HotendQuickControlComponent,
  BedQuickControlComponent,
  FanQuickControlComponent,
  QuickControlModalComponent,
  LaserHomeComponent,
  LaserJogComponent,
  LaserJobsComponent,
  LaserPrepareComponent,
  LaserRunningComponent,
  LaserCameraComponent,
  LaserMoreComponent,
  LzIconComponent,
  LzHoldDirective,
  LzStatusBarComponent,
  LzBedMapComponent,
  LzSlideConfirmComponent,
  LzCameraComponent,
];
