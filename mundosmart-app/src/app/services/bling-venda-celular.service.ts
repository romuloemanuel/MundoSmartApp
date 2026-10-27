import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BlingVendaCelular {
  id?: string;
  blingPedidoId: number;
  blingItemId: number;
  pedidoNumero: string;
  dataVenda: string;
  clienteNome: string;
  clienteCpf: string;
  produtoCodigo: string;
  produtoNome: string;
  categoriaId?: number | null;
  categoriaNome: string;
  tipo: string;
  imei: string;
  marca?: string;
  modelo?: string;
  cor?: string;
  configuracao?: string;
  marcaId?: string | null;
  modeloId?: string | null;
  clienteLocalId?: number | null;
  cadastroPendente?: boolean;
  valor: number;
}

export interface BlingVendaCelularDesconto {
  elegivel: boolean;
  motivo: string;
  descontoPercentual: number;
  vendas: BlingVendaCelular[];
}

export interface BlingVendaCelularPendencias {
  total: number;
  vendas: BlingVendaCelular[];
}

export interface BlingVendaCelularPassivel {
  passivel: boolean;
  motivo: string;
  aparelhos: BlingVendaCelular[];
}

export interface BlingVendaCelularSyncResult {
  ok: boolean;
  pedidosLidos: number;
  importadas: number;
  atualizadas: number;
  ignoradas: number;
  semImei: number;
  semCpf: number;
  aviso?: string | null;
  executadoEm?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BlingVendaCelularService {
  private readonly apiUrl = `${environment.apiUrl}/vendas-celulares`;

  constructor(private http: HttpClient) {}

  consultarDesconto(cpf?: string, imei?: string): Observable<BlingVendaCelularDesconto> {
    let params = new HttpParams();
    if (cpf) params = params.set('cpf', cpf);
    if (imei) params = params.set('imei', imei);
    return this.http.get<BlingVendaCelularDesconto>(`${this.apiUrl}/desconto`, { params });
  }

  listar(termo?: string): Observable<BlingVendaCelular[]> {
    let params = new HttpParams();
    if (termo) params = params.set('termo', termo);
    return this.http.get<BlingVendaCelular[]>(this.apiUrl, { params });
  }

  sincronizar(opts?: { dias?: number; historicoCompleto?: boolean }): Observable<BlingVendaCelularSyncResult> {
    return this.http.post<BlingVendaCelularSyncResult>(`${this.apiUrl}/sincronizar`, {
      dias: opts?.dias,
      historicoCompleto: !!opts?.historicoCompleto,
    });
  }

  pendencias(): Observable<BlingVendaCelularPendencias> {
    return this.http.get<BlingVendaCelularPendencias>(`${this.apiUrl}/pendencias`);
  }

  consultarPassivel(opts: {
    clienteId?: number | null;
    cpf?: string;
    modeloId?: string;
    modeloNome?: string;
    marcaNome?: string;
  }): Observable<BlingVendaCelularPassivel> {
    let params = new HttpParams();
    if (opts.clienteId) params = params.set('clienteId', String(opts.clienteId));
    if (opts.cpf) params = params.set('cpf', opts.cpf);
    if (opts.modeloId) params = params.set('modeloId', opts.modeloId);
    if (opts.modeloNome) params = params.set('modeloNome', opts.modeloNome);
    if (opts.marcaNome) params = params.set('marcaNome', opts.marcaNome);
    return this.http.get<BlingVendaCelularPassivel>(`${this.apiUrl}/passivel-desconto`, { params });
  }

  vincularCliente(vendaId: string, clienteId: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiUrl}/${vendaId}/vincular-cliente`, { clienteId });
  }
}
