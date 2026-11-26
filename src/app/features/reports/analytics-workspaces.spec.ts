import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { analyticsFixture } from '../../core/analytics-fixture';
import { REPORTS } from '../../core/report-definitions';
import { demoBooks } from '../../core/book-seed';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsChartComponent } from '../dashboard/analytics-chart.component';
import { DashboardPageComponent } from '../dashboard/dashboard-page.component';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsPageComponent } from './reports-page.component';
import { ReportsModule } from './reports.module';

describe('dashboard and reporting workspaces', () => {
  const source = new BehaviorSubject(analyticsFixture());

  beforeEach(async () => {
    source.next({ ...analyticsFixture(), books: demoBooks('2026-11-25T12:00:00Z') });
    await TestBed.configureTestingModule({
      imports: [DashboardModule, ReportsModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: AnalyticsService, useValue: { source$: source.asObservable() } }]
    }).overrideComponent(AnalyticsChartComponent, {
      set: { template: '<p>{{ data.title }}</p>' }
    }).compileComponents();
  });

  async function render(fixture: ComponentFixture<unknown>): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('renders live dashboard sections, the chart models and quick action links without canvas', async () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    const page = await render(fixture);
    expect(page.textContent).toContain('Test Library');
    expect(page.textContent).toContain('Current snapshot');
    expect(page.textContent).toContain('Collected payments');
    expect(page.querySelectorAll('app-analytics-chart').length).toBe(5);
    expect(page.textContent).toContain('Deleted Title');
    expect(page.querySelector('a[href="/circulation?action=return"]')?.textContent).toContain('Return book');
    fixture.componentInstance.period.next(30);
    await render(fixture);
    expect(page.textContent).toContain('Pride and Prejudice');
  });

  it('passes chart data into an accessible table even when canvas rendering is unavailable', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [DashboardModule, NoopAnimationsModule, RouterTestingModule] }).compileComponents();
    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(null);
    const fixture = TestBed.createComponent(AnalyticsChartComponent);
    fixture.componentInstance.data = { title: 'Issue trends', description: 'Day totals', kind: 'line',
      labels: ['Nov 25'], series: [{ label: 'Issued', values: [3] }] };
    const page = await render(fixture);
    expect(page.querySelector('canvas')?.getAttribute('aria-label')).toContain('Issue trends');
    expect(page.querySelector('table')?.textContent).toContain('Issued');
    expect(page.querySelector('table tbody td')?.textContent).toBe('3');
  });

  it('paginates the on-screen report and exports and prints every filtered row', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.componentInstance.filters.get('language')!.setValue('English');
    const page = await render(fixture);
    const matching = source.value.books.filter(book => book.language === 'English').length;
    expect(page.querySelectorAll('table.mat-table tbody tr').length).toBe(10);
    expect(page.querySelector('.report-print')).toBeNull();
    let blob: Blob | undefined;
    spyOn(URL, 'createObjectURL').and.callFake(value => {
      blob = value as Blob;
      return 'blob:test-report';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    const exportButton = Array.from(page.querySelectorAll('button')).find(button => button.textContent?.includes('Export CSV'))!;
    exportButton.click();
    const text = await blob!.text();
    expect(text.split('\r\n').length).toBe(matching + 1);
    expect(text).toContain('"Book ID","Title","Author"');
    const print = spyOn(window, 'print').and.callFake(() => {
      const snapshot = document.body.querySelector('.report-print-output');
      expect(snapshot?.querySelectorAll('tbody tr').length).toBe(matching);
      expect(snapshot?.querySelector('header')?.textContent).toContain('Test Library');
    });
    fixture.componentInstance.print();
    expect(print).toHaveBeenCalled();
  });

  it('selects every report through Material and renders the expected table headers', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    const page = await render(fixture);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const select = await loader.getHarness(MatSelectHarness.with({ selector: '#report-type' }));
    for (const report of REPORTS) {
      await select.open();
      const options = await select.getOptions({ text: report.title });
      await options[0].click();
      expect(Array.from(page.querySelectorAll('.report-data-table th')).map(cell => cell.textContent?.trim()))
        .toEqual(report.columns.map(column => column.label));
    }
  });

  it('keeps facet controls mounted, refreshes summaries and resets pagination on filter changes', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    const page = await render(fixture);
    const facets = Array.from(page.querySelectorAll('mat-select')).slice(1);
    fixture.componentInstance.paginate({ pageIndex: 2, pageSize: 10, length: 40 });
    await render(fixture);
    fixture.componentInstance.filters.get('search')!.setValue('Pride and Prejudice');
    await render(fixture);
    expect(Array.from(page.querySelectorAll('mat-select')).slice(1)).toEqual(facets);
    expect(page.querySelectorAll('.report-data-table tbody tr').length).toBe(1);
    expect(page.querySelector('.reports-summary')?.textContent).toContain('Matching records1');
    fixture.componentInstance.clear();
    await render(fixture);
    expect(page.querySelector('.reports-results-heading')?.textContent).toContain('40 matching records');
    expect(page.querySelector('.mat-paginator-range-label')?.textContent).toContain('1 – 10');
  });

  it('keeps a usable CSV link and sends all filtered rows to a body-level native print snapshot', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.componentInstance.filters.get('language')!.setValue('English');
    const page = await render(fixture);
    let blob: Blob | undefined;
    spyOn(URL, 'createObjectURL').and.callFake(value => {
      blob = value as Blob;
      return 'blob:test-report';
    });
    const revoke = spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function(this: HTMLAnchorElement) {
      expect(this.isConnected).toBeTrue();
      expect(this.download).toMatch(/^booksphere-inventory-\d{4}-\d{2}-\d{2}\.csv$/);
    });
    const button = (text: string) => Array.from(page.querySelectorAll('button')).find(item => item.textContent?.includes(text))!;
    button('Export CSV').click();
    fixture.detectChanges();
    const fallback = page.querySelector<HTMLAnchorElement>('.reports-output-note a')!;
    expect(fallback.getAttribute('href')).toBe('blob:test-report');
    expect(fallback.download).toMatch(/^booksphere-inventory-/);
    expect(blob!.type).toBe('text/csv;charset=utf-8');
    expect(Array.from(new Uint8Array(await blob!.slice(0, 3).arrayBuffer()))).toEqual([239, 187, 191]);
    expect(revoke).not.toHaveBeenCalled();

    spyOn(window, 'print').and.callFake(() => {
      const output = document.body.querySelector(':scope > .report-print-output')!;
      expect(output.querySelectorAll('tbody tr').length).toBe(source.value.books.filter(book => book.language === 'English').length);
      expect(output.textContent).toContain('Test Library');
      expect(output.textContent).toContain('English');
      expect(document.body.classList.contains('booksphere-report-printing')).toBeTrue();
    });
    button('Print report').click();
    expect(window.print).toHaveBeenCalled();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.querySelector(':scope > .report-print-output')).toBeNull();
    expect(document.body.classList.contains('booksphere-report-printing')).toBeFalse();
  });

  it('reuses the all-row report projection when only pagination changes', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    const view = fixture.componentInstance;
    let rows: readonly unknown[] = [];
    const subscription = view.view$.subscribe(result => rows = result.rows);
    const initial = rows;
    view.paginate({ pageIndex: 1, pageSize: 10, length: 40 });
    expect(rows).toBe(initial);
    view.filters.get('search')!.setValue('Pride and Prejudice');
    expect(rows).not.toBe(initial);
    expect(rows.length).toBe(1);
    subscription.unsubscribe();
  });

  it('explains invalid dates and disables both actions until filters are cleared', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.componentInstance.select('payments');
    fixture.componentInstance.filters.patchValue({ start: '2026-11-26', end: '2026-11-25' });
    const page = await render(fixture);
    const actions = Array.from(page.querySelectorAll<HTMLButtonElement>('.reports-actions button')).slice(1);
    expect(actions.every(button => button.disabled)).toBeTrue();
    expect(page.textContent).toContain('The end of the date range must be on or after the start.');
    fixture.componentInstance.clear();
    await render(fixture);
    expect(actions.every(button => !button.disabled)).toBeTrue();
    expect(page.querySelector('.reports-results-heading')?.textContent).toContain('2 matching records');
  });

  it('shows only the selected report controls and disables export when filters match no records', async () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    const page = await render(fixture);
    expect(page.textContent).toContain('Availability');
    expect(page.querySelector('input[type="date"]')).toBeNull();
    fixture.componentInstance.select('payments');
    await render(fixture);
    expect(page.textContent).toContain('Payment method');
    expect(page.querySelectorAll('input[type="date"]').length).toBe(2);
    fixture.componentInstance.filters.get('search')!.setValue('no matched payment');
    await render(fixture);
    expect(page.textContent).toContain('No matching records');
    expect(Array.from(page.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export CSV'))?.disabled).toBeTrue();
  });
});
