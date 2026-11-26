import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sort } from '@angular/material/sort';
import { Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { BookSortKey } from '../../core/book-query';
import { categoryName } from '../../core/book-rules';
import { Book } from '../../models/library';
import { BookService } from '../../services/book.service';
import { workspaceAction } from '../../shared/workspace-action';
import { BookBrowser } from '../../shared/books/book-browser';
import { BookDetailsDialogComponent } from '../../shared/books/book-details-dialog.component';
import { BookEditorDialogComponent } from './book-editor-dialog.component';
import { DeleteBookDialogComponent } from './delete-book-dialog.component';

@Component({
  selector: 'app-books-page',
  templateUrl: './books-page.component.html'
})
export class BooksPageComponent implements OnDestroy {
  readonly browser = new BookBrowser(this.books.books$, 10);
  readonly storageWarning$ = this.books.storageWarning$;
  readonly categoryName = categoryName;
  readonly columns = ['title', 'isbn', 'category', 'shelfLocation', 'totalCopies', 'availableCopies', 'status', 'actions'];
  private readonly destroyed = new Subject<void>();

  constructor(private readonly books: BookService, private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar, route: ActivatedRoute, router: Router) {
    workspaceAction(route, router, ['add']).pipe(takeUntil(this.destroyed)).subscribe(() => this.edit(null));
  }

  applySort(sort: Sort): void {
    this.browser.sort({ key: sort.active as BookSortKey, direction: sort.direction || 'asc' });
  }

  showDetails(book: Book): void {
    this.dialog.open(BookDetailsDialogComponent, { data: book, width: '640px', maxWidth: '94vw' });
  }

  edit(book: Book | null): void {
    this.dialog.open<BookEditorDialogComponent, Book | null, Book>(BookEditorDialogComponent, {
      data: book, width: '720px', maxWidth: '94vw'
    }).afterClosed().pipe(takeUntil(this.destroyed)).subscribe(saved => {
      if (saved) {
        this.snackBar.open(book ? 'Book updated.' : 'Book added.', 'Dismiss', { duration: 4000 });
      }
    });
  }

  confirmDelete(book: Book): void {
    if (book.borrowedCopies || book.reservedCopies) {
      this.snackBar.open('This book has active loans or reservations and cannot be deleted.', 'Dismiss');
      return;
    }
    this.dialog.open<DeleteBookDialogComponent, Book, boolean>(DeleteBookDialogComponent, {
      data: book, width: '440px', maxWidth: '94vw'
    }).afterClosed().pipe(
      filter(confirmed => confirmed === true),
      switchMap(() => this.books.delete(book.id)),
      takeUntil(this.destroyed)
    ).subscribe({
      next: () => this.snackBar.open('Book deleted.', 'Dismiss', { duration: 4000 }),
      error: (error: Error) => this.snackBar.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
