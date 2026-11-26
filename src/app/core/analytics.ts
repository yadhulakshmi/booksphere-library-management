import { ActivityItem, AnalyticsChart, AnalyticsSource, Period, PopularBook } from '../models/analytics';
import { LibraryActivity, MEMBERSHIP_TYPES } from '../models/library';
import { BOOK_CATEGORIES } from './book-rules';
import { shiftDay } from './circulation-dates';
import { activeLoan, activeReservation } from './circulation-state';
import { localDate } from './member-rules';

export const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const inPeriod = (day: string | null, period: Period): boolean =>
  !!day && (!period.start || day >= period.start) && (!period.end || day <= period.end);
export const eventDay = (stamp: string): string => localDate(new Date(stamp));
export const sum = <T>(items: readonly T[], value: (item: T) => number): number =>
  items.reduce((total, item) => total + value(item), 0);

export function inventoryTotals(books: AnalyticsSource['books']) {
  return { titles: books.length, copies: sum(books, book => book.totalCopies),
    available: sum(books, book => book.availableCopies), borrowed: sum(books, book => book.borrowedCopies),
    reserved: sum(books, book => book.reservedCopies) };
}

export function popularBooks(source: AnalyticsSource, period: Period, category = ''): PopularBook[] {
  const inventory = new Map(source.books.map(book => [book.id, book]));
  const records = new Map<string, Omit<PopularBook, 'rank'>>();
  for (const loan of source.loans) {
    const issue = inPeriod(loan.checkedOutAt, period);
    const returned = inPeriod(loan.returnedAt, period);
    const book = inventory.get(loan.bookId);
    const categoryId = book?.categoryId ?? 'unknown';
    if ((!issue && !returned) || (category && category !== categoryId)) {
      continue;
    }
    const prior = records.get(loan.bookId);
    records.set(loan.bookId, {
      id: loan.bookId, title: book?.title ?? prior?.title ?? loan.bookTitle,
      author: book?.author ?? '', categoryId, borrowings: (prior?.borrowings ?? 0) + Number(issue),
      returns: (prior?.returns ?? 0) + Number(returned)
    });
  }
  return Array.from(records.values()).sort((a, b) =>
    b.borrowings - a.borrowings || collator.compare(a.title, b.title) || collator.compare(a.id, b.id)
  ).map((book, index) => ({ ...book, rank: index + 1 }));
}

const shortDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formattedDay = (day: string): string => shortDay.format(new Date(day + 'T00:00:00Z'));

export function trendBuckets(source: AnalyticsSource, days: 7 | 30 | 90) {
  const period = { start: shiftDay(source.today, 1 - days), end: source.today };
  const width = days === 90 ? 7 : 1;
  const starts = Array.from({ length: Math.ceil(days / width) }, (_, index) => shiftDay(period.start, index * width));
  const buckets = starts.map((start, index) => ({
    start, end: index + 1 < starts.length ? shiftDay(starts[index + 1], -1) : period.end,
    issued: 0, returned: 0, assessed: 0, collected: 0
  }));
  const add = (day: string | null, key: 'issued' | 'returned' | 'assessed' | 'collected', amount: number): void => {
    if (inPeriod(day, period)) {
      const bucket = buckets.find(item => inPeriod(day, item));
      if (bucket) {
        bucket[key] += amount;
      }
    }
  };
  source.loans.forEach(loan => {
    add(loan.checkedOutAt, 'issued', 1);
    add(loan.returnedAt, 'returned', 1);
  });
  source.fines.forEach(fine => add(eventDay(fine.assessedAt), 'assessed', fine.assessedMinor));
  source.payments.forEach(payment => add(payment.paidOn, 'collected', payment.amountMinor));
  return { period, buckets, labels: buckets.map(bucket => width === 1 ?
    formattedDay(bucket.start) : formattedDay(bucket.start) + '–' + formattedDay(bucket.end)) };
}

export function dashboardAnalytics(source: AnalyticsSource, days: 7 | 30 | 90) {
  const { period, buckets, labels } = trendBuckets(source, days);
  const active = source.loans.filter(activeLoan);
  const overdue = active.filter(loan => loan.dueAt < source.today);
  const statusCounts = { current: active.length - overdue.length, overdue: overdue.length, returned: source.loans.length - active.length };
  const membership = Object.fromEntries(MEMBERSHIP_TYPES.map(type =>
    [type, source.members.filter(member => member.membershipType === type).length]));
  const category = BOOK_CATEGORIES.map(({ id, name }) => ({
    name, count: source.books.filter(book => book.categoryId === id).length
  }));
  const reservationStatuses = { waiting: 0, ready: 0, fulfilled: 0, cancelled: 0, expired: 0 };
  source.reservations.forEach(item => reservationStatuses[item.status]++);
  const charts: AnalyticsChart[] = [
    { title: 'Borrowing and return trends', description: days === 90 ? 'Issues and returns by seven-day interval.' : 'Issues and returns by calendar day.',
      kind: 'line', labels, series: [{ label: 'Issued', values: buckets.map(b => b.issued) }, { label: 'Returned', values: buckets.map(b => b.returned) }] },
    { title: 'Book category distribution', description: 'Titles currently in the inventory.', kind: 'doughnut',
      labels: category.map(item => item.name), series: [{ label: 'Titles', values: category.map(item => item.count) }] },
    { title: 'Membership distribution', description: 'Current members across all membership statuses.', kind: 'bar',
      labels: MEMBERSHIP_TYPES, series: [{ label: 'Members', values: MEMBERSHIP_TYPES.map(type => membership[type]) }] },
    { title: 'Circulation status', description: 'Open loans are divided into current and overdue. Returned loans are all-time history.',
      kind: 'bar', labels: ['Open, not overdue', 'Overdue', 'Returned'], series: [{ label: 'Loans', values: Object.values(statusCounts) }] },
    { title: 'Fine and payment trends', description: 'Fines by assessment date. Payments by recorded payment date.',
      kind: 'line', labels, currency: true, series: [{ label: 'Assessed', values: buckets.map(b => b.assessed) },
        { label: 'Collected', values: buckets.map(b => b.collected) }] }
  ];
  return {
    charts, period, category, membership, reservationStatuses, statusCounts,
    inventory: inventoryTotals(source.books), totalMembers: source.members.length,
    activeMembers: source.members.filter(member => member.status === 'Active').length,
    activeLoans: active.length, overdue: overdue.length,
    activeReservations: source.reservations.filter(activeReservation).length,
    outstanding: sum(source.fines, fine => fine.balanceMinor),
    collected: sum(buckets, bucket => bucket.collected),
    popular: popularBooks(source, period).filter(book => book.borrowings > 0).slice(0, 5),
    dueToday: active.filter(loan => loan.dueAt === source.today).length,
    expiringReservations: source.reservations.filter(item => item.status === 'ready' &&
      inPeriod(item.expiresAt, { start: source.today, end: shiftDay(source.today, 2) })).length,
    expiredMembers: source.members.filter(member => member.status === 'Expired').length,
    unavailable: source.books.filter(book => book.availableCopies === 0).length
  };
}

const ACTIVITY_LABELS: Record<LibraryActivity['type'], string> = {
  'book-added': 'Book added', 'book-updated': 'Inventory updated', 'book-deleted': 'Book deleted',
  'member-registered': 'Member registered', checkout: 'Book issued', return: 'Book returned',
  'loan-renewed': 'Loan renewed', reservation: 'Reservation created', 'reservation-ready': 'Reservation ready',
  'reservation-fulfilled': 'Reservation collected', 'reservation-cancelled': 'Reservation cancelled',
  'reservation-expired': 'Reservation expired', fine: 'Fine assessed', 'fine-partial-payment': 'Partial payment recorded',
  'fine-paid': 'Fine paid', 'settings-updated': 'Library settings updated', 'settings-restored': 'Default settings restored'
};

export function recentActivity(source: AnalyticsSource): ActivityItem[] {
  const related = new Map([...source.loans, ...source.reservations, ...source.fines, ...source.payments]
    .map(record => [record.id, record]));
  const books = new Map(source.books.map(book => [book.id, book]));
  return [...source.activity].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    collator.compare(b.id, a.id)).slice(0, 8).map(event => {
      const record = related.get(event.entityId);
      const book = books.get(event.entityId);
      return { id: event.id, title: ACTIVITY_LABELS[event.type] ?? 'Library activity',
        description: event.description ?? (record ? record.bookTitle + ' · ' + record.membershipId :
          book?.title ?? (event.entityId === 'library-settings' ? 'Library information and policies' : event.entityId)),
        occurredAt: event.occurredAt, demo: !!(record?.demonstration ?? book?.demonstration) };
    });
}
