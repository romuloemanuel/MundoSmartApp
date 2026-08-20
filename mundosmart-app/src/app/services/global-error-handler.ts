import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { ErrorAlertService } from './error-alert.service';

/**
 * Captura exceções não tratadas e mostra o alerta modal global.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly zone = inject(NgZone);
  private readonly alerts = inject(ErrorAlertService);
  private ultimoEm = 0;
  private ultimaMsg = '';

  handleError(error: unknown): void {
    // Mantém o log no console para debug.
    console.error(error);

    const msg = this.mensagem(error);
    const agora = Date.now();
    // Evita rajada do mesmo erro (ex.: CD loop).
    if (msg === this.ultimaMsg && agora - this.ultimoEm < 2500) return;
    this.ultimaMsg = msg;
    this.ultimoEm = agora;

    this.zone.run(() => {
      this.alerts.show(msg, {
        titulo: 'Erro inesperado',
        kind: 'erro',
        detalhe: 'Detalhes técnicos foram registrados no console.',
      });
    });
  }

  private mensagem(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      // Mensagens técnicas demais → texto amigável
      const m = error.message.trim();
      if (m.includes('NG0') || m.includes('ExpressionChanged') || m.length > 220) {
        return 'Ocorreu um erro inesperado na tela. Se o problema continuar, recarregue a página.';
      }
      return m;
    }
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}
