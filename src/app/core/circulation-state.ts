import { Book, CirculationReference, Fine, FinePayment, LibraryActivity, LibrarySettings, Loan, Member, Reservation, ReservationStatus } from '../models/library';
import { parseBooks } from './book-records';
import { withAvailability } from './book-rules';
import { lateDays, shiftDay } from './circulation-dates';
import { validDate } from './member-rules';
import { DEFAULT_LIBRARY_SETTINGS, inRange, loanTerms, POLICY_RANGES, validateSettings, validLoanTerms } from './library-policies';
import { fineAmount } from './fine-rules';
import { validateFineLedger } from './fine-ledger-validation';

export interface CirculationState {
  version: 2;
  settings: LibrarySettings;
  fines: Fine[];
  payments: FinePayment[];
  sequence: number;
  books: Book[];
  loans: Loan[];
  reservations: Reservation[];
  activity: LibraryActivity[];
}

export const activeLoan = (loan: Loan): boolean => loan.returnedAt === null;
export const activeReservation = (reservation: Reservation): boolean =>
  reservation.status === 'waiting' || reservation.status === 'ready';

export function nextId(state: CirculationState, prefix: string): string {
  if (!Number.isSafeInteger(state.sequence + 1)) {
    throw new Error('The transaction ID sequence is exhausted.');
  }
  return prefix + '-' + String(++state.sequence).padStart(6, '0');
}

export function recordActivity(state: CirculationState, type: LibraryActivity['type'], entityId: string,
  now: Date, description?: string): void {
  state.activity.push({ id: nextId(state, 'ACT'), entityId, type, occurredAt: now.toISOString(), description });
}

export function reference(book: Book, member: Member, demonstration = false): CirculationReference {
  return { bookId: book.id, bookTitle: book.title, memberId: member.id,
    memberName: member.firstName + ' ' + member.lastName, membershipId: member.membershipId, demonstration };
}

export function projectInventory(state: CirculationState): Book[] {
  const counts = new Map<string, { borrowedCopies: number; reservedCopies: number }>();
  state.books.forEach(book => counts.set(book.id, { borrowedCopies: 0, reservedCopies: 0 }));
  const allocate = (id: string, key: 'borrowedCopies' | 'reservedCopies'): void => {
    const count = counts.get(id);
    if (!count) {
      throw new Error('An active circulation record references missing inventory.');
    }
    count[key]++;
  };
  state.loans.filter(activeLoan).forEach(loan => allocate(loan.bookId, 'borrowedCopies'));
  state.reservations.filter(item => item.status === 'ready').forEach(item => allocate(item.bookId, 'reservedCopies'));
  return state.books.map(book => {
    const count = counts.get(book.id)!;
    if (count.borrowedCopies + count.reservedCopies > book.totalCopies) {
      throw new Error('Total copies cannot be lower than the number of allocated copies.');
    }
    return withAvailability({ ...book, ...count });
  });
}

export function queuePositions(reservations: readonly Reservation[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  return new Map(reservations.filter(item => item.status === 'waiting').sort((a, b) => a.sequence - b.sequence).map(item => {
    const count = (counts.get(item.bookId) ?? 0) + 1;
    counts.set(item.bookId, count);
    return [item.id, count];
  }));
}

export function settleReservations(state: CirculationState, members: readonly Member[],
  today: string, now: Date): void {
  const eligible = new Set(members.filter(member => member.status === 'Active').map(member => member.id));
  state.reservations = state.reservations.map(item => {
    if (!activeReservation(item)) {
      return item;
    }
    if (item.status === 'ready' && item.expiresAt! < today) {
      recordActivity(state, 'reservation-expired', item.id, now);
      return { ...item, status: 'expired' };
    }
    if (!eligible.has(item.memberId) || state.loans.some(loan =>
      activeLoan(loan) && loan.bookId === item.bookId && loan.memberId === item.memberId)) {
      recordActivity(state, 'reservation-cancelled', item.id, now);
      return { ...item, status: 'cancelled' };
    }
    return item;
  });
  const free = new Map(projectInventory(state).map(book => [book.id, book.availableCopies]));
  const promoted = new Set<string>();
  state.reservations.filter(item => item.status === 'waiting').sort((a, b) => a.sequence - b.sequence).forEach(item => {
    const copies = free.get(item.bookId) ?? 0;
    if (copies > 0) {
      promoted.add(item.id);
      free.set(item.bookId, copies - 1);
      recordActivity(state, 'reservation-ready', item.id, now);
    }
  });
  state.reservations = state.reservations.map(item => promoted.has(item.id) ? {
    ...item, status: 'ready', readyAt: today, expiresAt: shiftDay(today, item.collectionDays)
  } : item);
}

const reservationStatuses: readonly ReservationStatus[] = ['waiting', 'ready', 'fulfilled', 'cancelled', 'expired'];

export function parseCirculation(raw: string, now = new Date()): CirculationState {
  const parsed = JSON.parse(raw);
  const legacy = parsed?.version === 1;
  const state: CirculationState = parsed;
  if (!state || (!legacy && state.version !== 2) || !Number.isSafeInteger(state.sequence) || state.sequence < 0 ||
      !Array.isArray(state.loans) || !Array.isArray(state.reservations) || !Array.isArray(state.activity)) {
    throw new Error('Invalid circulation snapshot.');
  }
  if (legacy) {
    state.version = 2;
    state.settings = { ...DEFAULT_LIBRARY_SETTINGS };
    state.fines = [];
    state.payments = [];
    state.reservations = state.reservations.map(item => ({ ...item, collectionDays: state.settings.reservationCollectionDays }));
    const terms = loanTerms(state.settings);
    state.loans = state.loans.map(loan => ({
      ...loan, terms, originalDueAt: shiftDay(loan.dueAt, -loan.renewals * terms.renewalDays)
    }));
  } else {
    state.settings = validateSettings(state.settings);
  }
  state.books = parseBooks(state.books, false);
  const ids = new Set<number>();
  const bookIds = new Set(state.books.map(book => book.id));
  const allocations = new Set<string>();
  const validateId = (id: string, prefix: string): number => {
    const seq = typeof id === 'string' && id.startsWith(prefix + '-') ? Number(id.slice(prefix.length + 1)) : NaN;
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > state.sequence || ids.has(seq) ||
        id !== prefix + '-' + String(seq).padStart(6, '0')) {
      throw new Error('Invalid transaction identifier.');
    }
    ids.add(seq);
    return seq;
  };
  const validateReference = (record: CirculationReference, active: boolean): void => {
    const values = [record.bookId, record.bookTitle, record.memberId, record.memberName, record.membershipId];
    if (values.some(value => typeof value !== 'string' || !value.trim()) ||
        typeof record.demonstration !== 'boolean') {
      throw new Error('Invalid circulation reference.');
    }
    const key = JSON.stringify([record.bookId, record.memberId]);
    if (active) {
      if (!bookIds.has(record.bookId) || allocations.has(key)) {
        throw new Error('Invalid active circulation reference.');
      }
      allocations.add(key);
    }
  };
  for (const loan of state.loans) {
    validateId(loan.id, 'LOAN');
    validateReference(loan, activeLoan(loan));
    if (!validLoanTerms(loan.terms) || !validDate(loan.checkedOutAt) || !validDate(loan.originalDueAt) ||
        !validDate(loan.dueAt) || loan.originalDueAt < loan.checkedOutAt || loan.dueAt < loan.originalDueAt ||
        !Number.isSafeInteger(loan.renewals) || loan.renewals < 0 ||
        (loan.returnedAt === null ? loan.overdueDaysAtReturn !== null :
          !validDate(loan.returnedAt) || loan.returnedAt < loan.checkedOutAt ||
          loan.overdueDaysAtReturn !== lateDays(loan.dueAt, loan.returnedAt))) {
      throw new Error('Invalid loan dates.');
    }
  }
  for (const item of state.reservations) {
    if (validateId(item.id, 'RES') !== item.sequence || !reservationStatuses.includes(item.status) || !validDate(item.placedAt) ||
        !inRange(item.collectionDays, POLICY_RANGES.reservationCollectionDays) ||
        (item.readyAt === null ? item.expiresAt !== null :
          !validDate(item.readyAt) || !validDate(item.expiresAt!) || item.readyAt < item.placedAt || item.expiresAt! < item.readyAt) ||
        (['ready', 'expired', 'fulfilled'].includes(item.status) && item.readyAt === null) ||
        (item.status === 'waiting' && item.readyAt !== null) ||
        (item.status === 'fulfilled' ? !validDate(item.fulfilledAt!) || item.fulfilledAt! < item.readyAt! ||
          item.fulfilledAt! > item.expiresAt! : item.fulfilledAt !== null)) {
      throw new Error('Invalid reservation dates.');
    }
    validateReference(item, activeReservation(item));
  }
  for (const activity of state.activity) {
    validateId(activity.id, 'ACT');
    if (typeof activity.entityId !== 'string' || typeof activity.type !== 'string' ||
        (activity.description !== undefined && typeof activity.description !== 'string') ||
        !Number.isFinite(Date.parse(activity.occurredAt))) {
      throw new Error('Invalid activity record.');
    }
  }
  if (legacy) {
    state.loans.forEach(loan => assessFine(state, loan, now));
  }
  validateFineLedger(state.loans, state.fines, state.payments, validateId);
  state.books = projectInventory(state);
  return state;
}

export function assessFine(state: CirculationState, loan: Loan, now: Date): void {
  if (loan.returnedAt === null || !loan.overdueDaysAtReturn || state.fines.some(fine => fine.loanId === loan.id)) {
    return;
  }
  const { dailyFineMinor, graceDays, maxFineMinor, currency } = loan.terms;
  const policy = { dailyFineMinor, graceDays, maxFineMinor, currency };
  const assessedMinor = fineAmount(loan.overdueDaysAtReturn, policy);
  if (assessedMinor === 0) {
    return;
  }
  const { bookId, memberId, bookTitle, memberName, membershipId, demonstration, originalDueAt, dueAt, returnedAt } = loan;
  const timestamp = now.toISOString();
  const fine: Fine = {
    id: nextId(state, 'FINE'), loanId: loan.id, bookId, memberId, bookTitle, memberName, membershipId, demonstration,
    originalDueAt, dueAt, returnedAt, overdueDays: loan.overdueDaysAtReturn, policy, assessedMinor,
    paidMinor: 0, balanceMinor: assessedMinor, status: 'Outstanding', assessedAt: timestamp, updatedAt: timestamp
  };
  state.fines.push(fine);
  recordActivity(state, 'fine', fine.id, now);
}
