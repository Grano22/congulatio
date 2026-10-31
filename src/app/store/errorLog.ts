import { Injectable, computed, inject, signal } from '@angular/core';
import { TomeVault } from './tomeVault';
import { APP_VERSION } from '../layout/app-version';
import { ErrorEntry, describeError, isBurst, isChunkFailure, isNoise, recordError } from '../domain/errorReport';

const LOG_KEY = 'errors.log';
const SAVE_DELAY_MS = 1000;

export type ErrorSource = 'handler' | 'bootstrap' | 'lazy-load';

const currentRoute = (): string => {
  try {
    const base = new URL(document.baseURI).pathname;
    const path = location.pathname.startsWith(base) ? `/${location.pathname.slice(base.length)}` : location.pathname;
    return path.replace(/\/+/g, '/') || '/';
  } catch {
    return '/';
  }
};

@Injectable({ providedIn: 'root' })
export class ErrorLog {
  private readonly vault = inject(TomeVault);

  readonly entries = signal<ErrorEntry[]>([]);
  readonly critical = signal<ErrorEntry | null>(null);
  readonly unseen = signal(0);
  readonly total = computed(() => this.entries().reduce((sum, e) => sum + e.count, 0));

  private times: number[] = [];
  private capturing = false;
  private timer?: ReturnType<typeof setTimeout>;
  private loaded = false;

  constructor() {
    void this.vault.setting<ErrorEntry[]>(LOG_KEY).then((stored) => {
      if (Array.isArray(stored)) this.entries.update((now) => [...now, ...stored.filter((s) => !now.some((n) => n.id === s.id))]);
      this.loaded = true;
    });
  }

  capture(error: unknown, source: ErrorSource = 'handler'): ErrorEntry | null {
    if (this.capturing) return null;
    this.capturing = true;
    try {
      const described = describeError(error);
      if (isNoise(described.message)) return null;
      const now = Date.now();
      this.times = [...this.times.filter((t) => now - t <= 60_000), now];
      const critical = source !== 'handler' || isChunkFailure(described.name, described.message) || isBurst(this.times, now);
      const { entries, entry } = recordError(this.entries(), described, {
        source,
        route: currentRoute(),
        appVersion: APP_VERSION,
        at: new Date(now).toISOString(),
        critical,
      });
      this.entries.set(entries);
      this.unseen.update((n) => n + 1);
      if (critical && !this.critical()) this.critical.set(entry);
      this.schedule();
      return entry;
    } catch {
      return null;
    } finally {
      this.capturing = false;
    }
  }

  dismissCritical(): void {
    this.critical.set(null);
  }

  markSeen(): void {
    this.unseen.set(0);
  }

  markReported(id: string): void {
    const at = new Date().toISOString();
    this.entries.update((list) => list.map((e) => (e.id === id ? { ...e, reportedAt: at } : e)));
    this.critical.update((c) => (c?.id === id ? { ...c, reportedAt: at } : c));
    this.schedule();
  }

  clear(): void {
    this.entries.set([]);
    this.unseen.set(0);
    this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.loaded || this.entries().length) void this.vault.remember(LOG_KEY, this.entries());
    }, SAVE_DELAY_MS);
  }
}
