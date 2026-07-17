import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { BlingContato } from '../models/bling.models';
import { environment } from '../../environments/environment';
import { normalizarContatoParaSalvar, apenasDigitos, validarCpfCnpj } from '../utils/contato-validacao';
import { ClienteDuplicadoVerificacao, ContatoAltSugestao } from '../utils/cliente-duplicata';

@Injectable({
  providedIn: 'root',
})
export class ClientesService {
  private readonly apiUrl = `${environment.apiUrl}/clientes`;
  private readonly listaCache = new Map<string, { ts: number; data: BlingContato[] }>();
  private readonly cacheTtlMs = 8_000;

  constructor(private http: HttpClient) {}

  listar(nome?: string): Observable<BlingContato[]> {
    const key = this.normalizarChaveCache(nome);
    const hit = this.listaCache.get(key);
    if (hit && Date.now() - hit.ts < this.cacheTtlMs) {
      return of(hit.data);
    }

    const params = nome?.trim() ? new HttpParams().set('nome', nome.trim()) : undefined;
    return this.http.get<BlingContato[]>(this.apiUrl, { params }).pipe(
      tap(data => this.listaCache.set(key, { ts: Date.now(), data })),
    );
  }

  obter(id: number): Observable<BlingContato> {
    return this.http.get<BlingContato>(`${this.apiUrl}/${id}`);
  }

  verificarCpf(cpfCnpj: string, excluirId?: number): Observable<ClienteDuplicadoVerificacao> {
    let params = new HttpParams().set('cpfCnpj', cpfCnpj);
    if (excluirId !== undefined) params = params.set('excluirId', excluirId);
    return this.http.get<ClienteDuplicadoVerificacao>(`${this.apiUrl}/verificar-cpf`, { params });
  }

  verificarTelefone(telefone: string, excluirId?: number): Observable<ClienteDuplicadoVerificacao> {
    let params = new HttpParams().set('telefone', telefone);
    if (excluirId !== undefined) params = params.set('excluirId', excluirId);
    return this.http.get<ClienteDuplicadoVerificacao>(`${this.apiUrl}/verificar-telefone`, { params });
  }

  /** Nome sugerido para contato alternativo — não bloqueia o cadastro. */
  sugerirContatoAlt(telefone: string): Observable<ContatoAltSugestao> {
    const params = new HttpParams().set('telefone', telefone);
    return this.http.get<ContatoAltSugestao>(`${this.apiUrl}/sugerir-contato-alt`, { params });
  }

  criar(contato: BlingContato): Observable<BlingContato> {
    return this.http.post<BlingContato>(this.apiUrl, normalizarContatoParaSalvar(contato)).pipe(
      tap(() => this.limparCacheLista()),
    );
  }

  atualizar(id: number, contato: BlingContato): Observable<BlingContato> {
    return this.http.put<BlingContato>(`${this.apiUrl}/${id}`, normalizarContatoParaSalvar(contato)).pipe(
      tap(() => this.limparCacheLista()),
    );
  }

  private limparCacheLista(): void {
    this.listaCache.clear();
  }

  /** Mesma busca com/sem máscara compartilha cache (CPF, telefone). */
  private normalizarChaveCache(nome?: string): string {
    const t = (nome ?? '').trim().toLowerCase();
    const digitos = t.replace(/\D/g, '');
    if (digitos.length >= 3 && digitos.length >= t.length * 0.55) {
      return `#${digitos}`;
    }
    return t;
  }
}
