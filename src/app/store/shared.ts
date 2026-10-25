export type QuerableState = {
  filter: { [field: string | symbol]: { query: string; } }
};

export type SortableState = {
  sort: { [field: string | symbol]: { order: string } };
};

enum LoadingState {
  LOADING,
  LOADED,
  ERROR,
}

export type LoadableState = {
    status: LoadingState;
};

export const SharedStateType = {
  QuerableState: 'QuerableState',
  SortableState: 'SortableState',
  LoadableState: 'LoadableState',
} as const;

export const ID_KEY = Symbol('id');

export const SharedInitialState: {
  [SharedStateType.QuerableState]: QuerableState;
  [SharedStateType.SortableState]: SortableState;
  [SharedStateType.LoadableState]: LoadableState;
} = {
  [SharedStateType.QuerableState]: { filter: { [ID_KEY]: { query: '' } } },
  [SharedStateType.SortableState]: { sort: { [ID_KEY]: { order: 'asc' } } },
  [SharedStateType.LoadableState]: { status: LoadingState.LOADING },
}

type SharedStateTypeKey = keyof typeof SharedStateType;

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type StateFromKeys<K extends SharedStateTypeKey> =
  UnionToIntersection<typeof SharedInitialState[K]>;

export const fillSharedInitialState = <K extends SharedStateTypeKey>(stateTypes: K[]): StateFromKeys<K> => {
  const initialState = {} as Record<string, unknown>;

  for (const key of stateTypes) {
    initialState[key] = SharedInitialState[key];
  }

  return initialState as StateFromKeys<K>;
};
