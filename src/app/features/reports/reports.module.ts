import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReportValuePipe } from './report-value.pipe';
import { ReportsPageComponent } from './reports-page.component';

@NgModule({
  declarations: [ReportsPageComponent, ReportValuePipe],
  imports: [CommonModule, SharedModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatPaginatorModule, MatSelectModule, MatSortModule, MatTableModule, MatTooltipModule,
    RouterModule.forChild([{ path: '', component: ReportsPageComponent }])]
})
export class ReportsModule {}
