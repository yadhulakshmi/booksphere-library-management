import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { CirculationCoordinator } from './circulation-coordinator.service';

@Injectable({ providedIn: 'root' })
export class LibraryActivityService {
  readonly activity$ = this.coordinator.state$.pipe(map(state => state?.activity ?? []));

  constructor(private readonly coordinator: CirculationCoordinator) {}
}
