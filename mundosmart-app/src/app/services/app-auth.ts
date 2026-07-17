import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap, catchError, throwError, shareReplay, finalize, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { LOJA_OS_MOCOCA, normalizarLojaOs } from '../config/os-loja.config';

export interface AppUsuario {
  id: string;
  usuario: string;
  nome: string;
  role: string;
  ativo: boolean;
  tecnicoId?: string | null;
  /**
   * Se preenchida: só cria/edita OS e orçamentos dessa loja.
   * Lista de OS é aberta (ver fila da assistência). Comissões/histórico geral ficam no escopo.
   * Null (Admin/Root): cria em qualquer loja; padrão Mococa.
   */
  lojaOrigem?: string | null;
  deveTrocarSenha?: boolean;
  ultimoLoginEm?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiraEm: string;
  refreshToken: string;
  refreshExpiraEm: string;
  usuario: AppUsuario;
}

const TOKEN_KEY = 'ms_access_token';
const REFRESH_KEY = 'ms_refresh_token';
const REFRESH_EXPIRA_KEY = 'ms_refresh_expira';
const USER_KEY = 'ms_usuario';
const EXPIRA_KEY = 'ms_token_expira';

@Injectable({ providedIn: 'root' })
export class AppAuthService {
  private readonly api = `${environment.apiUrl}/conta`;
  readonly usuario = signal<AppUsuario | null>(this.lerUsuario());
  private refreshEmAndamento$: Observable<LoginResponse> | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  login(usuario: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.api}/login`, { usuario, senha }).pipe(
      tap(res => this.persistirSessao(res)),
    );
  }

  /** Renova access token (8h) com refresh token. Compartilha chamada concorrente. */
  refresh(): Observable<LoginResponse> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken || this.refreshExpirado()) {
      return throwError(() => new Error('Refresh token ausente ou expirado.'));
    }

    if (!this.refreshEmAndamento$) {
      this.refreshEmAndamento$ = this.http.post<LoginResponse>(`${this.api}/refresh`, { refreshToken }).pipe(
        tap(res => this.persistirSessao(res)),
        catchError(err => {
          this.logout(false);
          return throwError(() => err);
        }),
        finalize(() => { this.refreshEmAndamento$ = null; }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }

    return this.refreshEmAndamento$;
  }

  me(): Observable<AppUsuario | null> {
    if (!this.getToken()) return of(null);
    return this.http.get<AppUsuario>(`${this.api}/me`).pipe(
      tap(u => {
        this.usuario.set(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }),
      catchError(() => {
        this.logout(false);
        return of(null);
      }),
    );
  }

  alterarSenha(senhaAtual: string, senhaNova: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.api}/alterar-senha`, { senhaAtual, senhaNova }).pipe(
      tap(() => {
        const u = this.usuario();
        if (u) {
          const next = { ...u, deveTrocarSenha: false };
          this.usuario.set(next);
          localStorage.setItem(USER_KEY, JSON.stringify(next));
        }
      }),
    );
  }

  isAuthenticated(): boolean {
    if (!environment.authEnabled) return true;
    return !!this.getToken() || (!!localStorage.getItem(REFRESH_KEY) && !this.refreshExpirado());
  }

  isRoot(): boolean {
    if (!environment.authEnabled) return true;
    return (this.usuario()?.role ?? '').toLowerCase() === 'root';
  }

  isAdmin(): boolean {
    if (!environment.authEnabled) return true;
    const role = (this.usuario()?.role ?? '').toLowerCase();
    return role === 'admin' || role === 'root';
  }

  /** Loja vinculada. Null = Admin/Root (pode criar em qualquer loja). */
  lojaCriacao(): string | null {
    if (!environment.authEnabled) return null;
    const loja = this.usuario()?.lojaOrigem?.trim();
    return loja || null;
  }

  /** Só cria/edita OS e orçamentos da própria loja (exceto Admin/Root sem vínculo). */
  restringeCriacaoPorLoja(): boolean {
    return !!this.lojaCriacao();
  }

  /** Pode escolher loja no cadastro (Admin/Root sem loja vinculada). */
  podeEscolherLoja(): boolean {
    return !this.restringeCriacaoPorLoja();
  }

  /**
   * Loja pré-preenchida no cadastro:
   * loja do usuário, ou Mococa (assistência) quando Admin/Root.
   */
  lojaPadraoCriacao(): string {
    return normalizarLojaOs(this.lojaCriacao() || LOJA_OS_MOCOCA);
  }

  /** Pode editar/excluir esta OS (mesma loja ou sem restrição). */
  podeAlterarOsDaLoja(lojaOrigem?: string | null): boolean {
    if (!this.restringeCriacaoPorLoja()) return true;
    return normalizarLojaOs(lojaOrigem) === this.lojaPadraoCriacao();
  }

  logout(navegar = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REFRESH_EXPIRA_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRA_KEY);
    this.refreshEmAndamento$ = null;
    this.usuario.set(null);
    if (navegar) {
      void this.router.navigate([environment.authEnabled ? '/login' : '/ordens-servico']);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * No boot: troca código curto `h` do QR por sessão (preferido)
   * e ainda aceita tokens legados na query (`ms_at`…).
   */
  inicializarSessaoDaUrl(): Observable<void> {
    if (typeof window === 'undefined' || !environment.authEnabled) {
      return of(void 0);
    }

    this.consumirTransferenciaLegadaDaJanela();

    const url = new URL(window.location.href);
    const handoff = url.searchParams.get('h')?.trim();
    if (!handoff) return of(void 0);

    return this.http.post<LoginResponse>(`${this.api}/sessao-qr`, { codigo: handoff }).pipe(
      tap(res => {
        this.persistirSessao(res);
        this.limparParamsSessaoDaUrl(['h', 'ms_at', 'ms_rt', 'ms_ae', 'ms_re', 'ms_u']);
      }),
      map(() => void 0),
      catchError(() => {
        // Intake continua público; sem sessão o usuário só não fica logado no app.
        this.limparParamsSessaoDaUrl(['h']);
        return of(void 0);
      }),
    );
  }

  /** @deprecated tokens JWT grandes no QR — mantido só para links antigos. */
  consumirTransferenciaDaJanela(): boolean {
    return this.consumirTransferenciaLegadaDaJanela();
  }

  private consumirTransferenciaLegadaDaJanela(): boolean {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    const aplicada = this.aplicarSessaoDosParams(url.searchParams);
    if (!aplicada) return false;
    this.limparParamsSessaoDaUrl(['ms_at', 'ms_rt', 'ms_ae', 'ms_re', 'ms_u']);
    return true;
  }

  private limparParamsSessaoDaUrl(chaves: string[]): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    let mudou = false;
    for (const k of chaves) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        mudou = true;
      }
    }
    if (!mudou) return;
    const limpa = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', limpa || url.pathname);
  }

  private aplicarSessaoDosParams(params: URLSearchParams): boolean {
    if (!environment.authEnabled) return false;
    const accessToken = params.get('ms_at')?.trim();
    const refreshToken = params.get('ms_rt')?.trim();
    if (!accessToken || !refreshToken) return false;

    const expiraEm = params.get('ms_ae')?.trim() || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const refreshExpiraEm = params.get('ms_re')?.trim() || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    let usuario = this.lerUsuario();
    const uEnc = params.get('ms_u')?.trim();
    if (uEnc) {
      try {
        const decoded = JSON.parse(this.decodificarBase64Url(uEnc)) as AppUsuario;
        if (decoded?.usuario) usuario = decoded;
      } catch { /* ignora */ }
    }

    if (!usuario) {
      usuario = {
        id: '',
        usuario: 'transferido',
        nome: 'Sessão transferida',
        role: 'operador',
        ativo: true,
      };
    }

    this.persistirSessao({
      accessToken,
      tokenType: 'Bearer',
      expiraEm,
      refreshToken,
      refreshExpiraEm,
      usuario,
    });
    return true;
  }

  private decodificarBase64Url(valor: string): string {
    const b64 = valor.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return decodeURIComponent(escape(atob(b64 + pad)));
  }

  /** Access token próximo do fim (≤ 2 min) — dispara refresh preventivo. */
  accessProximoDoFim(folgaMs = 120_000): boolean {
    const expira = localStorage.getItem(EXPIRA_KEY);
    if (!expira) return !this.getToken();
    const t = Date.parse(expira);
    if (!Number.isFinite(t)) return false;
    return t - Date.now() <= folgaMs;
  }

  private refreshExpirado(): boolean {
    const expira = localStorage.getItem(REFRESH_EXPIRA_KEY);
    if (!expira) return false;
    const t = Date.parse(expira);
    return Number.isFinite(t) && t <= Date.now();
  }

  private persistirSessao(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(EXPIRA_KEY, res.expiraEm);
    if (res.refreshToken) {
      localStorage.setItem(REFRESH_KEY, res.refreshToken);
    }
    if (res.refreshExpiraEm) {
      localStorage.setItem(REFRESH_EXPIRA_KEY, res.refreshExpiraEm);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(res.usuario));
    this.usuario.set(res.usuario);
  }

  private lerUsuario(): AppUsuario | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) as AppUsuario : null;
    } catch {
      return null;
    }
  }
}
