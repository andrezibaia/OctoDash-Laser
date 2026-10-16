import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LaserCameraComponent } from './components/laser/camera/laser-camera.component';
import { LaserHomeComponent } from './components/laser/home/laser-home.component';
import { LaserJobsComponent } from './components/laser/jobs/laser-jobs.component';
import { LaserJogComponent } from './components/laser/jog/laser-jog.component';
import { LaserMoreComponent } from './components/laser/more/laser-more.component';
import { LaserPrepareComponent } from './components/laser/prepare/laser-prepare.component';
import { LaserRunningComponent } from './components/laser/running/laser-running.component';
import { LaserSettingsComponent } from './components/laser/settings/laser-settings.component';
import { ConfigInvalidComponent } from './components/setup/invalid-config/invalid-config.component';
import { ConfigSetupComponent } from './components/setup/setup.component';
import { StandbyComponent } from './components/standby/standby.component';

// OctoDash-Laser: the printer screens (main screen, control, files, filament) are replaced by
// laser screens. "/main-screen", "/control" and "/files" are kept as aliases because shared
// OctoDash components still navigate to them.
const routes: Routes = [
  { path: 'main-screen', component: LaserHomeComponent },
  { path: 'jog', component: LaserJogComponent },
  { path: 'control', redirectTo: 'jog' },
  { path: 'jobs', component: LaserJobsComponent },
  { path: 'files', redirectTo: 'jobs' },
  { path: 'prepare', component: LaserPrepareComponent },
  { path: 'job', component: LaserRunningComponent },
  { path: 'camera', component: LaserCameraComponent },
  { path: 'more', component: LaserMoreComponent },
  { path: 'invalid-config', component: ConfigInvalidComponent },
  { path: 'no-config', component: ConfigSetupComponent },
  { path: 'settings', component: LaserSettingsComponent },
  { path: 'standby', component: StandbyComponent },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forRoot(routes, { useHash: true, enableViewTransitions: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
