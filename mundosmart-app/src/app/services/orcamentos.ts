import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlingOrcamento, BlingOrdemServico } from '../models/bling.models';
import { environment } from '../../environments/environment';
import { montarHtmlImpressaoOrcamento } from '../utils/orcamento-impressao.templates';
import { OsImpressaoService } from './os-impressao.service';

/** Validade padrão do orçamento em dias úteis. */
export const ORCAMENTO_VALIDADE_DIAS_UTEIS = 7;

@Injectable({
  providedIn: 'root',
})
export class OrcamentosService {
  private readonly apiUrl = `${environment.apiUrl}/orcamentos`;

  constructor(
    private http: HttpClient,
    private impressaoOs: OsImpressaoService,
  ) {}

  listar(situacao?: string): Observable<BlingOrcamento[]> {
    const params = situacao ? `?situacao=${encodeURIComponent(situacao)}` : '';
    return this.http.get<BlingOrcamento[]>(`${this.apiUrl}${params}`);
  }

  obter(id: number): Observable<BlingOrcamento> {
    return this.http.get<BlingOrcamento>(`${this.apiUrl}/${id}`);
  }

  criar(orcamento: BlingOrcamento): Observable<BlingOrcamento> {
    return this.http.post<BlingOrcamento>(this.apiUrl, orcamento);
  }

  atualizar(id: number, orcamento: BlingOrcamento): Observable<BlingOrcamento> {
    return this.http.put<BlingOrcamento>(`${this.apiUrl}/${id}`, orcamento);
  }

  converterEmOs(id: number): Observable<BlingOrdemServico> {
    return this.http.post<BlingOrdemServico>(`${this.apiUrl}/${id}/converter-os`, {});
  }

  /** Após criar a OS na tela de inclusão, marca o orçamento como convertido. */
  vincularOs(id: number, osBlingId: number, osNumero?: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.apiUrl}/${id}/vincular-os`, {
      osBlingId,
      osNumero,
    });
  }

  /** Registra follow-up com anotação (+1 contato) e agenda a próxima data. */
  registrarFollowUp(
    id: number,
    body: { anotacao: string; responsavel?: string; dataFollowUpProxima?: string },
  ): Observable<BlingOrcamento> {
    return this.http.post<BlingOrcamento>(`${this.apiUrl}/${id}/follow-ups`, body);
  }

  registrarDesistencia(
    id: number,
    body: { motivo: string; responsavel?: string },
  ): Observable<BlingOrcamento> {
    return this.http.post<BlingOrcamento>(`${this.apiUrl}/${id}/desistencia`, body);
  }

  /** Imprime pré-orçamento (aviso especulativo incluso). Recarrega se só tiver id. */
  imprimir(orcamento: BlingOrcamento): void {
    if (orcamento.id == null) return;

    const disparar = (o: BlingOrcamento) => {
      try {
        const html = montarHtmlImpressaoOrcamento(o);
        this.impressaoOs.abrirJanelaImpressao(html, `Pré-orçamento #${o.numero ?? o.id}`);
      } catch (err) {
        console.error('[impressão orçamento]', err);
        window.alert('Não foi possível montar a impressão do orçamento.');
      }
    };

    if ((orcamento.itens?.length ?? 0) > 0 || orcamento.contato?.nome) {
      disparar(orcamento);
      return;
    }

    this.obter(orcamento.id).subscribe({
      next: disparar,
      error: () => window.alert('Não foi possível carregar o orçamento para impressão.'),
    });
  }
}
