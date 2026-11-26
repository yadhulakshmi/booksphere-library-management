import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { recordActivity } from '../core/circulation-state';
import { DEFAULT_LIBRARY_SETTINGS, validateSettings } from '../core/library-policies';
import { LibrarySettings } from '../models/library';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { LibraryPolicyService } from './library-policy.service';

@Injectable({ providedIn: 'root' })
export class LibrarySettingsService {
  readonly settings$ = this.policy.settings$;
  readonly warning$ = this.coordinator.warning$;

  constructor(private readonly coordinator: CirculationCoordinator, private readonly policy: LibraryPolicyService) {}

  save(settings: LibrarySettings) {
    return this.coordinator.execute('settings.save', settings, () => this.update(settings, 'settings-updated'));
  }

  restoreDefaults() {
    return this.coordinator.execute('settings.restore', null, () => this.update(DEFAULT_LIBRARY_SETTINGS, 'settings-restored'));
  }

  private update(settings: LibrarySettings, action: 'settings-updated' | 'settings-restored') {
    return this.coordinator.run(({ state, now }) => {
      state.settings = validateSettings(settings);
      recordActivity(state, action, 'library-settings', now);
      return state.settings;
    }).pipe(map(value => value.result));
  }
}
