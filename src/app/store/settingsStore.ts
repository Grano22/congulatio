import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { TomeVault } from './tomeVault';

export const AUTOSAVE_INTERVALS = [15, 30, 60, 300] as const;
export type AutosaveInterval = (typeof AUTOSAVE_INTERVALS)[number];

export type AppSettings = {
  autosave: boolean;
  autosaveSeconds: AutosaveInterval;
  warnBeforeLeaving: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = { autosave: true, autosaveSeconds: 30, warnBeforeLeaving: true };

const SETTINGS_KEY = 'app.settings';

export function readSettings(value: unknown): AppSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<Record<keyof AppSettings, unknown>>;
  const seconds = Number(raw.autosaveSeconds);
  return {
    autosave: typeof raw.autosave === 'boolean' ? raw.autosave : DEFAULT_SETTINGS.autosave,
    autosaveSeconds: (AUTOSAVE_INTERVALS as readonly number[]).includes(seconds) ? (seconds as AutosaveInterval) : DEFAULT_SETTINGS.autosaveSeconds,
    warnBeforeLeaving: typeof raw.warnBeforeLeaving === 'boolean' ? raw.warnBeforeLeaving : DEFAULT_SETTINGS.warnBeforeLeaving,
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly vault = inject(TomeVault);

  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly loaded = signal(false);

  constructor() {
    void this.vault.setting<unknown>(SETTINGS_KEY).then((stored) => {
      this.settings.set(readSettings(stored));
      this.loaded.set(true);
    });
    effect(() => {
      const settings = this.settings();
      if (untracked(this.loaded)) void this.vault.remember(SETTINGS_KEY, settings);
    });
  }

  update(changes: Partial<AppSettings>): void {
    this.settings.update((s) => readSettings({ ...s, ...changes }));
  }
}
