import { AnalyticsSource } from '../models/analytics';
import { Facet, ReportQuery, ReportRow, ReportSummary, ReportType } from '../models/report';
import { collator, eventDay, inPeriod, popularBooks, sum } from './analytics';
import { categoryName } from './book-rules';
import { lateDays, loanStatus } from './circulation-dates';
import { activeLoan, activeReservation } from './circulation-state';
import { estimatedFine, outstandingBalance } from './fine-rules';
import { FACET_LABELS, REPORTS } from './report-definitions';

const RESERVATION_STATUS = {
  waiting: 'Waiting', ready: 'Ready for collection', fulfilled: 'Fulfilled', cancelled: 'Cancelled', expired: 'Expired'
};

export const defaultReportQuery: ReportQuery = {
  type: 'inventory', search: '', start: '', end: '', facets: {}, dateBasis: 'issue', sort: 'title', direction: 'asc'
};

function rowsFor(source: AnalyticsSource, query: ReportQuery): ReportRow[] {
  switch (query.type) {
    case 'inventory': return source.books.map(book => ({
      values: { id: book.id, title: book.title, author: book.author, isbn: book.isbn, category: categoryName(book.categoryId),
        language: book.language, copies: book.totalCopies, borrowed: book.borrowedCopies, reserved: book.reservedCopies,
        available: book.availableCopies, status: book.status },
      filters: { category: book.categoryId, language: book.language, status: book.status }, demo: book.demonstration
    }));
    case 'members': return source.members.map(member => ({
      values: { membership: member.membershipId, member: member.firstName + ' ' + member.lastName,
        type: member.membershipType, registered: member.registrationDate, expiry: member.expiryDate, status: member.status,
        loans: source.loans.filter(loan => loan.memberId === member.id && activeLoan(loan)).length,
        reservations: source.reservations.filter(item => item.memberId === member.id && activeReservation(item)).length,
        balance: outstandingBalance(source.fines, member.id) },
      filters: { membershipType: member.membershipType, status: member.status }, day: member.registrationDate,
      demo: member.demonstration
    }));
    case 'circulation': return source.loans.map(loan => {
      const status = loanStatus(loan, source.today);
      return { values: { id: loan.id, title: loan.bookTitle, member: loan.memberName, membership: loan.membershipId,
        issued: loan.checkedOutAt, due: loan.dueAt, returned: loan.returnedAt, renewals: loan.renewals, status,
        days: loan.overdueDaysAtReturn ?? lateDays(loan.dueAt, source.today) },
        filters: { status, book: loan.bookId, member: loan.memberId }, day: loan.checkedOutAt, returned: loan.returnedAt,
        demo: loan.demonstration };
    });
    case 'overdue': return source.loans.filter(loan => activeLoan(loan) && loan.dueAt < source.today).map(loan => ({
      values: { id: loan.id, title: loan.bookTitle, member: loan.memberName, membership: loan.membershipId,
        due: loan.dueAt, days: lateDays(loan.dueAt, source.today), estimate: estimatedFine(loan, source.today), status: 'Overdue' },
      filters: {}, day: loan.dueAt, demo: loan.demonstration
    }));
    case 'reservations': return source.reservations.map(item => ({
      values: { id: item.id, title: item.bookTitle, member: item.memberName, membership: item.membershipId,
        placed: item.placedAt, ready: item.readyAt, deadline: item.expiresAt, fulfilled: item.fulfilledAt, status: RESERVATION_STATUS[item.status] },
      filters: { status: RESERVATION_STATUS[item.status] }, day: item.placedAt, demo: item.demonstration
    }));
    case 'fines': return source.fines.map(fine => ({
      values: { id: fine.id, loan: fine.loanId, title: fine.bookTitle, member: fine.memberName, membership: fine.membershipId,
        date: eventDay(fine.assessedAt), assessed: fine.assessedMinor, paid: fine.paidMinor, balance: fine.balanceMinor, status: fine.status },
      filters: { status: fine.status }, day: eventDay(fine.assessedAt), demo: fine.demonstration
    }));
    case 'payments': return source.payments.map(payment => ({
      values: { id: payment.id, fine: payment.fineId, member: payment.memberName, membership: payment.membershipId,
        date: payment.paidOn, method: payment.method, amount: payment.amountMinor, reference: payment.reference },
      filters: { method: payment.method }, day: payment.paidOn, demo: payment.demonstration
    }));
    case 'popular': return popularBooks(source, query, query.facets.category).map(book => ({
      values: { rank: book.rank, title: book.title, author: book.author, category: book.categoryId === 'unknown' ? 'Unknown' : categoryName(book.categoryId),
        borrowings: book.borrowings, returns: book.returns }, filters: { category: book.categoryId }
    }));
  }
}

function summarize(type: ReportType, rows: readonly ReportRow[]): ReportSummary[] {
  const count = (label: string, value: number): ReportSummary => ({ label, value });
  const total = (key: string, label: string, money = false): ReportSummary =>
    ({ label, value: sum(rows, row => Number(row.values[key] ?? 0)), money });
  const statuses = (...values: string[]): ReportSummary[] => values.map(status =>
    count(status, rows.filter(row => row.values['status'] === status).length));
  const summary = [count('Matching records', rows.length)];
  switch (type) {
    case 'inventory': return [...summary, total('copies', 'Physical copies'), total('available', 'Available copies'),
      total('borrowed', 'Borrowed copies'), total('reserved', 'Ready reserved copies')];
    case 'members': return [...summary, ...statuses('Active', 'Expired', 'Suspended', 'Inactive'),
      total('balance', 'Current assessed balance', true)];
    case 'circulation': return [...summary, ...statuses('Active', 'Due today', 'Overdue', 'Returned')];
    case 'overdue': return [...summary, count('Members affected', new Set(rows.map(row => row.values['membership'])).size),
      total('estimate', 'Estimated accruing fines', true)];
    case 'reservations': return [...summary, ...statuses('Waiting', 'Ready for collection', 'Fulfilled', 'Cancelled', 'Expired')];
    case 'fines': return [...summary, total('assessed', 'Assessed in period', true), total('paid', 'Paid to date on these fines', true),
      total('balance', 'Current balance on these fines', true)];
    case 'payments': return [...summary, total('amount', 'Collected in period', true)];
    case 'popular': return [...summary, total('borrowings', 'Borrowings'), total('returns', 'Completed returns')];
  }
}

export function buildReport(source: AnalyticsSource, query: ReportQuery) {
  const report = REPORTS.find(item => item.type === query.type)!;
  const all = rowsFor(source, query);
  const optionRows = query.type === 'popular' ? rowsFor(source, { ...query, start: '', end: '', facets: {} }) : all;
  const options = report.facets.map(key => {
    const labels = new Map<string, string>();
    for (const row of optionRows) {
      const id = row.filters[key];
      if (id && !labels.has(id)) {
        const label = key === 'book' ? String(row.values['title']) + ' · ' + id :
          key === 'member' ? row.values['member'] + ' · ' + row.values['membership'] :
          key === 'category' ? String(row.values['category']) : id;
        labels.set(id, label);
      }
    }
    const selected = query.facets[key];
    if (selected && !labels.has(selected)) {
      labels.set(selected, selected);
    }
    return { key, label: FACET_LABELS[key],
      values: Array.from(labels, ([value, label]) => ({ value, label })).sort((a, b) => collator.compare(a.label, b.label)) };
  });
  const search = query.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const rows = all.filter(row => {
    const basis = query.type === 'circulation' && query.dateBasis === 'return' ? row.returned : row.day;
    const usesRowDate = !!report.dateLabel && query.type !== 'popular';
    const needsDate = query.start || query.end || (query.type === 'circulation' && query.dateBasis === 'return');
    const text = Object.values(row.values).join(' ').toLowerCase();
    return (!usesRowDate || !needsDate || inPeriod(basis ?? null, query)) &&
      report.facets.every(key => !query.facets[key] || query.facets[key] === row.filters[key]) &&
      search.every(term => text.includes(term));
  }).sort((a, b) => {
    const left = a.values[query.sort] ?? '';
    const right = b.values[query.sort] ?? '';
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left), String(right));
    return (query.direction === 'asc' ? order : -order) ||
      collator.compare(String(a.values['id'] ?? a.values['membership'] ?? a.values['title']),
        String(b.values['id'] ?? b.values['membership'] ?? b.values['title']));
  });
  const filters = options.flatMap(({ key, label, values }) => {
    const selected = query.facets[key];
    return selected ? [{ label, value: values.find(item => item.value === selected)?.label ?? selected }] : [];
  });
  if (query.search.trim()) {
    filters.push({ label: 'Search', value: query.search.trim() });
  }
  if (report.dateLabel) {
    const label = query.type === 'circulation' ? (query.dateBasis === 'issue' ? 'Issue date' : 'Return date') : report.dateLabel;
    filters.push({ label, value: (query.start || 'Any start') + ' to ' + (query.end || 'Any end') });
  }
  return { report, rows, options, summary: summarize(query.type, rows), filters,
    ready: query.type === 'members' ? source.inventoryAvailable && source.membersAvailable : source.inventoryAvailable };
}
