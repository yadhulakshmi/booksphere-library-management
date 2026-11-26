import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BookSort } from '../../core/book-query';
import { categoryName } from '../../core/book-rules';
import { Book } from '../../models/library';
import { BookService } from '../../services/book.service';
import { BookBrowser } from '../../shared/books/book-browser';
import { BookDetailsDialogComponent } from '../../shared/books/book-details-dialog.component';

@Component({
  selector: 'app-catalogue-page',
  templateUrl: './catalogue-page.component.html'
})
export class CataloguePageComponent {
  readonly browser = new BookBrowser(this.books.books$, 12);
  readonly storageWarning$ = this.books.storageWarning$;
  readonly categoryName = categoryName;
  readonly sortOptions: readonly { label: string; sort: BookSort }[] = [
    { label: 'Title A–Z', sort: { key: 'title', direction: 'asc' } },
    { label: 'Title Z–A', sort: { key: 'title', direction: 'desc' } },
    { label: 'Author A–Z', sort: { key: 'author', direction: 'asc' } },
    { label: 'Newest publication', sort: { key: 'publicationYear', direction: 'desc' } },
    { label: 'Recently added', sort: { key: 'dateAdded', direction: 'desc' } },
    { label: 'Most available copies', sort: { key: 'availableCopies', direction: 'desc' } }
  ];
  layout: 'grid' | 'list' = 'grid';

  constructor(private readonly books: BookService, private readonly dialog: MatDialog) {}

  showDetails(book: Book): void {
    this.dialog.open(BookDetailsDialogComponent, { data: book, width: '640px', maxWidth: '94vw' });
  }

  trackBook(_: number, book: Book): string {
    return book.id;
  }
}
