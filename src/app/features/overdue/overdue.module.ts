import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { CirculationUiModule } from '../../shared/circulation/circulation-ui.module';
import { SharedModule } from '../../shared/shared.module';
import { MemberProfileModule } from '../members/member-profile.module';
import { FinePaymentDialogComponent } from './fine-payment-dialog.component';
import { OverduePageComponent } from './overdue-page.component';

@NgModule({
  declarations: [OverduePageComponent, FinePaymentDialogComponent],
  imports: [CommonModule, SharedModule, CirculationUiModule, MemberProfileModule, ReactiveFormsModule,
    MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, MatSelectModule,
    MatSnackBarModule, MatSortModule, MatTableModule, MatTabsModule, MatTooltipModule,
    RouterModule.forChild([{ path: '', component: OverduePageComponent }])]
})
export class OverdueModule {}
