import type { CirculationState } from '../core/circulation-state';
import type { MemberSnapshot } from '../core/member-records';
import { Book, BookInput, FinePayment, FinePaymentInput, LibrarySettings, Loan, Member,
  MemberInput, MembershipState, Reservation } from './library';

export interface LibrarySnapshot {
  readonly revision: number;
  readonly circulation: CirculationState;
  readonly members: MemberSnapshot;
}

export interface ApiOperations {
  'book.create': [BookInput, Book];
  'book.update': [{ id: string; book: BookInput }, Book];
  'book.delete': [{ id: string }, void];
  'member.create': [MemberInput, Member];
  'member.update': [{ id: string; member: MemberInput }, Member];
  'member.renew': [{ id: string; expiryDate: string }, Member];
  'member.status': [{ id: string; state: MembershipState }, Member];
  'member.delete': [{ id: string }, void];
  'loan.issue': [{ memberId: string; bookId: string; date: string; reservationId?: string }, Loan];
  'loan.return': [{ id: string; date: string }, Loan];
  'loan.renew': [{ id: string }, Loan];
  'reservation.create': [{ memberId: string; bookId: string }, Reservation];
  'reservation.cancel': [{ id: string }, void];
  'fine.pay': [{ fineId: string; payment: FinePaymentInput }, FinePayment];
  'settings.save': [LibrarySettings, LibrarySettings];
  'settings.restore': [null, LibrarySettings];
  'reservations.settle': [null, void];
}

export type ApiAction = keyof ApiOperations;
export type ApiInput<K extends ApiAction> = ApiOperations[K][0];
export type ApiResult<K extends ApiAction> = ApiOperations[K][1];
export type ApiCommand = { [K in ApiAction]: { type: K; input: ApiInput<K> } }[ApiAction];

export interface ApiCommit<K extends ApiAction> {
  readonly snapshot: LibrarySnapshot;
  readonly result: ApiResult<K> extends void ? null : ApiResult<K>;
}
