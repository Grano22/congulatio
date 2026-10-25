import type { RandomCharacter } from './randomCharacter';

export type HairPresetId =
  | 'bald'
  | 'crop'
  | 'short'
  | 'long'
  | 'ponytail'
  | 'bun'
  | 'topknot'
  | 'mohawk'
  | 'braids'
  | 'bearded';

export const HAIR_PRESETS: { id: HairPresetId; label: string }[] = [
  { id: 'bald', label: 'Bald' },
  { id: 'crop', label: 'Crop' },
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bun', label: 'Bun' },
  { id: 'topknot', label: 'Topknot' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'braids', label: 'Braids' },
  { id: 'bearded', label: 'Bearded' },
];

export const HAIR_COLORS: { hex: string; label: string }[] = [
  { hex: '#221c18', label: 'Raven' },
  { hex: '#4a2f1a', label: 'Umber' },
  { hex: '#6b3e1f', label: 'Chestnut' },
  { hex: '#8a5a2b', label: 'Bronze' },
  { hex: '#a04a20', label: 'Copper' },
  { hex: '#c89a4a', label: 'Honey' },
  { hex: '#e2c25c', label: 'Flaxen' },
  { hex: '#b8b0a0', label: 'Ash' },
  { hex: '#ddd8cf', label: 'Frost' },
  { hex: '#3f5a2a', label: 'Moss' },
  { hex: '#5a2a4a', label: 'Plum' },
  { hex: '#3d6a8c', label: 'Tide' },
];

export type Appearance = {
  hair: HairPresetId;
  hairColor: string;
};

const FROM_PIXEL_STYLE: Record<RandomCharacter['hairStyle'], HairPresetId> = {
  bald: 'bald',
  short: 'short',
  long: 'long',
  mohawk: 'mohawk',
  topknot: 'topknot',
  bun: 'bun',
  beard: 'bearded',
};

function crownColor(character: RandomCharacter): string {
  const skin = character.face[7]?.[3];
  const counts = new Map<string, number>();
  for (const c of character.face.slice(0, 3).flat()) {
    if (c && c !== skin) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? HAIR_COLORS[1].hex;
}

export function defaultAppearance(character: RandomCharacter): Appearance {
  return { hair: FROM_PIXEL_STYLE[character.hairStyle] ?? 'short', hairColor: crownColor(character) };
}

export const appearanceOf = (character: RandomCharacter): Appearance =>
  character.appearance ?? defaultAppearance(character);
