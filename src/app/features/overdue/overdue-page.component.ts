import { Component, OnDestroy, TemplateRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, take, takeUntil } from 'rxjs/operators';
import { localDate } from '../../core/member-rules';
import { Fine, FinePayment, Loan, PAYMENT_METHODS } from '../../models/library';
import { CirculationCoordinator } from '../../services/circulation-coordinator.service';
import { MemberService } from '../../services/member.service';
import { TransactionActionDialogComponent } from '../../shared/circulation/transaction-action-dialog.component';
import { MemberProfileDialogComponent } from '../members/member-profile-dialog.component';
import { FinePaymentDialogComponent } from './fine-payment-dialog.component';
import { fineRow, OVERDUE_COLUMNS, overdueRow, OverdueRow, paymentRow } from './overdue-table';

const EMPTY = { search: '', status: '', duration: '', start: '', end: '' };
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

@Component({
  selector: 'app-overdue-page',
  templateUrl: './overdue-page.component.html'
})
export class OverduePageComponent implements OnDestroy {
  readonly filters = this.forms.group({ ...EMPTY });
  readonly warning$ = this.coordinator.warning$;
  readonly fineStatuses: readonly string[] = ['Outstanding', 'Partially Paid', 'Paid'];
  readonly methods: readonly string[] = PAYMENT_METHODS;
  private readonly destroyed = new Subject<void>();
  private readonly query = new BehaviorSubject({ tab: 0, sort: 'date', direction: 'desc' as 'asc' | 'desc', index: 0, size: 10 });
  readonly view$ = combineLatest([this.coordinator.state$, this.query]).pipe(map(([state, query]) => {
    const today = localDate();
    const overdue = state?.loans.filter(loan => !loan.returnedAt && loan.dueAt < today) ?? [];
    const overdueRows = overdue.map(loan => overdueRow(loan, today));
    const fines = state?.fines ?? [];
    const payments = state?.payments ?? [];
    const all = query.tab === 0 ? overdueRows : query.tab === 1 ? fines.map(fineRow) : payments.map(paymentRow);
    const columns = OVERDUE_COLUMNS[query.tab];
    const { search, status, duration, start, end } = this.filters.value;
    const terms = String(search).trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = all.filter(row => (!status || row.status === status) &&
      (!duration || row.days >= Number(duration)) &&
      (!start || row.date >= start) && (!end || row.date <= end) &&
      terms.every(term => row.searchable.includes(term))
    ).sort((a, b) => {
      const left = a.cells[query.sort] ?? (query.sort === 'date' ? a.date : '');
      const right = b.cells[query.sort] ?? (query.sort === 'date' ? b.date : '');
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right));
      return (query.direction === 'asc' ? order : -order) || collator.compare(a.id, b.id);
    });
    const index = Math.min(query.index, Math.max(0, Math.ceil(rows.length / query.size) - 1));
    const offset = index * query.size;
    return { query, columns, keys: [...columns.map(column => column.key), 'actions'], index,
      rows: rows.slice(offset, offset + query.size), length: rows.length, total: all.length,
      overdue: overdue.length, members: new Set(overdue.map(loan => loan.memberId)).size,
      estimated: overdueRows.reduce((sum, row) => sum + row.amount, 0),
      assessed: fines.reduce((sum, fine) => sum + fine.balanceMinor, 0),
      filteredPayments: query.tab === 2 ? rows.reduce((sum, row) => sum + row.amount, 0) : 0 };
  }));

  constructor(private readonly forms: FormBuilder, private readonly coordinator: CirculationCoordinator,
    private readonly members: MemberService, private readonly dialog: MatDialog, private readonly snack: MatSnackBar, route: ActivatedRoute) {
    route.queryParamMap.pipe(takeUntil(this.destroyed)).subscribe(params => {
      const tab = params.get('tab');
      this.tab(tab === 'fines' ? 1 : tab === 'payments' ? 2 : 0);
    });
    this.filters.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() =>
      this.query.next({ ...this.query.value, index: 0 }));
  }

  clear(): void { this.filters.reset({ ...EMPTY }); }

  tab(tab: number): void {
    if (tab === this.query.value.tab) {
      return;
    }
    this.filters.reset({ ...EMPTY }, { emitEvent: false });
    this.query.next({ ...this.query.value, tab, sort: tab === 1 ? 'id' : 'date', direction: 'desc', index: 0 });
  }

  sort(event: Sort): void {
    this.query.next({ ...this.query.value, sort: event.active, direction: event.direction || 'asc', index: 0 });
  }

  paginate(event: PageEvent): void {
    this.query.next({ ...this.query.value, index: event.pageIndex, size: event.pageSize });
  }

  loan(row: OverdueRow): Loan | null { return 'loan' in row ? row.loan : null; }
  fine(row: OverdueRow): Fine | null { return 'fine' in row ? row.fine : null; }
  payment(row: OverdueRow): FinePayment | null { return 'payment' in row ? row.payment : null; }

  returnBook(loan: Loan): void {
    this.dialog.open(TransactionActionDialogComponent, { data: { kind: 'return', loan }, width: '490px', maxWidth: '94vw' })
      .afterClosed().pipe(takeUntil(this.destroyed)).subscribe(saved => {
        if (saved) {
          this.snack.open('Book returned. Any applicable fine has been assessed.', 'Dismiss', { duration: 4500 });
        }
      });
  }

  profile(loan: Loan): void {
    this.members.members$.pipe(take(1), takeUntil(this.destroyed)).subscribe(members => {
      const member = members.find(item => item.id === loan.memberId);
      if (member) {
        this.dialog.open(MemberProfileDialogComponent, { data: { member, readOnly: true }, width: '700px', maxWidth: '94vw' });
      } else {
        this.snack.open('The member profile is unavailable.', 'Dismiss');
      }
    });
  }

  details(template: TemplateRef<unknown>, data: Loan | Fine | FinePayment): void {
    this.dialog.open(template, { data, width: '560px', maxWidth: '94vw' });
  }

  history(fine: Fine): void {
    this.tab(2);
    this.filters.get('search')!.setValue(fine.id);
  }

  pay(fine: Fine): void {
    this.dialog.open(FinePaymentDialogComponent, { data: fine, width: '560px', maxWidth: '94vw' })
      .afterClosed().pipe(takeUntil(this.destroyed)).subscribe(saved => {
        if (saved) {
          this.snack.open('Payment recorded.', 'Dismiss', { duration: 4000 });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
