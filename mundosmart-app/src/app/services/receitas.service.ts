import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReceitaFaixa {
  bruto: number;
  custoItem: number;
  custoLoja: number;
  quantidade: number;
}

export interface ReceitaPeriodo {
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
  bling: ReceitaFaixa;
  celulares: ReceitaFaixa;
  assistencia: ReceitaFaixa;
  celularesEstoqueEntrou: number;
}

export interface ReceitaPainel {
  agrupamento: string;
  avisoBling?: string | null;
  custoBlingIndisponivel: boolean;
  periodos: ReceitaPeriodo[];
}

@Injectable({ providedIn: 'root' })
export class ReceitasService {
  private readonly base = `${environment.apiUrl}/receitas`;

  constructor(private http: HttpClient) {}

  painel(agrupamento: string, periodos: number): Observable<ReceitaPainel> {
    const params = new HttpParams()
      .set('agrupamento', agrupamento)
      .set('periodos', String(periodos));
    return this.http.get<ReceitaPainel>(this.base, { params });
  }
}
