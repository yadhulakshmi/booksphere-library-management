import { validDate } from './member-rules';
import { Loan } from '../models/library';

export function shiftDay(day: string, offset: number): string {
  if (!validDate(day)) {
    throw new Error('Enter a valid calendar date.');
  }
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  const result = date.toISOString().slice(0, 10);
  if (!validDate(result)) {
    throw new Error('The calculated date is outside the supported calendar.');
  }
  return result;
}

export function lateDays(due: string, day: string): number {
  return Math.max(0, (Date.parse(day + 'T00:00:00Z') - Date.parse(due + 'T00:00:00Z')) / 86400000);
}

export function loanStatus(loan: Loan, today: string): string {
  return loan.returnedAt ? 'Returned' : loan.dueAt < today ? 'Overdue' :
    loan.dueAt === today ? 'Due today' : 'Active';
}
