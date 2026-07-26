import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'SmartIrrigation · Entrar',
  },
  {
    path: 'cadastro',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/auth/cadastro/cadastro.component').then((m) => m.CadastroComponent),
    title: 'SmartIrrigation · Cadastro',
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'SmartIrrigation · Dashboard',
  },
  {
    path: 'historico',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/historical-charts/historical-charts.component').then(
        (m) => m.HistoricalChartsComponent,
      ),
    title: 'SmartIrrigation · Histórico',
  },
  {
    path: 'configuracoes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'SmartIrrigation · Configurações',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
