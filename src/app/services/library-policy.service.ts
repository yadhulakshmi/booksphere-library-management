import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DEFAULT_LIBRARY_SETTINGS } from '../core/library-policies';
import { LibrarySettings } from '../models/library';

export type CirculationPolicy = LibrarySettings;

@Injectable({ providedIn: 'root' })
export class LibraryPolicyService {
  private readonly settings = new BehaviorSubject<LibrarySettings>(DEFAULT_LIBRARY_SETTINGS);
  readonly settings$ = this.settings.asObservable();

  get current(): LibrarySettings {
    return this.settings.value;
  }

  /** Called only after loading or committing an authoritative snapshot. */
  publish(settings: LibrarySettings): void {
    if (JSON.stringify(this.settings.value) !== JSON.stringify(settings)) {
      this.settings.next(Object.freeze({ ...settings }));
    }
  }
}
