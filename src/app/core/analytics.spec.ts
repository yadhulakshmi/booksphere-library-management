import { dashboardAnalytics, recentActivity, trendBuckets } from './analytics';
import { analyticsFixture } from './analytics-fixture';

describe('operational dashboard analytics', () => {
  it('aggregates inventory, membership, reservations and mutually exclusive loan statuses', () => {
    const source = analyticsFixture();
    const view = dashboardAnalytics(source, 7);
    expect(view.inventory).toEqual({ titles: 2, copies: 8, available: 5, borrowed: 2, reserved: 1 });
    expect(view.membership['Student']).toBe(2);
    expect(view.totalMembers).toBe(5);
    expect(view.activeMembers).toBe(source.members.filter(member => member.status === 'Active').length);
    expect(view.expiredMembers).toBeGreaterThan(0);
    expect(view.activeLoans).toBe(2);
    expect(view.overdue).toBe(1);
    expect(view.dueToday).toBe(1);
    expect(view.statusCounts).toEqual({ current: 1, overdue: 1, returned: 1 });
    expect(view.activeReservations).toBe(2);
    expect(view.reservationStatuses.ready).toBe(1);
    expect(view.reservationStatuses.waiting).toBe(1);
    expect(view.expiringReservations).toBe(1);
    expect(view.category.find(category => category.name === 'Fiction')?.count).toBe(2);
  });

  it('uses distinct issue, return, assessment and payment dates and includes zero buckets', () => {
    const source = analyticsFixture();
    const daily = trendBuckets(source, 7);
    expect(daily.period).toEqual({ start: '2026-11-19', end: source.today });
    expect(daily.buckets.length).toBe(7);
    expect(daily.buckets[0].issued).toBe(0);
    expect(daily.buckets.map(item => item.issued).reduce((a, b) => a + b)).toBe(2);
    expect(daily.buckets[6].returned).toBe(1);
    expect(daily.buckets[6].assessed).toBe(1000);
    expect(daily.buckets[6].collected).toBe(375);
    expect(trendBuckets(source, 30).buckets.length).toBe(30);
    expect(trendBuckets(source, 90).buckets.length).toBe(13);
    expect(trendBuckets(source, 90).buckets[12].end).toBe(source.today);
  });

  it('keeps outstanding balances, cash and accruing estimates separate and ranks ties deterministically', () => {
    const result = dashboardAnalytics(analyticsFixture(), 7);
    expect(result.outstanding).toBe(625);
    expect(result.collected).toBe(375);
    expect(result.popular.map(book => [book.title, book.rank])).toEqual([['Bridge', 1], ['Deleted Title', 2]]);
    expect(result.popular[1].author).toBe('');
    expect(result.popular[1].categoryId).toBe('unknown');
  });

  it('starts with zero metrics and preserves accessible groups when sources have no records', () => {
    const result = dashboardAnalytics({ ...analyticsFixture(), books: [], members: [], loans: [], reservations: [],
      fines: [], payments: [] }, 30);
    expect(result.inventory.titles).toBe(0);
    expect(result.collected).toBe(0);
    expect(result.popular).toEqual([]);
    expect(result.charts.every(chart => chart.series.every(series => series.values.every(value => value === 0)))).toBeTrue();
  });

  it('renders newest actual activities and resolves historical title snapshots', () => {
    const source = analyticsFixture();
    const result = recentActivity({ ...source, activity: [
      { id: 'ACT-1', entityId: 'LOAN-003', type: 'return', occurredAt: '2026-11-25T09:00:00Z' },
      { id: 'ACT-2', entityId: 'library-settings', type: 'settings-updated', occurredAt: '2026-11-25T11:00:00Z' }
    ] });
    expect(result.map(item => item.title)).toEqual(['Library settings updated', 'Book returned']);
    expect(result[1].description).toContain('Deleted Title');
  });
});
