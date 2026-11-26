import { Fine, FinePolicy, FineStatus, Loan } from '../models/library';
import { lateDays } from './circulation-dates';

export function fineAmount(overdueDays: number, policy: FinePolicy): number {
  return Math.min(policy.maxFineMinor, Math.max(0, overdueDays - policy.graceDays) * policy.dailyFineMinor);
}

export function estimatedFine(loan: Loan, today: string): number {
  return loan.returnedAt ? 0 : fineAmount(lateDays(loan.dueAt, today), loan.terms);
}

export function fineStatus(assessed: number, paid: number): FineStatus {
  return paid === 0 ? 'Outstanding' : paid === assessed ? 'Paid' : 'Partially Paid';
}

export function outstandingBalance(fines: readonly Fine[], memberId: string): number {
  return fines.reduce((total, fine) => total + (fine.memberId === memberId ? fine.balanceMinor : 0), 0);
}
