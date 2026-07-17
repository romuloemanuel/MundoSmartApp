import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';

export const apiLogInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;

  return next(req).pipe(
    tap({
      error: (err: unknown) => {
        if (!(err instanceof HttpErrorResponse)) return;

        const body = typeof err.error === 'string' ? err.error : err.error?.erro ?? err.error;
        console.groupCollapsed(`[API ${err.status}] ${req.method} ${url}`);
        console.error('Status:', err.status, err.statusText);
        if (body) console.error('Resposta:', body);
        console.groupEnd();
      },
    }),
  );
};
