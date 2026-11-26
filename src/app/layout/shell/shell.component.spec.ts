import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { LayoutModule } from '../layout.module';
import { ShellComponent } from './shell.component';

@Component({ template: '<h1>Overdue</h1>' })
class TestRouteComponent {}

describe('Shell accessibility', () => {
  beforeEach(() => TestBed.configureTestingModule({
    declarations: [TestRouteComponent],
    imports: [LayoutModule, NoopAnimationsModule,
      RouterTestingModule.withRoutes([{ path: 'overdue', component: TestRouteComponent }])]
  }));

  it('moves focus to the main workspace when the skip link is activated', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    page.querySelector<HTMLAnchorElement>('.skip-link')!.click();
    expect(document.activeElement).toBe(page.querySelector('main'));
  });

  it('keeps the active navigation name when a workspace is opened with a query parameter', async () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.ngZone!.run(() => TestBed.inject(Router).navigateByUrl('/overdue?tab=fines'));
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('nav[aria-label="Primary navigation"] [aria-current="page"]')
      ?.getAttribute('aria-label')).toBe('Overdue and Fines');
  });
});
