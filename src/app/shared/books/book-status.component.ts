import { Component, Input } from '@angular/core';
import { BookStatus } from '../../models/library';

@Component({
  selector: 'app-book-status',
  template: '<span class="book-status" [class.book-status-available]="status === \'Available\'">{{ status }}</span>'
})
export class BookStatusComponent {
  @Input() status: BookStatus = 'Out of stock';
}
