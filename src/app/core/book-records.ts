import { Book, BookInput } from '../models/library';
import { bookInputError, isbnKey, normalizeIsbn, validQuantity, withAvailability } from './book-rules';

export function parseBooks(parsed: unknown, legacy = true): Book[] {
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid inventory.');
  }
  const ids = new Set<string>();
  const isbns = new Set<string>();
  return parsed.map((book: Book) => {
    if (!book || typeof book.id !== 'string' || !book.id.trim() || ids.has(book.id) ||
        (legacy && (!validQuantity(book.borrowedCopies) || !validQuantity(book.reservedCopies))) ||
        bookInputError(book, legacy ? book.borrowedCopies + book.reservedCopies : 0) ||
        typeof book.demonstration !== 'boolean' || !Number.isFinite(Date.parse(book.dateAdded)) ||
        !Number.isFinite(Date.parse(book.lastUpdated))) {
      throw new Error('Invalid inventory record.');
    }
    const isbn = isbnKey(book.isbn);
    if (isbn && isbns.has(isbn)) {
      throw new Error('Duplicate ISBN in saved inventory.');
    }
    ids.add(book.id);
    if (isbn) {
      isbns.add(isbn);
    }
    return withAvailability(legacy ? book : { ...book, borrowedCopies: 0, reservedCopies: 0 });
  });
}

export function cleanBook(input: BookInput): BookInput {
  return {
    title: input.title.trim(), author: input.author.trim(), isbn: normalizeIsbn(input.isbn),
    categoryId: input.categoryId, publisher: input.publisher.trim(), publicationYear: input.publicationYear,
    edition: input.edition.trim(), language: input.language.trim(), description: input.description.trim(),
    coverImage: input.coverImage.trim(), shelfLocation: input.shelfLocation.trim(), totalCopies: input.totalCopies
  };
}

export function validateBook(books: readonly Book[], input: BookInput, allocated: number, id?: string): void {
  const error = bookInputError(input, allocated);
  if (error) {
    throw new Error(error);
  }
  const isbn = isbnKey(input.isbn);
  if (isbn && books.some(book => book.id !== id && isbnKey(book.isbn) === isbn)) {
    throw new Error('A book with this ISBN is already in the inventory.');
  }
}

export function newBook(input: BookInput, timestamp: string): Book {
  const id = 'book-' + Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
  return withAvailability({
    ...cleanBook(input), id, borrowedCopies: 0, reservedCopies: 0,
    dateAdded: timestamp, lastUpdated: timestamp, demonstration: false
  });
}
