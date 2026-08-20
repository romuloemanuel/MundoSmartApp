import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ErrorAlertService, extrairMensagemErroHttp } from '../services/error-alert.service';
import { bindUserFeedback, UserFeedbackService } from '../services/user-feedback.service';

/** Marque a request com este contexto para não abrir o alerta global. */
export const SKIP_GLOBAL_ERROR_ALERT = new HttpContextToken(() => false);

/**
 * - 400/422: toast (erro de processo / validação)
 * - demais (rede, 5xx…): modal central
 * - 401: ignorado (auth)
 */
export const errorAlertInterceptor: HttpInterceptorFn = (req, next) => {
  const alerts = inject(ErrorAlertService);
  const feedback = inject(UserFeedbackService);
  bindUserFeedback(feedback);

  return next(req).pipe(
    tap({
      error: (err: unknown) => {
        if (req.context.get(SKIP_GLOBAL_ERROR_ALERT)) return;
        if (!(err instanceof HttpErrorResponse)) return;
        if (err.status === 401) return;

        const msg = extrairMensagemErroHttp(err, 'Ocorreu um erro. Tente novamente.');
        if (err.status === 400 || err.status === 422) {
          feedback.erroUsuario(msg);
          return;
        }
        alerts.showHttp(err);
      },
    }),
  );
};
