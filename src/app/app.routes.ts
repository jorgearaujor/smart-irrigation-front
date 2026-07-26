import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'SmartIrrigation · Dashboard',
  },
  {
    path: 'historico',
    loadComponent: () =>
      import('./features/historical-charts/historical-charts.component').then(
        (m) => m.HistoricalChartsComponent,
      ),
    title: 'SmartIrrigation · Histórico',
  },
  {
    path: 'configuracoes',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'SmartIrrigation · Configurações',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
