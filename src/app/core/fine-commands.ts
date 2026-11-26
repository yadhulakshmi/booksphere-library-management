import { FinePayment, FinePaymentInput, PAYMENT_METHODS } from '../models/library';
import { CirculationContext } from './circulation-commands';
import { nextId, recordActivity } from './circulation-state';
import { fineStatus } from './fine-rules';
import { validDate } from './member-rules';

export function payFine({ state, today, now }: CirculationContext, fineId: string, input: FinePaymentInput): FinePayment {
  const fine = state.fines.find(item => item.id === fineId);
  if (!fine) {
    throw new Error('Select an assessed fine to record a payment.');
  }
  if (!input.requestId?.trim() || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 ||
      !PAYMENT_METHODS.includes(input.method) || !validDate(input.paidOn) ||
      input.paidOn < fine.returnedAt || input.paidOn > today ||
      typeof input.reference !== 'string' || typeof input.notes !== 'string') {
    throw new Error('Enter a positive amount, valid method, and payment date between the return date and today.');
  }
  const reference = input.reference.trim();
  const notes = input.notes.trim();
  const existing = state.payments.find(payment => payment.requestId === input.requestId);
  if (existing) {
    if (existing.fineId === fineId && existing.amountMinor === input.amountMinor &&
        existing.method === input.method && existing.paidOn === input.paidOn &&
        existing.reference === reference && existing.notes === notes) {
      return existing;
    }
    throw new Error('This payment request ID was already used.');
  }
  if (fine.balanceMinor === 0) {
    throw new Error('This fine has already been paid.');
  }
  if (input.amountMinor > fine.balanceMinor) {
    throw new Error('Payment cannot exceed the outstanding balance.');
  }
  const { memberId, memberName, membershipId, bookId, bookTitle, demonstration } = fine;
  const recordedAt = now.toISOString();
  const payment: FinePayment = { id: nextId(state, 'PAY'), fineId, memberId, memberName, membershipId, bookId,
    bookTitle, demonstration, recordedAt, requestId: input.requestId, amountMinor: input.amountMinor,
    method: input.method, paidOn: input.paidOn, reference, notes };
  state.payments.push(payment);
  const paidMinor = fine.paidMinor + payment.amountMinor;
  const status = fineStatus(fine.assessedMinor, paidMinor);
  state.fines = state.fines.map(item => item.id === fineId ? {
    ...fine, paidMinor, balanceMinor: fine.assessedMinor - paidMinor, status, updatedAt: recordedAt
  } : item);
  recordActivity(state, status === 'Paid' ? 'fine-paid' : 'fine-partial-payment', payment.id, now);
  return payment;
}
