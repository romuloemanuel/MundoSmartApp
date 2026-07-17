import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OsFotoAparelho, OsIntakeSessao, OsIntakeToken } from '../models/bling.models';
import { environment } from '../../environments/environment';
import { obterUrlAppIntake } from '../config/intake-app-url.config';

@Injectable({ providedIn: 'root' })
export class OsIntakeService {
  private readonly intakeUrl = '/api/intake';

  constructor(private http: HttpClient) {}

  gerarToken(osId: number): Observable<OsIntakeToken> {
    const urlApp = obterUrlAppIntake();
    return this.http.post<OsIntakeToken>(
      `${environment.apiUrl}/ordens-servico/${osId}/intake/token`,
      null,
      { params: urlApp ? { appUrl: urlApp } : {} },
    );
  }

  enviarFoto(
    token: string,
    arquivo: File,
    categoria?: string,
    descricaoFoco?: string,
  ): Observable<OsFotoAparelho> {
    const form = new FormData();
    // Nome explícito melhora o bind IFormFile no ASP.NET (celulares mandam nome vazio).
    const nome = arquivo.name?.trim() || `foto-${Date.now()}.jpg`;
    form.append('arquivo', arquivo, nome);
    if (categoria?.trim()) form.append('categoria', categoria.trim());
    if (descricaoFoco?.trim()) form.append('descricaoFoco', descricaoFoco.trim());
    return this.http.post<OsFotoAparelho>(`${this.intakeUrl}/${token}/fotos`, form);
  }

  enviarFotoOs(
    osId: number,
    arquivo: File,
    categoria?: string,
    descricaoFoco?: string,
  ): Observable<OsFotoAparelho> {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name || 'foto.jpg');
    if (categoria?.trim()) form.append('categoria', categoria.trim());
    if (descricaoFoco?.trim()) form.append('descricaoFoco', descricaoFoco.trim());
    return this.http.post<OsFotoAparelho>(
      `${environment.apiUrl}/ordens-servico/${osId}/fotos`,
      form,
    );
  }

  removerFotoOs(osId: number, fotoId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/ordens-servico/${osId}/fotos/${fotoId}`,
    );
  }

  atualizarCategoriaFotoOs(
    osId: number,
    fotoId: string,
    categoria: string,
    descricaoFoco?: string,
  ): Observable<OsFotoAparelho> {
    return this.http.patch<OsFotoAparelho>(
      `${environment.apiUrl}/ordens-servico/${osId}/fotos/${fotoId}`,
      { categoria, descricaoFoco: descricaoFoco ?? null },
    );
  }

  removerFoto(token: string, fotoId: string): Observable<void> {
    return this.http.delete<void>(`${this.intakeUrl}/${token}/fotos/${fotoId}`);
  }

  obterSessao(token: string): Observable<OsIntakeSessao> {
    return this.http.get<OsIntakeSessao>(`${this.intakeUrl}/${token}`);
  }

  salvarSenha(token: string, tipo: 'numerica' | 'desenho', valor: string): Observable<OsIntakeSessao> {
    return this.http.put<OsIntakeSessao>(`${this.intakeUrl}/${token}/senha`, { tipo, valor });
  }
}

export function urlArquivoOs(caminho?: string): string {
  if (!caminho) return '';
  if (caminho.startsWith('http')) return caminho;
  const path = caminho.startsWith('/') ? caminho : `/${caminho}`;
  if (environment.filesUrl) return `${environment.filesUrl}${path}`;
  return path;
}
