import { Injectable, computed, effect, signal } from '@angular/core';
import { DEFAULT_THEME, ThemeId, isThemeId, nextTheme, theme } from '../domain/themes';

const THEME_KEY = 'congulatio.theme.v1';
const LEGACY_VIEW_KEY = 'congulatio.view.v1';

function readTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemeId(stored)) return stored;
    const legacy = (JSON.parse(localStorage.getItem(LEGACY_VIEW_KEY) ?? '{}') as { theme?: unknown }).theme;
    return isThemeId(legacy) ? legacy : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  readonly id = signal<ThemeId>(readTheme());
  readonly current = computed(() => theme(this.id()));

  constructor() {
    this.apply(this.id());
    effect(() => {
      const id = this.id();
      try {
        localStorage.setItem(THEME_KEY, id);
      } catch {
        return;
      }
    });
  }

  set(id: ThemeId): void {
    if (id === this.id()) return;
    const doc = document as TransitionDocument;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const update = (): void => {
      this.id.set(id);
      this.apply(id);
    };
    if (doc.startViewTransition && !calm) doc.startViewTransition(update);
    else update();
  }

  next(): void {
    this.set(nextTheme(this.id()));
  }

  private apply(id: ThemeId): void {
    document.documentElement.dataset['theme'] = id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme(id).chromeColor);
  }
}
