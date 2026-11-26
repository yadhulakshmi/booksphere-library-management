import { Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';
import { parseCirculation } from '../core/circulation-state';
import { memberDeletionReason } from '../core/member-deletion-rules';
import { localDate } from '../core/member-rules';
import { CirculationStorageService } from './circulation-storage.service';

@Injectable({ providedIn: 'root' })
export class MemberDeletionPolicy {
  constructor(private readonly storage?: CirculationStorageService) {}

  reasonFor(memberId: string): Observable<string | null> {
    return defer(() => {
      let state;
      try {
        const saved = this.storage?.read() ?? this.storage?.readPrevious();
        state = saved != null ? parseCirculation(saved) : null;
      } catch {
        throw new Error('Member deletion is blocked until circulation data can be verified.');
      }
      return of(memberDeletionReason(state, memberId, localDate()));
    });
  }
}
