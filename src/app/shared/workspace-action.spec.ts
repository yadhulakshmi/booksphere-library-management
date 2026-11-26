import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { workspaceAction } from './workspace-action';

describe('workspace shortcut query actions', () => {
  it('emits a supported action once and clears only that query parameter after activation', async () => {
    const params = new BehaviorSubject(convertToParamMap({ action: 'return', other: 'keep' }));
    const route = { queryParamMap: params.asObservable() } as ActivatedRoute;
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    const actions: string[] = [];
    const subscription = workspaceAction(route, router, ['issue', 'return']).subscribe(action => actions.push(action));
    params.next(convertToParamMap({ action: 'return', other: 'updated' }));
    expect(actions).toEqual(['return']);
    expect(router.navigate).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(router.navigate).toHaveBeenCalledOnceWith([], {
      relativeTo: route, queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true
    });
    subscription.unsubscribe();
  });
});
