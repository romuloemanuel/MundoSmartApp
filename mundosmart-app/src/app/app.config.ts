import { ApplicationConfig, APP_INITIALIZER, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { apiLogInterceptor } from './interceptors/api-log.interceptor';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorAlertInterceptor } from './interceptors/error-alert.interceptor';
import { EstoqueConfigService } from './services/estoque-config';
import { OsImpressaoConfigService } from './services/os-impressao-config.service';
import { AcrescimoEstoqueConfigService } from './services/acrescimo-estoque-config.service';
import { AppAuthService } from './services/app-auth';
import { GlobalErrorHandler } from './services/global-error-handler';
import { provideBlingAuthInitializer } from './services/bling-auth';

function initSessaoTransferida(auth: AppAuthService) {
  return () => firstValueFrom(auth.inicializarSessaoDaUrl());
}

function initEstoqueConfig(svc: EstoqueConfigService) {
  return () => firstValueFrom(svc.carregar());
}

function initImpressaoOsConfig(svc: OsImpressaoConfigService) {
  return () => firstValueFrom(svc.carregar());
}

function initAcrescimoEstoqueConfig(svc: AcrescimoEstoqueConfigService) {
  return () => firstValueFrom(svc.carregar());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorAlertInterceptor, apiLogInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initSessaoTransferida,
      deps: [AppAuthService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initEstoqueConfig,
      deps: [EstoqueConfigService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initImpressaoOsConfig,
      deps: [OsImpressaoConfigService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initAcrescimoEstoqueConfig,
      deps: [AcrescimoEstoqueConfigService],
      multi: true,
    },
    provideBlingAuthInitializer(),
  ]
};
