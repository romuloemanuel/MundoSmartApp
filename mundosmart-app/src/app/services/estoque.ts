import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PedidoCompraEstoque,
  PedidoCompraDetalhe,
  MovimentacaoEstoque,
  LoteEstoque,
  RegistrarPedidoCompraRequest,
  RegistrarSaidaEstoqueRequest,
  ReposicaoSemanalResponse,
  RelatorioReposicaoParams,
  RelatorioReposicaoHistorico,
  SalvarRelatorioReposicaoRequest,
  RegistrarDevolucaoGarantiaRequest,
  LoteGarantiaItem,
  EstoqueSugestaoItem,
  CaixaRetornoGarantiaResponse,
  CaixaRetornoAdicaoResponse,
  GerarLoteDevolucaoGarantiaRequest,
  LoteDevolucaoGarantiaDocumento,
  LoteRetornoGarantiaHistorico,
  AnaliseRetornoGarantiaResponse,
  CustoPecaReferencia,
  PecaCatalogo,
} from '../models/estoque.models';

@Injectable({ providedIn: 'root' })
export class EstoqueService {
  private readonly base = `${environment.apiUrl}/estoque`;

  constructor(private http: HttpClient) {}

  listarPedidos(): Observable<PedidoCompraEstoque[]> {
    return this.http.get<PedidoCompraEstoque[]>(`${this.base}/pedidos`);
  }

  obterPedido(id: string): Observable<PedidoCompraDetalhe> {
    return this.http.get<PedidoCompraDetalhe>(`${this.base}/pedidos/${id}`);
  }

  registrarPedido(body: RegistrarPedidoCompraRequest): Observable<PedidoCompraDetalhe> {
    return this.http.post<PedidoCompraDetalhe>(`${this.base}/pedidos`, body);
  }

  listarLotes(pecaId?: string, somenteComSaldo = false): Observable<LoteEstoque[]> {
    let params = new HttpParams();
    if (pecaId) params = params.set('pecaId', pecaId);
    if (somenteComSaldo) params = params.set('somenteComSaldo', 'true');
    return this.http.get<LoteEstoque[]>(`${this.base}/lotes`, { params });
  }

  listarMovimentacoes(tipo?: string, inicio?: string, fim?: string): Observable<MovimentacaoEstoque[]> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    if (inicio) params = params.set('inicio', inicio);
    if (fim) params = params.set('fim', fim);
    return this.http.get<MovimentacaoEstoque[]>(`${this.base}/movimentacoes`, { params });
  }

  registrarSaida(body: RegistrarSaidaEstoqueRequest): Observable<MovimentacaoEstoque[]> {
    return this.http.post<MovimentacaoEstoque[]>(`${this.base}/saidas`, body);
  }

  relatorioReposicao(opts: RelatorioReposicaoParams = {}): Observable<ReposicaoSemanalResponse> {
    const params = this.montarParamsReposicao(opts);
    return this.http.get<ReposicaoSemanalResponse>(`${this.base}/relatorios/reposicao`, { params }).pipe(
      catchError(err => {
        if (err.status === 404) {
          return this.http.get<ReposicaoSemanalResponse>(`${this.base}/relatorios/reposicao-semanal`, { params });
        }
        return throwError(() => err);
      }),
    );
  }

  private montarParamsReposicao(opts: RelatorioReposicaoParams): HttpParams {
    let params = new HttpParams();
    if (opts.periodo) params = params.set('periodo', opts.periodo);
    if (opts.inicio) params = params.set('inicio', this.dataQueryParam(opts.inicio));
    if (opts.fim) params = params.set('fim', this.dataQueryParam(opts.fim));
    if (opts.modeloId) params = params.set('modeloId', opts.modeloId);
    return params;
  }

  /** Evita deslocamento de fuso ao enviar ISO completo para a API. */
  private dataQueryParam(valor: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return valor;
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  listarPecas(termo?: string): Observable<PecaCatalogo[]> {
    let params = new HttpParams();
    if (termo) params = params.set('termo', termo);
    return this.http.get<PecaCatalogo[]>(`${environment.apiUrl}/pecas`, { params });
  }

  obterCustoReferenciaPeca(pecaId: string): Observable<CustoPecaReferencia> {
    return this.http.get<CustoPecaReferencia>(`${this.base}/pecas/${pecaId}/custo-referencia`);
  }

  salvarRelatorioReposicao(body: SalvarRelatorioReposicaoRequest): Observable<RelatorioReposicaoHistorico> {
    return this.http.post<RelatorioReposicaoHistorico>(`${this.base}/relatorios/reposicao/historico`, body);
  }

  listarRelatoriosReposicao(
    limite = 10,
    statusConclusao?: string,
  ): Observable<RelatorioReposicaoHistorico[]> {
    let params = new HttpParams().set('limite', limite);
    if (statusConclusao?.trim()) {
      params = params.set('statusConclusao', statusConclusao.trim());
    }
    return this.http.get<RelatorioReposicaoHistorico[]>(`${this.base}/relatorios/reposicao/historico`, { params });
  }

  obterRelatorioReposicao(id: string): Observable<RelatorioReposicaoHistorico> {
    return this.http.get<RelatorioReposicaoHistorico>(`${this.base}/relatorios/reposicao/historico/${id}`);
  }

  atualizarStatusRelatorioReposicao(
    id: string,
    statusConclusao: string,
  ): Observable<RelatorioReposicaoHistorico> {
    return this.http.patch<RelatorioReposicaoHistorico>(
      `${this.base}/relatorios/reposicao/historico/${id}/status`,
      { statusConclusao },
    );
  }

  listarLotesEmGarantia(filtros?: {
    fornecedor?: string;
    osNumero?: string;
    lote?: string;
  }): Observable<LoteGarantiaItem[]> {
    let params = new HttpParams();
    if (filtros?.fornecedor?.trim()) params = params.set('fornecedor', filtros.fornecedor.trim());
    if (filtros?.osNumero?.trim()) params = params.set('osNumero', filtros.osNumero.trim());
    if (filtros?.lote?.trim()) params = params.set('lote', filtros.lote.trim());
    return this.http.get<LoteGarantiaItem[]>(`${this.base}/lotes/em-garantia`, { params });
  }

  listarLotesPrestesAVencer(filtros?: {
    dias?: number;
    fornecedor?: string;
    busca?: string;
  }): Observable<LoteGarantiaItem[]> {
    let params = new HttpParams();
    if (filtros?.dias != null) params = params.set('dias', String(filtros.dias));
    if (filtros?.fornecedor?.trim()) params = params.set('fornecedor', filtros.fornecedor.trim());
    if (filtros?.busca?.trim()) params = params.set('busca', filtros.busca.trim());
    return this.http.get<LoteGarantiaItem[]>(`${this.base}/lotes/prestes-a-vencer`, { params });
  }

  sugerirOsGarantia(termo: string): Observable<EstoqueSugestaoItem[]> {
    let params = new HttpParams();
    if (termo?.trim()) params = params.set('termo', termo.trim());
    return this.http.get<EstoqueSugestaoItem[]>(`${this.base}/sugestoes/os-garantia`, { params });
  }

  sugerirLoteGarantia(termo: string): Observable<EstoqueSugestaoItem[]> {
    let params = new HttpParams();
    if (termo?.trim()) params = params.set('termo', termo.trim());
    return this.http.get<EstoqueSugestaoItem[]>(`${this.base}/sugestoes/lote-garantia`, { params });
  }

  sugerirFornecedorGarantia(termo: string): Observable<EstoqueSugestaoItem[]> {
    let params = new HttpParams();
    if (termo?.trim()) params = params.set('termo', termo.trim());
    return this.http.get<EstoqueSugestaoItem[]>(`${this.base}/sugestoes/fornecedor-garantia`, { params });
  }

  listarCaixaRetornoGarantia(fornecedor?: string): Observable<CaixaRetornoGarantiaResponse> {
    let params = new HttpParams();
    if (fornecedor?.trim()) params = params.set('fornecedor', fornecedor.trim());
    return this.http.get<CaixaRetornoGarantiaResponse>(`${this.base}/caixa-retorno-garantia`, { params });
  }

  adicionarCaixaRetornoGarantia(
    body: RegistrarDevolucaoGarantiaRequest,
  ): Observable<CaixaRetornoAdicaoResponse> {
    return this.http.post<CaixaRetornoAdicaoResponse>(`${this.base}/caixa-retorno-garantia`, body);
  }

  removerCaixaRetornoGarantia(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/caixa-retorno-garantia/${id}`);
  }

  gerarLoteDevolucaoGarantia(
    body: GerarLoteDevolucaoGarantiaRequest,
  ): Observable<LoteDevolucaoGarantiaDocumento> {
    return this.http.post<LoteDevolucaoGarantiaDocumento>(`${this.base}/devolucoes-garantia/lote`, body);
  }

  listarLotesRetornoHistorico(opts?: {
    fornecedor?: string;
    de?: string;
    ate?: string;
    limite?: number;
  }): Observable<LoteRetornoGarantiaHistorico[]> {
    let params = new HttpParams();
    if (opts?.fornecedor?.trim()) params = params.set('fornecedor', opts.fornecedor.trim());
    if (opts?.de) params = params.set('de', opts.de);
    if (opts?.ate) params = params.set('ate', opts.ate);
    if (opts?.limite != null) params = params.set('limite', String(opts.limite));
    return this.http.get<LoteRetornoGarantiaHistorico[]>(`${this.base}/lotes-retorno-garantia`, { params });
  }

  obterLoteRetornoHistorico(id: string): Observable<LoteRetornoGarantiaHistorico> {
    return this.http.get<LoteRetornoGarantiaHistorico>(`${this.base}/lotes-retorno-garantia/${id}`);
  }

  analisarRetornoGarantia(opts?: {
    de?: string;
    ate?: string;
    fornecedor?: string;
  }): Observable<AnaliseRetornoGarantiaResponse> {
    let params = new HttpParams();
    if (opts?.de) params = params.set('de', opts.de);
    if (opts?.ate) params = params.set('ate', opts.ate);
    if (opts?.fornecedor?.trim()) params = params.set('fornecedor', opts.fornecedor.trim());
    return this.http.get<AnaliseRetornoGarantiaResponse>(`${this.base}/analise-retorno-garantia`, { params });
  }
}
