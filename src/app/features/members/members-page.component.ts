import { Component, OnDestroy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sort } from '@angular/material/sort';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { EMPTY_MEMBER_FILTERS, filterMembers, MemberColumn, sortMembers } from '../../core/member-query';
import { Member, MEMBERSHIP_STATES, MEMBERSHIP_TYPES } from '../../models/library';
import { MemberService } from '../../services/member.service';
import { workspaceAction } from '../../shared/workspace-action';
import { MemberAction, MemberActionDialogComponent } from './member-action-dialog.component';
import { MemberEditorDialogComponent } from './member-editor-dialog.component';
import { MemberProfileDialogComponent } from './member-profile-dialog.component';

interface DirectoryQuery {
  index: number;
  size: number;
  column: MemberColumn;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-members-page',
  templateUrl: './members-page.component.html'
})
export class MembersPageComponent implements OnDestroy {
  readonly types = MEMBERSHIP_TYPES;
  readonly statuses = [...MEMBERSHIP_STATES, 'Expired'];
  readonly columns = ['name', 'membershipId', 'email', 'membershipType', 'registrationDate', 'expiryDate', 'status', 'actions'];
  readonly filters = this.forms.group({ ...EMPTY_MEMBER_FILTERS });
  readonly warning$ = this.members.storageWarning$;
  private readonly destroyed = new Subject<void>();
  private readonly query = new BehaviorSubject<DirectoryQuery>({ index: 0, size: 10, column: 'name', direction: 'asc' });
  readonly view$ = combineLatest([this.members.members$, this.query]).pipe(map(([members, query]) => {
    const results = sortMembers(filterMembers(members, this.filters.getRawValue()), query.column, query.direction);
    const pageIndex = Math.min(query.index, Math.max(0, Math.ceil(results.length / query.size) - 1));
    const offset = pageIndex * query.size;
    return {
      query, pageIndex, length: results.length, rows: results.slice(offset, offset + query.size),
      total: members.length, demo: members.some(member => member.demonstration),
      counts: members.reduce((counts, member) => {
        counts[member.status]++;
        return counts;
      }, { Active: 0, Expired: 0, Suspended: 0, Inactive: 0 })
    };
  }));

  constructor(private readonly forms: FormBuilder, private readonly members: MemberService,
    private readonly dialog: MatDialog, private readonly snackBar: MatSnackBar, route: ActivatedRoute, router: Router) {
    workspaceAction(route, router, ['add']).pipe(takeUntil(this.destroyed)).subscribe(() => this.edit(null));
    this.filters.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() =>
      this.query.next({ ...this.query.value, index: 0 })
    );
  }

  clear(): void {
    this.filters.reset({ ...EMPTY_MEMBER_FILTERS });
  }

  sort(sort: Sort): void {
    this.query.next({ ...this.query.value, column: sort.active as MemberColumn, direction: sort.direction || 'asc', index: 0 });
  }

  paginate(event: PageEvent): void {
    this.query.next({ ...this.query.value, index: event.pageIndex, size: event.pageSize });
  }

  edit(member: Member | null): void {
    this.dialog.open<MemberEditorDialogComponent, Member | null, Member>(
      MemberEditorDialogComponent, { data: member, width: '670px', maxWidth: '94vw' }
    ).afterClosed().pipe(takeUntil(this.destroyed)).subscribe(result => {
      if (result) {
        this.snackBar.open(member ? 'Member updated.' : 'Member added.', 'Dismiss', { duration: 4000 });
      }
    });
  }

  profile(member: Member): void {
    this.dialog.open<MemberProfileDialogComponent, Member, 'edit' | 'renew'>(
      MemberProfileDialogComponent, { data: member, width: '700px', maxWidth: '94vw' }
    ).afterClosed().pipe(takeUntil(this.destroyed)).subscribe(action => {
      if (action === 'edit') {
        this.edit(member);
      } else if (action === 'renew') {
        this.action(member, 'renew');
      }
    });
  }

  action(member: Member, action: MemberAction): void {
    const messages = { renew: 'Membership renewed.', status: 'Membership status updated.', delete: 'Member deleted.' };
    this.dialog.open<MemberActionDialogComponent, { member: Member; action: MemberAction }, boolean>(
      MemberActionDialogComponent, { data: { member, action }, width: '470px', maxWidth: '94vw' }
    ).afterClosed().pipe(takeUntil(this.destroyed)).subscribe(result => {
      if (result) {
        this.snackBar.open(messages[action], 'Dismiss', { duration: 4000 });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
