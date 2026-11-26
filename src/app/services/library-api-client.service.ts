import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DataEnvironment } from '../../environments/data-environment';
import { API_ROUTES } from '../core/api-routes';
import { ApiAction, ApiCommit, ApiInput, LibrarySnapshot } from '../models/library-api';

export const LIBRARY_DATA_CONFIG = new InjectionToken<DataEnvironment>('BookSphere data configuration', {
  providedIn: 'root', factory: () => environment
});

@Injectable({ providedIn: 'root' })
export class LibraryApiClient {
  constructor(private readonly http: HttpClient, @Inject(LIBRARY_DATA_CONFIG) readonly config: DataEnvironment) {}

  snapshot(): Observable<LibrarySnapshot> {
    return this.http.get<LibrarySnapshot>(this.config.apiBaseUrl + '/snapshot');
  }

  execute<K extends ApiAction>(action: K, input: ApiInput<K>, revision: number, requestId: string): Observable<ApiCommit<K>> {
    const route = API_ROUTES[action];
    const params = (input ?? {}) as Record<string, unknown>;
    const path = route.path.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(String(params[key])));
    const headers = new HttpHeaders({ 'If-Match': '"' + revision + '"', 'Idempotency-Key': requestId });
    return this.http.request<ApiCommit<K>>(route.method, this.config.apiBaseUrl + path,
      { headers, body: route.method === 'DELETE' ? undefined : input });
  }
}
