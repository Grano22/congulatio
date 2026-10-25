import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CustomAttribute, CustomAttributeDraft, SAMPLE_CUSTOM_ATTRIBUTES } from '../domain/attributes';

type AttributesState = {
  defs: CustomAttribute[];
};

let attributeCounter = 0;

export const AttributesStore = signalStore(
  { providedIn: 'root' },
  withState<AttributesState>({ defs: SAMPLE_CUSTOM_ATTRIBUTES }),
  withMethods((store) => ({
    add: (draft: CustomAttributeDraft): string => {
      attributeCounter += 1;
      const id = `attr-${Date.now().toString(36)}-${attributeCounter.toString(36)}`;
      patchState(store, (state) => ({ defs: [...state.defs, { ...draft, id }] }));
      return id;
    },
    update: (id: string, draft: CustomAttributeDraft) =>
      patchState(store, (state) => ({ defs: state.defs.map((d) => (d.id === id ? { ...draft, id } : d)) })),
    remove: (id: string) => patchState(store, (state) => ({ defs: state.defs.filter((d) => d.id !== id) })),
    replaceAll: (defs: CustomAttribute[]) => patchState(store, { defs }),
  })),
);
