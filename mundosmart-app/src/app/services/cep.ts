import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { apenasDigitos, formatarCep } from '../utils/contato-validacao';

export interface EnderecoPorCep {
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  complemento?: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

@Injectable({ providedIn: 'root' })
export class CepService {
  constructor(private http: HttpClient) {}

  consultar(cep: string): Observable<EnderecoPorCep | null> {
    const d = apenasDigitos(cep);
    if (d.length !== 8) return of(null);

    return this.http.get<ViaCepResponse>(`https://viacep.com.br/ws/${d}/json/`).pipe(
      map(r => this.mapear(r, d)),
      catchError(() => of(null)),
    );
  }

  /** Busca CEPs pelo logradouro (UF + cidade + rua, mínimo 3 letras). */
  buscarPorLogradouro(uf: string, cidade: string, logradouro: string): Observable<EnderecoPorCep[]> {
    const u = (uf ?? '').trim().toUpperCase();
    const c = (cidade ?? '').trim();
    const l = (logradouro ?? '').trim();
    if (u.length !== 2 || c.length < 2 || l.length < 3) return of([]);

    const url =
      `https://viacep.com.br/ws/${encodeURIComponent(u)}/${encodeURIComponent(c)}/${encodeURIComponent(l)}/json/`;
    return this.http.get<ViaCepResponse[] | ViaCepResponse>(url).pipe(
      map(r => {
        const lista = Array.isArray(r) ? r : r ? [r] : [];
        return lista
          .map(item => this.mapear(item, ''))
          .filter((x): x is EnderecoPorCep => !!x);
      }),
      catchError(() => of([])),
    );
  }

  private mapear(r: ViaCepResponse | null | undefined, cepFallback: string): EnderecoPorCep | null {
    if (!r || r.erro === true || r.erro === 'true') return null;
    const cep = apenasDigitos(r.cep || cepFallback);
    if (cep.length !== 8 && !(r.logradouro || r.localidade)) return null;
    return {
      cep: formatarCep(r.cep || cep),
      logradouro: (r.logradouro || '').trim(),
      bairro: (r.bairro || '').trim(),
      municipio: (r.localidade || '').trim(),
      uf: (r.uf || '').trim().toUpperCase(),
      complemento: (r.complemento || '').trim() || undefined,
    };
  }
}
