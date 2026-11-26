import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { lateDays, shiftDay } from '../../core/circulation-dates';
import { localDate, validDate } from '../../core/member-rules';
import { Loan, Reservation, ReservationStatus } from '../../models/library';
import { CirculationService } from '../../services/circulation.service';
import { ReservationService } from '../../services/reservation.service';

export const RESERVATION_LABELS: Record<ReservationStatus, string> = {
  waiting: 'Waiting', ready: 'Ready for collection', fulfilled: 'Fulfilled', cancelled: 'Cancelled', expired: 'Expired'
};

export type TransactionAction =
  { kind: 'return' | 'renew'; loan: Loan } |
  { kind: 'details' | 'cancel'; reservation: Reservation; position?: number };

@Component({
  selector: 'app-transaction-action-dialog',
  templateUrl: './transaction-action-dialog.component.html'
})
export class TransactionActionDialogComponent implements OnDestroy {
  readonly loan = 'loan' in this.data ? this.data.loan : null;
  readonly reservation = 'reservation' in this.data ? this.data.reservation : null;
  readonly position = 'reservation' in this.data ? this.data.position : undefined;
  readonly today = localDate();
  readonly labels = RESERVATION_LABELS;
  readonly title = { return: 'Return book', renew: 'Renew loan', cancel: 'Cancel reservation', details: 'Reservation details' }[this.data.kind];
  readonly proposedDue = this.loan && this.data.kind === 'renew' ? shiftDay(this.loan.dueAt, this.loan.terms.renewalDays) : '';
  readonly form = this.forms.group({ date: [this.today, (control: AbstractControl) => {
    const date = control.value;
    return validDate(date) && date <= this.today && (!this.loan || date >= this.loan.checkedOutAt)
      ? null : { date: true };
  }] });
  saving = false;
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: TransactionAction, private readonly forms: FormBuilder,
    private readonly circulation: CirculationService,
    private readonly reservations: ReservationService, private readonly snack: MatSnackBar,
    private readonly dialog: MatDialogRef<TransactionActionDialogComponent, boolean>) {}

  get renewalsRemaining(): number {
    return Math.max(0, (this.loan?.terms.maxLoanRenewals ?? 0) - (this.loan?.renewals ?? 0));
  }

  get overdue(): number {
    return this.loan && this.form.valid ? lateDays(this.loan.dueAt, this.form.value.date) : 0;
  }

  confirm(): void {
    this.form.markAllAsTouched();
    if (this.saving || (this.data.kind === 'return' && this.form.invalid)) {
      return;
    }
    let request: Observable<Loan | void>;
    switch (this.data.kind) {
      case 'return': request = this.circulation.returnBook(this.data.loan.id, this.form.value.date); break;
      case 'renew': request = this.circulation.renew(this.data.loan.id); break;
      case 'cancel': request = this.reservations.cancel(this.data.reservation.id); break;
      case 'details': return;
    }
    this.saving = this.dialog.disableClose = true;
    request.pipe(takeUntil(this.destroyed), finalize(() => {
      this.saving = this.dialog.disableClose = false;
    })).subscribe({
      next: () => this.dialog.close(true),
      error: (error: Error) => this.snack.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
