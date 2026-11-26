import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DataEnvironment } from '../../environments/data-environment';
import { LIBRARY_DATA_CONFIG } from './library-api-client.service';

export class LibraryApiError extends Error {
  constructor(readonly status: number, message: string, readonly uncertain = false) {
    super(message);
  }
}

@Injectable()
export class LibraryApiErrorInterceptor implements HttpInterceptor {
  constructor(@Inject(LIBRARY_DATA_CONFIG) private readonly config: DataEnvironment) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.config.dataMode !== 'api' || !request.url.startsWith(this.config.apiBaseUrl + '/')) {
      return next.handle(request);
    }
    return next.handle(request).pipe(timeout(8000), catchError((failure: unknown) => {
      const status = failure instanceof HttpErrorResponse ? failure.status : 0;
      const timedOut = failure instanceof TimeoutError;
      if (status === 0 || timedOut || [502, 503, 504].includes(status)) {
        const mutation = request.method !== 'GET';
        const message = mutation
          ? 'The Mock API did not confirm this change. Retry the read before submitting again.'
          : 'The Mock API is unavailable. Start the local server, then retry the read.';
        return throwError(() => new LibraryApiError(status, message, mutation));
      }
      if (status === 409 || status === 412) {
        return throwError(() => new LibraryApiError(status, 'The library changed elsewhere. Retry the read before submitting again.'));
      }
      const detail = failure instanceof HttpErrorResponse && typeof failure.error?.message === 'string'
        ? failure.error.message : 'The Mock API could not complete this request.';
      return throwError(() => new LibraryApiError(status, detail));
    }));
  }
}
