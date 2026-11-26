import { firstValueFrom } from 'rxjs';
import { BookInput } from '../models/library';
import { BookService } from './book.service';
import { BookStorageService } from './book-storage.service';

describe('BookService', () => {
  const input: BookInput = {
    title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', categoryId: 'fiction',
    isbn: '978-0-441-47812-5', publisher: 'Ace Books', publicationYear: 1987,
    edition: 'Ace edition', language: 'English', description: 'An envoy visits an unfamiliar world.',
    coverImage: '', shelfLocation: 'FIC-05', totalCopies: 3
  };
  let stored: string | null;
  let storage: jasmine.SpyObj<BookStorageService>;
  let service: BookService;

  beforeEach(() => {
    stored = null;
    storage = jasmine.createSpyObj<BookStorageService>('BookStorageService', ['read', 'write']);
    storage.read.and.callFake(() => stored);
    storage.write.and.callFake(value => stored = value);
    service = new BookService(storage);
  });

  it('seeds 40 demonstration records once and does not reseed initialized empty inventory', async () => {
    const seeded = await firstValueFrom(service.books$);
    expect(seeded.length).toBe(40);
    expect(seeded.every(book => book.demonstration)).toBeTrue();
    const count = storage.write.calls.count();
    expect((await firstValueFrom(new BookService(storage).books$)).map(book => book.id)).toEqual(seeded.map(book => book.id));
    expect(storage.write.calls.count()).toBe(count);
    stored = '[]';
    expect(await firstValueFrom(new BookService(storage).books$)).toEqual([]);
    expect(storage.write.calls.count()).toBe(count);
  });

  it('creates a normalized, independently identifiable book and emits the new inventory', async () => {
    const sizes: number[] = [];
    const subscription = service.books$.subscribe(books => sizes.push(books.length));
    const created = await firstValueFrom(service.create(input));
    expect(created.isbn).toBe('9780441478125');
    expect(created.availableCopies).toBe(3);
    expect(created.status).toBe('Available');
    expect(created.demonstration).toBeFalse();
    expect(sizes).toEqual([40, 41]);
    subscription.unsubscribe();
  });

  it('updates metadata and inventory while keeping the ID, date added and allocation', async () => {
    const books = await firstValueFrom(service.books$);
    const original = books.find(book => book.borrowedCopies > 0)!;
    const updated = await firstValueFrom(service.update(original.id, {
      ...original, title: 'Updated title', totalCopies: original.totalCopies + 2
    }));
    expect(updated.id).toBe(original.id);
    expect(updated.dateAdded).toBe(original.dateAdded);
    expect(updated.title).toBe('Updated title');
    expect(updated.borrowedCopies).toBe(original.borrowedCopies);
    expect(updated.availableCopies).toBe(original.availableCopies + 2);
  });

  it('rejects duplicate equivalents in ISBN-10 and ISBN-13 form and allows the same record to retain its ISBN', async () => {
    const created = await firstValueFrom(service.create(input));
    await expectAsync(firstValueFrom(service.create({ ...input, isbn: '0-441-47812-3' })))
      .toBeRejectedWithError(/ISBN.*already/);
    await expectAsync(firstValueFrom(service.update(created.id, { ...input, isbn: '0441478123' }))).toBeResolved();
  });

  it('rejects invalid checksums, invalid years and missing required values', async () => {
    await expectAsync(firstValueFrom(service.create({ ...input, isbn: '9780441478124' })))
      .toBeRejectedWithError(/valid ISBN/);
    await expectAsync(firstValueFrom(service.create({ ...input, publicationYear: 0 })))
      .toBeRejectedWithError(/publication year/);
    await expectAsync(firstValueFrom(service.create({ ...input, title: '  ' })))
      .toBeRejectedWithError(/required/);
  });

  it('rejects fractional, negative and below-allocation totals', async () => {
    const books = await firstValueFrom(service.books$);
    const allocated = books.find(book => book.reservedCopies > 0)!;
    for (const totalCopies of [-1, 2.5]) {
      await expectAsync(firstValueFrom(service.create({ ...input, totalCopies }))).toBeRejectedWithError(/whole number/);
    }
    await expectAsync(firstValueFrom(service.update(allocated.id, { ...allocated, totalCopies: 0 })))
      .toBeRejectedWithError(/allocated copies/);
  });

  it('blocks deletion for borrowed and reserved books and persists eligible deletion', async () => {
    const books = await firstValueFrom(service.books$);
    const borrowed = books.find(book => book.borrowedCopies > 0)!;
    const reserved = books.find(book => book.reservedCopies > 0)!;
    for (const book of [borrowed, reserved]) {
      await expectAsync(firstValueFrom(service.delete(book.id))).toBeRejectedWithError(/active loans or reservations/);
    }
    const eligible = await firstValueFrom(service.create(input));
    await firstValueFrom(service.delete(eligible.id));
    const restored = await firstValueFrom(new BookService(storage).books$);
    expect(restored.some(book => book.id === eligible.id)).toBeFalse();
  });

  it('restores edits from storage and derives availability without trusting saved computed fields', async () => {
    const created = await firstValueFrom(service.create(input));
    await firstValueFrom(service.update(created.id, { ...input, totalCopies: 8 }));
    const records = JSON.parse(stored!);
    records[records.length - 1].availableCopies = 1000;
    stored = JSON.stringify(records);
    const books = await firstValueFrom(new BookService(storage).books$);
    expect(books.find(book => book.id === created.id)?.availableCopies).toBe(8);
  });

  it('reports corrupt data and leaves it in place until a successful change', async () => {
    stored = '[invalid';
    const restored = new BookService(storage);
    expect(await firstValueFrom(restored.books$)).toEqual([]);
    expect(await firstValueFrom(restored.storageWarning$)).toContain('could not be read');
    expect(stored).toBe('[invalid');
    await firstValueFrom(restored.create(input));
    expect(await firstValueFrom(restored.storageWarning$)).toBe('');
  });

  it('keeps the reactive inventory unchanged if persistence fails', async () => {
    storage.write.and.throwError('Quota exceeded');
    await expectAsync(firstValueFrom(service.create(input))).toBeRejectedWithError(/could not save/);
    expect((await firstValueFrom(service.books$)).length).toBe(40);
  });
});
