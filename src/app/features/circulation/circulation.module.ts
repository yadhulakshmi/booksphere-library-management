import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CirculationUiModule } from '../../shared/circulation/circulation-ui.module';
import { CirculationPageComponent } from './circulation-page.component';

@NgModule({
  declarations: [CirculationPageComponent],
  imports: [CirculationUiModule, RouterModule.forChild([{ path: '', component: CirculationPageComponent }])]
})
export class CirculationModule {}
