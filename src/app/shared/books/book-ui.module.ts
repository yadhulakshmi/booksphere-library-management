import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { BookCoverComponent } from './book-cover.component';
import { BookDetailsDialogComponent } from './book-details-dialog.component';
import { BookFiltersComponent } from './book-filters.component';
import { BookStatusComponent } from './book-status.component';

const material = [MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule,
  MatPaginatorModule, MatSelectModule];

@NgModule({
  declarations: [BookCoverComponent, BookDetailsDialogComponent, BookFiltersComponent, BookStatusComponent],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ...material],
  exports: [BookCoverComponent, BookFiltersComponent, BookStatusComponent, ...material]
})
export class BookUiModule {}
