import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tecnico {
  id?: string;
  nome: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

@Injectable({ providedIn: 'root' })
export class TecnicosService {
  private readonly apiUrl = `${environment.apiUrl}/tecnicos`;

  constructor(private http: HttpClient) {}

  listar(apenasAtivos?: boolean): Observable<Tecnico[]> {
    let params = new HttpParams();
    if (apenasAtivos === true) params = params.set('ativos', 'true');
    return this.http.get<Tecnico[]>(this.apiUrl, { params });
  }

  criar(nome: string): Observable<Tecnico> {
    return this.http.post<Tecnico>(this.apiUrl, { nome, ativo: true });
  }

  atualizar(id: string, nome: string, ativo: boolean): Observable<Tecnico> {
    return this.http.put<Tecnico>(`${this.apiUrl}/${id}`, { nome, ativo });
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
