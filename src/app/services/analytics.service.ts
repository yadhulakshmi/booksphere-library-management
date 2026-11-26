import { Injectable, Optional } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { localDate, memberView } from '../core/member-rules';
import { AnalyticsSource } from '../models/analytics';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { LibraryApiState } from './library-api-state.service';
import { LibraryActivityService } from './library-activity.service';
import { MemberService } from './member.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  readonly source$: Observable<AnalyticsSource> = (this.api?.enabled
    ? combineLatest([this.api.snapshot$, this.api.warning$]).pipe(map(([snapshot, warning]) => {
      const state = snapshot?.circulation;
      const today = localDate();
      return {
        libraryName: state?.settings.name ?? 'BookSphere', today,
        books: state?.books ?? [], members: snapshot?.members.records.map(record => memberView(record, today)) ?? [],
        loans: state?.loans ?? [], reservations: state?.reservations ?? [], fines: state?.fines ?? [],
        payments: state?.payments ?? [], activity: [...(state?.activity ?? []), ...(snapshot?.members.registrations ?? [])],
        warnings: warning ? [warning] : [], inventoryAvailable: !!snapshot, membersAvailable: !!snapshot
      };
    }))
    : combineLatest([
      this.coordinator.state$, this.coordinator.warning$, this.members.members$,
      this.members.storageWarning$, this.activity.activity$, this.members.registrationActivity$
    ]).pipe(map(([snapshot, inventoryWarning, members, memberWarning, activity, registrations]) => ({
      libraryName: snapshot?.settings.name ?? 'BookSphere',
      today: localDate(),
      books: snapshot?.books ?? [], members, loans: snapshot?.loans ?? [], reservations: snapshot?.reservations ?? [],
      fines: snapshot?.fines ?? [], payments: snapshot?.payments ?? [],
      activity: [...activity, ...registrations],
      warnings: Array.from(new Set([inventoryWarning, memberWarning].filter(Boolean))),
      inventoryAvailable: snapshot !== null, membersAvailable: !memberWarning
    })))
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  constructor(private readonly coordinator: CirculationCoordinator, private readonly members: MemberService,
    private readonly activity: LibraryActivityService, @Optional() private readonly api?: LibraryApiState) {}
}
