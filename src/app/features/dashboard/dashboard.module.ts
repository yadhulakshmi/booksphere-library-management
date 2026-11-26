import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { AnalyticsChartComponent } from './analytics-chart.component';
import { DashboardPageComponent } from './dashboard-page.component';

@NgModule({
  declarations: [DashboardPageComponent, AnalyticsChartComponent],
  imports: [CommonModule, SharedModule, MatFormFieldModule, MatSelectModule,
    RouterModule.forChild([{ path: '', component: DashboardPageComponent }])]
})
export class DashboardModule {}
