import { Facet, ReportColumn, ReportDefinition, ReportFormat } from '../models/report';

const column = (key: string, label: string, format: ReportFormat = 'text'): ReportColumn => ({ key, label, format });

export const FACET_LABELS: Record<Facet, string> = {
  category: 'Category', language: 'Language', status: 'Status', membershipType: 'Membership type',
  book: 'Book', member: 'Member', method: 'Payment method'
};

export const REPORTS: readonly ReportDefinition[] = [
  { type: 'inventory', title: 'Inventory', scope: 'Current inventory snapshot', facets: ['category', 'language', 'status'],
    columns: [column('id', 'Book ID'), column('title', 'Title'), column('author', 'Author'), column('isbn', 'ISBN'),
      column('category', 'Category'), column('language', 'Language'), column('copies', 'Total copies', 'count'),
      column('borrowed', 'Borrowed copies', 'count'), column('reserved', 'Ready reserved copies', 'count'),
      column('available', 'Available copies', 'count'), column('status', 'Availability')] },
  { type: 'members', title: 'Members', scope: 'Current member snapshot with optional registration period',
    facets: ['membershipType', 'status'], dateLabel: 'Registration date',
    columns: [column('membership', 'Membership ID'), column('member', 'Member'), column('type', 'Membership type'),
      column('registered', 'Registered', 'date'), column('expiry', 'Expires', 'date'), column('status', 'Current status'),
      column('loans', 'Active loans', 'count'), column('reservations', 'Active reservations', 'count'),
      column('balance', 'Outstanding assessed fines (INR)', 'money')] },
  { type: 'circulation', title: 'Circulation', scope: 'Loan history by issue or return date, with current status for open loans',
    facets: ['status', 'book', 'member'], dateLabel: 'Loan date',
    columns: [column('id', 'Loan ID'), column('title', 'Book title'), column('member', 'Member'), column('membership', 'Membership ID'),
      column('issued', 'Issued', 'date'), column('due', 'Due', 'date'), column('returned', 'Returned', 'date'),
      column('renewals', 'Renewals', 'count'), column('status', 'Loan status'), column('days', 'Overdue days', 'count')] },
  { type: 'overdue', title: 'Overdue loans', scope: 'Current overdue snapshot. Estimates accrue and are not payable until assessed.',
    facets: [], dateLabel: 'Due date',
    columns: [column('id', 'Loan ID'), column('title', 'Book title'), column('member', 'Member'), column('membership', 'Membership ID'),
      column('due', 'Due', 'date'), column('days', 'Overdue days', 'count'), column('estimate', 'Estimated fine (INR)', 'money'),
      column('status', 'Current status')] },
  { type: 'reservations', title: 'Reservations', scope: 'Reservation placement period with latest recorded status',
    facets: ['status'], dateLabel: 'Placement date',
    columns: [column('id', 'Reservation ID'), column('title', 'Book title'), column('member', 'Member'), column('membership', 'Membership ID'),
      column('placed', 'Placed', 'date'), column('ready', 'Ready', 'date'), column('deadline', 'Collection deadline', 'date'),
      column('fulfilled', 'Fulfilled', 'date'), column('status', 'Status')] },
  { type: 'fines', title: 'Financial · fine assessments', scope: 'Assessment period. Paid and outstanding amounts reflect current balances on those assessments.',
    facets: ['status'], dateLabel: 'Assessment date',
    columns: [column('id', 'Fine ID'), column('loan', 'Loan ID'), column('title', 'Book title'), column('member', 'Member'),
      column('membership', 'Membership ID'), column('date', 'Assessed on', 'date'), column('assessed', 'Assessed (INR)', 'money'),
      column('paid', 'Paid to date (INR)', 'money'), column('balance', 'Current outstanding (INR)', 'money'), column('status', 'Fine status')] },
  { type: 'payments', title: 'Financial · payment transactions', scope: 'Recorded payment period. Each full or partial payment appears once.',
    facets: ['method'], dateLabel: 'Payment date',
    columns: [column('id', 'Payment ID'), column('fine', 'Fine ID'), column('member', 'Member'), column('membership', 'Membership ID'),
      column('date', 'Payment date', 'date'), column('method', 'Method'), column('amount', 'Amount (INR)', 'money'), column('reference', 'Reference')] },
  { type: 'popular', title: 'Popular books', scope: 'Issues and returns recorded during the period. Category and author use the current catalogue where available.',
    facets: ['category'], dateLabel: 'Issue or return date',
    columns: [column('rank', 'Rank', 'count'), column('title', 'Book title'), column('author', 'Author'), column('category', 'Category'),
      column('borrowings', 'Borrowings', 'count'), column('returns', 'Completed returns', 'count')] }
];
