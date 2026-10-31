import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TomeHistory } from './tomeHistory';
import { SettingsStore } from './settingsStore';
import { CloudSync } from '../cloud/cloudSync';

@Injectable({ providedIn: 'root' })
export class Persistence {
  private readonly history = inject(TomeHistory);
  private readonly settings = inject(SettingsStore);
  private readonly sync = inject(CloudSync);

  readonly autosavedAt = signal<string | null>(null);
  readonly unsafeToLeave = computed(() => this.history.dirty() || this.sync.pending());

  private started = false;

  constructor() {
    const destroy = inject(DestroyRef);
    effect((onCleanup) => {
      const { autosave, autosaveSeconds } = this.settings.settings();
      if (!autosave) return;
      const timer = setInterval(() => void this.autosave(), autosaveSeconds * 1000);
      onCleanup(() => clearInterval(timer));
    });
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden' && this.settings.settings().autosave) void this.autosave();
    };
    const onLeave = (event: BeforeUnloadEvent): void => {
      if (this.settings.settings().autosave) void this.autosave();
      if (!this.settings.settings().warnBeforeLeaving || !this.unsafeToLeave()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onLeave);
    destroy.onDestroy(() => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onLeave);
    });
  }

  start(): void {
    this.started = true;
  }

  async autosave(): Promise<boolean> {
    if (!this.started || !this.history.owner() || !this.history.dirty()) return false;
    const ok = await this.history.persist();
    if (ok) this.autosavedAt.set(new Date().toISOString());
    return ok;
  }
}
