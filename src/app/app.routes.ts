import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './cloud/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./login/login-page').then((m) => m.LoginPage), title: 'Enter · Congulatio' },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./workbench/workbench').then((m) => m.Workbench), pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
