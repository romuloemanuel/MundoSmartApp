import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AppAuthService } from '../services/app-auth';

export const authGuard: CanActivateFn = (_route, state) => {
  if (!environment.authEnabled) return true;
  const auth = inject(AppAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Apenas Admin/Root. Operador não acessa comissões, histórico geral, usuários, etc. */
export const adminGuard: CanActivateFn = (_route, state) => {
  if (!environment.authEnabled) return true;
  const auth = inject(AppAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/ordens-servico']);
};

/** Apenas o perfil Root. */
export const rootGuard: CanActivateFn = (_route, state) => {
  if (!environment.authEnabled) return true;
  const auth = inject(AppAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.isRoot()) return true;
  return router.createUrlTree(['/ordens-servico']);
};

export const guestGuard: CanActivateFn = () => {
  if (!environment.authEnabled) {
    const router = inject(Router);
    return router.createUrlTree(['/ordens-servico']);
  }
  const auth = inject(AppAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/ordens-servico']);
};
