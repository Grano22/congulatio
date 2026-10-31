import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkStore {
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine !== false);
  readonly since = signal<string | null>(null);

  constructor() {
    const update = (): void => {
      const online = navigator.onLine !== false;
      if (online === this.online()) return;
      this.online.set(online);
      this.since.set(new Date().toISOString());
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}
