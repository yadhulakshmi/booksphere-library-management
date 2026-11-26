import { Injectable } from '@angular/core';

let localQueue: Promise<unknown> = Promise.resolve();

@Injectable({ providedIn: 'root' })
export class MemberStorageService {
  readonly key = 'booksphere.members.v1';

  read(): string | null {
    return localStorage.getItem(this.key);
  }

  write(snapshot: string): void {
    localStorage.setItem(this.key, snapshot);
  }

  transaction<T>(operation: () => T): Promise<T> {
    const locks = (navigator as Navigator & {
      locks?: { request<R>(name: string, callback: () => R): Promise<R> };
    }).locks;
    if (locks) {
      return locks.request('booksphere.library-write', operation);
    }
    const result = localQueue.then(operation);
    localQueue = result.catch(() => undefined);
    return result;
  }
}
