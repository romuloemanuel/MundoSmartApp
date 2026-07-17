import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUsuario } from './app-auth';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly api = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  listar(): Observable<AppUsuario[]> {
    return this.http.get<AppUsuario[]>(this.api);
  }

  criar(body: {
    usuario: string;
    nome: string;
    senha: string;
    role: string;
    tecnicoId?: string | null;
    lojaOrigem?: string | null;
    ativo?: boolean;
  }): Observable<AppUsuario> {
    return this.http.post<AppUsuario>(this.api, body);
  }

  atualizar(id: string, body: {
    nome: string;
    role: string;
    tecnicoId?: string | null;
    lojaOrigem?: string | null;
    ativo: boolean;
  }): Observable<AppUsuario> {
    return this.http.put<AppUsuario>(`${this.api}/${id}`, body);
  }

  resetSenha(id: string, senhaNova: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.api}/${id}/reset-senha`, { senhaNova });
  }

  excluir(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.api}/${id}`);
  }
}
