import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';

export function workspaceAction(route: ActivatedRoute, router: Router,
  actions: readonly string[]): Observable<string> {
  return route.queryParamMap.pipe(
    map(params => params.get('action')),
    distinctUntilChanged(),
    filter((action): action is string => action !== null && actions.includes(action)),
    tap(() => clearWorkspaceQuery(route, router, { action: null }))
  );
}

export function clearWorkspaceQuery(route: ActivatedRoute, router: Router, queryParams: Record<string, null>): void {
  // Route activation may still be completing when the query parameter first emits.
  void Promise.resolve().then(() => router.navigate([], {
    relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true
  }));
}
