import { Book } from '../models/library';
import { parseBooks } from './book-records';
import { withAvailability } from './book-rules';
import { demoBooks } from './book-seed';
import { CirculationContext, placeReservation } from './circulation-commands';
import { shiftDay } from './circulation-dates';
import { DEFAULT_LIBRARY_SETTINGS, loanTerms } from './library-policies';
import { CirculationState, nextId, recordActivity, reference, settleReservations } from './circulation-state';

export function initialCirculation(legacy: string | null, context: Omit<CirculationContext, 'state'>): CirculationState {
  const books = legacy === null ? demoBooks(context.now.toISOString()) : parseBooks(JSON.parse(legacy));
  if (books.some(book => !book.demonstration && (book.borrowedCopies || book.reservedCopies))) {
    throw new Error('Unsupported non-demonstration allocations require review before migration.');
  }
  const state: CirculationState = {
    version: 2, sequence: 0, settings: { ...DEFAULT_LIBRARY_SETTINGS }, fines: [], payments: [], books: books.map(book => withAvailability({ ...book, borrowedCopies: 0, reservedCopies: 0 })),
    loans: [], reservations: [], activity: []
  };
  if (legacy === null) {
    addExamples({ ...context, state });
  }
  return state;
}

function addExamples(context: CirculationContext): void {
  const { state, members, today, now, policy } = context;
  const eligible = members.filter(member => member.demonstration && member.status === 'Active' &&
    member.registrationDate <= shiftDay(today, -21));
  const held = state.books.find(book => book.totalCopies === 2);
  const other = state.books.filter(book => book.id !== held?.id && book.totalCopies > 0);
  if (eligible.length < 5 || !held || other.length < 2) {
    return;
  }
  const addLoan = (book: Book, index: number, daysAgo: number, renewals: number, returnedAt: string | null): void => {
    const checkedOutAt = shiftDay(today, -daysAgo);
    const dueAt = shiftDay(checkedOutAt, policy.lendingDays + renewals * policy.renewalDays);
    const id = nextId(state, 'LOAN');
    state.loans.push({ ...reference(book, eligible[index], true), id, checkedOutAt, dueAt, renewals, returnedAt,
      originalDueAt: shiftDay(checkedOutAt, policy.lendingDays), terms: loanTerms(policy),
      overdueDaysAtReturn: returnedAt ? 0 : null });
    recordActivity(state, 'checkout', id, now);
    if (renewals) {
      recordActivity(state, 'loan-renewed', id, now);
    }
    if (returnedAt) {
      recordActivity(state, 'return', id, now);
    }
  };
  addLoan(held, 0, 2, 0, null);
  addLoan(other[0], 1, 18, 0, null);
  addLoan(other[1], 2, 10, 1, null);
  addLoan(other[0], 0, 21, 0, shiftDay(today, -14));
  placeReservation(context, eligible[3].id, held.id, true);
  placeReservation(context, eligible[4].id, held.id, true);
  settleReservations(state, members, today, now);
}
