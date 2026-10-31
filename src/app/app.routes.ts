import { Routes } from '@angular/router';
import { signInGuard, tomeGuard } from './cloud/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [signInGuard], loadComponent: () => import('./login/login-page').then((m) => m.LoginPage), title: 'Sign in · Congulatio' },
  { path: '', canActivate: [tomeGuard], loadComponent: () => import('./workbench/workbench').then((m) => m.Workbench), pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
