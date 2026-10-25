import { effect, inject, untracked } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { CharactersStore } from './charactersStore';

export type EditorTabId = 'character' | 'sculptor' | 'dialogue' | 'routines' | 'interactions' | 'relations' | 'simulation';

export type FocusKind = 'soul' | 'routine' | 'dialogue' | 'interaction';

export type Focus = { kind: FocusKind; id: string };

type WorkspaceState = {
  tab: EditorTabId;
  focus: Focus | null;
};

export const sameFocus = (a: Focus | null, b: Focus | null): boolean =>
  a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id);

export const WorkspaceStore = signalStore(
  { providedIn: 'root' },
  withState<WorkspaceState>({ tab: 'character', focus: null }),
  withMethods((store) => ({
    open: (tab: EditorTabId) => patchState(store, { tab }),
    focusOn: (focus: Focus | null) => {
      if (!sameFocus(store.focus(), focus)) patchState(store, { focus });
    },
  })),
  withHooks({
    onInit(store) {
      const characters = inject(CharactersStore);
      effect(() => {
        const id = characters.selectedId();
        if (id) untracked(() => store.focusOn({ kind: 'soul', id }));
      });
      effect(() => {
        const focus = store.focus();
        if (!focus) return;
        const gone = focus.kind === 'soul' && !characters.characters().some((c) => c.id === focus.id);
        if (gone) untracked(() => store.focusOn(null));
      });
    },
  }),
);
