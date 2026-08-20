import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastKind = 'erro' | 'aviso' | 'sucesso' | 'info';

export interface ToastItem {
  id: number;
  titulo: string;
  mensagem: string;
  kind: ToastKind;
  criadoEm: number;
  ttlMs: number;
}

const TTL_PADRAO_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class ToastAlertService {
  private readonly itensSubject = new BehaviorSubject<ToastItem[]>([]);
  private proximoId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly itens$: Observable<ToastItem[]> = this.itensSubject.asObservable();

  /** Alerta canto superior direito — some sozinho em 15s (ou ttlMs). */
  show(mensagem: string, opts?: {
    titulo?: string;
    kind?: ToastKind;
    ttlMs?: number;
  }): void {
    const texto = (mensagem ?? '').toString().trim();
    if (!texto) return;

    const kind = opts?.kind ?? 'erro';
    const ttlMs = opts?.ttlMs ?? TTL_PADRAO_MS;
    const item: ToastItem = {
      id: this.proximoId++,
      titulo: opts?.titulo?.trim() || this.tituloPadrao(kind),
      mensagem: texto,
      kind,
      criadoEm: Date.now(),
      ttlMs,
    };

    const atuais = this.itensSubject.value;
    // Evita spam da mesma mensagem
    if (atuais.some(t => t.mensagem === item.mensagem && t.kind === item.kind)) {
      return;
    }

    this.itensSubject.next([item, ...atuais].slice(0, 5));
    const timer = setTimeout(() => this.dismiss(item.id), ttlMs);
    this.timers.set(item.id, timer);
  }

  erro(mensagem: string, titulo = 'Atenção'): void {
    this.show(mensagem, { titulo, kind: 'erro' });
  }

  aviso(mensagem: string, titulo = 'Atenção'): void {
    this.show(mensagem, { titulo, kind: 'aviso' });
  }

  sucesso(mensagem: string, titulo = 'Pronto'): void {
    this.show(mensagem, { titulo, kind: 'sucesso' });
  }

  dismiss(id: number): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    this.itensSubject.next(this.itensSubject.value.filter(i => i.id !== id));
  }

  private tituloPadrao(kind: ToastKind): string {
    if (kind === 'aviso') return 'Atenção';
    if (kind === 'sucesso') return 'Pronto';
    if (kind === 'info') return 'Informação';
    return 'Atenção';
  }
}
