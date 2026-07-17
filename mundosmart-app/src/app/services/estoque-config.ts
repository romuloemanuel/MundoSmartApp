import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { aplicarConfigEstoque, EstoqueLimites, getEstoqueConfig } from '../config/estoque.config';

@Injectable({ providedIn: 'root' })
export class EstoqueConfigService {
  constructor(private http: HttpClient) {}

  carregar(): Observable<void> {
    return this.http.get<{ limiteLaranja: number; limiteAmarelo: number }>(
      `${environment.apiUrl}/config/estoque`,
    ).pipe(
      timeout(8_000),
      tap(cfg => aplicarConfigEstoque({
        limiteLaranja: cfg.limiteLaranja,
        limiteAmarelo: cfg.limiteAmarelo,
      })),
      map(() => void 0),
      catchError(() => {
        aplicarConfigEstoque(environment.estoque);
        return of(void 0);
      }),
    );
  }

  limitesAtuais(): EstoqueLimites {
    return { ...getEstoqueConfig() };
  }
}
