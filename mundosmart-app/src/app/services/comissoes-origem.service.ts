import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ComissaoVendedor {
  nome: string;
  quantidade: number;
  vendas: number;
  trocas: number;
  total: number;
  dinheiroPago: number;
  custo: number;
  liquido: number;
}

export interface ComissaoLancamento {
  data: string;
  tipo: string;
  vendedor: string;
  descricao: string;
  produto: string;
  cliente: string;
  valor: number;
  dinheiroPago: number;
  custo: number | null;
  liquido: number;
}

export interface ComissaoOrigem {
  aviso?: string | null;
  total: number;
  dinheiroPago: number;
  custo: number;
  liquido: number;
  quantidade: number;
  vendas: number;
  trocas: number;
  vendedores: ComissaoVendedor[];
  lancamentos: ComissaoLancamento[];
}

@Injectable({ providedIn: 'root' })
export class ComissoesOrigemService {
  private readonly base = `${environment.apiUrl}/comissoes`;

  constructor(private http: HttpClient) {}

  smartphones(inicio: string, fim: string): Observable<ComissaoOrigem> {
    return this.http.get<ComissaoOrigem>(`${this.base}/smartphones`, { params: this.params(inicio, fim) });
  }

  loja(inicio: string, fim: string): Observable<ComissaoOrigem> {
    return this.http.get<ComissaoOrigem>(`${this.base}/loja`, { params: this.params(inicio, fim) });
  }

  private params(inicio: string, fim: string): HttpParams {
    return new HttpParams().set('inicio', inicio).set('fim', fim);
  }
}
