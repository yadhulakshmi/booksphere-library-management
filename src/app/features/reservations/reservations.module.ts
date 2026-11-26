import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CirculationUiModule } from '../../shared/circulation/circulation-ui.module';
import { ReservationsPageComponent } from './reservations-page.component';

@NgModule({
  declarations: [ReservationsPageComponent],
  imports: [CirculationUiModule, RouterModule.forChild([{ path: '', component: ReservationsPageComponent }])]
})
export class ReservationsModule {}
