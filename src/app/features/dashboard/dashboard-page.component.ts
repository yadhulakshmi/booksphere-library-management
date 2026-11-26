import { Component } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { dashboardAnalytics, recentActivity } from '../../core/analytics';
import { categoryName } from '../../core/book-rules';
import { AnalyticsChart } from '../../models/analytics';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss']
})
export class DashboardPageComponent {
  readonly ranges = [7, 30, 90] as const;
  readonly period = new BehaviorSubject<7 | 30 | 90>(7);
  readonly categoryName = categoryName;
  readonly actions = [
    { label: 'Add book', path: '/books', action: 'add', icon: 'library_add' },
    { label: 'Add member', path: '/members', action: 'add', icon: 'person_add' },
    { label: 'Issue book', path: '/circulation', action: 'issue', icon: 'add_task' },
    { label: 'Return book', path: '/circulation', action: 'return', icon: 'assignment_return' },
    { label: 'Create reservation', path: '/reservations', action: 'reserve', icon: 'bookmark_add' },
    { label: 'View overdue loans', path: '/overdue', icon: 'schedule' },
    { label: 'View reports', path: '/reports', icon: 'assessment' }
  ];

  readonly view$ = combineLatest([this.analytics.source$, this.period]).pipe(map(([source, days]) => {
    const data = dashboardAnalytics(source, days);
    const stock = source.inventoryAvailable;
    const members = source.membersAvailable;
    const metric = (label: string, value: number, path: string, icon: string, ready: boolean, money = false) =>
      ({ label, value: ready ? value : null, path, icon, money });
    return {
      source, data, activity: recentActivity(source),
      demo: [...source.books, ...source.members, ...source.loans, ...source.reservations, ...source.fines, ...source.payments]
        .some(item => item.demonstration),
      metrics: [
        metric('Book titles', data.inventory.titles, '/catalogue', 'menu_book', stock),
        metric('Physical copies', data.inventory.copies, '/books', 'library_books', stock),
        metric('Available copies', data.inventory.available, '/catalogue', 'check_circle_outline', stock),
        metric('Total members', data.totalMembers, '/members', 'groups', members),
        metric('Active members', data.activeMembers, '/members', 'person_outline', members),
        metric('Active loans', data.activeLoans, '/circulation', 'swap_horiz', stock),
        metric('Overdue loans', data.overdue, '/overdue', 'schedule', stock),
        metric('Active reservations', data.activeReservations, '/reservations', 'bookmark_border', stock),
        metric('Outstanding assessed fines', data.outstanding, '/overdue', 'payments', stock, true)
      ],
      alerts: [
        metric('Overdue loans', data.overdue, '/overdue', 'schedule', stock),
        metric('Loans due today', data.dueToday, '/circulation', 'today', stock),
        metric('Reservations due within 2 days', data.expiringReservations, '/reservations', 'event_available', stock),
        metric('Expired memberships', data.expiredMembers, '/members', 'person_off', members),
        metric('Outstanding assessed fines', data.outstanding, '/overdue', 'payments', stock, true),
        metric('Unavailable book titles', data.unavailable, '/catalogue', 'inventory_2', stock)
      ]
    };
  }));

  chartKey(_: number, chart: AnalyticsChart): string { return chart.title; }

  constructor(private readonly analytics: AnalyticsService) {}
}
