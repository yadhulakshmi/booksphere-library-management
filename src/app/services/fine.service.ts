import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { payFine } from '../core/fine-commands';
import { FinePaymentInput } from '../models/library';
import { CirculationCoordinator } from './circulation-coordinator.service';

@Injectable({ providedIn: 'root' })
export class FineService {
  readonly fines$ = this.coordinator.state$.pipe(map(state => state?.fines ?? []));
  readonly payments$ = this.coordinator.state$.pipe(map(state => state?.payments ?? []));
  constructor(private readonly coordinator: CirculationCoordinator) {}

  pay(fineId: string, input: FinePaymentInput) {
    return this.coordinator.execute('fine.pay', { fineId, payment: input }, () =>
      this.coordinator.run(context => payFine(context, fineId, input)).pipe(map(value => value.result)));
  }
}
