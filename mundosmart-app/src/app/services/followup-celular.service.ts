import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type InteresseCelular = 'troca' | 'compra' | 'compra_boleto';
export type SituacaoFollowUpCelular = 'Em aberto' | 'Convertido' | 'Não realizado' | 'Desistência';

export interface FollowUpCelularContato {
  data: string;
  anotacao: string;
  responsavel?: string;
  criadoEm?: string;
}

export interface FollowUpCelular {
  id: string;
  numero: number;
  clienteNome: string;
  telefone: string;
  interesse: InteresseCelular;
  aparelhoDesejado?: string;
  aparelhoCliente?: string;
  valorEstimado?: number;
  observacao?: string;
  responsavel?: string;
  situacao: SituacaoFollowUpCelular | string;
  dataFollowUp?: string;
  vezesContato: number;
  followUps?: FollowUpCelularContato[];
  motivoDesistencia?: string;
  observacaoConversao?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface SalvarFollowUpCelular {
  clienteNome: string;
  telefone: string;
  interesse: InteresseCelular;
  aparelhoDesejado?: string;
  aparelhoCliente?: string;
  valorEstimado?: number | null;
  observacao?: string;
  responsavel?: string;
  dataFollowUp?: string;
}

@Injectable({ providedIn: 'root' })
export class FollowUpCelularService {
  private readonly apiUrl = `${environment.apiUrl}/follow-ups-celulares`;

  constructor(private http: HttpClient) {}

  listar(): Observable<FollowUpCelular[]> {
    return this.http.get<FollowUpCelular[]>(this.apiUrl);
  }

  criar(body: SalvarFollowUpCelular): Observable<FollowUpCelular> {
    return this.http.post<FollowUpCelular>(this.apiUrl, body);
  }

  atualizar(id: string, body: SalvarFollowUpCelular): Observable<FollowUpCelular> {
    return this.http.put<FollowUpCelular>(`${this.apiUrl}/${id}`, body);
  }

  registrarFollowUp(
    id: string,
    body: { anotacao: string; responsavel?: string; dataFollowUpProxima?: string },
  ): Observable<FollowUpCelular> {
    return this.http.post<FollowUpCelular>(`${this.apiUrl}/${id}/follow-ups`, body);
  }

  registrarDesistencia(id: string, motivo: string): Observable<FollowUpCelular> {
    return this.http.post<FollowUpCelular>(`${this.apiUrl}/${id}/desistencia`, { motivo });
  }

  converter(id: string, observacao?: string): Observable<FollowUpCelular> {
    return this.http.post<FollowUpCelular>(`${this.apiUrl}/${id}/converter`, { observacao });
  }
}
