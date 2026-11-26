import { BookStorageService } from './book-storage.service';
import { CirculationStorageService } from './circulation-storage.service';
import { MemberStorageService } from './member-storage.service';

export class MemoryBookStorage extends BookStorageService {
  constructor(public value: string | null) { super(); }
  override read(): string | null { return this.value; }
  override write(value: string): void { this.value = value; }
}

export class MemoryCirculationStorage extends CirculationStorageService {
  value: string | null = null;
  fail = false;
  previous: string | null = null;
  override readPrevious(): string | null { return this.previous; }
  override read(): string | null { return this.value; }
  override write(value: string): void {
    if (this.fail) {
      throw new Error('Quota exceeded');
    }
    this.value = value;
  }
}

export class MemoryMemberStorage extends MemberStorageService {
  value: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  override read(): string | null { return this.value; }
  override write(value: string): void { this.value = value; }
  override transaction<T>(operation: () => T): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
