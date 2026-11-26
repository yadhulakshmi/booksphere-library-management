import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { createReportDownload, CsvDownload, releaseReportDownload, reportCsv, startReportDownload } from '../../core/report-csv';
import { REPORTS } from '../../core/report-definitions';
import { buildReport, defaultReportQuery } from '../../core/reports';
import { Facet, ReportType } from '../../models/report';
import { localDate } from '../../core/member-rules';
import { AnalyticsService } from '../../services/analytics.service';

const EMPTY = {
  search: '', start: '', end: '', dateBasis: 'issue',
  category: '', language: '', status: '', membershipType: '', book: '', member: '', method: ''
};

@Component({
  selector: 'app-reports-page',
  templateUrl: './reports-page.component.html'
})
export class ReportsPageComponent implements OnDestroy {
  readonly reports = REPORTS;
  readonly filters = this.forms.group({ ...EMPTY });
  private readonly switches = new BehaviorSubject({ ...defaultReportQuery, index: 0, size: 10 });
  private readonly destroyed = new Subject<void>();
  generatedAt = new Date();
  printRequested = false;
  lastDownload?: CsvDownload & { safeHref: SafeUrl };
  outputError = '';
  @ViewChild('printReport') private printReport?: ElementRef<HTMLElement>;
  private printOutput?: HTMLElement;

  private readonly reportQuery$ = this.switches.pipe(
    map(({ index, size, ...query }) => {
      const { search, start, end, dateBasis, ...facets } = this.filters.getRawValue();
      return { ...query, search, start, end, dateBasis, facets };
    }),
    distinctUntilChanged((previous, next) => JSON.stringify(previous) === JSON.stringify(next))
  );
  private readonly projection$ = combineLatest([this.analytics.source$, this.reportQuery$]).pipe(map(([source, query]) => {
    const result = buildReport(source, query);
    const invalidRange = !!query.start && !!query.end && query.start > query.end;
    const outputUnavailable = invalidRange ? 'Correct the date range before exporting or printing.' :
      !result.ready ? 'Export and print are unavailable until the report data loads.' :
      !result.rows.length ? 'Export and print need at least one matching record.' : '';
    return { ...result, source, keys: result.report.columns.map(column => column.key), invalidRange, outputUnavailable };
  }));
  readonly view$ = combineLatest([this.projection$, this.switches]).pipe(map(([result, query]) => {
    const index = Math.min(query.index, Math.max(0, Math.ceil(result.rows.length / query.size) - 1));
    const offset = index * query.size;
    return { ...result, query, index, page: result.rows.slice(offset, offset + query.size) };
  }));

  constructor(private readonly forms: FormBuilder, private readonly analytics: AnalyticsService, private readonly changeDetector: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly document: Document, private readonly zone: NgZone,
    private readonly sanitizer: DomSanitizer) {
    this.filters.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(() =>
      this.switches.next({ ...this.switches.value, index: 0 }));
  }

  get type(): ReportType { return this.switches.value.type; }

  select(type: ReportType): void {
    const definition = REPORTS.find(report => report.type === type);
    if (!definition) {
      return;
    }
    this.filters.reset({ ...EMPTY }, { emitEvent: false });
    this.switches.next({ ...this.switches.value, type, sort: type === 'inventory' ? 'title' : definition.columns[0].key,
      direction: 'asc', index: 0 });
  }

  clear(): void { this.filters.reset({ ...EMPTY }); }

  sort(event: Sort): void {
    this.switches.next({ ...this.switches.value, sort: event.active, direction: event.direction || 'asc', index: 0 });
  }

  paginate(event: PageEvent): void {
    this.switches.next({ ...this.switches.value, index: event.pageIndex, size: event.pageSize });
  }

  facetKey(_: number, facet: { key: Facet }): Facet { return facet.key; }
  optionKey(_: number, option: { value: string }): string { return option.value; }

  exportCsv(report: ReturnType<typeof buildReport>): void {
    if (!report.ready || !report.rows.length) {
      return;
    }
    this.outputError = '';
    try {
      const download = createReportDownload(reportCsv(report.report.columns, report.rows),
        'booksphere-' + report.report.type + '-' + localDate() + '.csv');
      this.releaseDownload();
      this.lastDownload = { ...download, safeHref: this.sanitizer.bypassSecurityTrustUrl(download.href) };
      startReportDownload(this.document, download);
    } catch {
      this.outputError = 'The CSV download could not start. Try the download link if available.';
    }
  }

  print(): void {
    this.finishPrint();
    this.outputError = '';
    try {
      if (!this.document.defaultView || !this.preparePrint()) {
        this.outputError = 'The report is unavailable for printing.';
        return;
      }
      this.document.defaultView.print();
    } catch {
      this.finishPrint();
      this.outputError = 'The browser could not open the print dialog.';
    }
  }

  @HostListener('window:beforeprint')
  preparePrint(): boolean {
    if (this.printOutput) {
      return true;
    }
    this.generatedAt = new Date();
    this.printRequested = true;
    this.changeDetector.detectChanges();
    const report = this.printReport?.nativeElement.cloneNode(true) as HTMLElement | undefined;
    this.printRequested = false;
    this.changeDetector.detectChanges();
    if (!report) {
      return false;
    }
    report.classList.add('report-print-output');
    this.document.body.appendChild(report);
    this.document.body.classList.add('booksphere-report-printing');
    this.printOutput = report;
    return true;
  }

  @HostListener('window:afterprint')
  finishPrint(): void {
    this.printOutput?.remove();
    this.printOutput = undefined;
    this.document.body.classList.remove('booksphere-report-printing');
  }

  private releaseDownload(): void {
    const download = this.lastDownload;
    if (download) {
      this.zone.runOutsideAngular(() => releaseReportDownload(download));
    }
  }

  ngOnDestroy(): void {
    this.finishPrint();
    this.releaseDownload();
    this.destroyed.next();
    this.destroyed.complete();
  }
}
