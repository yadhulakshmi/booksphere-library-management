import { activeLoan, activeReservation, CirculationState } from './circulation-state';
import { outstandingBalance } from './fine-rules';

export function memberDeletionReason(state: CirculationState | null, memberId: string, today: string): string | null {
  if (state?.loans.some(loan => loan.memberId === memberId && activeLoan(loan)) ||
      state?.reservations.some(item => item.memberId === memberId && activeReservation(item) &&
        (item.status === 'waiting' || item.expiresAt! >= today))) {
    return 'This member has active loans or reservations and cannot be deleted.';
  }
  return state && outstandingBalance(state.fines, memberId) > 0
    ? 'This member has an outstanding fine balance and cannot be deleted.' : null;
}
