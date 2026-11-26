import { Component, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, defer, Observable, Subject } from 'rxjs';
import { finalize, map, startWith, takeUntil } from 'rxjs/operators';
import { shiftDay } from '../../core/circulation-dates';
import { activeLoan } from '../../core/circulation-state';
import { localDate, validDate } from '../../core/member-rules';
import { Book, Loan, Member, Reservation } from '../../models/library';
import { outstandingBalance } from '../../core/fine-rules';
import { FineService } from '../../services/fine.service';
import { BookService } from '../../services/book.service';
import { CirculationService } from '../../services/circulation.service';
import { LibraryPolicyService } from '../../services/library-policy.service';
import { MemberService } from '../../services/member.service';
import { ReservationService } from '../../services/reservation.service';

export interface TransactionEntry {
  mode: 'issue' | 'reserve' | 'collect';
  bookId?: string;
  memberId?: string;
  reservationId?: string;
}

@Component({
  selector: 'app-transaction-entry-dialog',
  templateUrl: './transaction-entry-dialog.component.html'
})
export class TransactionEntryDialogComponent implements OnDestroy {
  readonly today = localDate();
  readonly form = this.forms.group({ member: ['', this.selection], book: ['', this.selection],
    day: [this.today, (control: AbstractControl) =>
      validDate(control.value) && control.value <= localDate() ? null : { date: true }] });
  readonly title = { issue: 'Issue book', reserve: 'Create reservation', collect: 'Collect reservation' }[this.data.mode];
  readonly showDate = this.data.mode !== 'reserve';
  readonly memberOptions$ = combineLatest([this.members.members$, this.form.get('member')!.valueChanges.pipe(startWith(''))])
    .pipe(map(([members, term]) => members.filter(member =>
      this.memberLabel(member).toLowerCase().includes(this.search(term)))));
  readonly bookOptions$ = combineLatest([this.books.books$, this.form.get('book')!.valueChanges.pipe(startWith(''))])
    .pipe(map(([books, term]) => books.filter(book =>
      [book.title, book.author, book.isbn].join(' ').toLowerCase().includes(this.search(term)))));
  readonly selection$ = combineLatest([
    this.members.members$, this.books.books$, this.circulation.loans$, this.reservations.reservations$,
    this.fines.fines$, this.policies.settings$,
    defer(() => this.form.valueChanges.pipe(startWith(this.form.value)))
  ]).pipe(map(([members, books, loans, reservations, fines, policy, selection]) => {
    const member = members.find(item => item.id === selection.member?.id);
    const book = books.find(item => item.id === selection.book?.id);
    const count = loans.filter(loan => loan.memberId === member?.id && activeLoan(loan)).length;
    const reserved = reservations.some(item => item.bookId === book?.id && item.memberId === member?.id && item.status === 'ready');
    const due = validDate(selection.day) && selection.day <= this.today ? shiftDay(selection.day, policy.lendingDays) : '';
    const restricted = !!member && outstandingBalance(fines, member.id) >= policy.restrictionThresholdMinor;
    return { member, book, count, reserved, due, restricted, limit: policy.maxLoansPerMember };
  }));
  saving = false;
  private readonly destroyed = new Subject<void>();

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: TransactionEntry, private readonly forms: FormBuilder,
    private readonly members: MemberService, private readonly books: BookService,
    private readonly circulation: CirculationService, private readonly reservations: ReservationService,
    private readonly policies: LibraryPolicyService, private readonly fines: FineService,
    private readonly dialog: MatDialogRef<TransactionEntryDialogComponent, boolean>, private readonly snack: MatSnackBar) {
    combineLatest([members.members$, books.books$]).pipe(takeUntil(this.destroyed)).subscribe(([directory, inventory]) => {
      const member = directory.find(item => item.id === data.memberId);
      const book = inventory.find(item => item.id === data.bookId);
      if (data.memberId && member && !this.form.get('member')!.value) {
        this.form.get('member')!.setValue(member);
      }
      if (data.bookId && book && !this.form.get('book')!.value) {
        this.form.get('book')!.setValue(book);
      }
    });
  }

  readonly memberLabel = (member: Member | string | null): string =>
    !member || typeof member === 'string' ? member ?? '' : member.firstName + ' ' + member.lastName + ' · ' + member.membershipId;
  readonly bookLabel = (book: Book | string | null): string =>
    !book || typeof book === 'string' ? book ?? '' : book.title + ' · ' + book.author;

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving) {
      return;
    }
    const { member, book, day } = this.form.getRawValue();
    this.saving = this.dialog.disableClose = true;
    const request: Observable<Loan | Reservation> = this.showDate ? this.circulation.issue(member.id, book.id, day, this.data.reservationId)
      : this.reservations.create(member.id, book.id);
    request.pipe(takeUntil(this.destroyed), finalize(() => {
      this.saving = this.dialog.disableClose = false;
    })).subscribe({
      next: () => this.dialog.close(true),
      error: (error: Error) => this.snack.open(error.message, 'Dismiss')
    });
  }

  private selection(control: AbstractControl) {
    return control.value?.id ? null : { selection: true };
  }

  private search(term: unknown): string {
    return typeof term === 'string' ? term.trim().toLowerCase() : '';
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
