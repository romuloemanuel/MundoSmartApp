import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BlingConfigAdmin {
  clientId: string;
  clientSecretConfigurado: boolean;
  redirectUri: string;
  consultaProdutosHabilitada: boolean;
  consultaProdutosSyncMinutos: number;
  idCampoPermitePersonalizacao: number;
  modoLocal: boolean;
  habilitado: boolean;
  tokenConectado: boolean;
  tokenExpiraEm?: string | null;
  temOverrideMongo: boolean;
  atualizadoEm?: string | null;
}

export interface BlingConfigAdminSalvar {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  consultaProdutosHabilitada: boolean;
  consultaProdutosSyncMinutos: number;
  idCampoPermitePersonalizacao: number;
}

@Injectable({ providedIn: 'root' })
export class BlingConfigService {
  private readonly apiUrl = `${environment.apiUrl}/config/bling`;

  constructor(private http: HttpClient) {}

  carregar(): Observable<BlingConfigAdmin> {
    return this.http.get<BlingConfigAdmin>(this.apiUrl);
  }

  salvar(dto: BlingConfigAdminSalvar): Observable<BlingConfigAdmin> {
    return this.http.put<BlingConfigAdmin>(this.apiUrl, dto);
  }
}
