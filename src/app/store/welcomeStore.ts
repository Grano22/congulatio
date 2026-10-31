import { Injectable, computed, inject, signal } from '@angular/core';
import { TomeVault } from './tomeVault';
import { ShellStore } from './shellStore';
import { APP_VERSION } from '../layout/app-version';
import { releasesSince } from '../domain/releaseNotes';

const SEEN_KEY = 'welcome.seenVersion';

@Injectable({ providedIn: 'root' })
export class WelcomeStore {
  private readonly vault = inject(TomeVault);
  private readonly shell = inject(ShellStore);

  readonly seen = signal<string | null>(null);
  readonly firstVisit = computed(() => this.seen() === null);
  readonly releases = computed(() => releasesSince(this.seen(), APP_VERSION));
  private checked = false;

  async check(): Promise<void> {
    if (this.checked) return;
    this.checked = true;
    const seen = (await this.vault.setting<string>(SEEN_KEY)) ?? null;
    this.seen.set(seen);
    if (seen !== APP_VERSION && this.releases().length && !this.shell.dialog()) this.shell.open('welcome');
  }

  showAgain(): void {
    this.shell.open('welcome');
  }

  async dismiss(): Promise<void> {
    this.seen.set(APP_VERSION);
    await this.vault.remember(SEEN_KEY, APP_VERSION);
  }
}
