import { EMPTY_FILTERS, filterBooks, sortBooks } from './book-query';
import { demoBooks } from './book-seed';

describe('book query', () => {
  const books = demoBooks('2026-01-01T00:00:00Z');
  const booksWithIsbn = [{ ...books[0], isbn: '9780441478125' }, ...books.slice(1)];

  it('searches title, author, publisher and ISBN ignoring ISBN punctuation', () => {
    expect(filterBooks(books, { ...EMPTY_FILTERS, search: 'pride austen' }).map(book => book.title))
      .toEqual(['Pride and Prejudice']);
    expect(filterBooks(books, { ...EMPTY_FILTERS, search: 'addison-wesley' }).length).toBe(3);
    expect(filterBooks(booksWithIsbn, { ...EMPTY_FILTERS, search: '0-441-47812-3' }).length).toBe(1);
  });

  it('intersects search, category, language and availability', () => {
    const book = books.find(record => record.language === 'French' && record.categoryId === 'fiction')!;
    const filters = { search: 'verne', category: 'fiction', language: 'French', status: book.status };
    expect(filterBooks(books, filters)).toEqual([book]);
    expect(filterBooks(books, { ...filters, language: 'English' })).toEqual([]);
  });

  it('sorts numeric copy counts without mutating inventory order', () => {
    const sorted = sortBooks(books, { key: 'totalCopies', direction: 'desc' });
    expect(sorted[0].totalCopies).toBe(6);
    expect(sorted[sorted.length - 1].totalCopies).toBe(0);
    expect(books[0].title).toBe('Pride and Prejudice');
  });
});
