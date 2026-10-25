import type { RandomCharacter } from './randomCharacter';

export type BuildKey = 'height' | 'girth' | 'eyeSize' | 'legLength' | 'legGirth' | 'armLength' | 'handSize' | 'chest';

export type CharacterBuild = Record<BuildKey, number>;

export type BuildRange = {
  key: BuildKey;
  label: string;
  min: number;
  max: number;
  step: number;
  femaleOnly?: boolean;
};

export const BUILD_RANGES: BuildRange[] = [
  { key: 'height', label: 'Size', min: 0.7, max: 1.3, step: 0.01 },
  { key: 'girth', label: 'Fatness', min: 0.7, max: 1.7, step: 0.01 },
  { key: 'eyeSize', label: 'Eyes', min: 0.5, max: 1.8, step: 0.01 },
  { key: 'legLength', label: 'Leg length', min: 0.7, max: 1.35, step: 0.01 },
  { key: 'legGirth', label: 'Leg thickness', min: 0.6, max: 1.6, step: 0.01 },
  { key: 'armLength', label: 'Arm length', min: 0.7, max: 1.35, step: 0.01 },
  { key: 'handSize', label: 'Hands', min: 0.6, max: 1.7, step: 0.01 },
  { key: 'chest', label: 'Chest', min: 0.15, max: 0.75, step: 0.01, femaleOnly: true },
];

const RACE_BUILD: Record<string, Partial<CharacterBuild>> = {
  Human: {},
  Elf: { height: 1.08, girth: 0.85, legLength: 1.1, armLength: 1.05 },
  Dwarf: { height: 0.82, girth: 1.3, legLength: 0.8, legGirth: 1.3, handSize: 1.25 },
  Orc: { height: 1.15, girth: 1.25, legGirth: 1.25, armLength: 1.12, handSize: 1.35 },
  Halfling: { height: 0.72, girth: 1.05, legLength: 0.85, eyeSize: 1.25 },
  Undead: { girth: 0.75, legGirth: 0.75, eyeSize: 0.8 },
};

const BODY_GIRTH: Record<string, number> = {
  Lean: 0.85,
  Slender: 0.8,
  Stocky: 1.2,
  Sturdy: 1.15,
  Massive: 1.45,
  Petite: 0.85,
  Withered: 0.75,
};

const clamp = (range: BuildRange, value: number): number => Math.min(range.max, Math.max(range.min, value));

export function defaultBuild(character: Pick<RandomCharacter, 'race' | 'sex' | 'bodyType'>): CharacterBuild {
  const race = RACE_BUILD[character.race] ?? {};
  const base: CharacterBuild = {
    height: 1,
    girth: 1,
    eyeSize: 1,
    legLength: 1,
    legGirth: 1,
    armLength: 1,
    handSize: 1,
    chest: 0.4,
    ...race,
  };
  base.girth *= BODY_GIRTH[character.bodyType] ?? 1;
  return Object.fromEntries(BUILD_RANGES.map((r) => [r.key, clamp(r, base[r.key])])) as CharacterBuild;
}

export const buildOf = (character: RandomCharacter): CharacterBuild => character.build ?? defaultBuild(character);

export type BuildPreset = { id: string; label: string; build: CharacterBuild };

const preset = (id: string, label: string, build: Partial<CharacterBuild>): BuildPreset => ({
  id,
  label,
  build: { height: 1, girth: 1, eyeSize: 1, legLength: 1, legGirth: 1, armLength: 1, handSize: 1, chest: 0.4, ...build },
});

export const BUILD_PRESETS: BuildPreset[] = [
  preset('balanced', 'Balanced', {}),
  preset('warrior', 'Warrior', { height: 1.08, girth: 1.15, legGirth: 1.2, armLength: 1.05, handSize: 1.15, chest: 0.45 }),
  preset('scholar', 'Scholar', { height: 0.98, girth: 0.88, legGirth: 0.85, handSize: 0.9, eyeSize: 1.1, chest: 0.35 }),
  preset('rogue', 'Rogue', { height: 0.95, girth: 0.82, legLength: 1.08, legGirth: 0.85, armLength: 1.05, chest: 0.35 }),
  preset('hearty', 'Hearty', { girth: 1.45, legGirth: 1.3, handSize: 1.1, chest: 0.6 }),
  preset('elder', 'Elder', { height: 0.93, girth: 0.95, legGirth: 0.8, eyeSize: 0.9, chest: 0.4 }),
  preset('giant', 'Giant', { height: 1.28, girth: 1.3, legGirth: 1.35, armLength: 1.1, handSize: 1.45, chest: 0.5 }),
  preset('sprite', 'Sprite', { height: 0.75, girth: 0.85, eyeSize: 1.45, legLength: 0.9, handSize: 0.8, chest: 0.3 }),
];

export const sameBuild = (a: CharacterBuild, b: CharacterBuild): boolean => BUILD_RANGES.every((r) => a[r.key] === b[r.key]);
