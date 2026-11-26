import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { IsActiveMatchOptions, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, map, startWith, takeUntil } from 'rxjs/operators';
import { NAVIGATION } from '../../core/navigation';
import { NavigationSearchService } from '../../services/navigation-search.service';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnDestroy {
  readonly navigation = NAVIGATION;
  readonly navigationMatch: IsActiveMatchOptions = {
    paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored'
  };
  readonly search = new FormControl('');
  readonly searchResults$ = this.search.valueChanges.pipe(
    startWith(''),
    map((query: string) => this.navigationSearch.findPages(query))
  );

  mobile = false;
  mobileOpen = false;
  collapsed = false;
  breadcrumb = '';
  private readonly destroyed = new Subject<void>();

  constructor(
    breakpoints: BreakpointObserver,
    private readonly router: Router,
    private readonly navigationSearch: NavigationSearchService,
    title: Title
  ) {
    breakpoints.observe('(max-width: 900px)').pipe(takeUntil(this.destroyed)).subscribe(state => {
      this.mobile = state.matches;
      this.mobileOpen = false;
    });

    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      takeUntil(this.destroyed)
    ).subscribe(() => {
      const page = router.routerState.snapshot.root.firstChild?.firstChild;
      this.breadcrumb = page?.data['breadcrumb'] ?? '';
      title.setTitle(this.breadcrumb ? `${this.breadcrumb} | BookSphere` : 'BookSphere');
      this.mobileOpen = false;
    });
  }

  skipNavigation(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }

  toggleNavigation(): void {
    if (this.mobile) {
      this.mobileOpen = !this.mobileOpen;
    } else {
      this.collapsed = !this.collapsed;
    }
  }

  goToPage(path: string): void {
    this.search.reset('');
    void this.router.navigate(['/', path]);
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
