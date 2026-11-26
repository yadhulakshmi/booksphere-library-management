import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { finalize, map, take, takeUntil } from 'rxjs/operators';
import { BOOK_CATEGORIES, BOOK_COVER_PATH, currentYear, isbnKey, validIsbn, validQuantity, validYear } from '../../core/book-rules';
import { Book, BookInput } from '../../models/library';
import { BookService } from '../../services/book.service';

const requiredText: ValidatorFn = control => String(control.value ?? '').trim() ? null : { required: true };

@Component({
  selector: 'app-book-editor-dialog',
  templateUrl: './book-editor-dialog.component.html'
})
export class BookEditorDialogComponent implements OnDestroy {
  readonly categories = BOOK_CATEGORIES;
  readonly maxYear = currentYear();
  readonly allocated = (this.book?.borrowedCopies ?? 0) + (this.book?.reservedCopies ?? 0);
  readonly textFields = [
    { key: 'title', label: 'Title' }, { key: 'author', label: 'Author' },
    { key: 'publisher', label: 'Publisher' }, { key: 'edition', label: 'Edition' },
    { key: 'language', label: 'Language' }, { key: 'shelfLocation', label: 'Shelf location' }
  ];
  readonly form = this.forms.group({
    title: [this.book?.title ?? '', requiredText],
    author: [this.book?.author ?? '', requiredText],
    categoryId: [this.book?.categoryId ?? '', Validators.required],
    isbn: [this.book?.isbn ?? '', (control: AbstractControl) => validIsbn(control.value) ? null : { checksum: true },
      (control: AbstractControl) => this.books.books$.pipe(take(1), map(books => {
        const isbn = isbnKey(control.value);
        return isbn && books.some(book => book.id !== this.book?.id && isbnKey(book.isbn) === isbn)
          ? { duplicate: true } : null;
      }))],
    publisher: [this.book?.publisher ?? '', requiredText],
    publicationYear: [this.book?.publicationYear ?? null, [Validators.required,
      (control: AbstractControl) => validYear(control.value) ? null : { publicationYear: true }]],
    edition: [this.book?.edition ?? '', requiredText],
    language: [this.book?.language ?? 'English', requiredText],
    description: [this.book?.description ?? '', requiredText],
    coverImage: [this.book?.coverImage ?? '', Validators.pattern(BOOK_COVER_PATH)],
    shelfLocation: [this.book?.shelfLocation ?? '', requiredText],
    totalCopies: [this.book?.totalCopies ?? 0, [Validators.required, Validators.min(this.allocated),
      (control: AbstractControl) => validQuantity(control.value) ? null : { quantity: true }]]
  });
  saving = false;
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly book: Book | null,
    private readonly forms: FormBuilder, private readonly books: BookService,
    private readonly dialog: MatDialogRef<BookEditorDialogComponent, Book>, private readonly snackBar: MatSnackBar) {}

  save(): void {
    this.form.markAllAsTouched();
    if (!this.form.valid || this.saving) {
      return;
    }
    this.saving = this.dialog.disableClose = true;
    const input: BookInput = this.form.getRawValue();
    const request = this.book ? this.books.update(this.book.id, input) : this.books.create(input);
    request.pipe(takeUntil(this.destroyed), finalize(() => this.saving = this.dialog.disableClose = false)).subscribe({
      next: book => this.dialog.close(book),
      error: (error: Error) => this.snackBar.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
