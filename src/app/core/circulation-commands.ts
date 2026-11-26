import { Book, LibrarySettings, Loan, Member, Reservation } from '../models/library';
import { lateDays, shiftDay } from './circulation-dates';
import { activeLoan, activeReservation, assessFine, CirculationState, nextId, projectInventory, recordActivity, reference } from './circulation-state';
import { validDate } from './member-rules';
import { outstandingBalance } from './fine-rules';
import { loanTerms } from './library-policies';

export interface CirculationContext {
  readonly state: CirculationState;
  readonly members: readonly Member[];
  readonly policy: LibrarySettings;
  readonly today: string;
  readonly now: Date;
}

function eligibleMember(context: CirculationContext, id: string): Member {
  const member = context.members.find(item => item.id === id);
  if (!member || member.status !== 'Active') {
    throw new Error('Select a member with an active, unexpired membership.');
  }
  return member;
}

function ensureCanBorrow(context: CirculationContext, memberId: string): void {
  if (outstandingBalance(context.state.fines, memberId) >= context.policy.restrictionThresholdMinor) {
    throw new Error('Borrowing is restricted until outstanding assessed fines fall below the library threshold.');
  }
}

export function findBook(state: CirculationState, id: string): Book {
  const book = projectInventory(state).find(item => item.id === id);
  if (!book) {
    throw new Error('This book is no longer in the inventory.');
  }
  return book;
}

function currentLoan(state: CirculationState, id: string): Loan {
  const loan = state.loans.find(item => item.id === id && activeLoan(item));
  if (!loan) {
    throw new Error('This loan is no longer active.');
  }
  return loan;
}

export function issueLoan(context: CirculationContext, memberId: string, bookId: string, day: string,
  reservationId?: string): Loan {
  const { state, policy, today, now } = context;
  const member = eligibleMember(context, memberId);
  ensureCanBorrow(context, memberId);
  const book = findBook(state, bookId);
  if (!validDate(day) || day > today || day < member.registrationDate) {
    throw new Error('Borrow date must be between member registration and today.');
  }
  const existing = state.loans.filter(loan => loan.memberId === memberId && activeLoan(loan));
  if (existing.some(loan => loan.bookId === bookId)) {
    throw new Error('This member already has an active loan for this title.');
  }
  if (existing.length >= policy.maxLoansPerMember) {
    throw new Error('This member has reached the active loan limit.');
  }
  const ready = state.reservations.find(item => item.bookId === bookId && item.memberId === memberId && item.status === 'ready');
  if (reservationId && ready?.id !== reservationId) {
    throw new Error('This reservation is no longer ready for collection.');
  }
  if (!ready && book.availableCopies === 0) {
    throw new Error('No copy is available for this member.');
  }
  if (ready) {
    if (day < ready.readyAt!) {
      throw new Error('Collection cannot precede the ready-for-collection date.');
    }
    state.reservations = state.reservations.map(item =>
      item.id === ready.id ? { ...item, status: 'fulfilled', fulfilledAt: day } : item);
    recordActivity(state, 'reservation-fulfilled', ready.id, now);
  }
  const dueAt = shiftDay(day, policy.lendingDays);
  const loan: Loan = {
    ...reference(book, member), id: nextId(state, 'LOAN'), checkedOutAt: day,
    dueAt, originalDueAt: dueAt, terms: loanTerms(policy), renewals: 0, returnedAt: null, overdueDaysAtReturn: null
  };
  state.loans.push(loan);
  recordActivity(state, 'checkout', loan.id, now);
  return loan;
}

export function returnLoan(context: CirculationContext, id: string, day: string): Loan {
  const { state, today, now } = context;
  const loan = currentLoan(state, id);
  if (!validDate(day) || day < loan.checkedOutAt || day > today) {
    throw new Error('Return date must be between the borrow date and today.');
  }
  const returned = { ...loan, returnedAt: day, overdueDaysAtReturn: lateDays(loan.dueAt, day) };
  state.loans = state.loans.map(item => item.id === id ? returned : item);
  recordActivity(state, 'return', id, now);
  assessFine(state, returned, now);
  return returned;
}

export function renewLoan(context: CirculationContext, id: string): Loan {
  const { state, today, now } = context;
  const loan = currentLoan(state, id);
  eligibleMember(context, loan.memberId);
  ensureCanBorrow(context, loan.memberId);
  if (loan.dueAt < today) {
    throw new Error('Overdue loans cannot be renewed.');
  }
  if (loan.renewals >= loan.terms.maxLoanRenewals) {
    throw new Error('This loan has reached its renewal limit.');
  }
  const eligible = new Set(context.members.filter(member => member.status === 'Active').map(member => member.id));
  if (state.reservations.some(item => item.bookId === loan.bookId && item.memberId !== loan.memberId &&
    activeReservation(item) && eligible.has(item.memberId))) {
    throw new Error('Another member has an active reservation for this title.');
  }
  const renewed = { ...loan, dueAt: shiftDay(loan.dueAt, loan.terms.renewalDays), renewals: loan.renewals + 1 };
  state.loans = state.loans.map(item => item.id === id ? renewed : item);
  recordActivity(state, 'loan-renewed', id, now);
  return renewed;
}

export function placeReservation(context: CirculationContext, memberId: string, bookId: string, demonstration = false): string {
  const { state, today, now } = context;
  const member = eligibleMember(context, memberId);
  const book = findBook(state, bookId);
  if (state.loans.some(loan => loan.bookId === bookId && loan.memberId === memberId && activeLoan(loan))) {
    throw new Error('This member already has an active loan for this title.');
  }
  if (state.reservations.some(item => item.bookId === bookId && item.memberId === memberId && activeReservation(item))) {
    throw new Error('This member already has an active reservation for this title.');
  }
  const id = nextId(state, 'RES');
  const item: Reservation = {
    ...reference(book, member, demonstration), id, sequence: state.sequence,
    collectionDays: context.policy.reservationCollectionDays,
    status: 'waiting', placedAt: today, readyAt: null, expiresAt: null, fulfilledAt: null
  };
  state.reservations.push(item);
  recordActivity(state, 'reservation', id, now);
  return id;
}

export function cancelReservation(context: CirculationContext, id: string): void {
  const { state, now } = context;
  if (!state.reservations.some(item => item.id === id && activeReservation(item))) {
    throw new Error('This reservation is no longer active.');
  }
  state.reservations = state.reservations.map(item => item.id === id ? { ...item, status: 'cancelled' } : item);
  recordActivity(state, 'reservation-cancelled', id, now);
}
