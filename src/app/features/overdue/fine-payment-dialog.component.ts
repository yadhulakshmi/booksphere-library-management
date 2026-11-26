import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { minorUnits } from '../../core/library-policies';
import { localDate, validDate } from '../../core/member-rules';
import { Fine, PAYMENT_METHODS } from '../../models/library';
import { FineService } from '../../services/fine.service';

@Component({
  selector: 'app-fine-payment-dialog',
  templateUrl: './fine-payment-dialog.component.html'
})
export class FinePaymentDialogComponent implements OnDestroy {
  readonly methods = PAYMENT_METHODS;
  readonly today = localDate();
  readonly form = this.forms.group({
    amount: [(this.fine.balanceMinor / 100).toFixed(2), (control: AbstractControl) => {
      const amount = minorUnits(control.value);
      return amount > 0 && amount <= this.fine.balanceMinor ? null : { amount: true };
    }],
    method: ['', Validators.required],
    paidOn: [this.today, (control: AbstractControl) =>
      validDate(control.value) && control.value >= this.fine.returnedAt && control.value <= this.today ? null : { date: true }],
    reference: [''],
    notes: ['']
  });
  saving = false;
  private readonly requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly fine: Fine, private readonly forms: FormBuilder,
    private readonly fines: FineService, private readonly snack: MatSnackBar,
    private readonly dialog: MatDialogRef<FinePaymentDialogComponent, boolean>) {}

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving) {
      return;
    }
    this.saving = this.dialog.disableClose = true;
    const { amount, method, paidOn, reference, notes } = this.form.getRawValue();
    this.fines.pay(this.fine.id, {
      requestId: this.requestId, amountMinor: minorUnits(amount), method, paidOn, reference, notes
    }).pipe(takeUntil(this.destroyed), finalize(() => this.saving = this.dialog.disableClose = false)).subscribe({
      next: () => this.dialog.close(true),
      error: (error: Error) => this.snack.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
