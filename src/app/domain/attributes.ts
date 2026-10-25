import type { RandomCharacter } from './randomCharacter';

export type AttributeKey = 'STR' | 'DEX' | 'INT' | 'WIS' | 'CON' | 'CHA';

export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_KEYS: AttributeKey[] = ['STR', 'DEX', 'INT', 'WIS', 'CON', 'CHA'];

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 100;

const RACE_MODS: Record<string, Partial<Attributes>> = {
  Human: { CHA: 4 },
  Elf: { DEX: 10, INT: 6, CON: -6 },
  Dwarf: { CON: 12, STR: 6, DEX: -6 },
  Orc: { STR: 16, CON: 8, INT: -8, CHA: -6 },
  Halfling: { DEX: 12, CHA: 6, STR: -10 },
  Undead: { WIS: 8, CON: 10, CHA: -12 },
};

const TEMPERAMENT_MODS: Record<string, Partial<Attributes>> = {
  Stubborn: { CON: 6, WIS: -4 },
  Cunning: { INT: 6, DEX: 4 },
  Jolly: { CHA: 8 },
  Melancholic: { WIS: 6, CHA: -4 },
  Fierce: { STR: 8, WIS: -4 },
  Wise: { WIS: 10 },
  Gregarious: { CHA: 10 },
  Brooding: { INT: 4, CHA: -6 },
  Kind: { CHA: 6, WIS: 4 },
  Scheming: { INT: 8, CHA: -2 },
};

function seededNoise(seed: string, key: string): number {
  let h = 2166136261;
  for (const ch of `${seed}:${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 21) - 10;
}

export const clampAttribute = (v: number): number => Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

export function deriveAttributes(c: RandomCharacter): Attributes {
  const race = RACE_MODS[c.race] ?? {};
  const temper = TEMPERAMENT_MODS[c.temperament] ?? {};
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((k) => [k, clampAttribute(40 + c.level * 1.5 + seededNoise(c.id, k) + (race[k] ?? 0) + (temper[k] ?? 0))]),
  ) as Attributes;
}

export const attributesOf = (c: RandomCharacter): Attributes => c.attributes ?? deriveAttributes(c);

export const TEMPERAMENT_NAMES = Object.keys(TEMPERAMENT_MODS);

export type CustomAttribute = {
  id: string;
  key: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  description: string;
};

export type CustomAttributeDraft = Omit<CustomAttribute, 'id'>;

export type AttributeRow = {
  id: string;
  key: string;
  name: string;
  min: number;
  max: number;
  value: number;
  custom: boolean;
};

const CORE_NAMES: Record<AttributeKey, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CON: 'Constitution',
  CHA: 'Charisma',
};

export const CORE_ATTRIBUTES = ATTRIBUTE_KEYS.map((key) => ({ key, name: CORE_NAMES[key], min: ATTRIBUTE_MIN, max: ATTRIBUTE_MAX }));

export const SAMPLE_CUSTOM_ATTRIBUTES: CustomAttribute[] = [
  { id: 'attr-luck', key: 'LCK', name: 'Luck', min: 0, max: 20, defaultValue: 10, description: 'How often fate leans their way.' },
  { id: 'attr-rep', key: 'REP', name: 'Reputation', min: -100, max: 100, defaultValue: 0, description: 'What the realm whispers about them.' },
];

export function validateCustomAttribute(draft: CustomAttributeDraft, others: CustomAttribute[]): string | null {
  const key = draft.key.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{0,5}$/.test(key)) return 'The key needs 1–6 letters or digits, starting with a letter.';
  if ((ATTRIBUTE_KEYS as string[]).includes(key)) return `${key} is a core attribute already.`;
  if (others.some((a) => a.key.toUpperCase() === key)) return `Another attribute already uses ${key}.`;
  if (!draft.name.trim()) return 'Give the attribute a name.';
  if (!Number.isFinite(draft.min) || !Number.isFinite(draft.max) || !Number.isFinite(draft.defaultValue)) return 'Range and default must be numbers.';
  if (draft.min >= draft.max) return 'The lowest value must be below the highest.';
  if (draft.defaultValue < draft.min || draft.defaultValue > draft.max) return 'The default must sit inside the range.';
  return null;
}

export function attributeRows(c: RandomCharacter, defs: CustomAttribute[]): AttributeRow[] {
  const core = attributesOf(c);
  return [
    ...CORE_ATTRIBUTES.map((a) => ({ id: a.key, key: a.key, name: a.name, min: a.min, max: a.max, value: core[a.key], custom: false })),
    ...defs.map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      min: d.min,
      max: d.max,
      value: Math.min(d.max, Math.max(d.min, c.customAttributes?.[d.id] ?? d.defaultValue)),
      custom: true,
    })),
  ];
}

export const attributeToken = (soulName: string, key: string, value: number): string => `[[${soulName}.${key}=${value}]]`;

export function parseAttributeValue(raw: string, min: number, max: number): number | string {
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return 'Enter a whole number.';
  const value = Number(text);
  if (value < min || value > max) return `Keep it between ${min} and ${max}.`;
  return value;
}
