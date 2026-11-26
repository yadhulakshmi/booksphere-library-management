import { analyticsFixture } from './analytics-fixture';
import { reportCsv } from './report-csv';
import { buildReport, defaultReportQuery } from './reports';
import { ReportColumn, ReportRow } from '../models/report';

describe('report projections and CSV', () => {
  const source = analyticsFixture();

  it('combines inventory search and facets and summarizes only matching stock', () => {
    const view = buildReport(source, { ...defaultReportQuery, search: 'atlas',
      facets: { category: 'fiction', language: 'English', status: 'Available' } });
    expect(view.rows.length).toBe(1);
    expect(view.summary.find(item => item.label === 'Available copies')?.value).toBe(3);
    expect(view.options.map(item => item.key)).toEqual(['category', 'language', 'status']);
  });

  it('distinguishes issue dates from returns and retains deleted book and member references', () => {
    const base = { ...defaultReportQuery, type: 'circulation' as const, start: source.today, end: source.today };
    expect(buildReport(source, base).rows).toEqual([]);
    const returned = buildReport(source, { ...base, dateBasis: 'return' });
    expect(returned.rows[0].values['title']).toBe('Deleted Title');
    expect(returned.rows[0].values['membership']).toBe(source.loans[2].membershipId);
    expect(returned.rows[0].values['days']).toBe(2);
  });

  it('uses report-specific status, category, date, and payment method filters', () => {
    const members = buildReport(source, { ...defaultReportQuery, type: 'members', facets: { status: 'Expired' } });
    expect(members.rows.every(row => row.values['status'] === 'Expired')).toBeTrue();
    const reservations = buildReport(source, { ...defaultReportQuery, type: 'reservations', facets: { status: 'Waiting' } });
    expect(reservations.rows.length).toBe(1);
    const popular = buildReport(source, { ...defaultReportQuery, type: 'popular', facets: { category: 'unknown' },
      start: source.today, end: source.today });
    expect(popular.rows[0].values).toEqual(jasmine.objectContaining({ borrowings: 0, returns: 1, title: 'Deleted Title' }));
    const payments = buildReport(source, { ...defaultReportQuery, type: 'payments', facets: { method: 'Cash' },
      start: source.today, end: source.today });
    expect(payments.summary.find(item => item.money)?.value).toBe(125);
  });

  it('reports assessed, outstanding, payments and current estimates independently', () => {
    const fines = buildReport(source, { ...defaultReportQuery, type: 'fines', start: source.today });
    const payment = buildReport(source, { ...defaultReportQuery, type: 'payments' });
    const overdue = buildReport(source, { ...defaultReportQuery, type: 'overdue' });
    expect(fines.summary.map(item => item.value)).toEqual([1, 1000, 375, 625]);
    expect(payment.summary.map(item => item.value)).toEqual([2, 375]);
    expect(overdue.summary.map(item => item.value)).toEqual([1, 1, 500]);
  });

  it('escapes CSV text and neutralizes formula cells while keeping monetary values numeric', () => {
    const columns: ReportColumn[] = [{ key: 'text', label: 'Description', format: 'text' },
      { key: 'amount', label: 'Amount (INR)', format: 'money' }];
    const rows: ReportRow[] = [
      { values: { text: 'First, "quoted"\nsecond', amount: 235 }, filters: {} },
      ...['=SUM(A1:A2)', '  +2', '-1', '@a', '\tformula', '=HYPERLINK("x")'].map(text =>
        ({ values: { text, amount: 0 }, filters: {} }))
    ];
    const result = reportCsv(columns, rows);
    expect(result).toContain('"First, ""quoted""\nsecond","2.35"');
    expect(result).toContain('"\'=SUM(A1:A2)","0.00"');
    expect(result).toContain('"\'  +2"');
    expect(result).toContain('"\'-1"');
    expect(result).toContain('"\'@a"');
    expect(result).toContain('"\'\tformula"');
    expect(result).toContain('"\'=HYPERLINK(""x"")"');
    expect(result.split('\r\n').length).toBe(rows.length + 1);
  });
});
