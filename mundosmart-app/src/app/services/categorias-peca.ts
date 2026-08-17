import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, shareReplay, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { aplicarCategoriasPecaCadastro, nomesCategoriasPeca } from '../config/peca-categoria.config';

export interface CategoriaPecaCadastro {
  id?: string;
  nome: string;
  ordem: number;
  usaCoresPorModelo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriasPecaService {
  private readonly apiUrl = `${environment.apiUrl}/categorias-peca`;
  private cache$?: Observable<CategoriaPecaCadastro[]>;

  constructor(private http: HttpClient) {}

  listar(forcar = false): Observable<CategoriaPecaCadastro[]> {
    if (forcar) this.cache$ = undefined;
    this.cache$ ??= this.http.get<CategoriaPecaCadastro[]>(this.apiUrl).pipe(
      tap(lista => aplicarCategoriasPecaCadastro(lista)),
      catchError(() => of([])),
      shareReplay(1),
    );
    return this.cache$;
  }

  nomes(forcar = false): Observable<string[]> {
    return this.listar(forcar).pipe(
      map(lista => {
        const nomes = lista.map(c => c.nome);
        return nomes.length ? nomes : nomesCategoriasPeca();
      }),
    );
  }

  criar(body: { nome: string; usaCoresPorModelo: boolean; ordem?: number }): Observable<CategoriaPecaCadastro> {
    return this.http.post<CategoriaPecaCadastro>(this.apiUrl, body).pipe(
      tap(() => { this.cache$ = undefined; }),
    );
  }

  atualizar(
    id: string,
    body: { nome: string; usaCoresPorModelo: boolean; ordem: number },
  ): Observable<CategoriaPecaCadastro> {
    return this.http.put<CategoriaPecaCadastro>(`${this.apiUrl}/${id}`, body).pipe(
      tap(() => { this.cache$ = undefined; }),
    );
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => { this.cache$ = undefined; }),
    );
  }
}
