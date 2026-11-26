import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { localDate, validDate } from '../../core/member-rules';
import { Member, MEMBERSHIP_STATES } from '../../models/library';
import { MemberService } from '../../services/member.service';

export type MemberAction = 'renew' | 'status' | 'delete';

@Component({
  selector: 'app-member-action-dialog',
  templateUrl: './member-action-dialog.component.html'
})
export class MemberActionDialogComponent implements OnDestroy {
  readonly states = MEMBERSHIP_STATES;
  readonly titles = { renew: 'Renew membership', status: 'Change membership status', delete: 'Delete member?' };
  readonly labels = { renew: 'Renew membership', status: 'Confirm status change', delete: 'Delete member' };
  readonly form = this.forms.group({
    expiryDate: ['', this.data.action === 'renew' ? (control: AbstractControl) =>
      validDate(control.value) && control.value > localDate() && control.value > this.data.member.expiryDate
        ? null : { expiry: true } : []],
    state: ['', this.data.action === 'status' ? Validators.required : []]
  });
  saving = false;
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: { member: Member; action: MemberAction },
    private readonly forms: FormBuilder, private readonly members: MemberService,
    private readonly dialog: MatDialogRef<MemberActionDialogComponent, boolean>, private readonly snackBar: MatSnackBar) {}

  confirm(): void {
    this.form.markAllAsTouched();
    if (!this.form.valid || this.saving) {
      return;
    }
    this.saving = true;
    const { expiryDate, state } = this.form.getRawValue();
    const id = this.data.member.id;
    let request: Observable<Member | void>;
    switch (this.data.action) {
      case 'renew': request = this.members.renew(id, expiryDate); break;
      case 'status': request = this.members.changeStatus(id, state); break;
      case 'delete': request = this.members.delete(id); break;
    }
    request.pipe(takeUntil(this.destroyed), finalize(() => this.saving = false)).subscribe({
      next: () => this.dialog.close(true),
      error: (error: Error) => this.snackBar.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
