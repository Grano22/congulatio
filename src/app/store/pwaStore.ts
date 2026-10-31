import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { TomeHistory } from './tomeHistory';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

@Injectable({ providedIn: 'root' })
export class PwaStore {
  private readonly updates = inject(SwUpdate);
  private readonly history = inject(TomeHistory);

  readonly updateReady = signal(false);
  readonly installed = signal(typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches);
  private readonly installPrompt = signal<InstallPrompt | null>(null);
  readonly canInstall = computed(() => this.installPrompt() !== null && !this.installed());
  readonly offlineReady = computed(() => this.updates.isEnabled);

  constructor() {
    if (this.updates.isEnabled) {
      const subscription = this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateReady.set(true);
      });
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    }
    const onPrompt = (event: Event): void => {
      event.preventDefault();
      this.installPrompt.set(event as InstallPrompt);
    };
    const onInstalled = (): void => {
      this.installed.set(true);
      this.installPrompt.set(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    });
  }

  async install(): Promise<boolean> {
    const prompt = this.installPrompt();
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    this.installPrompt.set(null);
    return outcome === 'accepted';
  }

  async applyUpdate(): Promise<void> {
    if (this.history.dirty()) await this.history.persist();
    try {
      await this.updates.activateUpdate();
    } finally {
      document.location.reload();
    }
  }
}
