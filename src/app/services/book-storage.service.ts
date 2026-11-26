import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BookStorageService {
  private readonly key = 'booksphere.books.v1';

  read(): string | null {
    return localStorage.getItem(this.key);
  }

  write(snapshot: string): void {
    localStorage.setItem(this.key, snapshot);
  }
}
