import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const adminGuard: CanActivateFn = async () => {
  if (!environment.requireAuth) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.waitForAuthReady();
  await auth.waitForProfileReady();

  if (auth.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
