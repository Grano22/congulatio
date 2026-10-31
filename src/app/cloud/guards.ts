import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';
import { TomeHistory } from '../store/tomeHistory';

export const tomeGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const history = inject(TomeHistory);
  await session.whenReady();
  await history.open(session.user().uid, session.takeLocalTome());
  return true;
};

export const signInGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.whenReady();
  return session.cloud() ? router.createUrlTree(['/']) : true;
};
