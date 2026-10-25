import type { Sex } from './characterFeatures';
import type { HairStyle, MouthMood, PixelFace } from './pixelFace';
import { generateFace } from './pixelFace';
import type { CharacterBuild } from './build';
import type { Appearance } from './hair';
import type { Attributes } from './attributes';

/**
 * Weighted pools keep the randomizer "smart": traits come from race-coherent
 * palettes with realistic proportions, the zodiac always matches the birth
 * date, and the nickname leans toward the temperament. Uniform dice would
 * yield a red-haired stocky elf named Bramble; the forge does not.
 */

type Weighted<T> = { v: T; w: number };

const pick = <T,>(items: Weighted<T>[], r: () => number): T => {
  const total = items.reduce((s, i) => s + i.w, 0);
  let x = r() * total;
  for (const i of items) {
    x -= i.w;
    if (x <= 0) return i.v;
  }
  return items[items.length - 1].v;
};

const w = <T>(pairs: [T, number][]): Weighted<T>[] => pairs.map(([v, wt]) => ({ v, w: wt }));

export type Race = 'Human' | 'Elf' | 'Dwarf' | 'Orc' | 'Halfling' | 'Undead';

export type SoulStatus = 'quest' | 'alive' | 'resting';

export interface RandomCharacter {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  race: Race;
  sex: Sex;
  origin: string;
  zodiac: string;
  /** date-only, e.g. "214-03-12" */
  birthDate: string;
  age: number;
  level: number;
  bodyType: string;
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  eyeColor: string;
  temperament: string;
  note: string;
  face: PixelFace;
  /** codex bookkeeping — how the soul is faring */
  status: SoulStatus;
  build?: CharacterBuild;
  appearance?: Appearance;
  portrait?: string;
  attributes?: Attributes;
  customAttributes?: Record<string, number>;
}

let idCounter = 0;

/** a fresh, collision-free id for a soul */
export function newCharacterId(): string {
  idCounter += 1;
  return `char-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

const RACES: Weighted<Race>[] = w([
  ['Human', 3],
  ['Elf', 2],
  ['Dwarf', 2],
  ['Orc', 2],
  ['Halfling', 2],
  ['Undead', 1],
]);

const FIRST_NAMES: Record<Race, string[]> = {
  Human: ['Aldric', 'Wren', 'Seraphine', 'Edric', 'Lyra', 'Bram', 'Elspeth', 'Rowan', 'Isabeau', 'Cassian'],
  Elf: ['Aelwyn', 'Caelen', 'Sylvaine', 'Thalwen', 'Ilyana', 'Fenrild', 'Mirethil', 'Osren'],
  Dwarf: ['Durin', 'Balderik', 'Grimnir', 'Thora', 'Bjorn', 'Kelda', 'Helga', 'Morrin'],
  Orc: ['Ghorak', 'Urgosh', 'Magra', 'Skarn', 'Vorga', 'Ashka', 'Torga', 'Krell'],
  Halfling: ['Tilly', 'Bramble', 'Pip', 'Maribel', 'Cornelius', 'Hazel', 'Fenwick', 'Rosie'],
  Undead: ['Mortimer', 'Vesper', 'Lucien', 'Isolde', 'Cadmus', 'Nox', 'Ophelia', 'Barnabas'],
};

const LAST_NAMES: Record<Race, string[]> = {
  Human: ['Blackwood', 'Ashford', 'Willowmere', 'Thornbury', 'Harwick', 'Emberfall'],
  Elf: ['Starweaver', 'Thornleaf', 'Moonwhisper', 'Silverbark', 'Windroot', 'Dawnpetal'],
  Dwarf: ['Ironbeard', 'Stonefist', 'Deepdelver', 'Orefang', 'Anvilhand', 'Grimtooth'],
  Orc: ['Skullmaw', 'Ashrend', 'Ironhide', 'Warcry', 'Blightfang', 'Stonemaul'],
  Halfling: ['Puddlegut', 'Clove', 'Brambleberry', 'Gingerbrew', 'Peabody', 'Turnipsworth'],
  Undead: ['the Undying', 'Nightvein', 'Palegrave', 'the Hollow', 'Ashenvein', 'Duskmourn'],
};

const NICKNAMES = ['the Bold', 'the Grey', 'the Quick', 'Ironhand', 'Softspoken', 'the Wary', 'Gilded', 'Bright-Eye', 'the Red', 'Mundane'];

const ORIGINS: Record<Race, string[]> = {
  Human: ['Valemark', 'Ashford Keep', 'Rivermoor', 'The Capital'],
  Elf: ['The Silverwood', 'Moonmere', 'Elarion'],
  Dwarf: ['The Deep Halls', 'Orefang', 'Stonehollow'],
  Orc: ['The Scorched Wastes', 'Ashgor', 'The Mudmarches'],
  Halfling: ['Bramblebury', 'The Green Hollow', 'Cloverdown'],
  Undead: ['The Sunken Crypt', 'Duskmourn', 'The Pale Barrow'],
};

const SKIN: Record<Race, Weighted<string>[]> = {
  Human: w([['Pale', 2], ['Tan', 3], ['Olive', 1.5], ['Bronze', 1]]),
  Elf: w([['Pale', 3], ['Moon-pale', 2], ['Olive', 1], ['Bronze', 1]]),
  Dwarf: w([['Tan', 2], ['Ruddy', 2], ['Bronze', 1]]),
  Orc: w([['Green', 3], ['Grey-green', 2], ['Yellow-green', 1]]),
  Halfling: w([['Fair', 2], ['Tan', 2], ['Rosy', 1]]),
  Undead: w([['Grey', 3], ['Ashen', 2], ['Bluish-grey', 1]]),
};

const SKIN_HEX: Record<string, string> = {
  Pale: '#f2d5b0',
  'Moon-pale': '#e9e4d8',
  Tan: '#d9a86f',
  Olive: '#b98d5e',
  Bronze: '#8d5a33',
  Ruddy: '#e0a583',
  Fair: '#f6e0c0',
  Rosy: '#f0c8a0',
  Green: '#7a9a4e',
  'Grey-green': '#8a9a62',
  'Yellow-green': '#a8a84e',
  Grey: '#9a9aa0',
  Ashen: '#b5b0a5',
  'Bluish-grey': '#8a93a5',
};

const HAIR: Record<Race, Weighted<string>[]> = {
  Human: w([['Brown', 3], ['Bronze', 2], ['Black', 2], ['Red', 1], ['White', 1]]),
  Elf: w([['White', 2], ['Silver', 2], ['Gold', 1.5], ['Black', 1]]),
  Dwarf: w([['Grey', 2], ['White', 2], ['Red', 1.5], ['Black', 1]]),
  Orc: w([['Black', 2], ['White', 1.5], ['Red', 1]]),
  Halfling: w([['Red', 2.5], ['Brown', 2], ['Black', 1]]),
  Undead: w([['White', 2], ['Grey', 2], ['Black', 1]]),
};

const HAIR_HEX: Record<string, string> = {
  Black: '#221c18',
  Brown: '#5a3d22',
  Bronze: '#8a5a2b',
  Red: '#a04a20',
  White: '#ddd8cf',
  Silver: '#c2c8d2',
  Gold: '#d8b24a',
  Grey: '#9a948c',
};

const EYES: Record<Race, Weighted<string>[]> = {
  Human: w([['Brown', 3], ['Blue', 2], ['Green', 1.5], ['Hazel', 1.5]]),
  Elf: w([['Blue', 2], ['Gold', 1.5], ['Green', 1.5], ['Purple', 1]]),
  Dwarf: w([['Blue', 2], ['Green', 1.5], ['Brown', 1.5]]),
  Orc: w([['Red', 2], ['Gold', 1.5], ['Green', 1]]),
  Halfling: w([['Brown', 2.5], ['Blue', 2], ['Green', 1.5]]),
  Undead: w([['Red', 2], ['Gold', 2], ['Purple', 1]]),
};

const EYES_HEX: Record<string, string> = {
  Brown: '#4a2f1a',
  Blue: '#4a6fa8',
  Green: '#4a7a4a',
  Hazel: '#7a5a2f',
  Gold: '#c8a032',
  Purple: '#7a4a8a',
  Red: '#a03228',
};

const BODY: Record<Race, Weighted<string>[]> = {
  Human: w([['Average', 3], ['Lean', 2], ['Stocky', 1.5]]),
  Elf: w([['Slender', 3], ['Average', 1.5]]),
  Dwarf: w([['Stocky', 3], ['Sturdy', 2]]),
  Orc: w([['Massive', 3], ['Sturdy', 2]]),
  Halfling: w([['Petite', 3], ['Plump', 1.5]]),
  Undead: w([['Withered', 2.5], ['Lean', 1.5]]),
};

const HAIR_STYLES: Record<Race, Weighted<HairStyle>[]> = {
  Human: w([['short', 3], ['long', 2], ['bald', 1], ['topknot', 1], ['bun', 1], ['mohawk', 0.5]]),
  Elf: w([['long', 3.5], ['short', 2], ['topknot', 1], ['bun', 1]]),
  Dwarf: w([['beard', 3], ['short', 2], ['bald', 1], ['mohawk', 0.5]]),
  Orc: w([['mohawk', 2.5], ['bald', 2.5], ['short', 1]]),
  Halfling: w([['short', 2.5], ['bun', 2], ['long', 1.5]]),
  Undead: w([['bald', 2.5], ['long', 1.5], ['short', 1]]),
};
// women lean toward flowier styles, men toward close-cropped ones
const STYLE_SEX_BIAS: Partial<Record<HairStyle, Sex>> = {
  topknot: 'female',
  bun: 'female',
  long: 'female',
  beard: 'male',
};

const TEMPERAMENTS = w([
  ['Stubborn', 2],
  ['Cunning', 2],
  ['Jolly', 1.5],
  ['Melancholic', 1.5],
  ['Fierce', 2],
  ['Wise', 1.5],
  ['Gregarious', 1.5],
  ['Brooding', 1.5],
  ['Kind', 1.5],
  ['Scheming', 1],
]);

const MOODS: MouthMood[] = ['smile', 'flat', 'frown'];

const STATUS: Weighted<SoulStatus>[] = w([
  ['alive', 3],
  ['quest', 2],
  ['resting', 1],
]);

const BIRTH_YEAR: Record<Race, [number, number]> = {
  Human: [180, 260],
  Elf: [150, 800],
  Dwarf: [140, 280],
  Orc: [190, 260],
  Halfling: [190, 260],
  Undead: [60, 280],
};

const RACE_WORD: Record<Race, string> = {
  Human: 'human',
  Elf: 'elf',
  Dwarf: 'dwarf',
  Orc: 'orc',
  Halfling: 'halfling',
  Undead: 'undead',
};

const RACE_FLAVOR: Record<Race, string> = {
  Human: 'Speaks of home in half-lit taverns, and means most of it.',
  Elf: 'Has outlived three of the four kingdoms, and remembers which ones were worth it.',
  Dwarf: 'Still owns the same hammer his grandfather swore at.',
  Orc: 'Counts friends on one hand. The other is a club.',
  Halfling: 'Can find food anywhere. Has tested this, repeatedly.',
  Undead: 'Remembers being alive. Refuses to discuss it.',
};

/** zodiac from calendar — the sign always agrees with the birth date */
function zodiacOf(month: number, day: number): string {
  const d = day;
  if ((month === 3 && d >= 21) || (month === 4 && d <= 19)) return 'Aries';
  if ((month === 4 && d > 19) || (month === 5 && d <= 20)) return 'Taurus';
  if ((month === 5 && d > 20) || (month === 6 && d <= 20)) return 'Gemini';
  if ((month === 6 && d > 20) || (month === 7 && d <= 22)) return 'Cancer';
  if ((month === 7 && d > 22) || (month === 8 && d <= 22)) return 'Leo';
  if ((month === 8 && d > 22) || (month === 9 && d <= 22)) return 'Virgo';
  if ((month === 9 && d > 22) || (month === 10 && d <= 22)) return 'Libra';
  if ((month === 10 && d > 22) || (month === 11 && d <= 21)) return 'Scorpio';
  if ((month === 11 && d > 21) || (month === 12 && d <= 21)) return 'Sagittarius';
  if ((month === 12 && d > 21) || (month === 1 && d <= 19)) return 'Capricorn';
  if ((month === 1 && d > 19) || (month === 2 && d <= 18)) return 'Aquarius';
  return 'Pisces';
}

function noteFor(c: Pick<RandomCharacter, 'firstName' | 'lastName' | 'nickname' | 'race' | 'bodyType' | 'origin' | 'temperament'>, r: () => number): string {
  const name = `${c.firstName} ${c.lastName}`;
  const nick = c.nickname ? ` "${c.nickname}"` : '';
  if (r() < 0.45) {
    const t2 = pick(TEMPERAMENTS, r);
    return `${name} is ${lower(c.temperament)} where it counts and ${lower(t2)} where it does not. ${RACE_FLAVOR[c.race]}`;
  }
  if (nick) {
    return `They call ${c.firstName}${nick} what the bards call ${lower(c.temperament)} — ${lower(c.bodyType)}, ${RACE_WORD[c.race] === 'undead' ? 'unliving' : `of ${c.origin}`}. ${RACE_FLAVOR[c.race]}`;
  }
  return `A ${lower(c.temperament)} ${lower(c.bodyType)} ${RACE_WORD[c.race]} of ${c.origin}. ${RACE_FLAVOR[c.race]}`;
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** roll the dice of fate — one coherent soul per throw */
export function generateRandomCharacter(): RandomCharacter {
  const r = Math.random;
  const race = pick(RACES, r);
  const sex: Sex = r() < 0.5 ? 'male' : 'female';
  const firstName = FIRST_NAMES[race][Math.floor(r() * FIRST_NAMES[race].length)];
  const lastName = LAST_NAMES[race][Math.floor(r() * LAST_NAMES[race].length)];
  const temperament = pick(TEMPERAMENTS, r);
  const nickname = NICKNAMES[Math.floor(r() * NICKNAMES.length)];
  const skin = pick(SKIN[race], r);
  const hairColor = pick(HAIR[race], r);
  const eyeColor = pick(EYES[race], r);
  const bodyType = pick(BODY[race], r);

  // hair style: race-weighted, with a gentle nudge toward the sex's favourites
  const styles = HAIR_STYLES[race].map((s) => ({
    ...s,
    w: STYLE_SEX_BIAS[s.v] === sex ? s.w * 1.6 : STYLE_SEX_BIAS[s.v] ? s.w * 0.4 : s.w,
  }));
  const hairStyle = pick(styles, r);

  // birth date → age → zodiac, all agreeing with each other
  const [yMin, yMax] = BIRTH_YEAR[race];
  const year = yMin + Math.floor(r() * (yMax - yMin + 1));
  const month = 1 + Math.floor(r() * 12);
  const day = 1 + Math.floor(r() * 28);
  const age = 291 - year;
  const zodiac = zodiacOf(month, day);
  const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // level climbs with years, but the dice still decide
  const level = Math.min(age, pick(w([[1 + Math.floor(r() * 9), 3], [10 + Math.floor(r() * 20), 4], [30 + Math.floor(r() * 30), 2]]), r));

  const seed = Math.floor(r() * 0xffffffff);
  const c: RandomCharacter = {
    id: newCharacterId(),
    firstName,
    lastName,
    nickname,
    race,
    sex,
    origin: ORIGINS[race][Math.floor(r() * ORIGINS[race].length)],
    zodiac,
    birthDate,
    age,
    level,
    bodyType,
    skin,
    hairColor,
    hairStyle,
    eyeColor,
    temperament,
    note: '',
    face: generateFace({
      seed,
      skin: SKIN_HEX[skin],
      hair: HAIR_HEX[hairColor],
      eyes: EYES_HEX[eyeColor],
      hairStyle,
      race,
      sex,
      mood: MOODS[Math.floor(r() * MOODS.length)],
    }),
    status: pick(STATUS, r),
  };
  c.note = noteFor(c, r);
  return c;
}
