import { Book, Fine, FinePayment, LibraryActivity, Loan, Member, Reservation } from './library';

export interface AnalyticsSource {
  readonly libraryName: string;
  readonly today: string;
  readonly books: readonly Book[];
  readonly members: readonly Member[];
  readonly loans: readonly Loan[];
  readonly reservations: readonly Reservation[];
  readonly fines: readonly Fine[];
  readonly payments: readonly FinePayment[];
  readonly activity: readonly LibraryActivity[];
  readonly warnings: readonly string[];
  readonly inventoryAvailable: boolean;
  readonly membersAvailable: boolean;
}

export interface Period {
  readonly start: string;
  readonly end: string;
}

export interface PopularBook {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly categoryId: string;
  readonly borrowings: number;
  readonly returns: number;
  readonly rank: number;
}

export interface AnalyticsChart {
  readonly title: string;
  readonly description: string;
  readonly kind: 'line' | 'bar' | 'doughnut';
  readonly labels: readonly string[];
  readonly series: readonly { label: string; values: readonly number[] }[];
  readonly currency?: boolean;
}

export interface ActivityItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly demo: boolean;
}
