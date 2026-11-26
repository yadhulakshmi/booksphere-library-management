import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { BOOK_CATEGORIES } from '../../core/book-rules';
import { BookFilters, EMPTY_FILTERS } from '../../core/book-query';

@Component({
  selector: 'app-book-filters',
  templateUrl: './book-filters.component.html'
})
export class BookFiltersComponent implements OnDestroy {
  @Input() languages: readonly string[] = [];
  @Output() readonly filtersChange = new EventEmitter<BookFilters>();
  readonly categories = BOOK_CATEGORIES;
  readonly form = this.forms.group({ ...EMPTY_FILTERS });
  private readonly changes = this.form.valueChanges.subscribe(value => this.filtersChange.emit(value));

  constructor(private readonly forms: FormBuilder) {}

  clear(): void {
    this.form.reset({ ...EMPTY_FILTERS });
  }

  ngOnDestroy(): void {
    this.changes.unsubscribe();
  }
}
