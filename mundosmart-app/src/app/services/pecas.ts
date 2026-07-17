import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PecaEstoque, DisponibilidadePecaResponse } from '../models/bling.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PecasService {
  private readonly apiUrl = `${environment.apiUrl}/pecas`;

  constructor(private http: HttpClient) {}

  buscar(termo?: string): Observable<PecaEstoque[]> {
    const params = termo ? new HttpParams().set('termo', termo) : undefined;
    return this.http.get<PecaEstoque[]>(this.apiUrl, { params });
  }

  obter(id: string): Observable<PecaEstoque> {
    return this.http.get<PecaEstoque>(`${this.apiUrl}/${id}`);
  }

  salvar(peca: PecaEstoque): Observable<PecaEstoque> {
    return this.http.post<PecaEstoque>(this.apiUrl, peca);
  }

  consultarDisponibilidade(modeloId: string, pecaId?: string): Observable<DisponibilidadePecaResponse[]> {
    let params = new HttpParams().set('modeloId', modeloId);
    if (pecaId) params = params.set('pecaId', pecaId);
    return this.http.get<DisponibilidadePecaResponse[]>(`${this.apiUrl}/disponibilidade`, { params });
  }
}
