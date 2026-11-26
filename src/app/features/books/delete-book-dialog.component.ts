import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Book } from '../../models/library';

@Component({
  selector: 'app-delete-book-dialog',
  template: `
    <h2 mat-dialog-title>Delete book?</h2>
    <mat-dialog-content>
      <p><strong>{{ book.title }}</strong> and its inventory record will be removed.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button>
      <button mat-flat-button color="warn" type="button" [mat-dialog-close]="true">Delete book</button>
    </mat-dialog-actions>
  `
})
export class DeleteBookDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly book: Book) {}
}
