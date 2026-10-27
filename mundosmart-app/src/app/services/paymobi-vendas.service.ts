import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
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
  _parcelasAtraso?: number,
  _statusContrato?: PaymobiStatus,
): PaymobiStatusCobranca {
  const s = (valor ?? '').trim().toLowerCase();
  if (s === 'ok' || s === 'negociacao' || s === 'recuperacao' || s === 'perdido') return s;
  return 'ok';
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

export type PaymobiTipoCobranca =
  | 'alerta_vencimento'
  | 'cobranca_manual'
  | 'cobranca_automatica'
  | 'reneg_auto'
  | 'reneg_manual'
  | 'extrajudicial';

export const TIPOS_COBRANCA: { id: PaymobiTipoCobranca; rotulo: string }[] = [
  { id: 'alerta_vencimento', rotulo: 'Alerta de vencimento' },
  { id: 'cobranca_manual', rotulo: 'Cobrança manual' },
  { id: 'cobranca_automatica', rotulo: 'Cobrança automática' },
  { id: 'reneg_auto', rotulo: 'Renegociação/Devolução Aut.' },
  { id: 'reneg_manual', rotulo: 'Renegociação/Devolução Manual' },
  { id: 'extrajudicial', rotulo: 'Cobrança extrajudicial' },
];

export interface PaymobiCobrancaAcao {
  id: string;
  em: string;
  tipo: string;
  modo?: string;
  observacao?: string;
  vencimentoRef?: string;
  boletosAtraso?: number;
  operador?: string;
  enviada?: boolean;
}

export interface PaymobiCobrancaItem {
  id: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteCpf?: string;
  aparelho?: string;
  aparelhoImei?: string;
  contratoNumero?: string;
  dataVenda?: string;
  status?: PaymobiStatus;
  parcelasAtraso: number;
  boletosPagos?: number;
  valorDevido?: number;
  valorParcela?: number;
  proximoVencimento?: string;
  vencimentoAtrasado?: string;
  tipoCobranca: PaymobiTipoCobranca | '';
  tipoCobrancaRotulo?: string;
  naoCobrarMais: boolean;
  sonecaAte?: string;
  sonecaAtiva?: boolean;
  proximaAcaoEm?: string;
  proximaAcaoRotulo?: string;
  filaHoje?: boolean;
  filaAlerta?: boolean;
  filaCobranca?: boolean;
  pendenteEnvio?: boolean;
  motivoPausa?: string;
  mensagemSugerida?: string;
  linkBoleto?: string;
  acoes?: PaymobiCobrancaAcao[];
}

export interface PaymobiCobrancaResumo {
  contratos: number;
  acaoHoje: number;
  alertaHoje: number;
  cobrancaHoje: number;
  soneca: number;
  naoCobrar: number;
  atrasados: number;
  pendenteEnvio: number;
}

export interface PaymobiCobrancaLista {
  resumo: PaymobiCobrancaResumo;
  itens: PaymobiCobrancaItem[];
}

export interface PaymobiCobrancaConfig {
  alertaHabilitado: boolean;
  alertaHora: number;
  alertaMaxAtraso: number;
  alertaMensagem: string;
  autoHabilitada: boolean;
  autoDiasAposVencimento: number;
  autoRepetirDias: number;
  autoHora: number;
  autoSoDiasUteis: boolean;
  autoMensagem: string;
}

export interface PaymobiConfig {
  email: string;
  senhaConfigurada: boolean;
  ultimaSincronizacao?: string;
  ultimoTotalImportado?: number;
  custoFixoAparelho?: number;
  custoPorAparelho?: number;
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

  sincronizar(body: {
    email?: string;
    senha?: string;
    salvarCredenciais?: boolean;
    substituirTudo?: boolean;
  }): Observable<PaymobiSincronizarResultado> {
    return this.http.post<PaymobiSincronizarResultado>(`${environment.apiUrl}/paymobi/sincronizar`, body).pipe(
      timeout(600_000),
    );
  }

  salvarCustos(body: {
    custoFixoAparelho: number;
    custoPorAparelho: number;
    custoPlataformaTotal: number;
    custoPlataformaMensal: number;
    email?: string;
    senha?: string;
  }): Observable<PaymobiConfig> {
    return this.http.put<PaymobiConfig>(`${environment.apiUrl}/paymobi/custos`, body);
  }

  cobranca(params?: { fila?: string; tipo?: string; termo?: string }): Observable<PaymobiCobrancaLista> {
    let httpParams = new HttpParams();
    if (params?.fila) httpParams = httpParams.set('fila', params.fila);
    if (params?.tipo) httpParams = httpParams.set('tipo', params.tipo);
    if (params?.termo?.trim()) httpParams = httpParams.set('termo', params.termo.trim());
    return this.http.get<PaymobiCobrancaLista>(`${environment.apiUrl}/paymobi/cobranca`, { params: httpParams });
  }

  cobrancaResumo(): Observable<PaymobiCobrancaResumo> {
    return this.http.get<PaymobiCobrancaResumo>(`${environment.apiUrl}/paymobi/cobranca/resumo`);
  }

  cobrancaConfig(): Observable<PaymobiCobrancaConfig> {
    return this.http.get<PaymobiCobrancaConfig>(`${environment.apiUrl}/paymobi/cobranca/config`);
  }

  salvarCobrancaConfig(body: PaymobiCobrancaConfig): Observable<PaymobiCobrancaConfig> {
    return this.http.put<PaymobiCobrancaConfig>(`${environment.apiUrl}/paymobi/cobranca/config`, body);
  }

  atualizarGestaoCobranca(
    id: string,
    body: {
      tipoCobranca?: string;
      naoCobrarMais?: boolean;
      sonecaAte?: string | null;
      limparSoneca?: boolean;
      observacao?: string;
    },
  ): Observable<PaymobiCobrancaItem> {
    return this.http.put<PaymobiCobrancaItem>(`${this.api}/${id}/gestao-cobranca`, body);
  }

  registrarAcaoCobranca(
    id: string,
    body: { tipo: string; observacao?: string; enviada?: boolean },
  ): Observable<PaymobiCobrancaItem> {
    return this.http.post<PaymobiCobrancaItem>(`${this.api}/${id}/acao-cobranca`, body);
  }
}
