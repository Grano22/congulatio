import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DEFAULT_VIEW_MODE, EditorTabId, NavigatorId, ViewModeId, allowsTab, fallbackTab, isViewModeId, modeForTab, viewMode } from '../domain/viewModes';
import { WorkspaceStore } from './workspaceStore';
import { ShellStore } from './shellStore';

const VIEW_KEY = 'congulatio.view.v1';

function readMode(): ViewModeId {
  try {
    const mode = (JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as { mode?: unknown }).mode;
    return isViewModeId(mode) ? mode : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

@Injectable({ providedIn: 'root' })
export class ViewStore {
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);

  readonly modeId = signal<ViewModeId>(readMode());
  readonly mode = computed(() => viewMode(this.modeId()));

  constructor() {
    this.workspace.open(fallbackTab(this.mode(), this.workspace.tab()));
    effect(() => {
      const mode = this.modeId();
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify({ mode }));
      } catch {
        return;
      }
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

  allowsTab(tab: EditorTabId): boolean {
    return allowsTab(this.mode(), tab);
  }

  allowsNavigator(id: NavigatorId): boolean {
    return this.mode().navigators.includes(id);
  }
}
