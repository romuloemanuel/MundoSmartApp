import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, timeout, map } from 'rxjs';
import { BlingOrdemServico, OsListaPaginada } from '../models/bling.models';
import { environment } from '../../environments/environment';
import { OsOrdenacaoCampo, OsOrdenacaoDirecao } from '../config/os-lista.config';

export interface OsFiltros {
  situacao?: string;
  nome?: string;
  numero?: string;
  telefone?: string;
  imei?: string;
  cpfCnpj?: string;
  dataCadastroInicio?: string;
  dataCadastroFim?: string;
  dataAtualizacaoInicio?: string;
  dataAtualizacaoFim?: string;
  dataConclusaoInicio?: string;
  dataConclusaoFim?: string;
  retorno?: boolean | null;
  lojaOrigem?: string;
  tecnicoNome?: string;
  modeloId?: string;
  modeloNome?: string;
  pagina?: number;
  tamanhoPagina?: number;
  ordenarPor?: OsOrdenacaoCampo;
  direcao?: OsOrdenacaoDirecao;
}

export interface ComissaoOsItem {
  id: number;
  numero?: string;
  lojaOrigem?: string;
  tecnicoNome?: string;
  clienteNome?: string;
  equipamento?: string;
  dataConclusao?: string;
  valorTotal: number;
  juros: number;
  valorPecas: number;
  valorLiquido: number;
}

export interface ComissaoPorTecnico {
  tecnicoNome: string;
  quantidadeOs: number;
  totalValor: number;
  totalJuros: number;
  totalPecas: number;
  totalLiquido: number;
}

export interface ComissaoRelatorio {
  dataConclusaoInicio?: string;
  dataConclusaoFim?: string;
  lojaOrigemFiltro?: string | null;
  tecnicosFiltro: string[];
  quantidadeOs: number;
  totalValor: number;
  totalJuros: number;
  totalPecas: number;
  totalLiquido: number;
  porTecnico: ComissaoPorTecnico[];
  ordens: ComissaoOsItem[];
}

export interface OsHistoricoResumo {
  id?: string;
  osBlingId: number;
  osNumero?: string;
  versao: number;
  acao: string;
  resumo?: string;
  usuarioId?: string;
  usuarioNome?: string;
  criadoEm: string;
}

export interface OsHistoricoDetalhe extends OsHistoricoResumo {
  snapshot?: BlingOrdemServico | null;
}

export interface OsHistoricoConsulta {
  itens: OsHistoricoResumo[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface OsHistoricoFiltrosConsulta {
  osBlingId?: number;
  osNumero?: string;
  acao?: string;
  usuario?: string;
  lojaOrigem?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrdensServicoService {
  private readonly apiUrl = `${environment.apiUrl}/ordens-servico`;
  private readonly listaCache = new Map<string, OsListaPaginada>();
  private readonly obterCache = new Map<number, BlingOrdemServico>();
  private readonly httpTimeoutMs = 15_000;

  constructor(private http: HttpClient) {}

  peekLista(filtros?: OsFiltros): OsListaPaginada | null {
    return this.listaCache.get(this.cacheKey(filtros)) ?? null;
  }

  peekObter(id: number): BlingOrdemServico | undefined {
    return this.obterCache.get(id);
  }

  /** Pré-carrega dados da lista para a tela de edição abrir mais rápido. */
  seedObter(os: BlingOrdemServico): void {
    if (os.id != null) this.obterCache.set(os.id, os);
  }

  invalidarListaCache(): void {
    this.listaCache.clear();
  }

  invalidarObterCache(id?: number): void {
    if (id != null) this.obterCache.delete(id);
    else this.obterCache.clear();
  }

  listar(filtros?: OsFiltros): Observable<OsListaPaginada> {
    return this.http
      .get<OsListaPaginada | BlingOrdemServico[]>(this.apiUrl, { params: this.buildParams(filtros) })
      .pipe(
        timeout(this.httpTimeoutMs),
        map((raw) => this.normalizarLista(raw, filtros)),
        tap((dados) => this.listaCache.set(this.cacheKey(filtros), dados)),
      );
  }

  obter(id: number): Observable<BlingOrdemServico> {
    return this.http.get<BlingOrdemServico>(`${this.apiUrl}/${id}`).pipe(
      timeout(this.httpTimeoutMs),
      tap((os) => {
        if (os.id != null) this.obterCache.set(os.id, os);
      }),
    );
  }

  criar(os: BlingOrdemServico): Observable<BlingOrdemServico> {
    return this.http.post<BlingOrdemServico>(this.apiUrl, os).pipe(
      tap((criada) => {
        this.invalidarListaCache();
        if (criada.id != null) this.obterCache.set(criada.id, criada);
      }),
    );
  }

  atualizar(id: number, os: BlingOrdemServico): Observable<BlingOrdemServico> {
    return this.http.put<BlingOrdemServico>(`${this.apiUrl}/${id}`, os).pipe(
      tap((atualizada) => {
        this.invalidarListaCache();
        this.obterCache.set(id, atualizada);
      }),
    );
  }

  consultarHistorico(filtros?: OsHistoricoFiltrosConsulta): Observable<OsHistoricoConsulta> {
    let params = new HttpParams();
    if (filtros?.osBlingId != null) params = params.set('osBlingId', String(filtros.osBlingId));
    if (filtros?.osNumero) params = params.set('osNumero', filtros.osNumero);
    if (filtros?.acao) params = params.set('acao', filtros.acao);
    if (filtros?.usuario) params = params.set('usuario', filtros.usuario);
    if (filtros?.lojaOrigem) params = params.set('lojaOrigem', filtros.lojaOrigem);
    if (filtros?.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros?.dataFim) params = params.set('dataFim', filtros.dataFim);
    if (filtros?.pagina != null) params = params.set('pagina', String(filtros.pagina));
    if (filtros?.tamanhoPagina != null) params = params.set('tamanhoPagina', String(filtros.tamanhoPagina));
    return this.http.get<OsHistoricoConsulta>(`${this.apiUrl}/historico`, { params }).pipe(
      timeout(this.httpTimeoutMs),
    );
  }

  listarHistorico(id: number): Observable<OsHistoricoResumo[]> {
    return this.http.get<OsHistoricoResumo[]>(`${this.apiUrl}/${id}/historico`).pipe(
      timeout(this.httpTimeoutMs),
    );
  }

  obterHistoricoVersao(id: number, versao: number): Observable<OsHistoricoDetalhe> {
    return this.http.get<OsHistoricoDetalhe>(`${this.apiUrl}/${id}/historico/${versao}`).pipe(
      timeout(this.httpTimeoutMs),
    );
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.invalidarListaCache();
        this.obterCache.delete(id);
      }),
    );
  }

  alterarSituacao(
    id: number,
    situacao: string,
    motivoCancelamento?: string,
    dataPrazoPeca?: string,
    tecnicoNome?: string,
  ): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/situacao`, {
      situacao,
      motivoCancelamento,
      dataPrazoPeca: dataPrazoPeca || undefined,
      tecnicoNome: tecnicoNome || undefined,
    }).pipe(
      tap(() => {
        this.invalidarListaCache();
        const cached = this.obterCache.get(id);
        if (cached) {
          this.obterCache.set(id, {
            ...cached,
            situacao,
            motivoCancelamento: motivoCancelamento ?? cached.motivoCancelamento,
            dataPrazoPeca: dataPrazoPeca ?? cached.dataPrazoPeca,
            tecnicoNome: tecnicoNome ?? cached.tecnicoNome,
            justificativasAtraso: undefined,
          });
        }
      }),
    );
  }

  relatorioComissao(filtros: {
    dataConclusaoInicio?: string;
    dataConclusaoFim?: string;
    tecnicos?: string[];
    incluirSemTecnico?: boolean;
    lojaOrigem?: string;
  }): Observable<ComissaoRelatorio> {
    let params = new HttpParams();
    if (filtros.dataConclusaoInicio) {
      params = params.set('dataConclusaoInicio', filtros.dataConclusaoInicio);
    }
    if (filtros.dataConclusaoFim) {
      params = params.set('dataConclusaoFim', filtros.dataConclusaoFim);
    }
    if (filtros.incluirSemTecnico === false) {
      params = params.set('incluirSemTecnico', 'false');
    }
    if (filtros.lojaOrigem) {
      params = params.set('lojaOrigem', filtros.lojaOrigem);
    }
    for (const nome of filtros.tecnicos ?? []) {
      const t = nome?.trim();
      if (t) params = params.append('tecnicos', t);
    }
    return this.http.get<ComissaoRelatorio>(`${this.apiUrl}/relatorio-comissao`, { params }).pipe(
      timeout(this.httpTimeoutMs),
    );
  }

  justificarAtraso(id: number, justificativaAtraso: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/justificativa-atraso`, {
      justificativaAtraso,
    }).pipe(
      tap(() => {
        this.invalidarListaCache();
        const cached = this.obterCache.get(id);
        if (cached) {
          this.obterCache.set(id, {
            ...cached,
            justificativasAtraso: [
              ...(cached.justificativasAtraso ?? []),
              { texto: justificativaAtraso, criadoEm: new Date().toISOString() },
            ],
          });
        }
      }),
    );
  }

  private buildParams(filtros?: OsFiltros): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    if (filtros.situacao) params = params.set('situacao', filtros.situacao);
    if (filtros.nome) params = params.set('nome', filtros.nome);
    if (filtros.numero) params = params.set('numero', filtros.numero);
    if (filtros.telefone) params = params.set('telefone', filtros.telefone);
    if (filtros.imei) params = params.set('imei', filtros.imei);
    if (filtros.cpfCnpj) params = params.set('cpfCnpj', filtros.cpfCnpj);
    if (filtros.dataCadastroInicio) params = params.set('dataCadastroInicio', filtros.dataCadastroInicio);
    if (filtros.dataCadastroFim) params = params.set('dataCadastroFim', filtros.dataCadastroFim);
    if (filtros.dataAtualizacaoInicio) params = params.set('dataAtualizacaoInicio', filtros.dataAtualizacaoInicio);
    if (filtros.dataAtualizacaoFim) params = params.set('dataAtualizacaoFim', filtros.dataAtualizacaoFim);
    if (filtros.dataConclusaoInicio) params = params.set('dataConclusaoInicio', filtros.dataConclusaoInicio);
    if (filtros.dataConclusaoFim) params = params.set('dataConclusaoFim', filtros.dataConclusaoFim);
    if (filtros.retorno !== null && filtros.retorno !== undefined) {
      params = params.set('retorno', String(filtros.retorno));
    }
    if (filtros.lojaOrigem) params = params.set('lojaOrigem', filtros.lojaOrigem);
    if (filtros.tecnicoNome) params = params.set('tecnicoNome', filtros.tecnicoNome);
    if (filtros.modeloId) params = params.set('modeloId', filtros.modeloId);
    if (filtros.modeloNome) params = params.set('modeloNome', filtros.modeloNome);
    if (filtros.pagina != null) params = params.set('pagina', String(filtros.pagina));
    if (filtros.tamanhoPagina != null) params = params.set('tamanhoPagina', String(filtros.tamanhoPagina));
    if (filtros.ordenarPor) params = params.set('ordenarPor', filtros.ordenarPor);
    if (filtros.direcao) params = params.set('direcao', filtros.direcao);
    return params;
  }

  private cacheKey(filtros?: OsFiltros): string {
    return JSON.stringify(filtros ?? {});
  }

  /** Aceita resposta paginada (novo) ou array legado (API antiga em execução). */
  private normalizarLista(
    raw: OsListaPaginada | BlingOrdemServico[] | Record<string, unknown>,
    filtros?: OsFiltros,
  ): OsListaPaginada {
    if (Array.isArray(raw)) {
      return {
        itens: raw,
        total: raw.length,
        pagina: filtros?.pagina ?? 1,
        tamanhoPagina: filtros?.tamanhoPagina ?? raw.length,
      };
    }

    const bag = raw as Record<string, unknown>;
    const itens = (bag['itens'] ?? bag['Itens']) as BlingOrdemServico[] | undefined;
    const lista = Array.isArray(itens) ? itens : [];

    const totalRaw = bag['total'] ?? bag['Total'];
    const total = typeof totalRaw === 'number' ? totalRaw : lista.length;

    const paginaRaw = bag['pagina'] ?? bag['Pagina'];
    const pagina = typeof paginaRaw === 'number' ? paginaRaw : (filtros?.pagina ?? 1);

    const tamanhoRaw = bag['tamanhoPagina'] ?? bag['TamanhoPagina'];
    const tamanhoPagina = typeof tamanhoRaw === 'number'
      ? tamanhoRaw
      : (filtros?.tamanhoPagina ?? lista.length);

    return { itens: lista, total, pagina, tamanhoPagina };
  }
}
