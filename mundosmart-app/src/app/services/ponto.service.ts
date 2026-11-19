import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export const PONTO_TOKEN_KEY = 'ms_ponto_aparelho_token';

export interface PontoColaborador {
  id: string;
  nome: string;
  usuario: string;
  role: string;
}

export interface PontoAparelho {
  id: string;
  apelido: string;
  lojaOrigem?: string | null;
  ativo: boolean;
  liberadoEm: string;
  liberadoPorNome: string;
  revogadoEm?: string | null;
  revogadoPorNome?: string | null;
  temGps: boolean;
}

export interface PontoStatus {
  maximoAparelhos: number;
  vagasUsadas: number;
  vagasLivres: number;
  esteAparelhoLiberado: boolean;
  esteAparelhoId?: string | null;
  senhaDoDia?: string | null;
  dia: string;
  aparelhos: PontoAparelho[];
  colaboradores: PontoColaborador[];
}

export interface PontoBatida {
  id: string;
  horario: string;
  tipo: string;
  usuarioNome: string;
  lojaOrigem?: string | null;
  fotoUrl?: string | null;
  semGps: boolean;
  foraDaLoja: boolean;
  distanciaLojaMetros?: number | null;
}

export interface PontoLiberarResultado {
  token: string;
  aparelho: PontoAparelho;
}

@Injectable({ providedIn: 'root' })
export class PontoService {
  private readonly api = `${environment.apiUrl}/ponto`;

  constructor(private http: HttpClient) {}

  tokenLocal(): string | null {
    try {
      return localStorage.getItem(PONTO_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  gravarToken(token: string): void {
    localStorage.setItem(PONTO_TOKEN_KEY, token);
  }

  limparToken(): void {
    localStorage.removeItem(PONTO_TOKEN_KEY);
  }

  status(): Observable<PontoStatus> {
    return this.http.get<PontoStatus>(`${this.api}/status`);
  }

  batidas(): Observable<PontoBatida[]> {
    return this.http.get<PontoBatida[]>(`${this.api}/batidas`);
  }

  liberar(body: {
    apelido: string;
    lojaOrigem: string | null;
    tokenExistente: string | null;
    latitude: number | null;
    longitude: number | null;
  }): Observable<PontoLiberarResultado> {
    return this.http.post<PontoLiberarResultado>(`${this.api}/aparelhos/liberar`, body).pipe(
      tap(r => {
        if (r?.token) this.gravarToken(r.token);
      }),
    );
  }

  revogar(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.api}/aparelhos/${id}/revogar`, {});
  }

  gerarSenha(): Observable<{ senha: string }> {
    return this.http.post<{ senha: string }>(`${this.api}/senha-dia`, {});
  }

  bater(form: FormData): Observable<PontoBatida> {
    return this.http.post<PontoBatida>(`${this.api}/bater`, form);
  }

  urlFoto(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.filesUrl || ''}${path}`;
  }
}
