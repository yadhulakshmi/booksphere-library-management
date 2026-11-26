import { ReportColumn, ReportRow, ReportValue } from '../models/report';

function field(value: ReportValue, money = false): string {
  const text = typeof value === 'number' && money ? (value / 100).toFixed(2) : String(value ?? '');
  const escaped = typeof value === 'string' && (/^[\s\u0000-\u001f\uFEFF]*[=+\-@＝＋－＠]/.test(text) || /^[\t\r\n]/.test(text))
    ? "'" + text : text;
  return '"' + escaped.replace(/"/g, '""') + '"';
}

export function reportCsv(columns: readonly ReportColumn[], rows: readonly ReportRow[]): string {
  return [columns.map(column => field(column.label)).join(','),
    ...rows.map(row => columns.map(column => field(row.values[column.key], column.format === 'money')).join(','))
  ].join('\r\n');
}

export interface CsvDownload {
  readonly href: string;
  readonly filename: string;
}

export function createReportDownload(csv: string, filename: string): CsvDownload {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  return { href: URL.createObjectURL(blob), filename };
}

export function startReportDownload(document: Document, download: CsvDownload): void {
  const anchor = document.createElement('a');
  anchor.href = download.href;
  anchor.download = download.filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
  }
}

export function releaseReportDownload(download: CsvDownload): void {
  // Giving the browser time to consume the link also covers navigation immediately after a click.
  window.setTimeout(() => URL.revokeObjectURL(download.href), 60000);
}
