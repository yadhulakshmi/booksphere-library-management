import { Injectable } from '@angular/core';
import { BehaviorSubject, defer, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { parseBooks } from '../core/book-records';
import { addBook, editBook, removeBook } from '../core/book-commands';
import { demoBooks } from '../core/book-seed';
import { CirculationState, recordActivity } from '../core/circulation-state';
import { Book, BookInput } from '../models/library';
import { BookStorageService } from './book-storage.service';
import { CirculationCoordinator } from './circulation-coordinator.service';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly records = new BehaviorSubject<readonly Book[]>([]);
  private readonly storageWarning = new BehaviorSubject('');
  readonly books$ = this.coordinator
    ? this.coordinator.state$.pipe(map(state => state?.books ?? []))
    : this.records.asObservable();
  readonly storageWarning$ = this.coordinator?.warning$ ?? this.storageWarning.asObservable();

  constructor(private readonly storage: BookStorageService, private readonly coordinator?: CirculationCoordinator) {
    if (!coordinator) {
      this.loadLegacyStorage();
    }
  }

  create(input: BookInput): Observable<Book> {
    const standalone = () => this.mutate('book-added', (books, now) => addBook(books, input, now));
    return this.coordinator?.execute('book.create', input, standalone) ?? standalone();
  }

  update(id: string, input: BookInput): Observable<Book> {
    const standalone = () => this.mutate('book-updated', (books, now) => editBook(books, id, input, now));
    return this.coordinator?.execute('book.update', { id, book: input }, standalone) ?? standalone();
  }

  delete(id: string): Observable<void> {
    const standalone = () => this.mutate('book-deleted', (books, _, state) => removeBook(books, id, state))
      .pipe(map(() => undefined));
    return this.coordinator?.execute('book.delete', { id }, standalone) ?? standalone();
  }

  private mutate(type: 'book-added' | 'book-updated' | 'book-deleted',
    command: (books: Book[], now: Date, state?: CirculationState) => Book): Observable<Book> {
    if (this.coordinator) {
      return this.coordinator.run(({ state, now }) => {
        const book = command(state.books, now, state);
        recordActivity(state, type, book.id, now, book.title);
        return book;
      }).pipe(map(({ result, state }) => state.books.find(book => book.id === result.id) ?? result));
    }
    return defer(() => {
      const books = [...this.records.value];
      const result = command(books, new Date());
      this.persistLegacy(books);
      return of(result);
    });
  }

  private loadLegacyStorage(): void {
    let saved: string | null;
    try {
      saved = this.storage.read();
    } catch {
      this.storageWarning.next('Browser storage is unavailable. Changes require writable browser storage.');
      return;
    }
    if (saved === null) {
      const seeds = demoBooks(new Date().toISOString());
      this.records.next(seeds);
      try {
        this.persistLegacy(seeds);
      } catch {
        this.storageWarning.next('Demonstration books could not be saved to browser storage.');
      }
      return;
    }
    try {
      this.records.next(parseBooks(JSON.parse(saved)));
    } catch {
      this.storageWarning.next('Saved inventory could not be read. The next successful change will replace the invalid inventory.');
    }
  }

  private persistLegacy(books: readonly Book[]): void {
    try {
      this.storage.write(JSON.stringify(books));
    } catch {
      throw new Error('Browser storage could not save this change. The inventory has not changed.');
    }
    this.records.next(books);
    this.storageWarning.next('');
  }
}
