import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { cancelReservation, placeReservation } from '../core/circulation-commands';
import { queuePositions } from '../core/circulation-state';
import { CirculationCoordinator } from './circulation-coordinator.service';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  readonly reservations$ = this.coordinator.state$.pipe(map(state => state?.reservations ?? []));
  readonly directory$ = this.reservations$.pipe(map(records => ({ records, positions: queuePositions(records) })));
  readonly warning$ = this.coordinator.warning$;

  constructor(private readonly coordinator: CirculationCoordinator) {}

  create(memberId: string, bookId: string) {
    return this.coordinator.execute('reservation.create', { memberId, bookId }, () =>
      this.coordinator.run(context => placeReservation(context, memberId, bookId)).pipe(
        map(({ result, state }) => state.reservations.find(item => item.id === result)!)
      ));
  }

  cancel(id: string) {
    return this.coordinator.execute('reservation.cancel', { id }, () =>
      this.coordinator.run(context => cancelReservation(context, id)).pipe(map(value => value.result)));
  }
}
