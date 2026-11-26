import { Injectable, OnDestroy, Optional } from '@angular/core';
import { BehaviorSubject, combineLatest, defer, firstValueFrom, from, Observable, ReplaySubject, Subject, timer } from 'rxjs';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { changeMembershipStatus, createMember, MemberSnapshot, parseMemberSnapshot, removeMember,
  renewMembership, updateMember } from '../core/member-records';
import { localDate, memberView } from '../core/member-rules';
import { demoMembers } from '../core/member-seed';
import { LibraryActivity, Member, MemberInput, MemberRecord, MembershipState } from '../models/library';
import { LibraryApiState } from './library-api-state.service';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberStorageService } from './member-storage.service';

@Injectable({ providedIn: 'root' })
export class MemberService implements OnDestroy {
  private readonly records = new ReplaySubject<readonly MemberRecord[]>(1);
  private readonly warning = new BehaviorSubject('');
  private readonly registrations = new BehaviorSubject<readonly LibraryActivity[]>([]);
  private readonly destroyed = new Subject<void>();
  readonly registrationActivity$ = this.registrations.asObservable();
  readonly changes$ = this.records.pipe(map(() => undefined));
  readonly storageWarning$ = this.api?.enabled ? this.api.warning$ : this.warning.asObservable();
  readonly members$ = combineLatest([this.records, timer(60000, 60000).pipe(startWith(0))]).pipe(
    map(([records]) => {
      const today = localDate();
      return records.map(record => memberView(record, today));
    })
  );

  constructor(private readonly storage: MemberStorageService, private readonly deletionPolicy: MemberDeletionPolicy,
    @Optional() private readonly api?: LibraryApiState) {
    if (api?.enabled) {
      api.snapshot$.pipe(takeUntil(this.destroyed)).subscribe(snapshot =>
        this.publish(snapshot?.members ?? { lastIssued: 0, records: [] }));
    } else {
      void this.storage.transaction(() => this.readSnapshot()).then(snapshot => this.publish(snapshot)).catch((error: Error) => {
        this.warning.next(error.message);
        this.records.next([]);
      });
    }
  }

  create(input: MemberInput): Observable<Member> {
    return this.api?.enabled ? this.api.execute('member.create', input) :
      this.mutate((snapshot, now) => createMember(snapshot, input, now));
  }

  update(id: string, input: MemberInput): Observable<Member> {
    return this.api?.enabled ? this.api.execute('member.update', { id, member: input }) :
      this.mutate((snapshot, now) => updateMember(snapshot, id, input, now));
  }

  renew(id: string, expiryDate: string): Observable<Member> {
    return this.api?.enabled ? this.api.execute('member.renew', { id, expiryDate }) :
      this.mutate((snapshot, now) => renewMembership(snapshot, id, expiryDate, now));
  }

  changeStatus(id: string, state: MembershipState): Observable<Member> {
    return this.api?.enabled ? this.api.execute('member.status', { id, state }) :
      this.mutate((snapshot, now) => changeMembershipStatus(snapshot, id, state, now));
  }

  delete(id: string): Observable<void> {
    return this.api?.enabled ? this.api.execute('member.delete', { id }) :
      this.mutate(async snapshot => removeMember(snapshot, id, await firstValueFrom(this.deletionPolicy.reasonFor(id))));
  }

  /** Called by the standalone coordinator while holding the shared storage lock. */
  readForCirculation(today: string): readonly Member[] {
    if (this.api?.enabled) {
      throw new Error('Browser member storage is unavailable in Mock API mode.');
    }
    return this.readSnapshot().records.map(record => memberView(record, today));
  }

  private mutate<T>(operation: (snapshot: MemberSnapshot, now: Date) =>
    { snapshot: MemberSnapshot; result: T } | Promise<{ snapshot: MemberSnapshot; result: T }>): Observable<T> {
    return defer(() => from(this.storage.transaction(async () => {
      const changed = await operation(this.readSnapshot(), new Date());
      this.save(changed.snapshot);
      return changed.result;
    }).then<T>(value => value)));
  }

  private readSnapshot(): MemberSnapshot {
    let saved: string | null;
    try {
      saved = this.storage.read();
    } catch {
      throw new Error('Member storage is unavailable.');
    }
    if (saved === null) {
      const records = demoMembers(new Date());
      const snapshot = { lastIssued: records.length, records };
      this.save(snapshot);
      return snapshot;
    }
    try {
      return parseMemberSnapshot(JSON.parse(saved));
    } catch {
      throw new Error('Saved member data is invalid. Changes are blocked to preserve the records and membership IDs.');
    }
  }

  private save(snapshot: MemberSnapshot): void {
    try {
      this.storage.write(JSON.stringify(snapshot));
    } catch {
      throw new Error('Browser storage could not save the member directory.');
    }
    this.publish(snapshot);
    this.warning.next('');
  }

  private publish(snapshot: MemberSnapshot): void {
    this.registrations.next(snapshot.registrations ?? []);
    this.records.next(snapshot.records);
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
