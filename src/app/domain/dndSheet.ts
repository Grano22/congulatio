import type { RandomCharacter } from './randomCharacter';
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, AttributeKey, attributesOf } from './attributes';

export type DndAbility = AttributeKey;

export const DND_ABILITIES: DndAbility[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const DND_ABILITY_NAMES: Record<DndAbility, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
};

export type DndSkillId =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival';

export const DND_SKILLS: { id: DndSkillId; name: string; ability: DndAbility }[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'DEX' },
  { id: 'animalHandling', name: 'Animal Handling', ability: 'WIS' },
  { id: 'arcana', name: 'Arcana', ability: 'INT' },
  { id: 'athletics', name: 'Athletics', ability: 'STR' },
  { id: 'deception', name: 'Deception', ability: 'CHA' },
  { id: 'history', name: 'History', ability: 'INT' },
  { id: 'insight', name: 'Insight', ability: 'WIS' },
  { id: 'intimidation', name: 'Intimidation', ability: 'CHA' },
  { id: 'investigation', name: 'Investigation', ability: 'INT' },
  { id: 'medicine', name: 'Medicine', ability: 'WIS' },
  { id: 'nature', name: 'Nature', ability: 'INT' },
  { id: 'perception', name: 'Perception', ability: 'WIS' },
  { id: 'performance', name: 'Performance', ability: 'CHA' },
  { id: 'persuasion', name: 'Persuasion', ability: 'CHA' },
  { id: 'religion', name: 'Religion', ability: 'INT' },
  { id: 'sleightOfHand', name: 'Sleight of Hand', ability: 'DEX' },
  { id: 'stealth', name: 'Stealth', ability: 'DEX' },
  { id: 'survival', name: 'Survival', ability: 'WIS' },
];

type ClassDef = {
  name: string;
  hitDie: number;
  saves: DndAbility[];
  skills: DndSkillId[];
  armor: string;
  armorClass: (mods: Record<DndAbility, number>) => number;
};

const CLASS_BY_ABILITY: Record<DndAbility, ClassDef> = {
  STR: { name: 'Fighter', hitDie: 10, saves: ['STR', 'CON'], skills: ['athletics', 'intimidation'], armor: 'Chain mail & shield', armorClass: () => 18 },
  DEX: {
    name: 'Rogue',
    hitDie: 8,
    saves: ['DEX', 'INT'],
    skills: ['acrobatics', 'perception', 'sleightOfHand', 'stealth'],
    armor: 'Leather armor',
    armorClass: (m) => 11 + m.DEX,
  },
  CON: { name: 'Barbarian', hitDie: 12, saves: ['STR', 'CON'], skills: ['athletics', 'survival'], armor: 'Unarmored defense', armorClass: (m) => 10 + m.DEX + m.CON },
  INT: { name: 'Wizard', hitDie: 6, saves: ['INT', 'WIS'], skills: ['arcana', 'history'], armor: 'No armor', armorClass: (m) => 10 + m.DEX },
  WIS: { name: 'Cleric', hitDie: 8, saves: ['WIS', 'CHA'], skills: ['insight', 'medicine'], armor: 'Scale mail & shield', armorClass: (m) => 16 + Math.min(m.DEX, 2) },
  CHA: { name: 'Bard', hitDie: 8, saves: ['DEX', 'CHA'], skills: ['deception', 'performance', 'persuasion'], armor: 'Leather armor', armorClass: (m) => 11 + m.DEX },
};

const SPECIES: Record<string, { name: string; speed: number; darkvision: number; languages: string[] }> = {
  Human: { name: 'Human', speed: 30, darkvision: 0, languages: ['Common'] },
  Elf: { name: 'Elf', speed: 30, darkvision: 60, languages: ['Common', 'Elvish'] },
  Dwarf: { name: 'Dwarf', speed: 30, darkvision: 120, languages: ['Common', 'Dwarvish'] },
  Orc: { name: 'Orc', speed: 30, darkvision: 120, languages: ['Common', 'Orc'] },
  Halfling: { name: 'Halfling', speed: 30, darkvision: 0, languages: ['Common', 'Halfling'] },
  Undead: { name: 'Undead (homebrew)', speed: 30, darkvision: 60, languages: ['Common'] },
};

const ALIGNMENTS: Record<string, string> = {
  Stubborn: 'Lawful Neutral',
  Cunning: 'Chaotic Neutral',
  Jolly: 'Chaotic Good',
  Melancholic: 'True Neutral',
  Fierce: 'Chaotic Neutral',
  Wise: 'Lawful Good',
  Gregarious: 'Neutral Good',
  Brooding: 'True Neutral',
  Kind: 'Neutral Good',
  Scheming: 'Lawful Evil',
};

const CLASS_PRIORITY: DndAbility[] = ['STR', 'DEX', 'INT', 'WIS', 'CHA', 'CON'];

export type DndAbilityRow = { key: DndAbility; name: string; score: number; modifier: number; save: number; proficientSave: boolean };

export type DndSkillRow = { id: DndSkillId; name: string; ability: DndAbility; bonus: number; proficient: boolean };

export type DndSheet = {
  name: string;
  nickname: string;
  species: string;
  className: string;
  level: number;
  alignment: string;
  background: string;
  proficiencyBonus: number;
  armorClass: number;
  armor: string;
  hitPoints: number;
  hitDice: string;
  initiative: number;
  speed: number;
  darkvision: number;
  passivePerception: number;
  languages: string[];
  abilities: DndAbilityRow[];
  skills: DndSkillRow[];
  notes: string;
};

export const abilityScore = (value: number): number => {
  const span = ATTRIBUTE_MAX - ATTRIBUTE_MIN;
  const score = 3 + ((value - ATTRIBUTE_MIN) * 17) / span;
  return Math.max(3, Math.min(20, Math.round(score)));
};

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);

export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);

export const formatModifier = (value: number): string => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`);

export function dndClassFor(scores: Record<DndAbility, number>): DndAbility {
  return CLASS_PRIORITY.reduce((best, key) => (scores[key] > scores[best] ? key : best), CLASS_PRIORITY[0]);
}

export function hitPoints(level: number, hitDie: number, conModifier: number): number {
  const first = hitDie + conModifier;
  const later = (level - 1) * (hitDie / 2 + 1 + conModifier);
  return Math.max(level, first + later);
}

export function buildDndSheet(c: RandomCharacter): DndSheet {
  const attributes = attributesOf(c);
  const scores = Object.fromEntries(DND_ABILITIES.map((k) => [k, abilityScore(attributes[k])])) as Record<DndAbility, number>;
  const mods = Object.fromEntries(DND_ABILITIES.map((k) => [k, abilityModifier(scores[k])])) as Record<DndAbility, number>;
  const level = Math.max(1, Math.min(20, Math.round(c.level || 1)));
  const proficiency = proficiencyBonus(level);
  const cls = CLASS_BY_ABILITY[dndClassFor(scores)];
  const species = SPECIES[c.race] ?? SPECIES['Human'];
  const skills = DND_SKILLS.map((s) => {
    const proficient = cls.skills.includes(s.id);
    return { ...s, proficient, bonus: mods[s.ability] + (proficient ? proficiency : 0) };
  });
  const perception = skills.find((s) => s.id === 'perception')!;
  return {
    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
    nickname: c.nickname,
    species: species.name,
    className: cls.name,
    level,
    alignment: ALIGNMENTS[c.temperament] ?? 'True Neutral',
    background: c.origin ? `Wanderer of ${c.origin}` : 'Wanderer',
    proficiencyBonus: proficiency,
    armorClass: cls.armorClass(mods),
    armor: cls.armor,
    hitPoints: hitPoints(level, cls.hitDie, mods.CON),
    hitDice: `${level}d${cls.hitDie}`,
    initiative: mods.DEX,
    speed: species.speed,
    darkvision: species.darkvision,
    passivePerception: 10 + perception.bonus,
    languages: species.languages,
    abilities: DND_ABILITIES.map((key) => {
      const proficientSave = cls.saves.includes(key);
      return { key, name: DND_ABILITY_NAMES[key], score: scores[key], modifier: mods[key], proficientSave, save: mods[key] + (proficientSave ? proficiency : 0) };
    }),
    skills,
    notes: c.note,
  };
}
