import { PageEvent } from '@angular/material/paginator';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BookFilters, BookSort, EMPTY_FILTERS, bookLanguages, filterBooks, sortBooks } from '../../core/book-query';
import { Book } from '../../models/library';

interface Query {
  filters: BookFilters;
  sort: BookSort;
  pageIndex: number;
  pageSize: number;
}

export class BookBrowser {
  private readonly query: BehaviorSubject<Query>;
  readonly view$;

  constructor(books$: Observable<readonly Book[]>, pageSize: number) {
    this.query = new BehaviorSubject<Query>({
      filters: { ...EMPTY_FILTERS }, sort: { key: 'title', direction: 'asc' }, pageIndex: 0, pageSize
    });
    this.view$ = combineLatest([books$, this.query]).pipe(map(([books, query]) => {
      const results = sortBooks(filterBooks(books, query.filters), query.sort);
      const pageIndex = Math.min(query.pageIndex, Math.max(0, Math.ceil(results.length / query.pageSize) - 1));
      const offset = pageIndex * query.pageSize;
      const counts = books.reduce((totals, book) => ({
        copies: totals.copies + book.totalCopies,
        available: totals.available + book.availableCopies,
        allocated: totals.allocated + book.borrowedCopies + book.reservedCopies
      }), { copies: 0, available: 0, allocated: 0 });
      return {
        total: books.length, demo: books.some(book => book.demonstration), counts,
        languages: bookLanguages(books), length: results.length,
        page: results.slice(offset, offset + query.pageSize), pageSize: query.pageSize, pageIndex, sort: query.sort
      };
    }));
  }

  filter(filters: BookFilters): void {
    this.query.next({ ...this.query.value, filters, pageIndex: 0 });
  }

  sort(sort: BookSort): void {
    this.query.next({ ...this.query.value, sort, pageIndex: 0 });
  }

  paginate(event: PageEvent): void {
    this.query.next({ ...this.query.value, pageIndex: event.pageIndex, pageSize: event.pageSize });
  }
}
