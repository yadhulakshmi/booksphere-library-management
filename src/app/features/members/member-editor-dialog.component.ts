import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { finalize, map, take, takeUntil } from 'rxjs/operators';
import { localDate, MEMBER_EMAIL, validDate, validPhone } from '../../core/member-rules';
import { Member, MEMBERSHIP_TYPES } from '../../models/library';
import { MemberService } from '../../services/member.service';

const requiredText = (control: AbstractControl): ValidationErrors | null =>
  control.value?.trim() ? null : { required: true };
const calendarDate = (control: AbstractControl): ValidationErrors | null =>
  validDate(control.value) ? null : { date: true };

@Component({
  selector: 'app-member-editor-dialog',
  templateUrl: './member-editor-dialog.component.html'
})
export class MemberEditorDialogComponent implements OnDestroy {
  readonly types = MEMBERSHIP_TYPES;
  readonly today = localDate();
  readonly form = this.forms.group({
    firstName: [this.member?.firstName ?? '', requiredText],
    lastName: [this.member?.lastName ?? '', requiredText],
    email: [this.member?.email ?? '', [requiredText, (control: AbstractControl) =>
      MEMBER_EMAIL.test(control.value?.trim()) ? null : { email: true }],
      (control: AbstractControl) => this.members.members$.pipe(take(1), map(members =>
        members.some(record => record.id !== this.member?.id && record.email === control.value.trim().toLowerCase())
          ? { duplicate: true } : null
      ))],
    phone: [this.member?.phone ?? '', [requiredText, (control: AbstractControl) =>
      validPhone(control.value?.trim() ?? '') ? null : { phone: true }]],
    address: [this.member?.address ?? '', requiredText],
    membershipType: [this.member?.membershipType ?? '', Validators.required],
    registrationDate: [this.member?.registrationDate ?? this.today, [calendarDate, (control: AbstractControl) =>
      control.value > localDate() ? { future: true } : null]],
    expiryDate: [this.member?.expiryDate ?? '', calendarDate],
    notes: [this.member?.notes ?? '']
  }, { validators: (group: AbstractControl) => {
    const { registrationDate, expiryDate } = group.value;
    return validDate(registrationDate) && validDate(expiryDate) && expiryDate < registrationDate
      ? { dateOrder: true } : null;
  } });
  saving = false;
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly member: Member | null, private readonly forms: FormBuilder,
    private readonly members: MemberService, private readonly dialog: MatDialogRef<MemberEditorDialogComponent, Member>,
    private readonly snackBar: MatSnackBar) {}

  save(): void {
    this.form.markAllAsTouched();
    if (!this.form.valid || this.saving) {
      return;
    }
    this.saving = this.dialog.disableClose = true;
    const input = this.form.getRawValue();
    const request = this.member ? this.members.update(this.member.id, input) : this.members.create(input);
    request.pipe(takeUntil(this.destroyed), finalize(() => this.saving = this.dialog.disableClose = false)).subscribe({
      next: member => this.dialog.close(member),
      error: (error: Error) => this.snackBar.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
