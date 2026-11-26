import { Injectable } from '@angular/core';
import { BehaviorSubject, defer, firstValueFrom, from, Observable, of } from 'rxjs';
import { finalize, shareReplay } from 'rxjs/operators';
import { parseLibrarySnapshot } from '../core/library-transaction';
import { ApiAction, ApiInput, ApiResult, LibrarySnapshot } from '../models/library-api';
import { LibraryApiClient } from './library-api-client.service';
import { LibraryApiError } from './library-api-error.interceptor';

@Injectable()
export class LibraryApiState {
  private readonly state = new BehaviorSubject<LibrarySnapshot | null>(null);
  private readonly warning = new BehaviorSubject('');
  private readonly reading = new BehaviorSubject(false);
  private readonly writing = new BehaviorSubject(false);
  private readonly inFlight = new Map<string, Observable<unknown>>();
  private readonly uncertainIds = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();
  private read?: Promise<void>;
  private writeCount = 0;
  readonly enabled = this.client.config.dataMode === 'api';
  readonly snapshot$ = this.state.asObservable();
  readonly warning$ = this.warning.asObservable();
  readonly loading$ = this.reading.asObservable();
  readonly mutating$ = this.writing.asObservable();

  constructor(private readonly client: LibraryApiClient) {}

  refresh(): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve();
    }
    if (!this.read) {
      this.reading.next(true);
      this.read = this.enqueue(async () => {
        try {
          const raw = await firstValueFrom(this.client.snapshot());
          const snapshot = parseLibrarySnapshot(raw);
          this.state.next(snapshot);
          this.warning.next('');
        } catch (error) {
          this.warning.next(error instanceof LibraryApiError ? error.message : 'The Mock API returned invalid library data.');
        } finally {
          this.read = undefined;
          this.reading.next(false);
        }
      });
    }
    return this.read;
  }

  execute<K extends ApiAction>(action: K, input: ApiInput<K>): Observable<ApiResult<K>> {
    return defer(() => {
      const key = JSON.stringify([action, input]);
      const pending = this.inFlight.get(key);
      if (pending) {
        return pending as Observable<ApiResult<K>>;
      }
      const request = this.uncertainIds.get(key) ?? newRequestId();
      this.writing.next(++this.writeCount > 0);
      const operation = this.enqueue(async () => {
        const snapshot = this.state.value;
        if (!this.enabled || !snapshot || this.warning.value) {
          throw new Error(this.warning.value || 'Load the Mock API data before submitting a change.');
        }
        try {
          const reply = await firstValueFrom(this.client.execute(action, input, snapshot.revision, request));
          const confirmed = parseLibrarySnapshot(reply.snapshot);
          if (confirmed.revision < snapshot.revision || !Object.prototype.hasOwnProperty.call(reply, 'result')) {
            throw new Error('Invalid Mock API commit response.');
          }
          this.uncertainIds.delete(key);
          this.state.next(confirmed);
          return (reply.result === null ? undefined : reply.result) as ApiResult<K>;
        } catch (error) {
          if (error instanceof LibraryApiError && [409, 412].includes(error.status)) {
            this.warning.next(error.message);
          } else if (!(error instanceof LibraryApiError) || error.uncertain) {
            this.uncertainIds.set(key, request);
            this.warning.next('The Mock API did not confirm this change. Retry the read before submitting again.');
            throw new Error(this.warning.value);
          }
          throw error;
        }
      });
      const shared = from(operation).pipe(finalize(() => {
        this.inFlight.delete(key);
        this.writing.next(--this.writeCount > 0);
      }), shareReplay({ bufferSize: 1, refCount: false }));
      this.inFlight.set(key, shared);
      return shared;
    });
  }

  async poll(): Promise<void> {
    if (!this.warning.value) {
      await this.refresh();
    }
  }

  settleIfNeeded(today: string): Observable<void> {
    const state = this.state.value?.circulation;
    if (!state || this.warning.value ||
      !state.reservations.some(item => item.status === 'ready' && item.expiresAt! < today)) {
      return of(undefined);
    }
    return this.execute('reservations.settle', null);
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

function newRequestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
