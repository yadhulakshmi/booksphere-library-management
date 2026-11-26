import { Book, BookStatus } from '../models/library';
import { categoryName, isbnKey, validIsbn } from './book-rules';

export interface BookFilters {
  search: string;
  category: string;
  language: string;
  status: BookStatus | '';
}

export const EMPTY_FILTERS: Readonly<BookFilters> = { search: '', category: '', language: '', status: '' };

export type BookSortKey = 'title' | 'author' | 'isbn' | 'category' | 'shelfLocation' |
  'totalCopies' | 'availableCopies' | 'status' | 'publicationYear' | 'dateAdded';

export interface BookSort {
  key: BookSortKey;
  direction: 'asc' | 'desc';
}

export function filterBooks(books: readonly Book[], filters: BookFilters): Book[] {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isbnQuery = filters.search.replace(/[\s-]/g, '');
  const isIsbnQuery = /^\d+[\dX]?$/i.test(isbnQuery);
  const fullIsbn = isIsbnQuery && validIsbn(isbnQuery) ? isbnKey(isbnQuery) : '';
  return books.filter(book => {
    const fields = [book.title, book.author, book.publisher, book.isbn].map(value => value.toLowerCase());
    const matchesSearch = terms.every(term => fields.some(field => field.includes(term))) ||
      (isIsbnQuery && (book.isbn.includes(isbnQuery.toUpperCase()) || (fullIsbn && isbnKey(book.isbn) === fullIsbn)));
    return matchesSearch && (!filters.category || book.categoryId === filters.category) &&
      (!filters.language || book.language.toLowerCase() === filters.language.toLowerCase()) &&
      (!filters.status || book.status === filters.status);
  });
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortBooks(books: readonly Book[], sort: BookSort): Book[] {
  return [...books].sort((left, right) => {
    const a = sort.key === 'category' ? categoryName(left.categoryId) : left[sort.key];
    const b = sort.key === 'category' ? categoryName(right.categoryId) : right[sort.key];
    const order = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
    return (sort.direction === 'asc' ? order : -order) || collator.compare(left.id, right.id);
  });
}

export function bookLanguages(books: readonly Book[]): string[] {
  const languages = new Map(books.map(book => [book.language.toLowerCase(), book.language]));
  return Array.from(languages.values()).sort(collator.compare);
}
