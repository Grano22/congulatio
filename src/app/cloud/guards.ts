import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';
import { TomeHistory } from '../store/tomeHistory';

export const authGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const history = inject(TomeHistory);
  const router = inject(Router);
  await session.whenReady();
  const user = session.user();
  if (!user) return router.createUrlTree(['/login']);
  await history.open(user.uid);
  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.whenReady();
  return session.user() ? router.createUrlTree(['/']) : true;
};
