import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { BookUiModule } from '../../shared/books/book-ui.module';
import { BookEditorDialogComponent } from './book-editor-dialog.component';
import { BooksPageComponent } from './books-page.component';
import { DeleteBookDialogComponent } from './delete-book-dialog.component';

@NgModule({
  declarations: [BooksPageComponent, BookEditorDialogComponent, DeleteBookDialogComponent],
  imports: [CommonModule, SharedModule, BookUiModule, ReactiveFormsModule, MatSnackBarModule,
    MatSortModule, MatTableModule, MatTooltipModule, RouterModule.forChild([{ path: '', component: BooksPageComponent }])]
})
export class BooksModule {}
