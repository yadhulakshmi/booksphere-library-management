import { Book, BookInput } from '../models/library';
import { cleanBook, newBook, validateBook } from './book-records';
import { withAvailability } from './book-rules';
import { activeReservation, CirculationState } from './circulation-state';

function find(books: readonly Book[], id: string): number {
  const index = books.findIndex(record => record.id === id);
  if (index < 0) {
    throw new Error('This book is no longer in the inventory.');
  }
  return index;
}

export function addBook(books: Book[], input: BookInput, now: Date): Book {
  validateBook(books, input, 0);
  const book = newBook(input, now.toISOString());
  books.push(book);
  return book;
}

export function editBook(books: Book[], id: string, input: BookInput, now: Date): Book {
  const index = find(books, id);
  const previous = books[index];
  validateBook(books, input, previous.borrowedCopies + previous.reservedCopies, id);
  const updated = withAvailability({ ...previous, ...cleanBook(input), lastUpdated: now.toISOString() });
  books[index] = updated;
  return updated;
}

export function removeBook(books: Book[], id: string, state?: CirculationState): Book {
  const index = find(books, id);
  const book = books[index];
  if (book.borrowedCopies || book.reservedCopies ||
      state?.reservations.some(item => item.bookId === id && activeReservation(item))) {
    throw new Error('This book has active loans or reservations and cannot be deleted.');
  }
  books.splice(index, 1);
  return book;
}
