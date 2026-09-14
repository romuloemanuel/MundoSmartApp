import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DocumentoTipo = 'contrato' | 'aviso' | 'termo';

export interface DocumentoVariavelTipo {
  id: string;
  rotulo: string;
}

export interface DocumentoVariavel {
  chave: string;
  rotulo: string;
  tipo: string;
  obrigatoria: boolean;
  oculta?: boolean;
  ordem: number;
}

export interface DocumentoVariavelCatalogo {
  id?: string;
  chave: string;
  rotulo: string;
  tipo: string;
  ordem: number;
}

export interface DocumentoModelo {
  id?: string;
  codigo?: string;
  tipo: DocumentoTipo;
  titulo: string;
  corpo: string;
  ativo: boolean;
  imprimirDuasVias?: boolean;
  ordem: number;
  variaveis: DocumentoVariavel[];
}

export const DOCUMENTO_TIPOS: { id: DocumentoTipo; rotulo: string }[] = [
  { id: 'contrato', rotulo: 'Contrato' },
  { id: 'aviso', rotulo: 'Aviso' },
  { id: 'termo', rotulo: 'Termo de conscientização' },
];

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly api = `${environment.apiUrl}/documentos`;

  constructor(private http: HttpClient) {}

  tiposVariavel(): Observable<DocumentoVariavelTipo[]> {
    return this.http.get<DocumentoVariavelTipo[]>(`${this.api}/tipos-variavel`);
  }

  listarCatalogo(): Observable<DocumentoVariavelCatalogo[]> {
    return this.http.get<DocumentoVariavelCatalogo[]>(`${this.api}/variaveis`);
  }

  criarCatalogo(body: Omit<DocumentoVariavelCatalogo, 'id'>): Observable<DocumentoVariavelCatalogo> {
    return this.http.post<DocumentoVariavelCatalogo>(`${this.api}/variaveis`, body);
  }

  atualizarCatalogo(id: string, body: Omit<DocumentoVariavelCatalogo, 'id'>): Observable<DocumentoVariavelCatalogo> {
    return this.http.put<DocumentoVariavelCatalogo>(`${this.api}/variaveis/${id}`, body);
  }

  excluirCatalogo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/variaveis/${id}`);
  }

  listarModelos(somenteAtivos = false): Observable<DocumentoModelo[]> {
    const params = new HttpParams().set('ativos', somenteAtivos ? 'true' : 'false');
    return this.http.get<DocumentoModelo[]>(`${this.api}/modelos`, { params });
  }

  obterModelo(id: string): Observable<DocumentoModelo> {
    return this.http.get<DocumentoModelo>(`${this.api}/modelos/${id}`);
  }

  criarModelo(body: DocumentoModelo): Observable<DocumentoModelo> {
    return this.http.post<DocumentoModelo>(`${this.api}/modelos`, body);
  }

  atualizarModelo(id: string, body: DocumentoModelo): Observable<DocumentoModelo> {
    return this.http.put<DocumentoModelo>(`${this.api}/modelos/${id}`, body);
  }

  excluirModelo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/modelos/${id}`);
  }
}
