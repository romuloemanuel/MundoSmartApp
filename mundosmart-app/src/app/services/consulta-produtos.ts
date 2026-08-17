import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  saldoTotal: number;
  cores: ConsultaProdutoCor[];
}

export interface ConsultaProdutosResponse {
  categoria: string;
  termo: string;
  origem: 'bling' | 'cache' | string;
  aviso?: string;
  grupos: ConsultaProdutoGrupo[];
}

@Injectable({ providedIn: 'root' })
export class ConsultaProdutosService {
  private readonly apiUrl = `${environment.apiUrl}/consulta-produtos`;

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
    return this.http.get<ConsultaProdutosResponse>(this.apiUrl, { params });
  }
}
