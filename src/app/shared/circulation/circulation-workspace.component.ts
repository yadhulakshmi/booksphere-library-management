import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, take, takeUntil } from 'rxjs/operators';
import { loanStatus } from '../../core/circulation-dates';
import { activeLoan, activeReservation, queuePositions } from '../../core/circulation-state';
import { localDate } from '../../core/member-rules';
import { Loan, Reservation } from '../../models/library';
import { CirculationCoordinator } from '../../services/circulation-coordinator.service';
import { clearWorkspaceQuery, workspaceAction } from '../workspace-action';
import { ReturnLoanPickerComponent } from './return-loan-picker.component';
import { RESERVATION_LABELS, TransactionAction, TransactionActionDialogComponent } from './transaction-action-dialog.component';
import { TransactionEntry, TransactionEntryDialogComponent } from './transaction-entry-dialog.component';

interface Column {
  key: string;
  label: string;
  date?: boolean;
}
interface Row {
  id: string;
  status: string;
  day: string;
  book: string;
  person: string;
  membership: string;
  demo: boolean;
  cells: Record<string, string | number | null | undefined>;
  loan?: Loan;
  reservation?: Reservation;
}
const sharedColumns: Column[] = [
  { key: 'id', label: 'ID' }, { key: 'book', label: 'Book' }, { key: 'person', label: 'Member' },
  { key: 'membership', label: 'Membership ID' }
];
const loanColumns: Column[] = [...sharedColumns, { key: 'day', label: 'Borrowed', date: true },
  { key: 'due', label: 'Due', date: true }, { key: 'returned', label: 'Returned', date: true },
  { key: 'renewals', label: 'Renewals' }, { key: 'status', label: 'Status' }];
const reservationColumns: Column[] = [...sharedColumns, { key: 'day', label: 'Placed', date: true },
  { key: 'position', label: 'Queue' }, { key: 'ready', label: 'Ready', date: true },
  { key: 'deadline', label: 'Deadline', date: true }, { key: 'fulfilled', label: 'Fulfilled', date: true },
  { key: 'status', label: 'Status' }];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

@Component({
  selector: 'app-circulation-workspace',
  templateUrl: './circulation-workspace.component.html'
})
export class CirculationWorkspaceComponent implements OnInit, OnDestroy {
  @Input() mode: 'loans' | 'reservations' = 'loans';
  readonly filters = this.forms.group({ search: '', status: '', start: '', end: '' });
  readonly warning$ = this.coordinator.warning$;
  readonly activeReservation = activeReservation;
  readonly loanStatuses = ['Active', 'Due today', 'Overdue', 'Returned'];
  readonly reservationStatuses = Object.values(RESERVATION_LABELS);
  private readonly destroyed = new Subject<void>();
  private readonly query = new BehaviorSubject({ index: 0, size: 10, sort: 'day', direction: 'desc' as 'asc' | 'desc', tab: 0 });

  readonly view$ = combineLatest([this.coordinator.state$, this.query]).pipe(map(([state, query]) => {
    const loans = state?.loans ?? [];
    const reservations = state?.reservations ?? [];
    const today = localDate();
    const all = this.mode === 'loans'
      ? loans.map(loan => this.loanRow(loan, today))
      : this.reservationRows(reservations);
    const scope = this.mode === 'loans' && query.tab === 0 ? all.filter(row => row.status !== 'Returned') : all;
    const { search, status, start, end } = this.filters.value;
    const terms = String(search).trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = scope.filter(row =>
      (!status || row.status === status) && (!start || row.day >= start) && (!end || row.day <= end) &&
      terms.every(term => [row.id, row.book, row.person, row.membership].join(' ').toLowerCase().includes(term))
    ).sort((a, b) => {
      const left = a.cells[query.sort] ?? '';
      const right = b.cells[query.sort] ?? '';
      const result = collator.compare(String(left), String(right));
      return (query.direction === 'asc' ? result : -result) || collator.compare(a.id, b.id);
    });
    const index = Math.min(query.index, Math.max(0, Math.ceil(rows.length / query.size) - 1));
    const offset = index * query.size;
    const count = (label: string): number => all.filter(row => row.status === label).length;
    const summary = this.mode === 'loans' ? [
      { label: 'Active loans', count: loans.filter(activeLoan).length }, { label: 'Due today', count: count('Due today') },
      { label: 'Overdue loans', count: count('Overdue') }, { label: 'Returned books', count: count('Returned') }
    ] : [
      { label: 'Waiting', count: count('Waiting') }, { label: 'Ready for collection', count: count('Ready for collection') },
      { label: 'Fulfilled', count: count('Fulfilled') }, { label: 'Expired or cancelled', count: count('Expired') + count('Cancelled') }
    ];
    return { query, index, rows: rows.slice(offset, offset + query.size), length: rows.length, summary,
      demo: all.some(row => row.demo), positions: queuePositions(reservations), total: scope.length };
  }));

  constructor(private readonly forms: FormBuilder, private readonly coordinator: CirculationCoordinator,
    private readonly dialog: MatDialog, private readonly snack: MatSnackBar,
    private readonly route: ActivatedRoute, private readonly router: Router) {
    this.filters.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() =>
      this.query.next({ ...this.query.value, index: 0 })
    );
  }

  get columns(): readonly Column[] {
    return this.mode === 'loans' ? loanColumns : reservationColumns;
  }

  get columnKeys(): string[] {
    return [...this.columns.map(column => column.key), 'actions'];
  }

  ngOnInit(): void {
    workspaceAction(this.route, this.router, this.mode === 'loans' ? ['issue', 'return'] : ['reserve'])
      .pipe(takeUntil(this.destroyed)).subscribe(action => {
        if (action === 'return') {
          this.pickReturn();
        } else {
          this.entry({ mode: action === 'issue' ? 'issue' : 'reserve' });
        }
      });
    this.route.queryParamMap.pipe(takeUntil(this.destroyed)).subscribe(params => {
      const bookId = params.get('book');
      if (bookId) {
        clearWorkspaceQuery(this.route, this.router, { book: null });
        this.entry({ mode: this.mode === 'loans' ? 'issue' : 'reserve', bookId });
      }
    });
  }

  clear(): void {
    this.filters.reset({ search: '', status: '', start: '', end: '' });
  }

  tab(index: number): void {
    this.filters.get('status')!.setValue('', { emitEvent: false });
    this.query.next({ ...this.query.value, tab: index, index: 0 });
  }

  sort(event: Sort): void {
    this.query.next({ ...this.query.value, sort: event.active, direction: event.direction || 'asc', index: 0 });
  }

  paginate(event: PageEvent): void {
    this.query.next({ ...this.query.value, index: event.pageIndex, size: event.pageSize });
  }

  entry(data: TransactionEntry): void {
    const message = { issue: 'Book issued.', reserve: 'Reservation created.', collect: 'Reservation collected and loan created.' };
    this.dialog.open<TransactionEntryDialogComponent, TransactionEntry, boolean>(TransactionEntryDialogComponent,
      { data, width: '540px', maxWidth: '94vw' }).afterClosed().pipe(take(1), takeUntil(this.destroyed)).subscribe(saved => {
      if (saved) {
        this.snack.open(message[data.mode], 'Dismiss', { duration: 4000 });
      }
    });
  }

  action(data: TransactionAction): void {
    const message = { return: 'Book returned.', renew: 'Loan renewed.', cancel: 'Reservation cancelled.', details: '' };
    this.dialog.open<TransactionActionDialogComponent, TransactionAction, boolean>(TransactionActionDialogComponent,
      { data, width: '490px', maxWidth: '94vw' }).afterClosed().pipe(take(1), takeUntil(this.destroyed)).subscribe(saved => {
      if (saved) {
        this.snack.open(message[data.kind], 'Dismiss', { duration: 4000 });
      }
    });
  }

  private pickReturn(): void {
    this.dialog.open<ReturnLoanPickerComponent, undefined, Loan>(ReturnLoanPickerComponent, {
      width: '540px', maxWidth: '94vw'
    }).afterClosed().pipe(takeUntil(this.destroyed)).subscribe(loan => {
      if (loan) {
        this.action({ kind: 'return', loan });
      }
    });
  }

  collect(item: Reservation): void {
    this.entry({ mode: 'collect', bookId: item.bookId, memberId: item.memberId, reservationId: item.id });
  }

  private loanRow(loan: Loan, today: string): Row {
    const status = loanStatus(loan, today);
    const base = { id: loan.id, book: loan.bookTitle, person: loan.memberName, membership: loan.membershipId,
      day: loan.checkedOutAt, status };
    return { ...base, loan, demo: loan.demonstration,
      cells: { ...base, due: loan.dueAt, returned: loan.returnedAt, renewals: loan.renewals } };
  }

  private reservationRows(records: readonly Reservation[]): Row[] {
    const positions = queuePositions(records);
    return records.map(reservation => {
      const base = { id: reservation.id, book: reservation.bookTitle, person: reservation.memberName,
        membership: reservation.membershipId, day: reservation.placedAt, status: RESERVATION_LABELS[reservation.status] };
      return { ...base, reservation, demo: reservation.demonstration,
        cells: { ...base, position: positions.get(reservation.id), ready: reservation.readyAt,
          deadline: reservation.expiresAt, fulfilled: reservation.fulfilledAt } };
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
