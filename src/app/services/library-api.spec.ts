import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { dashboardAnalytics } from '../core/analytics';
import { initialCirculation } from '../core/circulation-migration';
import { DEFAULT_LIBRARY_SETTINGS } from '../core/library-policies';
import { applyLibraryCommand, parseLibrarySnapshot } from '../core/library-transaction';
import { localDate, memberView } from '../core/member-rules';
import { demoMembers } from '../core/member-seed';
import { buildReport, defaultReportQuery } from '../core/reports';
import { BookInput } from '../models/library';
import { LibrarySnapshot } from '../models/library-api';
import { AnalyticsService } from './analytics.service';
import { BookService } from './book.service';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from './circulation-test-storage';
import { LibraryActivityService } from './library-activity.service';
import { LibraryApiClient, LIBRARY_DATA_CONFIG } from './library-api-client.service';
import { LibraryApiErrorInterceptor } from './library-api-error.interceptor';
import { LibraryApiState } from './library-api-state.service';
import { LibraryPolicyService } from './library-policy.service';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberService } from './member.service';

const book: BookInput = {
  title: 'HTTP Test Book', author: 'Demo Author', isbn: '', categoryId: 'fiction', publisher: 'Demo Press',
  publicationYear: 2024, edition: 'First', language: 'English', description: 'Fictional test title.',
  coverImage: '', shelfLocation: 'A1', totalCopies: 1
};

function fixture(): LibrarySnapshot {
  const now = new Date();
  const today = localDate(now);
  const records = demoMembers(now);
  return { revision: 0, members: { records, lastIssued: records.length },
    circulation: initialCirculation('[]', { members: records.map(record => memberView(record, today)),
      policy: DEFAULT_LIBRARY_SETTINGS, now, today }) };
}

function configure(mode: 'api' | 'standalone') {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [LibraryApiState,
      { provide: LIBRARY_DATA_CONFIG, useValue: { production: false, dataMode: mode, apiBaseUrl: '/api' } },
      { provide: HTTP_INTERCEPTORS, useClass: LibraryApiErrorInterceptor, multi: true }]
  });
  return { api: TestBed.inject(LibraryApiState), client: TestBed.inject(LibraryApiClient),
    http: TestBed.inject(HttpTestingController) };
}

describe('BookSphere Mock API adapter', () => {
  let api: LibraryApiState;
  let client: LibraryApiClient;
  let http: HttpTestingController;

  beforeEach(() => ({ api, client, http } = configure('api')));
  afterEach(() => http.verify());

  async function hydrate(snapshot = fixture()) {
    const pending = api.refresh();
    await Promise.resolve();
    http.expectOne({ url: '/api/snapshot', method: 'GET' }).flush(snapshot);
    await pending;
    return snapshot;
  }

  it('shows initial loading, deduplicates reads and publishes the typed snapshot after confirmation', async () => {
    const observed: boolean[] = [];
    const loading = api.loading$.subscribe(value => observed.push(value));
    const pending = api.refresh();
    expect(api.refresh()).toBe(pending);
    expect(await firstValueFrom(api.snapshot$)).toBeNull();
    await Promise.resolve();
    http.expectOne({ url: '/api/snapshot', method: 'GET' }).flush(fixture());
    await pending;
    expect((await firstValueFrom(api.snapshot$))?.members.records.length).toBe(30);
    expect(observed).toEqual([false, true, false]);
    loading.unsubscribe();
  });

  it('uses the correct REST verbs, encoded paths, revision and idempotency headers', async () => {
    const snapshot = fixture();
    const post = firstValueFrom(client.execute('book.create', book, 0, 'create'));
    const create = http.expectOne({ url: '/api/books', method: 'POST' });
    expect(create.request.headers.get('If-Match')).toBe('"0"');
    expect(create.request.headers.get('Idempotency-Key')).toBe('create');
    expect(create.request.body).toEqual(book);
    create.flush({ snapshot, result: null });
    await post;
    const put = firstValueFrom(client.execute('book.update', { id: 'space/id', book }, 1, 'update'));
    http.expectOne({ url: '/api/books/space%2Fid', method: 'PUT' }).flush({ snapshot, result: null });
    await put;
    const patch = firstValueFrom(client.execute('member.status', { id: 'member-1', state: 'Suspended' }, 2, 'status'));
    http.expectOne({ url: '/api/members/member-1/status', method: 'PATCH' }).flush({ snapshot, result: null });
    await patch;
    const remove = firstValueFrom(client.execute('book.delete', { id: 'book-id' }, 3, 'delete'));
    http.expectOne({ url: '/api/books/book-id', method: 'DELETE' }).flush({ snapshot, result: null });
    await remove;
  });

  it('keeps last confirmed state on failed mutations and does not automatically retry', async () => {
    await hydrate();
    const operation = firstValueFrom(api.execute('book.create', book));
    const failure = expectAsync(operation).toBeRejectedWithError(/previous snapshot/);
    await Promise.resolve();
    http.expectOne('/api/books').flush({ message: 'The previous snapshot was preserved.' }, { status: 500, statusText: 'Failure' });
    await failure;
    expect((await firstValueFrom(api.snapshot$))?.revision).toBe(0);
    http.expectNone('/api/books');
  });

  it('reports an unavailable API without falling back and allows a safe read retry', async () => {
    const pending = api.refresh();
    await Promise.resolve();
    http.expectOne('/api/snapshot').error(new ProgressEvent('error'));
    await pending;
    expect(await firstValueFrom(api.snapshot$)).toBeNull();
    expect(await firstValueFrom(api.warning$)).toContain('unavailable');
    await expectAsync(firstValueFrom(api.execute('book.create', book))).toBeRejectedWithError(/unavailable/);
    http.expectNone('/api/books');
    await hydrate();
    expect(await firstValueFrom(api.warning$)).toBe('');
  });

  it('blocks subsequent writes on a revision conflict until a read refreshes state', async () => {
    await hydrate();
    const mutation = firstValueFrom(api.execute('book.create', book));
    const failed = expectAsync(mutation).toBeRejectedWithError(/changed elsewhere/);
    await Promise.resolve();
    http.expectOne('/api/books').flush({}, { status: 412, statusText: 'Stale' });
    await failed;
    await expectAsync(firstValueFrom(api.execute('book.create', book))).toBeRejectedWithError(/changed elsewhere/);
    http.expectNone('/api/books');
    await hydrate({ ...fixture(), revision: 4 });
    expect((await firstValueFrom(api.snapshot$))?.revision).toBe(4);
  });

  it('collapses duplicate submissions and updates inventory, analytics and reports only when the server confirms', async () => {
    class UntouchedStorage extends MemoryMemberStorage {
      override read(): string | null { throw new Error('Browser data must not be read'); }
      override write(): void { throw new Error('Browser data must not be written'); }
    }
    const legacy = new MemoryBookStorage('existing-browser-inventory');
    const members = new MemberService(new UntouchedStorage(), new MemberDeletionPolicy(), api);
    const coordinator = new CirculationCoordinator(new MemoryCirculationStorage(), legacy, new UntouchedStorage(),
      members, new LibraryPolicyService(), undefined, api);
    const analytics = new AnalyticsService(coordinator, members, new LibraryActivityService(coordinator), api);
    try {
      const snapshot = await hydrate();
      const books = new BookService(legacy, coordinator);
      const first = firstValueFrom(books.create(book));
      const second = firstValueFrom(books.create(book));
      expect(await firstValueFrom(api.mutating$)).toBeTrue();
      await Promise.resolve();
      const pending = http.expectOne('/api/books');
      expect(await firstValueFrom(books.books$)).toEqual([]);
      const change = applyLibraryCommand(parseLibrarySnapshot(snapshot), { type: 'book.create', input: book }, new Date());
      pending.flush({ snapshot: { ...change.snapshot, revision: 1 }, result: change.result });
      expect((await first).id).toBe((await second).id);
      expect(await firstValueFrom(api.mutating$)).toBeFalse();
      const source = await firstValueFrom(analytics.source$);
      expect(dashboardAnalytics(source, 7).inventory.titles).toBe(1);
      expect(buildReport(source, defaultReportQuery).rows[0].values['title']).toBe(book.title);
      expect(legacy.value).toBe('existing-browser-inventory');
    } finally {
      members.ngOnDestroy();
      coordinator.ngOnDestroy();
    }
  });

  it('reuses the request identity after an uncertain transport failure and an explicit fresh read', async () => {
    const snapshot = await hydrate();
    const original = firstValueFrom(api.execute('book.create', book));
    const rejected = expectAsync(original).toBeRejectedWithError(/did not confirm/);
    await Promise.resolve();
    const pending = http.expectOne('/api/books');
    const requestId = pending.request.headers.get('Idempotency-Key');
    pending.error(new ProgressEvent('error'));
    await rejected;
    const applied = applyLibraryCommand(parseLibrarySnapshot(snapshot), { type: 'book.create', input: book }, new Date());
    const committed = { ...applied.snapshot, revision: 1 };
    await hydrate(committed);
    const retry = firstValueFrom(api.execute('book.create', book));
    await Promise.resolve();
    const reused = http.expectOne('/api/books');
    expect(reused.request.headers.get('Idempotency-Key')).toBe(requestId);
    reused.flush({ snapshot: committed, result: applied.result });
    expect((await retry).title).toBe(book.title);
    expect((await firstValueFrom(api.snapshot$))?.circulation.books.length).toBe(1);
  });
});

describe('explicit standalone data mode', () => {
  it('runs the existing local storage path without requesting a Mock API', async () => {
    const { api, http } = configure('standalone');
    const memberStorage = new MemoryMemberStorage();
    const members = new MemberService(memberStorage, new MemberDeletionPolicy(), api);
    const legacy = new MemoryBookStorage('[]');
    const storage = new MemoryCirculationStorage();
    const coordinator = new CirculationCoordinator(storage, legacy, memberStorage, members,
      new LibraryPolicyService(), undefined, api);
    try {
      await api.refresh();
      await coordinator.refresh();
      const books = new BookService(legacy, coordinator);
      await firstValueFrom(books.create(book));
      expect(JSON.parse(storage.value!).books[0].title).toBe(book.title);
      http.expectNone(() => true);
      http.verify();
    } finally {
      coordinator.ngOnDestroy();
      members.ngOnDestroy();
    }
  });
});
