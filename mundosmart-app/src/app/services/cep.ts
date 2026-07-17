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
      map(r => {
        if (!r || r.erro === true || r.erro === 'true') return null;
        return {
          cep: formatarCep(r.cep || d),
          logradouro: (r.logradouro || '').trim(),
          bairro: (r.bairro || '').trim(),
          municipio: (r.localidade || '').trim(),
          uf: (r.uf || '').trim().toUpperCase(),
        };
      }),
      catchError(() => of(null)),
    );
  }
}
