import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { activeLoan } from '../../core/circulation-state';
import { CirculationService } from '../../services/circulation.service';

@Component({
  selector: 'app-return-loan-picker',
  template: `
    <h2 mat-dialog-title>Select a loan to return</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="circulation-field">
        <mat-label>Search active loans</mat-label>
        <input matInput [formControl]="search" placeholder="Book, member, or loan ID">
      </mat-form-field>
      <ng-container *ngIf="loans$ | async as loans">
        <p *ngIf="!loans.length" class="muted">No matching active loans.</p>
        <ul class="return-loan-options">
          <li *ngFor="let loan of loans">
            <button mat-stroked-button type="button" [mat-dialog-close]="loan">
              <strong>{{ loan.bookTitle }}</strong><br>{{ loan.memberName }} · {{ loan.id }}
            </button>
          </li>
        </ul>
      </ng-container>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close type="button">Cancel</button></mat-dialog-actions>
  `
})
export class ReturnLoanPickerComponent {
  readonly search = new FormControl('');
  readonly loans$ = combineLatest([this.circulation.loans$, this.search.valueChanges.pipe(startWith(''))])
    .pipe(map(([loans, search]) => {
      const terms = String(search).toLowerCase().trim().split(/\s+/).filter(Boolean);
      return loans.filter(loan => {
        const text = [loan.bookTitle, loan.memberName, loan.membershipId, loan.id].join(' ').toLowerCase();
        return activeLoan(loan) && terms.every(term => text.includes(term));
      }).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
    }));

  constructor(private readonly circulation: CirculationService) {}
}
