import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CirculationStorageService {
  readonly key = 'booksphere.circulation.v2';
  readonly previousKey = 'booksphere.circulation.v1';

  readPrevious(): string | null {
    return localStorage.getItem(this.previousKey);
  }

  read(): string | null {
    return localStorage.getItem(this.key);
  }

  write(snapshot: string): void {
    localStorage.setItem(this.key, snapshot);
  }
}
