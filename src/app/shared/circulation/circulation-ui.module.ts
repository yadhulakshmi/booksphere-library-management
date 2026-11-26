import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
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
import { SharedModule } from '../shared.module';
import { ReturnLoanPickerComponent } from './return-loan-picker.component';
import { CirculationWorkspaceComponent } from './circulation-workspace.component';
import { TransactionActionDialogComponent } from './transaction-action-dialog.component';
import { TransactionEntryDialogComponent } from './transaction-entry-dialog.component';

@NgModule({
  declarations: [CirculationWorkspaceComponent, ReturnLoanPickerComponent, TransactionEntryDialogComponent, TransactionActionDialogComponent],
  imports: [CommonModule, SharedModule, ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatPaginatorModule, MatSelectModule, MatSnackBarModule, MatSortModule,
    MatTableModule, MatTabsModule, MatTooltipModule],
  exports: [CirculationWorkspaceComponent]
})
export class CirculationUiModule {}
