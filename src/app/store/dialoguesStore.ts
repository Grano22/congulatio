import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { DialogueNode, SAMPLE_DIALOGUE_NODES } from '../domain/dialogue';

type DialoguesState = {
  nodes: DialogueNode[];
};

export const DialoguesStore = signalStore(
  { providedIn: 'root' },
  withState<DialoguesState>({ nodes: SAMPLE_DIALOGUE_NODES }),
  withMethods((store) => ({
    add: (node: DialogueNode) => patchState(store, (state) => ({ nodes: [...state.nodes, node] })),
    addMany: (added: DialogueNode[]) => patchState(store, (state) => ({ nodes: [...state.nodes, ...added] })),
    replaceAll: (nodes: DialogueNode[]) => patchState(store, { nodes }),
    update: (id: string, changes: Partial<Omit<DialogueNode, 'id'>>) =>
      patchState(store, (state) => ({ nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) })),
  })),
);
