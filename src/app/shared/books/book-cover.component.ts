import { Component, Input } from '@angular/core';
import { Book } from '../../models/library';

@Component({
  selector: 'app-book-cover',
  template: `
    <div class="book-cover" [class.book-cover-small]="small" [attr.data-category]="book.categoryId" aria-hidden="true">
      <img *ngIf="book.coverImage && failedImage !== book.coverImage" [src]="book.coverImage"
        loading="lazy" alt="" (error)="failedImage = book.coverImage">
      <mat-icon>auto_stories</mat-icon>
      <span *ngIf="!small">{{ book.title }}</span>
    </div>
  `
})
export class BookCoverComponent {
  @Input() book!: Book;
  @Input() small = false;
  failedImage = '';
}
