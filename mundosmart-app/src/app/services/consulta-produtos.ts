import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SKIP_GLOBAL_ERROR_ALERT } from '../interceptors/error-alert.interceptor';

export type ConsultaProdutoCategoria = 'capinhas' | 'peliculas' | 'termicos';

export interface ConsultaProdutoCor {
  cor: string;
  saldo: number;
  codigo?: string;
  preco?: number;
}

export interface ConsultaProdutoGrupo {
  nome: string;
  modelo?: string;
  marca?: string;
  saldoTotal: number;
  permitePersonalizacao?: boolean;
  cores: ConsultaProdutoCor[];
}

export interface ConsultaProdutosResponse {
  categoria: string;
  termo: string;
  origem: 'bling' | 'cache' | string;
  aviso?: string;
  atualizadoEm?: string;
  syncIntervaloMinutos?: number;
  grupos: ConsultaProdutoGrupo[];
}

export interface ConsultaProdutosSyncResult {
  ok: boolean;
  itens: number;
  aviso?: string;
  atualizadoEm?: string;
  porCategoria?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ConsultaProdutosService {
  private readonly apiUrl = `${environment.apiUrl}/consulta-produtos`;
  private readonly httpCtx = new HttpContext().set(SKIP_GLOBAL_ERROR_ALERT, true);

  constructor(private http: HttpClient) {}

  consultar(
    categoria: ConsultaProdutoCategoria,
    q: string,
    incluirZerados = false,
  ): Observable<ConsultaProdutosResponse> {
    let params = new HttpParams()
      .set('categoria', categoria)
      .set('incluirZerados', incluirZerados ? 'true' : 'false');
    if (q.trim()) params = params.set('q', q.trim());
    return this.http.get<ConsultaProdutosResponse>(this.apiUrl, {
      params,
      context: this.httpCtx,
    });
  }

  sincronizar(categoria?: ConsultaProdutoCategoria): Observable<ConsultaProdutosSyncResult> {
    let params = new HttpParams();
    if (categoria) params = params.set('categoria', categoria);
    return this.http.post<ConsultaProdutosSyncResult>(`${this.apiUrl}/sincronizar`, null, {
      params,
      context: this.httpCtx,
    });
  }
}
