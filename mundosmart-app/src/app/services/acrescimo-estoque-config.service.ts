import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LOJAS_OS, normalizarLojaOs } from '../config/os-loja.config';

export interface AcrescimoEstoqueLoja {
  lojaCodigo: string;
  lojaNome: string;
  percentual: number;
}

export interface AcrescimoEstoqueConfig {
  lojas: AcrescimoEstoqueLoja[];
}

@Injectable({ providedIn: 'root' })
export class AcrescimoEstoqueConfigService {
  private mapa = new Map<string, number>();
  private carregado = false;

  constructor(private http: HttpClient) {}

  carregar(): Observable<AcrescimoEstoqueConfig> {
    return this.http.get<AcrescimoEstoqueConfig>(`${environment.apiUrl}/config/acrescimo-estoque`).pipe(
      tap(cfg => this.aplicar(cfg)),
      catchError(() => {
        this.aplicar({ lojas: LOJAS_OS.map(l => ({ lojaCodigo: l.codigo, lojaNome: l.nome, percentual: 0 })) });
        return of({ lojas: this.listarLojas() });
      }),
    );
  }

  salvar(config: AcrescimoEstoqueConfig): Observable<AcrescimoEstoqueConfig> {
    return this.http.put<AcrescimoEstoqueConfig>(`${environment.apiUrl}/config/acrescimo-estoque`, config).pipe(
      tap(cfg => this.aplicar(cfg)),
    );
  }

  listarLojas(): AcrescimoEstoqueLoja[] {
    return LOJAS_OS.map(l => ({
      lojaCodigo: l.codigo,
      lojaNome: l.nome,
      percentual: this.percentualDaLoja(l.codigo),
    }));
  }

  percentualDaLoja(lojaCodigo?: string | null): number {
    const cod = normalizarLojaOs(lojaCodigo);
    return this.mapa.get(cod) ?? 0;
  }

  /** Aplica o % configurado da loja sobre o valor sugerido do estoque. */
  aplicarNoSugerido(valor?: number | null, lojaCodigo?: string | null): number | undefined {
    if (valor == null || !Number.isFinite(Number(valor))) return undefined;
    const base = Number(valor);
    const pct = this.percentualDaLoja(lojaCodigo);
    if (pct <= 0) return Math.round(base * 100) / 100;
    return Math.round(base * (1 + pct / 100) * 100) / 100;
  }

  private aplicar(cfg: AcrescimoEstoqueConfig): void {
    this.mapa.clear();
    for (const l of cfg.lojas ?? []) {
      const cod = normalizarLojaOs(l.lojaCodigo);
      const pct = Number(l.percentual);
      this.mapa.set(cod, Number.isFinite(pct) && pct > 0 ? pct : 0);
    }
    this.carregado = true;
  }
}
