import { firstValueFrom } from 'rxjs';
import { demoBooks } from '../core/book-seed';
import { shiftDay } from '../core/circulation-dates';
import { parseCirculation } from '../core/circulation-state';
import { DEFAULT_LIBRARY_SETTINGS } from '../core/library-policies';
import { localDate } from '../core/member-rules';
import { Book, FinePaymentInput, Member } from '../models/library';
import { BookService } from './book.service';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { CirculationService } from './circulation.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from './circulation-test-storage';
import { FineService } from './fine.service';
import { LibraryPolicyService } from './library-policy.service';
import { LibrarySettingsService } from './library-settings.service';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberService } from './member.service';
import { ReservationService } from './reservation.service';

describe('Phase 3D fine and policy transactions', () => {
  const today = localDate();
  let legacy: MemoryBookStorage;
  let storage: MemoryCirculationStorage;
  let memberStorage: MemoryMemberStorage;
  let members: MemberService;
  let coordinator: CirculationCoordinator;
  let circulation: CirculationService;
  let reservations: ReservationService;
  let fines: FineService;
  let settings: LibrarySettingsService;
  let bookService: BookService;
  let patron: Member;
  let next: Member;
  let books: Book[];
  const snapshot = () => parseCirculation(storage.value!);
  const issue = (book = books[0], day = today) => firstValueFrom(circulation.issue(patron.id, book.id, day));
  const pay = (fineId: string, amountMinor: number, requestId = 'first', changes: Partial<FinePaymentInput> = {}) =>
    firstValueFrom(fines.pay(fineId, { amountMinor, requestId, method: 'Cash', paidOn: today,
      reference: '', notes: '', ...changes }));
  const assess = async () => {
    const loan = await issue(books[0], shiftDay(today, -34));
    await firstValueFrom(circulation.returnBook(loan.id, today));
    return snapshot().fines[0];
  };

  beforeEach(async () => {
    storage = new MemoryCirculationStorage();
    legacy = new MemoryBookStorage(JSON.stringify(demoBooks(new Date().toISOString())));
    memberStorage = new MemoryMemberStorage();
    members = new MemberService(memberStorage, new MemberDeletionPolicy(storage));
    const policy = new LibraryPolicyService();
    coordinator = new CirculationCoordinator(storage, legacy, memberStorage, members, policy);
    circulation = new CirculationService(coordinator);
    reservations = new ReservationService(coordinator);
    fines = new FineService(coordinator);
    settings = new LibrarySettingsService(coordinator, policy);
    bookService = new BookService(legacy, coordinator);
    await coordinator.refresh();
    const eligible = (await firstValueFrom(members.members$)).filter(member => member.status === 'Active');
    [patron, next] = eligible;
    books = snapshot().books.filter(book => book.totalCopies > 0);
  });

  afterEach(() => coordinator.ngOnDestroy());

  it('returns on the due date without assessing a fine', async () => {
    const loan = await issue(books[0], shiftDay(today, -14));
    const returned = await firstValueFrom(circulation.returnBook(loan.id, today));
    expect(returned.overdueDaysAtReturn).toBe(0);
    expect(snapshot().fines).toEqual([]);
  });

  it('assesses a late return once and synchronizes inventory and activity', async () => {
    const fine = await assess();
    expect(fine.assessedMinor).toBe(10000);
    expect(fine.status).toBe('Outstanding');
    expect(fine.originalDueAt).toBe(shiftDay(today, -20));
    expect(snapshot().books.find(book => book.id === fine.bookId)?.borrowedCopies).toBe(0);
    expect(snapshot().activity.some(item => item.type === 'fine' && item.entityId === fine.id)).toBeTrue();
    await expectAsync(firstValueFrom(circulation.returnBook(fine.loanId, today))).toBeRejectedWithError(/no longer active/);
    await coordinator.refresh();
    expect(snapshot().fines.length).toBe(1);
  });

  it('leaves active estimates unassessed and rejects payments for them', async () => {
    const loan = await issue(books[0], shiftDay(today, -34));
    expect(snapshot().fines).toEqual([]);
    await expectAsync(pay(loan.id, 500)).toBeRejectedWithError(/assessed fine/);
  });

  it('records partial and full payments with immutable history and correct status and activity', async () => {
    const fine = await assess();
    const partial = await pay(fine.id, 1237);
    expect(snapshot().fines[0]).toEqual(jasmine.objectContaining({
      status: 'Partially Paid', paidMinor: 1237, balanceMinor: 8763
    }));
    const final = await pay(fine.id, 8763, 'second', { method: 'UPI', reference: ' DEMO-42 ' });
    expect(snapshot().fines[0]).toEqual(jasmine.objectContaining({ status: 'Paid', balanceMinor: 0, paidMinor: 10000 }));
    expect(snapshot().payments).toEqual([partial, final]);
    expect(final.reference).toBe('DEMO-42');
    expect(snapshot().activity.map(item => item.type)).toContain('fine-partial-payment');
    expect(snapshot().activity.map(item => item.type)).toContain('fine-paid');
    await expectAsync(pay(fine.id, 1, 'third')).toBeRejectedWithError(/already been paid/);
  });

  it('rejects overpayment, invalid payment amounts, methods and dates', async () => {
    const fine = await assess();
    await expectAsync(pay(fine.id, 10001)).toBeRejectedWithError(/exceed/);
    for (const amount of [0, -1, 1.1]) {
      await expectAsync(pay(fine.id, amount)).toBeRejectedWithError(/positive amount/);
    }
    await expectAsync(pay(fine.id, 100, 'first', { paidOn: shiftDay(today, 1) })).toBeRejectedWithError(/payment date/);
    await expectAsync(pay(fine.id, 100, 'first', { method: 'Cheque' as FinePaymentInput['method'] }))
      .toBeRejectedWithError(/valid method/);
    expect(snapshot().payments).toEqual([]);
  });

  it('deduplicates concurrent and retried payment requests across reload', async () => {
    const fine = await assess();
    const [first, second] = await Promise.all([pay(fine.id, 1500), pay(fine.id, 1500)]);
    expect(second.id).toBe(first.id);
    expect(snapshot().payments.length).toBe(1);
    const reopened = new CirculationCoordinator(storage, legacy, memberStorage, members, new LibraryPolicyService());
    try {
      await reopened.refresh();
      const service = new FineService(reopened);
      expect((await firstValueFrom(service.payments$))[0]).toEqual(first);
      await expectAsync(pay(fine.id, 2000)).toBeRejectedWithError(/already used/);
      expect(snapshot().fines[0].balanceMinor).toBe(8500);
    } finally {
      reopened.ngOnDestroy();
    }
  });

  it('rolls back a failed payment and allows retry', async () => {
    const fine = await assess();
    const before = storage.value;
    storage.fail = true;
    await expectAsync(pay(fine.id, 1000)).toBeRejectedWithError(/could not save/);
    expect(storage.value).toBe(before);
    expect(await firstValueFrom(fines.payments$)).toEqual([]);
    expect((await firstValueFrom(fines.fines$))[0].balanceMinor).toBe(10000);
    storage.fail = false;
    await pay(fine.id, 1000);
    expect(snapshot().fines[0].balanceMinor).toBe(9000);
  });

  it('blocks issue, renewal, and collection at the threshold while retaining the hold', async () => {
    const loan = await issue(books[1]);
    const hold = await firstValueFrom(reservations.create(patron.id, books[2].id));
    const fine = await assess();
    await expectAsync(issue(books[3])).toBeRejectedWithError(/Borrowing is restricted/);
    await expectAsync(firstValueFrom(circulation.renew(loan.id))).toBeRejectedWithError(/Borrowing is restricted/);
    await expectAsync(firstValueFrom(circulation.issue(patron.id, hold.bookId, today, hold.id)))
      .toBeRejectedWithError(/Borrowing is restricted/);
    expect(snapshot().reservations[0].status).toBe('ready');
    expect(snapshot().reservations[0].expiresAt).toBe(hold.expiresAt);
    await firstValueFrom(circulation.returnBook(loan.id, today));
    await pay(fine.id, 1);
    await firstValueFrom(circulation.issue(patron.id, hold.bookId, today, hold.id));
    expect(snapshot().reservations[0].status).toBe('fulfilled');
  });

  it('blocks deletion with any unpaid fine and keeps paid history after eligible deletions', async () => {
    const fine = await assess();
    await pay(fine.id, 9900);
    await expectAsync(firstValueFrom(members.delete(patron.id))).toBeRejectedWithError(/outstanding fine/);
    await pay(fine.id, 100, 'final');
    await firstValueFrom(members.delete(patron.id));
    await firstValueFrom(bookService.delete(books[0].id));
    expect(snapshot().fines[0].bookTitle).toBe(books[0].title);
    expect(snapshot().payments[0].membershipId).toBe(patron.membershipId);
  });

  it('validates settings fields and persists normalized values with an activity record', async () => {
    for (const invalid of [
      { email: 'invalid' }, { phone: '1234' }, { closingTime: '08:00' }, { openingTime: '24:00' },
      { lendingDays: 0 }, { maxLoanRenewals: 21 }, { dailyFineMinor: -1 }, { graceDays: 1.5 },
      { restrictionThresholdMinor: 0 }
    ]) {
      await expectAsync(firstValueFrom(settings.save({ ...DEFAULT_LIBRARY_SETTINGS, ...invalid }))).toBeRejected();
    }
    const updated = await firstValueFrom(settings.save({ ...DEFAULT_LIBRARY_SETTINGS, name: '  Test Library  ', dailyFineMinor: 725 }));
    expect(updated.name).toBe('Test Library');
    expect(snapshot().settings.dailyFineMinor).toBe(725);
    expect(snapshot().activity.some(item => item.type === 'settings-updated')).toBeTrue();
    const policy = new LibraryPolicyService();
    const reopened = new CirculationCoordinator(storage, legacy, memberStorage, members, policy);
    try {
      await reopened.refresh();
      expect(policy.current).toEqual(updated);
    } finally {
      reopened.ngOnDestroy();
    }
  });

  it('restores defaults without modifying inventory, loans, reservations, fines or payments', async () => {
    const fine = await assess();
    await pay(fine.id, 1234);
    await firstValueFrom(reservations.create(next.id, books[1].id));
    await firstValueFrom(settings.save({ ...DEFAULT_LIBRARY_SETTINGS, lendingDays: 30 }));
    const before = snapshot();
    const restored = await firstValueFrom(settings.restoreDefaults());
    const after = snapshot();
    expect(restored).toEqual(DEFAULT_LIBRARY_SETTINGS);
    expect(after.books).toEqual(before.books);
    expect(after.loans).toEqual(before.loans);
    expect(after.reservations).toEqual(before.reservations);
    expect(after.fines).toEqual(before.fines);
    expect(after.payments).toEqual(before.payments);
    expect(after.activity[after.activity.length - 1].type).toBe('settings-restored');
  });

  it('retains loan renewal and fine terms, plus ready and waiting reservation terms after policy changes', async () => {
    const loan = await issue();
    const late = await issue(books[1], shiftDay(today, -20));
    await firstValueFrom(bookService.update(books[2].id, { ...books[2], totalCopies: 0 }));
    const waiting = await firstValueFrom(reservations.create(next.id, books[2].id));
    const ready = await firstValueFrom(reservations.create(next.id, books[3].id));
    await firstValueFrom(settings.save({ ...DEFAULT_LIBRARY_SETTINGS, lendingDays: 60, renewalDays: 2,
      maxLoanRenewals: 0, dailyFineMinor: 800, graceDays: 2, reservationCollectionDays: 10, maxLoansPerMember: 1 }));
    expect(snapshot().loans.find(item => item.id === loan.id)?.dueAt).toBe(loan.dueAt);
    expect(snapshot().reservations.find(item => item.id === ready.id)?.expiresAt).toBe(ready.expiresAt);
    expect((await firstValueFrom(circulation.renew(loan.id))).dueAt).toBe(shiftDay(loan.dueAt, 7));
    await expectAsync(issue(books[4])).toBeRejectedWithError(/loan limit/);
    await firstValueFrom(circulation.returnBook(late.id, today));
    expect(snapshot().fines[0].assessedMinor).toBe(3000);
    await firstValueFrom(bookService.update(books[2].id, { ...books[2], totalCopies: 1 }));
    expect(snapshot().reservations.find(item => item.id === waiting.id)?.expiresAt).toBe(shiftDay(today, 3));
    const future = await firstValueFrom(circulation.issue(next.id, books[4].id, today));
    expect(future.dueAt).toBe(shiftDay(today, 60));
    expect(future.terms.dailyFineMinor).toBe(800);
    expect(snapshot().fines[0].policy.dailyFineMinor).toBe(500);
  });

  it('applies the current borrowing threshold to subsequent eligibility checks', async () => {
    const fine = await assess();
    await expectAsync(issue(books[1])).toBeRejectedWithError(/restricted/);
    await firstValueFrom(settings.save({ ...DEFAULT_LIBRARY_SETTINGS, restrictionThresholdMinor: 20000 }));
    await issue(books[1]);
    expect(snapshot().fines[0].balanceMinor).toBe(fine.balanceMinor);
  });

  it('migrates v1 overdue returns once while preserving the original snapshot and identifiers', async () => {
    const assessed = await assess();
    const current = snapshot();
    const previous = JSON.stringify({
      version: 1, sequence: current.sequence, books: current.books,
      loans: current.loans.map(({ originalDueAt, terms, ...legacyLoan }) => legacyLoan),
      reservations: current.reservations.map(({ collectionDays, ...legacyReservation }) => legacyReservation),
      activity: current.activity.filter(item => item.type !== 'fine')
    });
    storage.value = null;
    storage.previous = previous;
    await coordinator.refresh();
    const migrated = snapshot();
    expect(migrated.version).toBe(2);
    expect(migrated.loans[0].id).toBe(assessed.loanId);
    expect(migrated.fines[0].assessedMinor).toBe(assessed.assessedMinor);
    expect(migrated.loans[0].terms.dailyFineMinor).toBe(500);
    expect(migrated.payments).toEqual([]);
    expect(storage.previous).toBe(previous);
    await coordinator.refresh();
    expect(snapshot().fines.map(fine => fine.id)).toEqual(migrated.fines.map(fine => fine.id));
  });

  it('keeps v1 data intact when v2 migration cannot be written', async () => {
    const current = snapshot();
    storage.previous = JSON.stringify({ ...current, version: 1 });
    const previous = storage.previous;
    storage.value = null;
    storage.fail = true;
    await coordinator.refresh();
    expect(storage.value).toBeNull();
    expect(storage.previous).toBe(previous);
    expect(await firstValueFrom(coordinator.warning$)).toContain('could not save');
  });
});
