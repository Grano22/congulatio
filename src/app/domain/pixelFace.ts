import type { Sex } from './characterFeatures';

/**
 * A 12×12 grid of pixels; null = transparent. Rendered as crisp squares —
 * a procedurally drawn 8-bit face (skin, hair, eyes, mouth, race touches).
 */
export type PixelFace = (string | null)[][];

export type HairStyle = 'bald' | 'short' | 'long' | 'mohawk' | 'topknot' | 'bun' | 'beard';
export type MouthMood = 'smile' | 'flat' | 'frown';

export interface FaceOptions {
  /** drives the small seed-based variations */
  seed: number;
  skin: string;
  hair: string;
  eyes: string;
  hairStyle: HairStyle;
  race: string;
  sex: Sex;
  mood: MouthMood;
}

const G = 12;
const MOUTH = '#59332a';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paint a tiny person. The layout is a fixed 12×12 head; colour, hair,
 * mouth and a few race-specific touches vary, so two runs of the same
 * traits can still yield different faces.
 */
export function generateFace(o: FaceOptions): PixelFace {
  const rnd = mulberry32(o.seed || 1);
  const f: PixelFace = Array.from({ length: G }, () => Array<string | null>(G).fill(null));
  const set = (x: number, y: number, c: string | null): void => {
    if (x >= 0 && x < G && y >= 0 && y < G) f[y][x] = c;
  };

  // head — rounded top, square cheeks, tucked chin
  for (let x = 3; x <= 8; x++) set(x, 2, o.skin);
  for (let y = 3; y <= 10; y++) for (let x = 2; x <= 9; x++) set(x, y, o.skin);
  for (let x = 4; x <= 7; x++) set(x, 11, o.skin);

  // ears (pointed for elves, small nubs otherwise)
  set(1, 5, o.skin);
  set(10, 5, o.skin);
  if (o.race === 'Elf') {
    set(1, 4, o.skin);
    set(10, 4, o.skin);
  }

  // eyes + brows
  set(4, 5, o.eyes);
  set(7, 5, o.eyes);
  const brow = o.hairStyle === 'bald' ? '#5a4632' : o.hair;
  set(4, 4, brow);
  set(7, 4, brow);

  // hair, by style
  switch (o.hairStyle) {
    case 'bald':
      break;
    case 'short':
      for (let x = 3; x <= 8; x++) set(x, 1, o.hair);
      for (let x = 2; x <= 9; x++) set(x, 2, o.hair);
      set(2, 4, o.hair);
      set(2, 5, o.hair);
      set(9, 4, o.hair);
      set(9, 5, o.hair);
      break;
    case 'long':
      for (let x = 3; x <= 8; x++) set(x, 1, o.hair);
      for (let x = 2; x <= 9; x++) set(x, 2, o.hair);
      for (let y = 3; y <= 10; y++) {
        set(1, y, o.hair);
        set(10, y, o.hair);
      }
      break;
    case 'mohawk':
      for (let y = 0; y <= 2; y++) {
        set(5, y, o.hair);
        set(6, y, o.hair);
      }
      break;
    case 'topknot':
      for (let x = 4; x <= 7; x++) set(x, 0, o.hair);
      for (let x = 3; x <= 8; x++) set(x, 1, o.hair);
      break;
    case 'bun':
      for (let x = 5; x <= 6; x++) set(x, 0, o.hair);
      for (let x = 4; x <= 7; x++) set(x, 1, o.hair);
      for (let x = 2; x <= 9; x++) set(x, 2, o.hair);
      set(2, 4, o.hair);
      set(9, 4, o.hair);
      break;
    case 'beard':
      for (let y = 7; y <= 10; y++) for (let x = 3; x <= 8; x++) set(x, y, o.hair);
      for (let x = 4; x <= 7; x++) set(x, 11, o.hair);
      break;
  }

  // mouth (painted after the beard so it cuts through)
  if (o.mood === 'smile') {
    set(4, 8, MOUTH);
    set(5, 9, MOUTH);
    set(6, 9, MOUTH);
    set(7, 8, MOUTH);
  } else if (o.mood === 'frown') {
    set(4, 9, MOUTH);
    set(5, 8, MOUTH);
    set(6, 8, MOUTH);
    set(7, 9, MOUTH);
  } else {
    for (let x = 4; x <= 7; x++) set(x, 8, MOUTH);
  }

  // race touches
  if (o.race === 'Orc') {
    set(3, 8, '#e8e0d0'); // tusks
    set(8, 8, '#e8e0d0');
  }
  if (o.race === 'Undead' && o.hairStyle === 'bald') {
    // a faint crack through the dome
    set(6, 2, '#3a3a40');
    set(6, 3, '#3a3a40');
  }

  // seed-driven micro-variation: a stray freckle / stubble pixel
  if (rnd() < 0.5) set(3, 7, 'rgba(0,0,0,0.18)');
  if (rnd() < 0.5) set(8, 7, 'rgba(0,0,0,0.18)');

  return f;
}
