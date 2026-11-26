import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { issueLoan, renewLoan, returnLoan } from '../core/circulation-commands';
import { CirculationCoordinator } from './circulation-coordinator.service';

@Injectable({ providedIn: 'root' })
export class CirculationService {
  readonly loans$ = this.coordinator.state$.pipe(map(state => state?.loans ?? []));
  readonly warning$ = this.coordinator.warning$;

  constructor(private readonly coordinator: CirculationCoordinator) {}

  issue(memberId: string, bookId: string, date: string, reservationId?: string) {
    return this.coordinator.execute('loan.issue', { memberId, bookId, date, reservationId }, () =>
      this.coordinator.run(context => issueLoan(context, memberId, bookId, date, reservationId)).pipe(map(value => value.result)));
  }

  returnBook(id: string, date: string) {
    return this.coordinator.execute('loan.return', { id, date }, () =>
      this.coordinator.run(context => returnLoan(context, id, date)).pipe(map(value => value.result)));
  }

  renew(id: string) {
    return this.coordinator.execute('loan.renew', { id }, () =>
      this.coordinator.run(context => renewLoan(context, id)).pipe(map(value => value.result)));
  }
}
