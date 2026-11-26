import { firstValueFrom } from 'rxjs';
import { demoBooks } from '../core/book-seed';
import { lateDays, shiftDay } from '../core/circulation-dates';
import { CirculationState, parseCirculation, queuePositions } from '../core/circulation-state';
import { localDate } from '../core/member-rules';
import { Book, Member } from '../models/library';
import { BookService } from './book.service';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { CirculationService } from './circulation.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from './circulation-test-storage';
import { LibraryActivityService } from './library-activity.service';
import { LibraryPolicyService } from './library-policy.service';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberService } from './member.service';
import { ReservationService } from './reservation.service';

describe('Phase 3C circulation transactions', () => {
  const today = localDate();
  const policy = new LibraryPolicyService();
  const legacyBooks = demoBooks(new Date().toISOString());
  let legacy: MemoryBookStorage;
  let storage: MemoryCirculationStorage;
  let memberStorage: MemoryMemberStorage;
  let coordinator: CirculationCoordinator;
  let service: CirculationService;
  let reservations: ReservationService;
  let members: MemberService;
  let books: BookService;
  let patrons: Member[];
  let title: Book;
  const snapshot = (): CirculationState => parseCirculation(storage.value!);
  const inventory = (): Book => snapshot().books.find(book => book.id === title.id)!;
  const issue = (member = patrons[0], date = today) => firstValueFrom(service.issue(member.id, title.id, date));
  const reserve = (member: Member) => firstValueFrom(reservations.create(member.id, title.id));

  beforeEach(async () => {
    legacy = new MemoryBookStorage(JSON.stringify(legacyBooks));
    storage = new MemoryCirculationStorage();
    memberStorage = new MemoryMemberStorage();
    members = new MemberService(memberStorage, new MemberDeletionPolicy(storage));
    coordinator = new CirculationCoordinator(storage, legacy, memberStorage, members, policy);
    service = new CirculationService(coordinator);
    reservations = new ReservationService(coordinator);
    books = new BookService(legacy, coordinator);
    await coordinator.refresh();
    title = snapshot().books.find(book => book.totalCopies >= 2)!;
    await firstValueFrom(books.update(title.id, { ...title, totalCopies: 1 }));
    patrons = (await firstValueFrom(members.members$)).filter(member => member.status === 'Active');
  });

  afterEach(() => coordinator.ngOnDestroy());

  it('issues a loan with a policy due date, matching inventory, and recorded activity', async () => {
    const loan = await issue();
    expect(loan.dueAt).toBe(shiftDay(today, policy.current.lendingDays));
    expect(inventory().availableCopies).toBe(0);
    expect(inventory().borrowedCopies).toBe(1);
    const activity = await firstValueFrom(new LibraryActivityService(coordinator).activity$);
    expect(activity.some(item => item.type === 'checkout' && item.entityId === loan.id)).toBeTrue();
  });

  it('rejects ineligible members and unavailable copies', async () => {
    const ineligible = (await firstValueFrom(members.members$)).find(member => member.status !== 'Active')!;
    await expectAsync(issue(ineligible)).toBeRejectedWithError(/active, unexpired/);
    await issue();
    await expectAsync(issue(patrons[1])).toBeRejectedWithError(/No copy/);
  });

  it('rejects duplicate active loans and enforces the borrowing limit', async () => {
    await issue();
    await expectAsync(issue()).toBeRejectedWithError(/already has an active loan/);
    const other = snapshot().books.filter(book => book.id !== title.id && book.totalCopies > 0);
    for (const book of other.slice(0, policy.current.maxLoansPerMember - 1)) {
      await firstValueFrom(service.issue(patrons[0].id, book.id, today));
    }
    await expectAsync(firstValueFrom(service.issue(patrons[0].id, other[6].id, today)))
      .toBeRejectedWithError(/loan limit/);
  });

  it('returns a loan once and captures overdue duration for later fine calculation', async () => {
    const loan = await issue(patrons[0], shiftDay(today, -20));
    const returned = await firstValueFrom(service.returnBook(loan.id, today));
    expect(returned.overdueDaysAtReturn).toBe(lateDays(loan.dueAt, today));
    expect(inventory().availableCopies).toBe(1);
    await expectAsync(firstValueFrom(service.returnBook(loan.id, today))).toBeRejectedWithError(/no longer active/);
  });

  it('extends the current due date and enforces renewals and overdue rules', async () => {
    const loan = await issue();
    const renewed = await firstValueFrom(service.renew(loan.id));
    expect(renewed.dueAt).toBe(shiftDay(loan.dueAt, policy.current.renewalDays));
    expect(renewed.renewals).toBe(1);
    await firstValueFrom(service.renew(loan.id));
    await expectAsync(firstValueFrom(service.renew(loan.id))).toBeRejectedWithError(/renewal limit/);
    await firstValueFrom(service.returnBook(loan.id, today));
    const overdue = await issue(patrons[1], shiftDay(today, -20));
    await expectAsync(firstValueFrom(service.renew(overdue.id))).toBeRejectedWithError(/Overdue/);
  });

  it('blocks renewal while another eligible member is waiting', async () => {
    const loan = await issue();
    await reserve(patrons[1]);
    await expectAsync(firstValueFrom(service.renew(loan.id))).toBeRejectedWithError(/active reservation/);
    await expectAsync(reserve(patrons[0])).toBeRejectedWithError(/active loan/);
  });

  it('queues distinct reservations in placement order and promotes on return', async () => {
    const loan = await issue();
    const first = await reserve(patrons[1]);
    const second = await reserve(patrons[2]);
    expect(first.status).toBe('waiting');
    expect(queuePositions(snapshot().reservations).get(second.id)).toBe(2);
    expect(inventory().reservedCopies).toBe(0);
    await expectAsync(reserve(patrons[1])).toBeRejectedWithError(/active reservation/);
    await firstValueFrom(service.returnBook(loan.id, today));
    const [ready, waiting] = snapshot().reservations;
    expect(ready.status).toBe('ready');
    expect(ready.expiresAt).toBe(shiftDay(today, policy.current.reservationCollectionDays));
    expect(waiting.status).toBe('waiting');
    expect(inventory().reservedCopies).toBe(1);
  });

  it('releases cancelled and expired holds and promotes the next waiting member', async () => {
    const first = await reserve(patrons[0]);
    const second = await reserve(patrons[1]);
    const third = await reserve(patrons[2]);
    expect(first.status).toBe('ready');
    await firstValueFrom(reservations.cancel(first.id));
    const state = snapshot();
    state.reservations = state.reservations.map(record => record.id === second.id ? {
      ...record, placedAt: shiftDay(today, -5), readyAt: shiftDay(today, -5), expiresAt: shiftDay(today, -2)
    } : record);
    storage.value = JSON.stringify(state);
    await coordinator.refresh();
    const updated = snapshot().reservations;
    expect(updated.map(record => record.status)).toEqual(['cancelled', 'expired', 'ready']);
    expect(updated[2].id).toBe(third.id);
    expect(inventory().availableCopies).toBe(0);
  });

  it('converts a ready reservation into a loan exactly once and protects the allocated copy', async () => {
    const ready = await reserve(patrons[0]);
    await expectAsync(issue(patrons[1])).toBeRejectedWithError(/No copy/);
    const collected = await firstValueFrom(service.issue(patrons[0].id, title.id, today, ready.id));
    expect(snapshot().reservations[0].fulfilledAt).toBe(today);
    expect(inventory().reservedCopies).toBe(0);
    expect(inventory().borrowedCopies).toBe(1);
    await expectAsync(firstValueFrom(service.issue(patrons[0].id, title.id, today, ready.id))).toBeRejected();
    expect(snapshot().loans.map(loan => loan.id)).toEqual([collected.id]);
  });

  it('cancels ineligible reservations and promotes an eligible successor', async () => {
    const first = await reserve(patrons[0]);
    const next = await reserve(patrons[1]);
    await firstValueFrom(members.changeStatus(patrons[0].id, 'Suspended'));
    await coordinator.refresh();
    expect(snapshot().reservations.find(record => record.id === first.id)?.status).toBe('cancelled');
    expect(snapshot().reservations.find(record => record.id === next.id)?.status).toBe('ready');
  });

  it('prevents negative stock and promotes the next member when copies are added', async () => {
    await issue();
    const waiting = await reserve(patrons[1]);
    await expectAsync(firstValueFrom(books.update(title.id, { ...title, totalCopies: 0 })))
      .toBeRejectedWithError(/allocated copies/);
    const updated = await firstValueFrom(books.update(title.id, { ...title, totalCopies: 2 }));
    expect(updated.borrowedCopies).toBe(1);
    expect(updated.reservedCopies).toBe(1);
    expect(updated.availableCopies).toBe(0);
    expect(snapshot().reservations.find(item => item.id === waiting.id)?.status).toBe('ready');
  });

  it('blocks deletion for active loans and waiting or ready reservations and retains historical names', async () => {
    const loan = await issue();
    const waiting = await reserve(patrons[1]);
    await expectAsync(firstValueFrom(books.delete(title.id))).toBeRejectedWithError(/active loans or reservations/);
    await expectAsync(firstValueFrom(members.delete(patrons[0].id))).toBeRejectedWithError(/active loans or reservations/);
    await expectAsync(firstValueFrom(members.delete(patrons[1].id))).toBeRejectedWithError(/active loans or reservations/);
    await firstValueFrom(service.returnBook(loan.id, today));
    await expectAsync(firstValueFrom(books.delete(title.id))).toBeRejectedWithError(/active loans or reservations/);
    await firstValueFrom(books.update(title.id, { ...title, totalCopies: 1 }));
    await firstValueFrom(reservations.cancel(waiting.id));
    await firstValueFrom(members.delete(patrons[0].id));
    await firstValueFrom(books.delete(title.id));
    expect(snapshot().loans[0].bookTitle).toBe(title.title);
    expect(snapshot().loans[0].membershipId).toBe(patrons[0].membershipId);
    expect(snapshot().reservations[0].id).toBe(waiting.id);
  });

  it('blocks deletion of a zero-copy title that only has a waiting reservation', async () => {
    await firstValueFrom(books.update(title.id, { ...title, totalCopies: 0 }));
    expect((await reserve(patrons[0])).status).toBe('waiting');
    await expectAsync(firstValueFrom(books.delete(title.id))).toBeRejectedWithError(/active loans or reservations/);
  });

  it('migrates only once and preserves IDs, title metadata and copy totals from previous storage', async () => {
    const original = legacyBooks.find(book => book.borrowedCopies > 0 && book.id !== title.id)!;
    const migrated = snapshot().books.find(book => book.id === original.id)!;
    expect(migrated.title).toBe(original.title);
    expect(migrated.totalCopies).toBe(original.totalCopies);
    expect(migrated.availableCopies).toBe(original.totalCopies);
    expect(snapshot().loans).toEqual([]);
    const loan = await issue();
    const reopened = new CirculationCoordinator(storage, legacy, memberStorage, members, policy);
    try {
      await reopened.refresh();
      expect((await firstValueFrom(reopened.state$))?.loans.map(item => item.id)).toEqual([loan.id]);
      expect(legacy.value).toBe(JSON.stringify(legacyBooks));
    } finally {
      reopened.ngOnDestroy();
    }
  });

  it('supplies consistent labeled examples only when legacy inventory is uninitialized', async () => {
    const fresh = new MemoryCirculationStorage();
    const freshCoordinator = new CirculationCoordinator(fresh, new MemoryBookStorage(null), memberStorage, members, policy);
    try {
      await freshCoordinator.refresh();
      const state = parseCirculation(fresh.value!);
      expect(state.loans.every(loan => loan.demonstration)).toBeTrue();
      expect(state.loans.length).toBe(4);
      expect(state.loans.some(loan => !!loan.returnedAt)).toBeTrue();
      expect(state.loans.some(loan => loan.renewals > 0)).toBeTrue();
      expect(state.loans.some(loan => !loan.returnedAt && loan.dueAt < today)).toBeTrue();
      expect(state.reservations.map(item => item.status)).toEqual(['ready', 'waiting']);
      expect(state.reservations.every(item => item.demonstration)).toBeTrue();
      await freshCoordinator.refresh();
      expect(parseCirculation(fresh.value!).loans.length).toBe(4);
    } finally {
      freshCoordinator.ngOnDestroy();
    }
  });

  it('rolls back a failed return and its queue promotion, then retries against the original state', async () => {
    const loan = await issue();
    const waiting = await reserve(patrons[1]);
    const before = storage.value;
    storage.fail = true;
    await expectAsync(firstValueFrom(service.returnBook(loan.id, today))).toBeRejectedWithError(/could not save/);
    expect(storage.value).toBe(before);
    expect((await firstValueFrom(service.loans$))[0].returnedAt).toBeNull();
    expect((await firstValueFrom(reservations.reservations$))[0].status).toBe('waiting');
    storage.fail = false;
    await firstValueFrom(service.returnBook(loan.id, today));
    expect(snapshot().reservations.find(item => item.id === waiting.id)?.status).toBe('ready');
  });

  it('preserves malformed storage and refuses mutations or member deletion', async () => {
    storage.value = '{bad snapshot';
    await coordinator.refresh();
    expect(await firstValueFrom(coordinator.warning$)).toContain('original storage was preserved');
    await expectAsync(issue()).toBeRejectedWithError(/original storage was preserved/);
    await expectAsync(firstValueFrom(members.delete(patrons[0].id))).toBeRejectedWithError(/blocked/);
    expect(storage.value).toBe('{bad snapshot');
  });

  it('queues competing requests so only one can claim the last copy', async () => {
    const results = await Promise.allSettled([issue(), issue(patrons[1])]);
    expect(results.filter(result => result.status === 'fulfilled').length).toBe(1);
    expect(snapshot().loans.length).toBe(1);
    expect(inventory().availableCopies).toBe(0);
  });
});
