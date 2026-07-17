import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap, timeout, catchError, throwError, map } from 'rxjs';
import { ModeloAparelho, MarcaAparelho, ModeloOperacaoResponse, ModeloReferenciaResponse, ModeloServicosValoresResponse } from '../models/bling.models';
import { environment } from '../../environments/environment';
import { MODELO_LIMITE_AUTOCOMPLETE_API } from '../config/aparelhos.config';
import { osSituacaoFinalizada } from '../pages/ordens-servico/os-situacao.util';

export interface ModeloFiltros {
  termo?: string;
  marcaId?: string;
  marcaNome?: string;
  tipoDispositivo?: string;
  limite?: number;
}

@Injectable({ providedIn: 'root' })
export class AparelhosService {
  private readonly apiUrl = `${environment.apiUrl}/aparelhos`;
  private readonly listaCache = new Map<string, { ts: number; data: ModeloAparelho[] }>();
  private readonly valoresCache = new Map<string, { ts: number; data: ModeloServicosValoresResponse }>();
  private readonly operacaoCache = new Map<string, { ts: number; data: ModeloOperacaoResponse }>();
  private readonly referenciaCache = new Map<string, { ts: number; data: ModeloReferenciaResponse }>();
  private readonly cacheTtlMs = 8_000;
  private readonly referenciaCacheTtlMs = 30_000;
  private readonly httpTimeoutMs = 8_000;

  constructor(private http: HttpClient) {}

  listarTiposDispositivo(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tipos-dispositivo`);
  }

  listarTiposCompatibilidade(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tipos-compatibilidade`);
  }

  listarMarcas(termo?: string, tipoDispositivo?: string, limite = 200): Observable<MarcaAparelho[]> {
    let params = new HttpParams().set('limite', limite.toString());
    if (termo?.trim()) params = params.set('termo', termo.trim());
    if (tipoDispositivo) params = params.set('tipoDispositivo', tipoDispositivo);
    return this.http.get<MarcaAparelho[]>(`${this.apiUrl}/marcas`, { params });
  }

  listarModelos(filtros?: ModeloFiltros): Observable<ModeloAparelho[]> {
    const key = this.chaveCache(filtros);
    const hit = this.listaCache.get(key);
    if (hit && Date.now() - hit.ts < this.cacheTtlMs) {
      return of(hit.data);
    }

    let params = new HttpParams();
    if (filtros?.termo?.trim()) params = params.set('termo', filtros.termo.trim());
    if (filtros?.marcaId) params = params.set('marcaId', filtros.marcaId);
    if (filtros?.marcaNome?.trim()) params = params.set('marcaNome', filtros.marcaNome.trim());
    if (filtros?.tipoDispositivo) params = params.set('tipoDispositivo', filtros.tipoDispositivo);
    if (filtros?.limite) params = params.set('limite', filtros.limite.toString());

    return this.http.get<ModeloAparelho[]>(`${this.apiUrl}/modelos`, { params }).pipe(
      tap(data => this.listaCache.set(key, { ts: Date.now(), data })),
    );
  }

  buscarModelos(termo?: string, marcaId?: string, tipoDispositivo?: string): Observable<ModeloAparelho[]> {
    return this.listarModelos({
      termo,
      marcaId,
      tipoDispositivo,
      limite: MODELO_LIMITE_AUTOCOMPLETE_API,
    });
  }

  obterModelo(id: string): Observable<ModeloAparelho> {
    return this.http.get<ModeloAparelho>(`${this.apiUrl}/modelos/${id}`);
  }

  criarModelo(modelo: ModeloAparelho): Observable<ModeloAparelho> {
    return this.http.post<ModeloAparelho>(`${this.apiUrl}/modelos`, modelo).pipe(
      tap(() => this.limparCacheLista()),
    );
  }

  atualizarModelo(id: string, modelo: ModeloAparelho): Observable<ModeloAparelho> {
    return this.http.put<ModeloAparelho>(`${this.apiUrl}/modelos/${id}`, modelo).pipe(
      tap(() => this.limparCacheLista()),
    );
  }

  excluirModelo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modelos/${id}`).pipe(
      tap(() => this.limparCacheLista()),
    );
  }

  consultarServicosValores(modeloId: string): Observable<ModeloServicosValoresResponse> {
    const key = `v|${modeloId}`;
    const hit = this.valoresCache.get(key);
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) {
      return of(hit.data);
    }

    return this.http.get<ModeloServicosValoresResponse>(
      `${this.apiUrl}/modelos/${modeloId}/servicos-valores`,
    ).pipe(
      timeout(this.httpTimeoutMs),
      tap(data => this.valoresCache.set(key, { ts: Date.now(), data: { pecas: data?.pecas ?? [] } })),
      catchError(err => throwError(() => err)),
    );
  }

  consultarOperacaoModelo(modeloId: string, excluirOsId?: number): Observable<ModeloOperacaoResponse> {
    const key = this.chaveOperacao(modeloId, excluirOsId);
    const hit = this.operacaoCache.get(key);
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) {
      return of(hit.data);
    }

    let params = new HttpParams();
    if (excluirOsId) params = params.set('excluirOsId', excluirOsId.toString());

    return this.http.get<ModeloOperacaoResponse>(
      `${this.apiUrl}/modelos/${modeloId}/operacao`,
      { params },
    ).pipe(
      timeout(this.httpTimeoutMs),
      map(data => this.sanitizarOperacao(data)),
      tap(data => this.operacaoCache.set(key, { ts: Date.now(), data })),
      catchError(err => throwError(() => err)),
    );
  }

  obterValoresEmCache(modeloId: string): ModeloServicosValoresResponse | undefined {
    const hit = this.valoresCache.get(`v|${modeloId}`);
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) return hit.data;
    return undefined;
  }

  obterOperacaoEmCache(modeloId: string, excluirOsId?: number): ModeloOperacaoResponse | undefined {
    const hit = this.operacaoCache.get(this.chaveOperacao(modeloId, excluirOsId));
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) return hit.data;
    return undefined;
  }

  consultarReferenciaModelo(modeloId: string, excluirOsId?: number): Observable<ModeloReferenciaResponse> {
    const key = this.chaveReferencia(modeloId, excluirOsId);
    const hit = this.referenciaCache.get(key);
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) {
      return of(hit.data);
    }

    let params = new HttpParams();
    if (excluirOsId) params = params.set('excluirOsId', excluirOsId.toString());

    return this.http.get<ModeloReferenciaResponse>(
      `${this.apiUrl}/modelos/${modeloId}/referencia`,
      { params },
    ).pipe(
      timeout(this.httpTimeoutMs),
      map(data => this.sanitizarReferencia(data)),
      tap(data => this.referenciaCache.set(key, { ts: Date.now(), data })),
    );
  }

  obterReferenciaEmCache(modeloId: string, excluirOsId?: number): ModeloReferenciaResponse | undefined {
    const hit = this.referenciaCache.get(this.chaveReferencia(modeloId, excluirOsId));
    if (hit && Date.now() - hit.ts < this.referenciaCacheTtlMs) return hit.data;
    return undefined;
  }

  limparCacheReferencia(): void {
    this.referenciaCache.clear();
    this.valoresCache.clear();
    this.operacaoCache.clear();
  }

  /** Concluído / Cancelado nunca entram na fila "na assistência". */
  private sanitizarOperacao(data: ModeloOperacaoResponse | null | undefined): ModeloOperacaoResponse {
    const osEmAndamento = (data?.osEmAndamento ?? []).filter(os => !osSituacaoFinalizada(os.situacao));
    return {
      ...data,
      marcaNome: data?.marcaNome,
      modeloNome: data?.modeloNome,
      osAbertasHoje: data?.osAbertasHoje ?? 0,
      osEmAndamento,
      osModeloEmAssistencia: osEmAndamento.length,
      pecasResumo: (data?.pecasResumo ?? []).map(p => ({
        ...p,
        emExecucao: Math.max(0, p.emExecucao ?? 0),
      })),
      alertas: data?.alertas ?? [],
    };
  }

  private sanitizarReferencia(data: ModeloReferenciaResponse | null | undefined): ModeloReferenciaResponse {
    const osEmAndamento = (data?.osEmAndamento ?? []).filter(os => !osSituacaoFinalizada(os.situacao));
    return {
      ...data,
      marcaNome: data?.marcaNome,
      modeloNome: data?.modeloNome,
      osEmAndamento,
      pecas: data?.pecas ?? [],
      alertas: data?.alertas ?? [],
    };
  }

  private chaveOperacao(modeloId: string, excluirOsId?: number): string {
    return `o|${modeloId}|${excluirOsId ?? ''}`;
  }

  private chaveReferencia(modeloId: string, excluirOsId?: number): string {
    return `${modeloId}|${excluirOsId ?? ''}`;
  }

  private chaveCache(filtros?: ModeloFiltros): string {
    const termo = (filtros?.termo ?? '').trim().toLowerCase();
    const marca = (filtros?.marcaNome ?? '').trim().toLowerCase();
    const tipo = filtros?.tipoDispositivo ?? '';
    const limite = filtros?.limite ?? 100;
    return `${termo}|${marca}|${tipo}|${limite}`;
  }

  private limparCacheLista(): void {
    this.listaCache.clear();
  }
}
