import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { localDate } from '../../core/member-rules';
import { BookStorageService } from '../../services/book-storage.service';
import { CirculationCoordinator } from '../../services/circulation-coordinator.service';
import { CirculationStorageService } from '../../services/circulation-storage.service';
import { CirculationService } from '../../services/circulation.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from '../../services/circulation-test-storage';
import { FineService } from '../../services/fine.service';
import { LibraryPolicyService } from '../../services/library-policy.service';
import { MemberStorageService } from '../../services/member-storage.service';
import { SettingsPageComponent } from '../settings/settings-page.component';
import { SettingsModule } from '../settings/settings.module';
import { OverduePageComponent } from './overdue-page.component';
import { OverdueModule } from './overdue.module';

describe('finance and policy workspaces', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverdueModule, SettingsModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BookStorageService, useValue: new MemoryBookStorage(null) },
        { provide: CirculationStorageService, useValue: new MemoryCirculationStorage() },
        { provide: MemberStorageService, useValue: new MemoryMemberStorage() }
      ]
    }).compileComponents();
    await TestBed.inject(CirculationCoordinator).refresh();
  });

  async function render(fixture: ComponentFixture<unknown>): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('renders overdue records and opens payment history filtered to an assessed fine', async () => {
    const fixture = TestBed.createComponent(OverduePageComponent);
    const page = await render(fixture);
    expect(page.querySelector('[role="tablist"]')?.textContent).toContain('Fine management');
    expect(page.querySelector('table')?.textContent).toContain('Estimated fine');
    const today = localDate();
    const circulation = TestBed.inject(CirculationService);
    const service = TestBed.inject(FineService);
    const loan = (await firstValueFrom(circulation.loans$)).find(item => !item.returnedAt && item.dueAt < today)!;
    await firstValueFrom(circulation.returnBook(loan.id, today));
    const fine = (await firstValueFrom(service.fines$))[0];
    await firstValueFrom(service.pay(fine.id, { amountMinor: 125, requestId: 'render-test', paidOn: today,
      method: 'UPI', reference: 'DEMO-RECEIPT', notes: '' }));
    fixture.componentInstance.tab(1);
    await render(fixture);
    expect(page.querySelector('table')?.textContent).toContain('Partially Paid');
    fixture.componentInstance.history(fine);
    await render(fixture);
    expect(page.querySelector('table')?.textContent).toContain('DEMO-RECEIPT');
    expect(page.querySelector<HTMLInputElement>('input[formControlName="search"]')?.value).toBe(fine.id);
    expect(page.textContent).toContain('Filtered payment total');
  });

  it('renders policy sections and saves monetary and numeric values entered through the form', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    const page = await render(fixture);
    expect(page.textContent).toContain('General library information');
    expect(page.textContent).toContain('Fine policies');
    const amount = page.querySelector<HTMLInputElement>('#library-setting-dailyFineMinor')!;
    const duration = page.querySelector<HTMLInputElement>('#library-setting-lendingDays')!;
    amount.value = '7.25';
    amount.dispatchEvent(new Event('input'));
    duration.value = '21';
    duration.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(page.textContent).toContain('Unsaved changes');
    const submit = page.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.click();
    await render(fixture);
    const current = TestBed.inject(LibraryPolicyService).current;
    expect(current.dailyFineMinor).toBe(725);
    expect(current.lendingDays).toBe(21);
    expect(fixture.componentInstance.form.pristine).toBeTrue();
  });
});
