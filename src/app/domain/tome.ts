import type { RandomCharacter } from './randomCharacter';
import type { DialogueNode } from './dialogue';
import type { CharacterRelation, Routine } from './relations';
import { INTERACTION_KIND_INFO, Interaction, PLAYER_ID } from './interactions';
import type { CustomAttribute } from './attributes';

export const TOME_FORMAT = 'congulatio-tome';
export const TOME_VERSION = 1;

export type TomeSnapshot = {
  characters: RandomCharacter[];
  dialogue: DialogueNode[];
  relations: CharacterRelation[];
  routines: Routine[];
  interactions: Interaction[];
  attributeDefs: CustomAttribute[];
};

export type ChangesetEntry = {
  id: number;
  label: string;
  details: string[];
  at: string;
};

export type HistoryEntry = ChangesetEntry & { snapshot: TomeSnapshot };

export type TomeFile = {
  format: typeof TOME_FORMAT;
  version: number;
  exportedAt: string;
  tome: TomeSnapshot;
  changeset?: ChangesetEntry[];
  history?: { index: number; entries: HistoryEntry[] };
};

export class TomeError extends Error {}

export const sameSnapshot = (a: TomeSnapshot, b: TomeSnapshot): boolean =>
  a.characters === b.characters &&
  a.dialogue === b.dialogue &&
  a.relations === b.relations &&
  a.routines === b.routines &&
  a.interactions === b.interactions &&
  a.attributeDefs === b.attributeDefs;

const clip = (text: string, max = 36): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function describeList<T extends { id: string }>(
  noun: string,
  before: T[],
  after: T[],
  name: (item: T) => string,
): { noun: string; details: string[] } {
  if (before === after) return { noun, details: [] };
  const old = new Map(before.map((x) => [x.id, x]));
  const now = new Map(after.map((x) => [x.id, x]));
  return {
    noun,
    details: [
      ...after.filter((x) => !old.has(x.id)).map((x) => `Added ${noun} ${name(x)}`),
      ...after.filter((x) => old.has(x.id) && old.get(x.id) !== x).map((x) => `Edited ${noun} ${name(x)}`),
      ...before.filter((x) => !now.has(x.id)).map((x) => `Removed ${noun} ${name(x)}`),
    ],
  };
}

export function describeChange(before: TomeSnapshot, after: TomeSnapshot): { label: string; details: string[] } {
  const soulName = (c: RandomCharacter): string => `${c.firstName} ${c.lastName}`.trim() || 'a nameless soul';
  const names = new Map([...before.characters, ...after.characters].map((c) => [c.id, soulName(c)]));
  const party = (id: string): string => (id === PLAYER_ID ? 'Player' : (names.get(id) ?? 'someone'));
  const parts = [
    describeList('soul', before.characters, after.characters, soulName),
    describeList('line', before.dialogue, after.dialogue, (n) => `“${clip(n.text)}”`),
    describeList('bond', before.relations, after.relations, (r) => `${names.get(r.fromId) ?? 'someone'} – ${names.get(r.toId) ?? 'someone'} (${r.kind})`),
    describeList('routine', before.routines, after.routines, (r) => r.name),
    describeList(
      'interaction',
      before.interactions,
      after.interactions,
      (i) => `${INTERACTION_KIND_INFO[i.kind]?.label ?? i.kind} ${party(i.sourceId)} → ${party(i.targetId)}`,
    ),
    describeList('attribute', before.attributeDefs, after.attributeDefs, (a) => `${a.key} (${a.name})`),
  ];
  const details = parts.flatMap((p) => p.details);
  if (details.length === 0) return { label: 'Reordered the tome', details };
  if (details.length === 1) return { label: details[0], details };
  const counts = parts
    .filter((p) => p.details.length)
    .map((p) => `${p.details.length} ${p.noun}${p.details.length === 1 ? '' : 's'}`);
  return { label: `Changed ${counts.join(', ')}`, details };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkList(value: unknown, what: string, check: (item: Record<string, unknown>) => boolean): void {
  if (!Array.isArray(value)) throw new TomeError(`The tome has no ${what} list.`);
  const bad = value.findIndex((item) => !isObject(item) || typeof item['id'] !== 'string' || !check(item));
  if (bad >= 0) throw new TomeError(`Entry ${bad + 1} in ${what} is damaged.`);
}

export function validateSnapshot(value: unknown): TomeSnapshot {
  if (!isObject(value)) throw new TomeError('The tome is empty.');
  checkList(value['characters'], 'souls', (c) => typeof c['firstName'] === 'string' && Array.isArray(c['face']));
  checkList(
    value['dialogue'],
    'dialogue',
    (n) =>
      typeof n['text'] === 'string' &&
      typeof n['speaker'] === 'string' &&
      (n['kind'] === 'line' || n['kind'] === 'choice') &&
      (n['parentId'] === null || typeof n['parentId'] === 'string'),
  );
  checkList(value['relations'], 'relations', (r) => typeof r['fromId'] === 'string' && typeof r['toId'] === 'string');
  checkList(value['routines'], 'routines', (r) => typeof r['name'] === 'string' && Array.isArray(r['forks']));
  const interactions = value['interactions'] ?? [];
  checkList(
    interactions,
    'interactions',
    (i) =>
      typeof i['kind'] === 'string' &&
      i['kind'] in INTERACTION_KIND_INFO &&
      typeof i['sourceId'] === 'string' &&
      typeof i['targetId'] === 'string' &&
      typeof i['trigger'] === 'string',
  );
  const attributeDefs = value['attributeDefs'] ?? [];
  checkList(
    attributeDefs,
    'attributes',
    (a) => typeof a['key'] === 'string' && typeof a['name'] === 'string' && typeof a['min'] === 'number' && typeof a['max'] === 'number',
  );
  return {
    ...(value as unknown as TomeSnapshot),
    interactions: interactions as Interaction[],
    attributeDefs: attributeDefs as CustomAttribute[],
  };
}

export function parseTomeFile(text: string): TomeFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TomeError('This file is not valid JSON.');
  }
  if (!isObject(data) || data['format'] !== TOME_FORMAT) throw new TomeError('This file is not a Congulatio tome.');
  if (typeof data['version'] !== 'number' || data['version'] > TOME_VERSION) {
    throw new TomeError('This tome was written by a newer version of Congulatio.');
  }
  const tome = validateSnapshot(data['tome']);
  const file: TomeFile = { format: TOME_FORMAT, version: data['version'], exportedAt: String(data['exportedAt'] ?? ''), tome };
  const history = data['history'];
  if (isObject(history) && Array.isArray(history['entries']) && typeof history['index'] === 'number') {
    const entries = (history['entries'] as unknown[]).map((e, i) => {
      if (!isObject(e)) throw new TomeError(`History entry ${i + 1} is damaged.`);
      return {
        id: Number(e['id'] ?? i),
        label: String(e['label'] ?? 'Change'),
        details: Array.isArray(e['details']) ? (e['details'] as unknown[]).map(String) : [],
        at: String(e['at'] ?? ''),
        snapshot: validateSnapshot(e['snapshot']),
      };
    });
    const index = Math.min(Math.max(0, Math.floor(history['index'] as number)), entries.length - 1);
    if (entries.length) file.history = { index, entries };
  }
  if (Array.isArray(data['changeset'])) {
    file.changeset = (data['changeset'] as unknown[]).filter(isObject).map((e, i) => ({
      id: Number(e['id'] ?? i),
      label: String(e['label'] ?? 'Change'),
      details: Array.isArray(e['details']) ? (e['details'] as unknown[]).map(String) : [],
      at: String(e['at'] ?? ''),
    }));
  }
  return file;
}

export const toChangeset = (entries: HistoryEntry[]): ChangesetEntry[] =>
  entries.map(({ id, label, details, at }) => ({ id, label, details, at }));
