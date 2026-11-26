import { AnalyticsSource } from '../models/analytics';
import { Fine, FinePayment, Loan, Reservation } from '../models/library';
import { demoBooks } from './book-seed';
import { withAvailability } from './book-rules';
import { DEFAULT_LIBRARY_SETTINGS, loanTerms } from './library-policies';
import { memberView } from './member-rules';
import { demoMembers } from './member-seed';

export function analyticsFixture(): AnalyticsSource {
  const today = '2026-11-25';
  const timestamp = new Date(2026, 10, 25, 12).toISOString();
  const books = demoBooks(timestamp).slice(0, 2).map((book, index) =>
    withAvailability({ ...book, title: index === 0 ? 'Atlas' : 'Bridge', totalCopies: 4, borrowedCopies: 1,
      reservedCopies: index, demonstration: false }));
  const members = demoMembers(new Date(2026, 10, 25)).slice(0, 5).map(record => memberView(record, today));
  const reference = { bookId: books[0].id, bookTitle: 'Atlas', memberId: members[0].id,
    memberName: 'Avery Linden', membershipId: members[0].membershipId, demonstration: false };
  const historical = { ...reference, bookId: 'deleted', bookTitle: 'Deleted Title',
    memberId: 'deleted-member', memberName: 'Historical Patron', membershipId: 'BS-HISTORICAL' };
  const base: Loan = { ...reference, id: 'LOAN-001', checkedOutAt: '2026-11-10', originalDueAt: '2026-11-24',
    dueAt: '2026-11-24', returnedAt: null, renewals: 0, overdueDaysAtReturn: null,
    terms: loanTerms(DEFAULT_LIBRARY_SETTINGS) };
  const loans: Loan[] = [base,
    { ...base, id: 'LOAN-002', checkedOutAt: '2026-11-24', dueAt: today, returnedAt: null,
      bookId: books[1].id, bookTitle: 'Bridge' },
    { ...base, ...historical, id: 'LOAN-003', checkedOutAt: '2026-11-20',
      dueAt: '2026-11-23', returnedAt: today, overdueDaysAtReturn: 2 }
  ];
  const reservation: Reservation = { ...reference, id: 'RES-001', sequence: 1, placedAt: today, collectionDays: 3,
    status: 'ready', readyAt: today, expiresAt: '2026-11-27', fulfilledAt: null };
  const fine: Fine = { ...historical, id: 'FINE-1', loanId: 'LOAN-003', overdueDays: 2, originalDueAt: '2026-11-23',
    dueAt: '2026-11-23', returnedAt: today, assessedAt: timestamp, updatedAt: timestamp,
    assessedMinor: 1000, paidMinor: 375, balanceMinor: 625, status: 'Partially Paid',
    policy: { currency: 'INR', maxFineMinor: 50000, dailyFineMinor: 500, graceDays: 0 } };
  const payment: FinePayment = { ...historical, id: 'PAY-1', fineId: fine.id, requestId: 'request-1', amountMinor: 125,
    method: 'Cash', paidOn: today, recordedAt: timestamp, reference: 'DEMO', notes: '' };
  return { libraryName: 'Test Library', today, books, members, loans,
    reservations: [reservation, { ...reservation, id: 'RES-002', sequence: 2, status: 'waiting', readyAt: null, expiresAt: null }],
    fines: [fine], payments: [payment, { ...payment, id: 'PAY-2', requestId: 'request-2', amountMinor: 250, method: 'UPI' }],
    activity: [], warnings: [], inventoryAvailable: true, membersAvailable: true };
}
