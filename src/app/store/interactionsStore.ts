import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Interaction, InteractionDraft, SAMPLE_INTERACTIONS } from '../domain/interactions';

type InteractionsState = {
  interactions: Interaction[];
};

let interactionCounter = 0;

export const InteractionsStore = signalStore(
  { providedIn: 'root' },
  withState<InteractionsState>({ interactions: SAMPLE_INTERACTIONS }),
  withMethods((store) => ({
    add: (draft: InteractionDraft): string => {
      interactionCounter += 1;
      const id = `act-${Date.now().toString(36)}-${interactionCounter.toString(36)}`;
      patchState(store, (state) => ({ interactions: [...state.interactions, { ...draft, id }] }));
      return id;
    },
    update: (id: string, draft: InteractionDraft) =>
      patchState(store, (state) => ({
        interactions: state.interactions.map((i) => (i.id === id ? { ...draft, id } : i)),
      })),
    remove: (id: string) =>
      patchState(store, (state) => ({ interactions: state.interactions.filter((i) => i.id !== id) })),
    replaceAll: (interactions: Interaction[]) => patchState(store, { interactions }),
  })),
);
