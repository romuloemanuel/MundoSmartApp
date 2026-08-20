import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastAlertService } from './toast-alert.service';

export type ErrorAlertKind = 'erro' | 'aviso' | 'info';

export interface ErrorAlertPayload {
  titulo: string;
  mensagem: string;
  kind: ErrorAlertKind;
  detalhe?: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorAlertService {
  private readonly toasts = inject(ToastAlertService);
  private readonly abertoSubject = new BehaviorSubject<ErrorAlertPayload | null>(null);
  private readonly fila: ErrorAlertPayload[] = [];

  readonly aberto$: Observable<ErrorAlertPayload | null> = this.abertoSubject.asObservable();

  get atual(): ErrorAlertPayload | null {
    return this.abertoSubject.value;
  }

  /** Modal central (erro de sistema / falha grave). */
  show(mensagem: string, opts?: {
    titulo?: string;
    kind?: ErrorAlertKind;
    detalhe?: string;
  }): void {
    const texto = (mensagem ?? '').toString().trim();
    if (!texto) return;

    const payload: ErrorAlertPayload = {
      titulo: opts?.titulo?.trim() || this.tituloPadrao(opts?.kind ?? 'erro'),
      mensagem: texto,
      kind: opts?.kind ?? 'erro',
      detalhe: opts?.detalhe?.trim() || undefined,
    };

    if (this.abertoSubject.value) {
      const ultimo = this.fila[this.fila.length - 1] ?? this.abertoSubject.value;
      if (ultimo.mensagem === payload.mensagem && ultimo.titulo === payload.titulo) return;
      this.fila.push(payload);
      return;
    }

    this.abertoSubject.next(payload);
  }

  showHttp(err: unknown, fallback = 'Ocorreu um erro inesperado. Tente novamente.'): void {
    const msg = extrairMensagemErroHttp(err, fallback);
    const status = err instanceof HttpErrorResponse ? err.status : undefined;
    const detalhe = status != null && status > 0 ? `Código HTTP ${status}` : undefined;
    this.show(msg, { titulo: 'Não foi possível concluir', kind: 'erro', detalhe });
  }

  showAviso(mensagem: string, titulo = 'Atenção'): void {
    this.show(mensagem, { titulo, kind: 'aviso' });
  }

  /**
   * Erro de processo do usuário (validação / campo faltando).
   * Toast no canto superior direito — some em 15s.
   */
  toastUsuario(mensagem: string, titulo = 'Atenção'): void {
    this.toasts.erro(mensagem, titulo);
  }

  fechar(): void {
    const proximo = this.fila.shift() ?? null;
    this.abertoSubject.next(proximo);
  }

  private tituloPadrao(kind: ErrorAlertKind): string {
    if (kind === 'aviso') return 'Atenção';
    if (kind === 'info') return 'Informação';
    return 'Algo deu errado';
  }
}

export function extrairMensagemErroHttp(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua rede e se a API está no ar.';
    }
    const body = err.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      if (typeof o['erro'] === 'string' && o['erro'].trim()) return o['erro'].trim();
      if (typeof o['message'] === 'string' && o['message'].trim()) return o['message'].trim();
      if (typeof o['title'] === 'string' && o['title'].trim()) return o['title'].trim();
    }
    if (err.statusText?.trim()) return `${err.status} — ${err.statusText}`;
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}
