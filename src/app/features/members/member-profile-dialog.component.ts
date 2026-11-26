import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { map } from 'rxjs/operators';
import { estimatedFine, outstandingBalance } from '../../core/fine-rules';
import { lateDays } from '../../core/circulation-dates';
import { activeLoan, activeReservation } from '../../core/circulation-state';
import { localDate } from '../../core/member-rules';
import { Member } from '../../models/library';
import { CirculationCoordinator } from '../../services/circulation-coordinator.service';

@Component({
  selector: 'app-member-profile-dialog',
  templateUrl: './member-profile-dialog.component.html'
})
export class MemberProfileDialogComponent {
  readonly readOnly = 'member' in this.data;
  readonly member = 'member' in this.data ? this.data.member : this.data;
  readonly circulation$ = this.coordinator.state$.pipe(map(state => {
    const loans = state?.loans.filter(loan => loan.memberId === this.member.id) ?? [];
    const reservations = state?.reservations.filter(item => item.memberId === this.member.id && activeReservation(item)) ?? [];
    const today = localDate();
    const fines = state?.fines.filter(fine => fine.memberId === this.member.id) ?? [];
    const payments = state?.payments.filter(payment => payment.memberId === this.member.id) ?? [];
    const balance = outstandingBalance(fines, this.member.id);
    return {
      verified: state !== null,
      current: loans.filter(activeLoan).map(loan => ({ loan, overdue: lateDays(loan.dueAt, today) })),
      history: loans.filter(loan => !activeLoan(loan)).reverse(),
      reservations, fines, payments, balance,
      estimated: loans.reduce((total, loan) => total + estimatedFine(loan, today), 0),
      paid: fines.reduce((total, fine) => total + fine.paidMinor, 0),
      paidFines: fines.filter(fine => fine.status === 'Paid').length,
      restricted: !!state && balance >= state.settings.restrictionThresholdMinor
    };
  }));

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: Member | { member: Member; readOnly: true }, private readonly coordinator: CirculationCoordinator) {}
}
