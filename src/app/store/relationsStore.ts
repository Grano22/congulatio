import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CharacterRelation, Routine, RoutineDraft, SAMPLE_RELATIONS, SAMPLE_ROUTINES } from '../domain/relations';

type RelationsState = {
  relations: CharacterRelation[];
  routines: Routine[];
};

let relationCounter = 0;
let routineCounter = 0;

export const RelationsStore = signalStore(
  { providedIn: 'root' },
  withState<RelationsState>({ relations: SAMPLE_RELATIONS, routines: SAMPLE_ROUTINES }),
  withMethods((store) => ({
    bind: (relation: Omit<CharacterRelation, 'id'>) => {
      relationCounter += 1;
      const id = `rel-${Date.now().toString(36)}-${relationCounter.toString(36)}`;
      patchState(store, (state) => ({ relations: [...state.relations, { ...relation, id }] }));
    },
    replaceAll: (relations: CharacterRelation[], routines: Routine[]) => patchState(store, { relations, routines }),
    updateRoutine: (id: string, changes: Partial<Omit<Routine, 'id'>>) =>
      patchState(store, (state) => ({ routines: state.routines.map((r) => (r.id === id ? { ...r, ...changes } : r)) })),
    addRoutine: (draft: RoutineDraft): string => {
      routineCounter += 1;
      const id = `rt-${Date.now().toString(36)}-${routineCounter.toString(36)}`;
      patchState(store, (state) => ({ routines: [...state.routines, { ...draft, id }] }));
      return id;
    },
    removeRoutine: (id: string) => patchState(store, (state) => ({ routines: state.routines.filter((r) => r.id !== id) })),
    joinRoutine: (routineId: string, soulId: string) =>
      patchState(store, (state) => ({
        routines: state.routines.map((r) =>
          r.id === routineId && !r.participantIds.includes(soulId) ? { ...r, participantIds: [...r.participantIds, soulId] } : r,
        ),
      })),
    leaveRoutine: (routineId: string, soulId: string) =>
      patchState(store, (state) => ({
        routines: state.routines.map((r) =>
          r.id === routineId ? { ...r, participantIds: r.participantIds.filter((id) => id !== soulId) } : r,
        ),
      })),
    unbind: (id: string) =>
      patchState(store, (state) => ({ relations: state.relations.filter((r) => r.id !== id) })),
  })),
);
