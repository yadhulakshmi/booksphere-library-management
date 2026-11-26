import { Book, BookCategory, BookInput } from '../models/library';

export const BOOK_CATEGORIES: readonly BookCategory[] = [
  'Fiction', 'Technology', 'Science', 'History', 'Business',
  'Education', 'Biography', 'Literature', 'Psychology', 'Mathematics'
].map(name => ({ id: name.toLowerCase(), name }));

export function categoryName(id: string): string {
  return BOOK_CATEGORIES.find(category => category.id === id)?.name ?? id;
}

export const MIN_PUBLICATION_YEAR = 1;
export const currentYear = (): number => new Date().getFullYear();

const requiredFields = ['title', 'author', 'categoryId', 'publisher', 'edition', 'language', 'description', 'shelfLocation'] as const;

export function normalizeIsbn(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

export function validIsbn(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (isbn === '') {
    return value.trim() === '';
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    return Array.from(isbn).reduce((sum, digit, index) =>
      sum + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0;
  }
  return /^97[89]\d{10}$/.test(isbn) && isbn13Checksum(isbn.slice(0, 12)) === isbn[12];
}

function isbn13Checksum(prefix: string): string {
  const weighted = Array.from(prefix).reduce((sum, digit, index) =>
    sum + Number(digit) * (index % 2 ? 3 : 1), 0);
  return String((10 - weighted % 10) % 10);
}

export function isbnKey(value: string): string {
  const isbn = normalizeIsbn(value);
  const prefix = '978' + isbn.slice(0, 9);
  return isbn.length === 10 ? prefix + isbn13Checksum(prefix) : isbn;
}

export const BOOK_COVER_PATH = /^(https:\/\/[^\s]+|assets\/[^\s]+)$/i;

export function validQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validYear(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PUBLICATION_YEAR && value <= currentYear();
}

export function bookInputError(input: BookInput, allocated: number): string | null {
  if (requiredFields.some(field => typeof input[field] !== 'string' || !input[field].trim())) {
    return 'Complete all required book fields.';
  }
  if (!BOOK_CATEGORIES.some(category => category.id === input.categoryId)) {
    return 'Choose a valid category.';
  }
  if (typeof input.isbn !== 'string' || !validIsbn(input.isbn)) {
    return 'Enter a valid ISBN-10 or ISBN-13.';
  }
  if (typeof input.coverImage !== 'string' || (input.coverImage.trim() && !BOOK_COVER_PATH.test(input.coverImage.trim()))) {
    return 'Use an HTTPS URL or a project assets path for the cover.';
  }
  if (!validYear(input.publicationYear)) {
    return 'Enter a whole publication year from 1 to ' + currentYear() + '.';
  }
  if (!validQuantity(input.totalCopies)) {
    return 'Enter a non-negative whole number of copies.';
  }
  return input.totalCopies < allocated ? 'Total copies cannot be below ' + allocated + ' allocated copies.' : null;
}

export function withAvailability(book: Omit<Book, 'availableCopies' | 'status'>): Book {
  const availableCopies = book.totalCopies - book.borrowedCopies - book.reservedCopies;
  return { ...book, availableCopies, status: availableCopies > 0 ? 'Available' :
    book.totalCopies === 0 ? 'Out of stock' : 'Unavailable' };
}
