import { Fine, FinePayment, Loan, PAYMENT_METHODS } from '../models/library';
import { fineAmount, fineStatus } from './fine-rules';
import { validFinePolicy } from './library-policies';
import { validDate } from './member-rules';

export function validateFineLedger(loans: readonly Loan[], fines: readonly Fine[], payments: readonly FinePayment[],
  validateId: (id: string, prefix: string) => number): void {
  if (!Array.isArray(fines) || !Array.isArray(payments)) {
    throw new Error('Invalid fine ledger.');
  }
  const loanById = new Map(loans.map(loan => [loan.id, loan]));
  const fineById = new Map<string, Fine>();
  const assessed = new Set<string>();
  for (const fine of fines) {
    validateId(fine.id, 'FINE');
    const loan = loanById.get(fine.loanId);
    if (!loan?.returnedAt || assessed.has(fine.loanId) || !validFinePolicy(fine.policy) ||
        fine.policy.currency !== loan.terms.currency || fine.policy.dailyFineMinor !== loan.terms.dailyFineMinor ||
        fine.policy.graceDays !== loan.terms.graceDays || fine.policy.maxFineMinor !== loan.terms.maxFineMinor ||
        fine.overdueDays !== loan.overdueDaysAtReturn || fine.returnedAt !== loan.returnedAt ||
        fine.originalDueAt !== loan.originalDueAt || fine.dueAt !== loan.dueAt ||
        !sameReference(fine, loan) || !fine.assessedMinor ||
        fine.assessedMinor !== fineAmount(fine.overdueDays, fine.policy) ||
        !Number.isFinite(Date.parse(fine.assessedAt)) || !Number.isFinite(Date.parse(fine.updatedAt))) {
      throw new Error('Invalid fine assessment.');
    }
    assessed.add(fine.loanId);
    fineById.set(fine.id, fine);
  }
  if (loans.some(loan => loan.returnedAt && fineAmount(loan.overdueDaysAtReturn ?? 0, loan.terms) > 0 && !assessed.has(loan.id))) {
    throw new Error('A fine assessment is missing.');
  }
  const totals = new Map<string, number>();
  const requests = new Set<string>();
  for (const payment of payments) {
    validateId(payment.id, 'PAY');
    const fine = fineById.get(payment.fineId);
    if (!fine || !sameReference(payment, fine) || !Number.isSafeInteger(payment.amountMinor) ||
        payment.amountMinor <= 0 || !PAYMENT_METHODS.includes(payment.method) ||
        !validDate(payment.paidOn) || payment.paidOn < fine.returnedAt ||
        !Number.isFinite(Date.parse(payment.recordedAt)) || typeof payment.reference !== 'string' ||
        typeof payment.notes !== 'string' || typeof payment.requestId !== 'string' ||
        !payment.requestId.trim() || requests.has(payment.requestId)) {
      throw new Error('Invalid fine payment.');
    }
    requests.add(payment.requestId);
    totals.set(fine.id, (totals.get(fine.id) ?? 0) + payment.amountMinor);
  }
  for (const fine of fines) {
    const paid = totals.get(fine.id) ?? 0;
    if (paid > fine.assessedMinor || fine.paidMinor !== paid || fine.balanceMinor !== fine.assessedMinor - paid ||
        fine.status !== fineStatus(fine.assessedMinor, paid)) {
      throw new Error('Fine balance does not match its payments.');
    }
  }
}

function sameReference(a: Fine | FinePayment, b: Fine | Loan): boolean {
  return a.memberId === b.memberId && a.bookId === b.bookId && a.bookTitle === b.bookTitle &&
    a.memberName === b.memberName && a.membershipId === b.membershipId && a.demonstration === b.demonstration;
}
