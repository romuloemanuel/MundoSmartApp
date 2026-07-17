import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface TecnicoSelectDialogRequest {
  tecnicos: Array<{ nome: string }>;
  tecnicoAtual?: string | null;
  situacao?: string | null;
  osLabel?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TecnicoSelectDialogService {
  private readonly requestsSubject = new Subject<TecnicoSelectDialogRequest>();
  private resolver?: (nome: string | null) => void;

  readonly requests$: Observable<TecnicoSelectDialogRequest> = this.requestsSubject.asObservable();

  /** Abre o modal e resolve com o nome escolhido, ou null se cancelar. */
  open(request: TecnicoSelectDialogRequest): Promise<string | null> {
    if (this.resolver) {
      this.resolver(null);
      this.resolver = undefined;
    }

    return new Promise<string | null>((resolve) => {
      this.resolver = resolve;
      this.requestsSubject.next(request);
    });
  }

  complete(nome: string | null): void {
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(nome);
  }
}
