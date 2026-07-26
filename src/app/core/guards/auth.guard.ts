import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = async (_route, state) => {
  if (!environment.requireAuth) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.waitForAuthReady();

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
