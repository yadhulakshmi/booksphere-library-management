import { Injectable, NgZone, OnDestroy, Optional } from '@angular/core';
import { BehaviorSubject, defer, firstValueFrom, from, fromEvent, Observable, Subject, timer } from 'rxjs';
import { filter, skip, takeUntil } from 'rxjs/operators';
import { CirculationContext } from '../core/circulation-commands';
import { initialCirculation } from '../core/circulation-migration';
import { CirculationState, parseCirculation, projectInventory, settleReservations } from '../core/circulation-state';
import { localDate } from '../core/member-rules';
import { DEFAULT_LIBRARY_SETTINGS } from '../core/library-policies';
import { BookStorageService } from './book-storage.service';
import { CirculationStorageService } from './circulation-storage.service';
import { LibraryPolicyService } from './library-policy.service';
import { MemberStorageService } from './member-storage.service';
import { ApiAction, ApiInput, ApiResult } from '../models/library-api';
import { LibraryApiState } from './library-api-state.service';
import { MemberService } from './member.service';

@Injectable({ providedIn: 'root' })
export class CirculationCoordinator implements OnDestroy {
  private readonly snapshot = new BehaviorSubject<CirculationState | null>(null);
  private readonly warning = new BehaviorSubject('');
  private readonly destroyed = new Subject<void>();
  readonly state$ = this.snapshot.asObservable();
  readonly warning$ = this.api?.enabled ? this.api.warning$ : this.warning.asObservable();

  constructor(private readonly storage: CirculationStorageService, private readonly legacy: BookStorageService,
    private readonly memberStorage: MemberStorageService, private readonly members: MemberService,
    private readonly policy: LibraryPolicyService, zone?: NgZone, @Optional() private readonly api?: LibraryApiState) {
    if (api?.enabled) {
      api.snapshot$.pipe(takeUntil(this.destroyed)).subscribe(snapshot => {
        this.snapshot.next(snapshot?.circulation ?? null);
        if (snapshot) {
          this.policy.publish(snapshot.circulation.settings);
        }
      });
      zone?.runOutsideAngular(() => timer(60000, 60000).pipe(takeUntil(this.destroyed)).subscribe(() =>
        zone.run(() => void api.poll().then(() => this.settleApiReservations()))
      ));
      return;
    }
    members.changes$.pipe(skip(1), takeUntil(this.destroyed)).subscribe(() => void this.refresh());
    zone?.runOutsideAngular(() => timer(60000, 60000).pipe(takeUntil(this.destroyed)).subscribe(() =>
      zone.run(() => void this.refresh())
    ));
    fromEvent<StorageEvent>(window, 'storage').pipe(
      filter(event => event.key === this.storage.key || event.key === this.storage.previousKey || event.key === this.memberStorage.key),
      takeUntil(this.destroyed)
    ).subscribe(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    if (this.api?.enabled) {
      await this.api.refresh();
      await this.settleApiReservations();
      return;
    }
    try {
      await this.commit(() => undefined);
    } catch (error) {
      this.warning.next(error instanceof Error ? error.message : 'Circulation storage is unavailable.');
    }
  }

  execute<K extends ApiAction>(action: K, input: ApiInput<K>,
    standalone: () => Observable<ApiResult<K>>): Observable<ApiResult<K>> {
    return this.api?.enabled ? this.api.execute(action, input) : standalone();
  }

  private async settleApiReservations(): Promise<void> {
    if (this.api?.enabled) {
      try {
        await firstValueFrom(this.api.settleIfNeeded(localDate()));
      } catch {
        // The API state retains the last confirmed snapshot and exposes transport errors.
      }
    }
  }

  run<T>(command: (context: CirculationContext) => T): Observable<{ result: T; state: CirculationState }> {
    return defer(() => {
      if (this.api?.enabled) {
        throw new Error('Use a typed Mock API operation in API mode.');
      }
      return from(this.commit(command));
    });
  }

  private commit<T>(command: (context: CirculationContext) => T): Promise<{ result: T; state: CirculationState }> {
    return this.memberStorage.transaction(() => {
      const now = new Date();
      const today = localDate(now);
      const members = this.members.readForCirculation(today);
      const defaults = DEFAULT_LIBRARY_SETTINGS;
      let raw: string | null;
      let state: CirculationState;
      try {
        raw = this.storage.read();
        const source = raw ?? this.storage.readPrevious();
        state = source === null
          ? initialCirculation(this.legacy.read(), { members, policy: defaults, now, today })
          : parseCirculation(source, now);
      } catch {
        throw new Error('Saved inventory or circulation data could not be read. The original storage was preserved.');
      }
      settleReservations(state, members, today, now);
      state.books = projectInventory(state);
      const result = command({ state, members, policy: state.settings, now, today });
      settleReservations(state, members, today, now);
      state.books = projectInventory(state);
      const serialized = JSON.stringify(state);
      if (serialized !== raw) {
        try {
          this.storage.write(serialized);
        } catch {
          throw new Error('Browser storage could not save the transaction. No inventory or circulation changes were applied.');
        }
      }
      this.snapshot.next(state);
      this.policy.publish(state.settings);
      this.warning.next('');
      return { result, state };
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}

export function initializeCirculation(coordinator: CirculationCoordinator): () => Promise<void> {
  return () => coordinator.refresh();
}
