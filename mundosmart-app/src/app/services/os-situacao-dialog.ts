import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { PRAZO_AGUARDANDO_PECA_DIAS_PADRAO } from '../config/os-situacao.config';

export type OsSituacaoDialogKind = 'cancelar' | 'concluir' | 'prazo';

export interface OsSituacaoDialogRequest {
  kind: OsSituacaoDialogKind;
  osLabel?: string | null;
  situacao?: string | null;
  /** Prefill do motivo (cancelamento). */
  motivoAtual?: string | null;
  /** Dias padrão sugeridos no prazo de peça. */
  prazoDiasPadrao?: number;
}

export type OsSituacaoDialogResult =
  | { kind: 'cancelar'; motivo: string }
  | { kind: 'concluir' }
  | { kind: 'prazo'; dataPrazoPeca: string }
  | null;

@Injectable({ providedIn: 'root' })
export class OsSituacaoDialogService {
  private readonly requestsSubject = new Subject<OsSituacaoDialogRequest>();
  private resolver?: (result: OsSituacaoDialogResult) => void;

  readonly requests$: Observable<OsSituacaoDialogRequest> = this.requestsSubject.asObservable();

  openCancelar(opts: {
    osLabel?: string | null;
    motivoAtual?: string | null;
  } = {}): Promise<string | null> {
    return this.open({
      kind: 'cancelar',
      osLabel: opts.osLabel,
      situacao: 'Cancelado',
      motivoAtual: opts.motivoAtual,
    }).then(r => (r?.kind === 'cancelar' ? r.motivo : null));
  }

  openConcluir(opts: { osLabel?: string | null } = {}): Promise<boolean> {
    return this.open({
      kind: 'concluir',
      osLabel: opts.osLabel,
      situacao: 'Concluído',
    }).then(r => r?.kind === 'concluir');
  }

  openPrazo(opts: {
    osLabel?: string | null;
    prazoDiasPadrao?: number;
  } = {}): Promise<string | null> {
    return this.open({
      kind: 'prazo',
      osLabel: opts.osLabel,
      situacao: 'Aguardando Peça',
      prazoDiasPadrao: opts.prazoDiasPadrao ?? PRAZO_AGUARDANDO_PECA_DIAS_PADRAO,
    }).then(r => (r?.kind === 'prazo' ? r.dataPrazoPeca : null));
  }

  open(request: OsSituacaoDialogRequest): Promise<OsSituacaoDialogResult> {
    if (this.resolver) {
      this.resolver(null);
      this.resolver = undefined;
    }

    return new Promise<OsSituacaoDialogResult>((resolve) => {
      this.resolver = resolve;
      this.requestsSubject.next(request);
    });
  }

  complete(result: OsSituacaoDialogResult): void {
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(result);
  }
}
