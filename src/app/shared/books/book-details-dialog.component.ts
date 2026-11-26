import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { categoryName } from '../../core/book-rules';
import { Book } from '../../models/library';

@Component({
  selector: 'app-book-details-dialog',
  templateUrl: './book-details-dialog.component.html'
})
export class BookDetailsDialogComponent {
  readonly categoryName = categoryName;

  constructor(@Inject(MAT_DIALOG_DATA) readonly book: Book) {}
}
