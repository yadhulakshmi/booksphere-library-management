import { Period } from './analytics';

export type ReportType = 'inventory' | 'members' | 'circulation' | 'overdue' | 'reservations' | 'fines' | 'payments' | 'popular';
export type ReportFormat = 'date' | 'money' | 'count' | 'text';
export type Facet = 'category' | 'language' | 'status' | 'membershipType' | 'book' | 'member' | 'method';
export type ReportValue = string | number | null;

export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly format: ReportFormat;
}

export interface ReportRow {
  readonly values: Readonly<Record<string, ReportValue>>;
  readonly filters: Readonly<Partial<Record<Facet, string>>>;
  readonly day?: string | null;
  readonly returned?: string | null;
  readonly demo?: boolean;
}

export interface ReportQuery extends Period {
  readonly type: ReportType;
  readonly search: string;
  readonly facets: Partial<Record<Facet, string>>;
  readonly dateBasis: 'issue' | 'return';
  readonly sort: string;
  readonly direction: 'asc' | 'desc';
}

export interface ReportDefinition {
  readonly type: ReportType;
  readonly title: string;
  readonly scope: string;
  readonly dateLabel?: string;
  readonly columns: readonly ReportColumn[];
  readonly facets: readonly Facet[];
}

export interface ReportSummary {
  readonly label: string;
  readonly value: number;
  readonly money?: boolean;
}
