import { Component, Optional } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { LibraryApiState } from '../services/library-api-state.service';

@Component({
  selector: 'app-data-status',
  template: `
    <div class="library-data-status" *ngIf="view$ | async as view">
      <span class="library-mode">{{ api?.enabled ? 'Mock API' : 'Standalone demo' }}</span>
      <span role="status" aria-live="polite">{{ view[1] ? 'Saving changes…' : view[0] ? 'Loading library data…' : view[2] }}</span>
      <button *ngIf="api?.enabled && view[2]" mat-button type="button" [disabled]="view[0] || view[1]"
        (click)="retry()">Retry read</button>
    </div>
  `
})
export class DataStatusComponent {
  readonly view$ = this.api?.enabled ? combineLatest([this.api.loading$, this.api.mutating$, this.api.warning$])
    : of<[boolean, boolean, string]>([false, false, '']);

  constructor(@Optional() readonly api?: LibraryApiState) {}

  retry(): void {
    void this.api?.refresh();
  }
}
