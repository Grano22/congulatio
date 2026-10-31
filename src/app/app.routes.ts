import { Routes } from '@angular/router';
import { signInGuard, tomeGuard } from './cloud/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [signInGuard],
    loadComponent: () => import('./login/login-page').then((m) => m.LoginPage),
    title: 'Sign in · Congulatio',
    data: { robots: 'noindex, follow', description: 'Sign in to Congulatio to sync your RPG tome across devices. An account is optional.' },
  },
  {
    path: '',
    canActivate: [tomeGuard],
    loadComponent: () => import('./workbench/workbench').then((m) => m.Workbench),
    pathMatch: 'full',
    title: 'Congulatio — Character & Dialogue Forge for RPG Worlds',
  },
  { path: '**', redirectTo: '' },
];
