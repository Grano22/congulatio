import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  DEFAULT_VIEW_MODE,
  EditorTabId,
  NavigatorId,
  ThemeChoice,
  ViewModeId,
  allowsTab,
  fallbackTab,
  isThemeChoice,
  isViewModeId,
  modeForTab,
  resolveTheme,
  viewMode,
} from '../domain/viewModes';
import { WorkspaceStore } from './workspaceStore';
import { ShellStore } from './shellStore';

const VIEW_KEY = 'congulatio.view.v1';

type StoredView = { mode: ViewModeId; theme: ThemeChoice };

function readView(): StoredView {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<StoredView>;
    return { mode: isViewModeId(v.mode) ? v.mode : DEFAULT_VIEW_MODE, theme: isThemeChoice(v.theme) ? v.theme : 'auto' };
  } catch {
    return { mode: DEFAULT_VIEW_MODE, theme: 'auto' };
  }
}

@Injectable({ providedIn: 'root' })
export class ViewStore {
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);
  private readonly stored = readView();

  readonly modeId = signal<ViewModeId>(this.stored.mode);
  readonly themeChoice = signal<ThemeChoice>(this.stored.theme);
  readonly mode = computed(() => viewMode(this.modeId()));
  readonly theme = computed(() => resolveTheme(this.themeChoice(), this.mode()));

  constructor() {
    this.workspace.open(fallbackTab(this.mode(), this.workspace.tab()));
    effect(() => {
      const view: StoredView = { mode: this.modeId(), theme: this.themeChoice() };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      } catch {
        return;
      }
    });
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
    });
    effect(() => {
      const tab = this.workspace.tab();
      untracked(() => {
        const current = this.mode();
        const target = modeForTab(current, tab);
        if (target.id === current.id) return;
        this.modeId.set(target.id);
        this.shell.notify('info', `Switched to the ${target.label} view to show this.`);
      });
    });
  }

  setMode(id: ViewModeId): void {
    const mode = viewMode(id);
    this.workspace.open(fallbackTab(mode, this.workspace.tab()));
    this.modeId.set(mode.id);
  }

  setTheme(choice: ThemeChoice): void {
    this.themeChoice.set(choice);
  }

  allowsTab(tab: EditorTabId): boolean {
    return allowsTab(this.mode(), tab);
  }

  allowsNavigator(id: NavigatorId): boolean {
    return this.mode().navigators.includes(id);
  }
}
