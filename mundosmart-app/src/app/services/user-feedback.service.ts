import { Injectable, inject } from '@angular/core';
import { ToastAlertService } from './toast-alert.service';
import { ErrorAlertService } from './error-alert.service';

/**
 * Canal único de feedback ao usuário no app.
 * - erroUsuario / aviso → toast canto superior direito (15s)
 * - erroSistema → modal central
 */
@Injectable({ providedIn: 'root' })
export class UserFeedbackService {
  private readonly toasts = inject(ToastAlertService);
  private readonly modal = inject(ErrorAlertService);

  /** Validação / regra de negócio / processo do usuário. */
  erroUsuario(mensagem: string, titulo = 'Atenção'): void {
    const msg = (mensagem ?? '').toString().trim();
    if (!msg) return;
    this.toasts.erro(msg, titulo);
  }

  aviso(mensagem: string, titulo = 'Atenção'): void {
    const msg = (mensagem ?? '').toString().trim();
    if (!msg) return;
    this.toasts.aviso(msg, titulo);
  }

  sucesso(mensagem: string, titulo = 'Pronto'): void {
    const msg = (mensagem ?? '').toString().trim();
    if (!msg) return;
    this.toasts.sucesso(msg, titulo);
  }

  /** Falha grave / sistema — modal no centro. */
  erroSistema(mensagem: string, opts?: { titulo?: string; detalhe?: string }): void {
    this.modal.show(mensagem, {
      titulo: opts?.titulo,
      kind: 'erro',
      detalhe: opts?.detalhe,
    });
  }
}

let feedbackRef: UserFeedbackService | null = null;

/** Chamado na raiz do app — habilita helpers sem inject em cada arquivo. */
export function bindUserFeedback(service: UserFeedbackService): void {
  feedbackRef = service;
}

/** Validação / regra de negócio — toast 15s (canto superior direito). */
export function avisarErroUsuario(mensagem: string, titulo = 'Atenção'): void {
  const msg = (mensagem ?? '').toString().trim();
  if (!msg) return;
  if (feedbackRef) {
    feedbackRef.erroUsuario(msg, titulo);
    return;
  }
  // Fallback raro (antes do bootstrap): console para não engolir o erro
  console.warn('[feedback]', msg);
}

export function avisarAvisoUsuario(mensagem: string, titulo = 'Atenção'): void {
  const msg = (mensagem ?? '').toString().trim();
  if (!msg) return;
  feedbackRef?.aviso(msg, titulo);
}

export function avisarSucessoUsuario(mensagem: string, titulo = 'Pronto'): void {
  const msg = (mensagem ?? '').toString().trim();
  if (!msg) return;
  feedbackRef?.sucesso(msg, titulo);
}

export function avisarErroSistema(mensagem: string, opts?: { titulo?: string; detalhe?: string }): void {
  const msg = (mensagem ?? '').toString().trim();
  if (!msg) return;
  if (feedbackRef) {
    feedbackRef.erroSistema(msg, opts);
    return;
  }
  console.error('[feedback-sistema]', msg);
}
