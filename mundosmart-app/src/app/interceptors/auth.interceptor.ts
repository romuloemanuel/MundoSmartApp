import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppAuthService } from '../services/app-auth';
import { Router } from '@angular/router';

function isPublicAuthUrl(url: string): boolean {
  return url.includes('/api/conta/login')
    || url.includes('/api/conta/refresh')
    || url.includes('/api/conta/sessao-qr')
    || url.includes('/api/intake/')
    || url.includes('/api/aparelho-fotos/')
    || url.includes('/api/config/estoque')
    || url.includes('/api/config/impressao-os')
    || url.includes('/api/config/acrescimo-estoque')
    || url.includes('/api/version');
}

function estaEmRotaPublica(): boolean {
  const path = typeof window !== 'undefined'
    ? (window.location.pathname || '')
    : '';
  return path.startsWith('/login') || path.startsWith('/intake') || path.startsWith('/aparelho-fotos');
}

function comHeaders(origem: Parameters<HttpInterceptorFn>[0], access?: string | null) {
  const headers: Record<string, string> = {};
  if (access) headers['Authorization'] = `Bearer ${access}`;
  try {
    const ponto = localStorage.getItem('ms_ponto_aparelho_token');
    if (ponto) headers['X-Ponto-Aparelho'] = ponto;
  } catch {
    /* ignore */
  }
  return Object.keys(headers).length ? origem.clone({ setHeaders: headers }) : origem;
}

/** Anexa Bearer JWT, renova com refresh token e redireciona para login em 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.authEnabled) return next(comHeaders(req, null));

  const auth = inject(AppAuthService);
  const router = inject(Router);
  const publicAuth = isPublicAuthUrl(req.url);

  const enviar = () => {
    const token = auth.getToken();
    // URLs "públicas" (config GET, login…) ainda recebem Bearer se houver sessão —
    // senão o PUT admin (ex.: acréscimo estoque) falha sem Authorization.
    const authReq = comHeaders(req, token);

    return next(authReq).pipe(
      catchError((err: unknown) => {
        if (!(err instanceof HttpErrorResponse) || err.status !== 401 || publicAuth) {
          return throwError(() => err);
        }

        return auth.refresh().pipe(
          switchMap(() => {
            return next(comHeaders(req, auth.getToken()));
          }),
          catchError(refreshErr => {
            auth.logout(false);
            if (!estaEmRotaPublica()) {
              const url = router.url || window.location.pathname || '';
              void router.navigate(['/login'], { queryParams: { returnUrl: url } });
            }
            return throwError(() => refreshErr);
          }),
        );
      }),
    );
  };

  if (!publicAuth && auth.accessProximoDoFim() && localStorage.getItem('ms_refresh_token')) {
    return auth.refresh().pipe(
      switchMap(() => enviar()),
      catchError(() => enviar()),
    );
  }

  return enviar();
};
