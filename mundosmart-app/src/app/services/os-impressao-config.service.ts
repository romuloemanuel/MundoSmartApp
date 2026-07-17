import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';

import { catchError, map, tap, timeout } from 'rxjs/operators';

import { environment } from '../../environments/environment';

import {

  ImpressaoOsConfig,

  aplicarConfigImpressaoOs,

  getConfigImpressaoOs,

  getEmpresaImpressaoConfig,

  getTextosImpressaoOs,

  IMPRESSAO_OS_CONFIG_PADRAO,

  ImpressaoOsTextos,

} from '../config/os-impressao-textos.config';



@Injectable({ providedIn: 'root' })

export class OsImpressaoConfigService {

  constructor(private http: HttpClient) {}



  carregar(): Observable<void> {

    return this.http.get<ImpressaoOsConfig>(`${environment.apiUrl}/config/impressao-os`).pipe(

      timeout(8_000),

      tap(cfg => aplicarConfigImpressaoOs(cfg)),

      map(() => void 0),

      catchError(() => {

        aplicarConfigImpressaoOs(IMPRESSAO_OS_CONFIG_PADRAO);

        return of(void 0);

      }),

    );

  }



  configAtual(): ImpressaoOsConfig {

    return getConfigImpressaoOs();

  }



  textosAtuais(): ImpressaoOsTextos {

    return getTextosImpressaoOs();

  }



  empresaAtual() {

    return getEmpresaImpressaoConfig();

  }



  salvar(config: ImpressaoOsConfig): Observable<ImpressaoOsConfig> {

    return this.http.put<ImpressaoOsConfig>(`${environment.apiUrl}/config/impressao-os`, {

      avisoPreOrcamento: config.avisoPreOrcamento,

      termosCondicoes: config.termosCondicoes,

      nomeEmpresa: config.nomeEmpresa,

      enderecoEmpresa: config.enderecoEmpresa,

      telefoneEmpresa: config.telefoneEmpresa,

      cnpjEmpresa: config.cnpjEmpresa,

      diasGarantiaPadrao: config.diasGarantiaPadrao,

      textoGarantiaTermica: config.textoGarantiaTermica,

    }).pipe(

      tap(cfg => aplicarConfigImpressaoOs(cfg)),

      map(cfg => ({ ...cfg })),

    );

  }

}

