import { lateDays } from '../../core/circulation-dates';
import { estimatedFine } from '../../core/fine-rules';
import { Fine, FinePayment, Loan } from '../../models/library';

export interface OverdueColumn {
  key: string;
  label: string;
  format?: 'date' | 'time' | 'money' | 'status';
}
export const OVERDUE_COLUMNS: readonly (readonly OverdueColumn[])[] = [
  [{ key: 'id', label: 'Loan ID' }, { key: 'book', label: 'Book title' }, { key: 'member', label: 'Member' },
    { key: 'membership', label: 'Membership ID' }, { key: 'borrowed', label: 'Borrowed', format: 'date' },
    { key: 'date', label: 'Due', format: 'date' }, { key: 'days', label: 'Overdue days' },
    { key: 'amount', label: 'Estimated fine', format: 'money' }, { key: 'status', label: 'Status', format: 'status' }],
  [{ key: 'id', label: 'Fine ID' }, { key: 'member', label: 'Member' }, { key: 'membership', label: 'Membership ID' },
    { key: 'book', label: 'Book title' }, { key: 'loan', label: 'Loan ID' }, { key: 'days', label: 'Overdue days' },
    { key: 'amount', label: 'Assessed', format: 'money' }, { key: 'paid', label: 'Paid', format: 'money' },
    { key: 'balance', label: 'Balance', format: 'money' }, { key: 'status', label: 'Status', format: 'status' }],
  [{ key: 'id', label: 'Payment ID' }, { key: 'fine', label: 'Fine ID' }, { key: 'member', label: 'Member' },
    { key: 'date', label: 'Payment date', format: 'date' }, { key: 'amount', label: 'Amount', format: 'money' },
    { key: 'status', label: 'Method' }, { key: 'reference', label: 'Reference' }]
];
interface RowBase {
  id: string;
  date: string;
  days: number;
  amount: number;
  status: string;
  demo: boolean;
  cells: Record<string, string | number>;
  searchable: string;
}
export type OverdueRow = (RowBase & { loan: Loan }) | (RowBase & { fine: Fine }) | (RowBase & { payment: FinePayment });

function rowBase(item: Loan | Fine | FinePayment, date: string, days: number, amount: number, status: string,
  other: Record<string, string | number> = {}): RowBase {
  const { id, bookTitle, memberName, membershipId, demonstration } = item;
  const cells = { id, book: bookTitle, member: memberName, membership: membershipId, date, days, amount, status, ...other };
  return { id, date, days, amount, status, demo: demonstration, cells,
    searchable: [id, bookTitle, memberName, membershipId, ...Object.values(other)].join(' ').toLowerCase() };
}

export function overdueRow(loan: Loan, today: string): OverdueRow {
  return { ...rowBase(loan, loan.dueAt, lateDays(loan.dueAt, today), estimatedFine(loan, today),
    'Overdue', { borrowed: loan.checkedOutAt }), loan };
}

export function fineRow(fine: Fine): OverdueRow {
  return { ...rowBase(fine, fine.returnedAt, fine.overdueDays, fine.assessedMinor, fine.status,
    { loan: fine.loanId, paid: fine.paidMinor, balance: fine.balanceMinor }), fine };
}

export function paymentRow(payment: FinePayment): OverdueRow {
  return { ...rowBase(payment, payment.paidOn, 0, payment.amountMinor, payment.method,
    { fine: payment.fineId, reference: payment.reference }), payment };
}
