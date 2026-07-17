import { Injectable } from '@angular/core';
import { BlingOrcamento } from '../models/bling.models';

const STORAGE_KEY = 'mundosmart.orcamentoOsPrefill';

/** Estado passado em `Router.navigate(..., { state })`. */
export const ORCAMENTO_OS_PREFILL_STATE_KEY = 'orcamentoOsPrefill';

/**
 * Guarda o orçamento até a tela de nova OS aplicar o prefill.
 * Usa memória + sessionStorage (sobrevive à troca de rota).
 */
@Injectable({ providedIn: 'root' })
export class OrcamentoOsPrefillService {
  private pending?: BlingOrcamento;

  preparar(orcamento: BlingOrcamento): void {
    const copia = this.clonar(orcamento);
    if (!copia) return;
    this.pending = copia;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(copia));
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** Lê sem remover (útil até o form confirmar o apply). */
  peek(esperadoId?: number): BlingOrcamento | undefined {
    const mem = this.lerMemoria(esperadoId);
    if (mem) return mem;
    return this.lerStorage(esperadoId);
  }

  /**
   * Resolve o orçamento por id: argumento → memória → sessionStorage.
   * Não limpa; chame `limpar()` só após apply bem-sucedido.
   */
  obterParaPrefill(esperadoId: number, jaCarregado?: BlingOrcamento): BlingOrcamento | undefined {
    if (jaCarregado && this.idCompativel(jaCarregado, esperadoId)) {
      return this.clonar(jaCarregado);
    }
    return this.peek(esperadoId);
  }

  /** @deprecated preferir obterParaPrefill + limpar após apply */
  consumir(esperadoId?: number): BlingOrcamento | undefined {
    const v = this.peek(esperadoId);
    this.limpar();
    return v;
  }

  limpar(): void {
    this.pending = undefined;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private clonar(orcamento: BlingOrcamento): BlingOrcamento | undefined {
    if (orcamento == null || orcamento.id == null) return undefined;
    return {
      ...orcamento,
      id: Number(orcamento.id),
      itens: (orcamento.itens ?? []).map(i => ({ ...i })),
      contato: orcamento.contato ? { ...orcamento.contato } : undefined,
    };
  }

  private idCompativel(orc: BlingOrcamento, esperadoId: number): boolean {
    return Number(orc.id) === Number(esperadoId);
  }

  private lerMemoria(esperadoId?: number): BlingOrcamento | undefined {
    const v = this.pending;
    if (!v) return undefined;
    if (esperadoId != null && !this.idCompativel(v, esperadoId)) return undefined;
    return this.clonar(v);
  }

  private lerStorage(esperadoId?: number): BlingOrcamento | undefined {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      const v = JSON.parse(raw) as BlingOrcamento;
      if (esperadoId != null && !this.idCompativel(v, esperadoId)) return undefined;
      return this.clonar(v);
    } catch {
      return undefined;
    }
  }
}
