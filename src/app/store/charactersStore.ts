import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { SharedStateType, fillSharedInitialState, QuerableState, SortableState, LoadableState } from './shared';
import type { RandomCharacter } from '../domain/randomCharacter';
import { generateFace } from '../domain/pixelFace';

type CharactersState = QuerableState & SortableState & LoadableState & {
  /** the bound codex — every soul saved from the forge */
  characters: RandomCharacter[];
  /** the soul currently loaded on the forge (clicked in the codex) */
  selectedId: string | null;
};

/** seed roster — the five souls the codex opens with */
export const INITIAL_SOULS: RandomCharacter[] = [
  {
    id: 'soul-001',
    firstName: 'Aldric',
    lastName: 'Blackwood',
    nickname: 'the Bold',
    race: 'Human',
    sex: 'male',
    origin: 'Valemark',
    zodiac: 'Aries',
    birthDate: '240-03-24',
    age: 51,
    level: 12,
    bodyType: 'Human Man',
    skin: 'Tan',
    hairColor: 'Bronze',
    hairStyle: 'short',
    eyeColor: 'Hazel',
    temperament: 'Wise',
    note: 'A wise, steady human of Valemark. Keeps a ledger of slights, and has no patience for the third one.',
    face: generateFace({ seed: 7, skin: '#d9a86f', hair: '#8a5a2b', eyes: '#7a5a2f', hairStyle: 'short', race: 'Human', sex: 'male', mood: 'flat' }),
    status: 'quest',
  },
  {
    id: 'soul-002',
    firstName: 'Seraphine',
    lastName: 'Moonwhisper',
    nickname: '',
    race: 'Elf',
    sex: 'female',
    origin: 'Moonmere',
    zodiac: 'Libra',
    birthDate: '151-09-28',
    age: 140,
    level: 8,
    bodyType: 'Slender',
    skin: 'Moon-pale',
    hairColor: 'White',
    hairStyle: 'long',
    eyeColor: 'Blue',
    temperament: 'Kind',
    note: 'A kind, slender elf of Moonmere. Has outlived three of the four kingdoms, and remembers which ones were worth it.',
    face: generateFace({ seed: 21, skin: '#e9e4d8', hair: '#ddd8cf', eyes: '#4a6fa8', hairStyle: 'long', race: 'Elf', sex: 'female', mood: 'smile' }),
    status: 'alive',
  },
  {
    id: 'soul-003',
    firstName: 'Grumhag',
    lastName: 'Skullmaw',
    nickname: 'the Red',
    race: 'Orc',
    sex: 'male',
    origin: 'Ashgor',
    zodiac: 'Scorpio',
    birthDate: '212-11-04',
    age: 79,
    level: 15,
    bodyType: 'Massive',
    skin: 'Green',
    hairColor: 'Black',
    hairStyle: 'mohawk',
    eyeColor: 'Red',
    temperament: 'Fierce',
    note: 'A fierce, massive orc of Ashgor. Counts friends on one hand. The other is a club.',
    face: generateFace({ seed: 33, skin: '#7a9a4e', hair: '#221c18', eyes: '#a03228', hairStyle: 'mohawk', race: 'Orc', sex: 'male', mood: 'frown' }),
    status: 'resting',
  },
  {
    id: 'soul-004',
    firstName: 'Wren',
    lastName: 'Willowmere',
    nickname: '',
    race: 'Halfling',
    sex: 'female',
    origin: 'Bramblebury',
    zodiac: 'Virgo',
    birthDate: '236-08-30',
    age: 55,
    level: 5,
    bodyType: 'Petite',
    skin: 'Fair',
    hairColor: 'Red',
    hairStyle: 'bun',
    eyeColor: 'Brown',
    temperament: 'Jolly',
    note: 'A jolly, petite halfling of Bramblebury. Can find food anywhere. Has tested this, repeatedly.',
    face: generateFace({ seed: 44, skin: '#f6e0c0', hair: '#a04a20', eyes: '#4a2f1a', hairStyle: 'bun', race: 'Halfling', sex: 'female', mood: 'smile' }),
    status: 'alive',
  },
  {
    id: 'soul-005',
    firstName: 'Mortimer',
    lastName: 'Ashenvein',
    nickname: 'the Undying',
    race: 'Undead',
    sex: 'male',
    origin: 'The Sunken Crypt',
    zodiac: 'Capricorn',
    birthDate: '88-12-02',
    age: 203,
    level: 20,
    bodyType: 'Withered',
    skin: 'Grey',
    hairColor: 'White',
    hairStyle: 'bald',
    eyeColor: 'Gold',
    temperament: 'Brooding',
    note: 'A brooding, withered undead of The Sunken Crypt. Remembers being alive. Refuses to discuss it.',
    face: generateFace({ seed: 55, skin: '#9a9aa0', hair: '#ddd8cf', eyes: '#c8a032', hairStyle: 'bald', race: 'Undead', sex: 'male', mood: 'flat' }),
    status: 'quest',
  },
];

const initialState: CharactersState = {
  ...fillSharedInitialState([SharedStateType.QuerableState, SharedStateType.LoadableState, SharedStateType.SortableState]),
  characters: INITIAL_SOULS,
  selectedId: null,
};

/** providedIn: 'root' is mandatory in @ngrx/signals v22 — without it the
 *  store is not injectable and every consumer crashes with NG0201 */
export const CharactersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    /** load a soul on the forge (null clears the selection) */
    select: (id: string | null) => patchState(store, { selectedId: id }),
    /** upsert by id — the forge's Save/Edit goes through here */
    save: (char: RandomCharacter) =>
      patchState(store, (state) => {
        const i = state.characters.findIndex((c) => c.id === char.id);
        return {
          characters: i === -1 ? [...state.characters, char] : state.characters.map((c) => (c.id === char.id ? char : c)),
        };
      }),
    replaceAll: (characters: RandomCharacter[]) =>
      patchState(store, (state) => ({
        characters,
        selectedId: characters.some((c) => c.id === state.selectedId) ? state.selectedId : null,
      })),
    remove: (id: string) =>
      patchState(store, (state) => ({
        characters: state.characters.filter((c) => c.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      })),
  })),
);
