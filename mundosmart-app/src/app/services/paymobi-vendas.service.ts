import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type PaymobiStatus = 'aberta' | 'atrasada' | 'quitada' | 'cancelada';
export type PaymobiStatusCobranca = 'ok' | 'negociacao' | 'recuperacao' | 'perdido';

export const STATUS_COBRANCA: { id: PaymobiStatusCobranca; rotulo: string }[] = [
  { id: 'ok', rotulo: 'OK' },
  { id: 'negociacao', rotulo: 'Em Negociação' },
  { id: 'recuperacao', rotulo: 'Em Recuperação' },
  { id: 'perdido', rotulo: 'Perdido' },
];

export function statusCobrancaDe(
  valor: string | undefined,
  parcelasAtraso: number,
  statusContrato?: PaymobiStatus,
): PaymobiStatusCobranca {
  const s = (valor ?? '').trim().toLowerCase();
  if (s === 'ok' || s === 'negociacao' || s === 'recuperacao' || s === 'perdido') return s;
  if (statusContrato === 'quitada' || statusContrato === 'cancelada') return 'ok';
  return parcelasAtraso > 0 || statusContrato === 'atrasada' ? 'perdido' : 'ok';
}

export interface PaymobiBoleto {
  id?: string;
  numero?: number;
  vencimento?: string;
  valor: number;
  status?: string;
  imei?: string;
  link?: string;
  pagoEm?: string;
  manual?: boolean;
}

export interface PaymobiCobranca {
  id?: string;
  data: string;
  valor: number;
  observacao?: string;
}

export interface PaymobiVenda {
  id?: string;
  clienteNome: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  aparelhoMarca?: string;
  aparelhoModelo?: string;
  aparelhoCor?: string;
  aparelhoImei?: string;
  valorInvestido: number;
  custoPlataforma?: number;
  valorVenda: number;
  parcelas?: number;
  valorParcela?: number;
  dataVenda: string;
  status: PaymobiStatus;
  statusCobranca?: PaymobiStatusCobranca;
  observacoes?: string;
  cobrancas?: PaymobiCobranca[];
  boletos?: PaymobiBoleto[];
  criadoEm?: string;
  atualizadoEm?: string;
  paymobiSellId?: string;
  lojaNome?: string;
  vendedorNome?: string;
  clienteEmail?: string;
  contratoNumero?: string;
  contratoTipo?: string;
  contratoAssinado?: boolean;
  encerradoEm?: string;
  canceladoEm?: string;
  valorOriginal?: number;
  valorEntrada?: number;
  valorDevido?: number;
  valorBaseAparelho?: number;
  aparelhoBloqueado?: boolean;
  parcelasAtraso?: number;
  origem?: string;
  sincronizadoEm?: string;
  concretizada?: boolean;
  concretizadaEm?: string;
  valorRevenda?: number;
  custoManutencao?: number;
  valorBoletosPagos?: number;
}

export interface PaymobiConfig {
  email: string;
  senhaConfigurada: boolean;
  ultimaSincronizacao?: string;
  ultimoTotalImportado?: number;
  custoFixoAparelho?: number;
  custoPlataformaTotal?: number;
  custoPlataformaMensal?: number;
}

export interface PaymobiSincronizarResultado {
  totalNaPaymobi: number;
  importadas: number;
  sincronizadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class PaymobiVendasService {
  private readonly api = `${environment.apiUrl}/paymobi/vendas`;

  constructor(private http: HttpClient) {}

  listar(status?: string, termo?: string): Observable<PaymobiVenda[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (termo?.trim()) params = params.set('termo', termo.trim());
    return this.http.get<PaymobiVenda[]>(this.api, { params });
  }

  obter(id: string): Observable<PaymobiVenda> {
    return this.http.get<PaymobiVenda>(`${this.api}/${id}`);
  }

  criar(body: PaymobiVenda): Observable<PaymobiVenda> {
    return this.http.post<PaymobiVenda>(this.api, body);
  }

  atualizar(id: string, body: PaymobiVenda): Observable<PaymobiVenda> {
    return this.http.put<PaymobiVenda>(`${this.api}/${id}`, body);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  adicionarCobranca(id: string, body: PaymobiCobranca): Observable<PaymobiVenda> {
    return this.http.post<PaymobiVenda>(`${this.api}/${id}/cobrancas`, body);
  }

  removerCobranca(id: string, cobrancaId: string): Observable<PaymobiVenda> {
    return this.http.delete<PaymobiVenda>(`${this.api}/${id}/cobrancas/${cobrancaId}`);
  }

  confirmarParcelaPaga(
    id: string,
    body: { numero: number; valor: number; vencimento?: string; imei?: string },
  ): Observable<PaymobiVenda> {
    return this.http.post<PaymobiVenda>(`${this.api}/${id}/parcelas/${body.numero}/pago`, body);
  }

  removerParcelaManual(id: string, boletoId: string): Observable<PaymobiVenda> {
    return this.http.delete<PaymobiVenda>(`${this.api}/${id}/parcelas-manuais/${boletoId}`);
  }

  config(): Observable<PaymobiConfig> {
    return this.http.get<PaymobiConfig>(`${environment.apiUrl}/paymobi/config`);
  }

  sincronizar(body: { email?: string; senha?: string; salvarCredenciais?: boolean }): Observable<PaymobiSincronizarResultado> {
    return this.http.post<PaymobiSincronizarResultado>(`${environment.apiUrl}/paymobi/sincronizar`, body);
  }

  salvarCustos(body: {
    custoFixoAparelho: number;
    custoPlataformaTotal: number;
    custoPlataformaMensal: number;
    email?: string;
    senha?: string;
  }): Observable<PaymobiConfig> {
    return this.http.put<PaymobiConfig>(`${environment.apiUrl}/paymobi/custos`, body);
  }
}
