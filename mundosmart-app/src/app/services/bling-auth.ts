import { Injectable, inject, provideAppInitializer } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BlingTokenResponse } from '../models/bling.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BlingAuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly storageKey = 'bling_token';
  private readonly http = inject(HttpClient);

  getAuthorizationUrl(): Observable<{ authorizationUrl: string }> {
    return this.http.get<{ authorizationUrl: string }>(`${this.apiUrl}/login`);
  }

  exchangeCode(code: string): Observable<BlingTokenResponse> {
    return this.http
      .get<BlingTokenResponse>(`${this.apiUrl}/callback?code=${code}`)
      .pipe(tap((token) => this.saveToken(token)));
  }

  refreshToken(): Observable<BlingTokenResponse> {
    const token = this.getToken();
    return this.http
      .post<BlingTokenResponse>(`${this.apiUrl}/refresh`, {
        refreshToken: token?.refreshToken,
      })
      .pipe(tap((newToken) => this.saveToken(newToken)));
  }

  saveToken(token: BlingTokenResponse): void {
    localStorage.setItem(this.storageKey, JSON.stringify(token));
    this.syncTokenToApi().subscribe();
  }

  syncTokenToApi(): Observable<{ message: string } | null> {
    const token = this.getToken();
    if (!token?.accessToken) return of(null);
    if (!this.isAuthenticated()) return of(null);

    const restanteSeg = Math.max(
      30,
      Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 1000),
    );

    return this.http.post<{ message: string }>(`${this.apiUrl}/token`, {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresIn: restanteSeg,
    }).pipe(catchError(() => of(null)));
  }

  getToken(): BlingTokenResponse | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return new Date(token.expiresAt) > new Date();
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
  }
}

export function provideBlingAuthInitializer() {
  return provideAppInitializer(() => {
    // Se o redirect URI no Bling estiver só em http://localhost:4200,
    // o ?code= chega na home e some no redirect do Angular — reencaminha.
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (code && !path.endsWith('/auth/callback')) {
        const qs = url.searchParams.toString();
        window.location.replace(`${url.origin}/auth/callback?${qs}`);
        return;
      }
    } catch {
      /* ignore */
    }

    inject(BlingAuthService).syncTokenToApi().subscribe();
  });
}
