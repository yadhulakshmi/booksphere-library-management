import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BookStorageService } from '../../services/book-storage.service';
import { CirculationCoordinator } from '../../services/circulation-coordinator.service';
import { CirculationStorageService } from '../../services/circulation-storage.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from '../../services/circulation-test-storage';
import { MemberStorageService } from '../../services/member-storage.service';
import { CirculationUiModule } from './circulation-ui.module';
import { CirculationWorkspaceComponent } from './circulation-workspace.component';

describe('circulation workspace', () => {
  let fixture: ComponentFixture<CirculationWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CirculationUiModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BookStorageService, useValue: new MemoryBookStorage(null) },
        { provide: CirculationStorageService, useValue: new MemoryCirculationStorage() },
        { provide: MemberStorageService, useValue: new MemoryMemberStorage() }
      ]
    }).compileComponents();
    await TestBed.inject(CirculationCoordinator).refresh();
    fixture = TestBed.createComponent(CirculationWorkspaceComponent);
  });

  it('renders the active-loan table, history tab and overdue action controls', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('[role="tablist"]')?.textContent).toContain('Loan history');
    expect(page.querySelectorAll('tr.mat-row').length).toBe(3);
    expect(page.querySelector('table')?.textContent).toContain('Overdue');
    expect(page.querySelector('button[aria-label^="Return LOAN"]')).not.toBeNull();
  });

  it('renders ready and waiting records and changes results as the search field is edited', () => {
    fixture.componentInstance.mode = 'reservations';
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelectorAll('tr.mat-row').length).toBe(2);
    expect(page.querySelector('table')?.textContent).toContain('Ready for collection');
    fixture.componentInstance.filters.get('search')!.setValue('no-such-reservation');
    fixture.detectChanges();
    expect(page.textContent).toContain('No matching transactions');
  });
});
