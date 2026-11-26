import { Component, OnDestroy, TemplateRef } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ValidatorFn } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { filter, finalize, takeUntil } from 'rxjs/operators';
import { CLOCK_TIME, inRange, minorUnits, POLICY_RANGES } from '../../core/library-policies';
import { MEMBER_EMAIL, validPhone } from '../../core/member-rules';
import { LibrarySettings } from '../../models/library';
import { LibrarySettingsService } from '../../services/library-settings.service';

type PolicyField = keyof typeof POLICY_RANGES;

interface SettingField {
  key: string;
  label: string;
  type?: 'email' | 'tel' | 'time' | 'number';
  money?: boolean;
  error: string;
  validator: ValidatorFn;
}

const textField = (key: string, label: string, type?: SettingField['type'],
  check: (value: string) => boolean = Boolean, error = 'This field is required.'): SettingField => ({
    key, label, type, error, validator: control => check(String(control.value ?? '').trim()) ? null : { invalid: true }
  });

function policyField(key: PolicyField, label: string, money = false): SettingField {
  const range = POLICY_RANGES[key];
  const [min, max] = range;
  return {
    key, label, money, type: money ? undefined : 'number',
    error: money ? 'Enter INR ' + min / 100 + ' to ' + max / 100 + ', with up to two decimal places.'
      : 'Enter a whole number from ' + min + ' to ' + max + '.',
    validator: control => {
      const text = String(control.value ?? '').trim();
      const value = money ? minorUnits(text) : /^\d+$/.test(text) ? Number(text) : NaN;
      return inRange(value, range) ? null : { range: true };
    }
  };
}

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html'
})
export class SettingsPageComponent implements OnDestroy {
  readonly sections = [
    { heading: 'General library information', fields: [
      textField('name', 'Library name'), textField('email', 'Library email', 'email', value => MEMBER_EMAIL.test(value), 'Enter a valid email.'),
      textField('phone', 'Contact number', 'tel', validPhone, 'Enter a phone number with 7 to 15 digits.'),
      textField('address', 'Address'),
      textField('openingTime', 'Opening time', 'time', value => CLOCK_TIME.test(value), 'Enter a valid opening time.'),
      textField('closingTime', 'Closing time', 'time', value => CLOCK_TIME.test(value), 'Enter a valid closing time.')
    ] },
    { heading: 'Borrowing policies', fields: [
      policyField('maxLoansPerMember', 'Active loan limit'), policyField('lendingDays', 'Standard loan duration (days)'),
      policyField('maxLoanRenewals', 'Maximum renewals'), policyField('renewalDays', 'Renewal extension (days)')
    ] },
    { heading: 'Reservation policies', note: 'Priority is first come, first served.', fields: [
      policyField('reservationCollectionDays', 'Collection period (days)')
    ] },
    { heading: 'Fine policies', note: 'Currency is INR. Fine terms are stored when a loan is issued.', fields: [
      policyField('dailyFineMinor', 'Daily overdue fine', true), policyField('graceDays', 'Grace period (days)'),
      policyField('maxFineMinor', 'Maximum fine per loan', true),
      policyField('restrictionThresholdMinor', 'Borrowing restriction threshold', true)
    ] }
  ];
  readonly fields = this.sections.flatMap(section => section.fields);
  readonly form: FormGroup = this.forms.group(Object.fromEntries(this.fields.map(field =>
    [field.key, new FormControl('', field.validator)]
  )), { validators: (control: AbstractControl) => {
    const { openingTime, closingTime } = control.value;
    return CLOCK_TIME.test(openingTime) && CLOCK_TIME.test(closingTime) && openingTime >= closingTime
      ? { timeOrder: true } : null;
  } });
  readonly warning$ = this.settings.warning$;
  saving = false;
  private saved!: LibrarySettings;
  private readonly destroyed = new Subject<void>();

  constructor(private readonly forms: FormBuilder, private readonly settings: LibrarySettingsService,
    private readonly dialog: MatDialog, private readonly snack: MatSnackBar) {
    this.settings.settings$.pipe(takeUntil(this.destroyed)).subscribe(value => {
      this.saved = value;
      if (!this.form.dirty) {
        this.cancel();
      }
    });
  }

  cancel(): void {
    const values = { ...this.saved };
    this.form.reset(Object.fromEntries(this.fields.map(field => {
      const value = values[field.key as keyof LibrarySettings];
      return [field.key, field.money ? (Number(value) / 100).toFixed(2) : value];
    })));
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving || !this.form.dirty) {
      return;
    }
    const fields = this.form.getRawValue();
    for (const key of Object.keys(POLICY_RANGES)) {
      fields[key] = this.fields.find(field => field.key === key)?.money ? minorUnits(fields[key]) : Number(fields[key]);
    }
    this.commit(this.settings.save({ ...this.saved, ...fields }), 'Settings saved.');
  }

  restore(template: TemplateRef<unknown>): void {
    this.dialog.open(template, { width: '460px', maxWidth: '94vw' }).afterClosed()
      .pipe(filter(confirmed => confirmed === true), takeUntil(this.destroyed))
      .subscribe(() => this.commit(this.settings.restoreDefaults(), 'Default settings restored.'));
  }

  private commit(action: Observable<LibrarySettings>, message: string): void {
    this.saving = true;
    action.pipe(takeUntil(this.destroyed), finalize(() => this.saving = false)).subscribe({
      next: updated => {
        this.saved = updated;
        this.cancel();
        this.snack.open(message, 'Dismiss', { duration: 4000 });
      },
      error: (error: Error) => this.snack.open(error.message, 'Dismiss')
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
