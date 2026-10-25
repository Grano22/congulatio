import type { RandomCharacter } from './randomCharacter';
import type { DialogueNode } from './dialogue';
import type { CharacterRelation, Routine } from './relations';
import { INTERACTION_KIND_INFO, Interaction, PLAYER_ID } from './interactions';

export type SearchKind = 'character' | 'line' | 'option' | 'routine' | 'bond' | 'interaction' | 'action';

export const SEARCH_TAGS: Record<SearchKind, string> = {
  character: 'Character',
  line: 'Dialogue line',
  option: 'Option',
  routine: 'Routine',
  bond: 'Bond',
  interaction: 'Interaction',
  action: 'Action',
};

const KIND_ORDER: SearchKind[] = ['character', 'routine', 'line', 'option', 'bond', 'interaction', 'action'];

export type SearchTarget =
  | { kind: 'soul'; id: string }
  | { kind: 'dialogue'; id: string }
  | { kind: 'routine'; id: string }
  | { kind: 'bond'; fromId: string }
  | { kind: 'interaction'; id: string }
  | { kind: 'command'; id: string };

export type SearchItem = {
  key: string;
  kind: SearchKind;
  label: string;
  sub: string;
  haystack: string;
  target: SearchTarget;
};

export type SearchHit = SearchItem & { before: string; match: string; after: string };

export type SearchSource = {
  characters: RandomCharacter[];
  dialogue: DialogueNode[];
  routines: Routine[];
  relations: CharacterRelation[];
  interactions: Interaction[];
  actions: { id: string; label: string; group: string }[];
};

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const clip = (text: string, max = 80): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function buildSearchIndex(source: SearchSource): SearchItem[] {
  const names = new Map(source.characters.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
  const items: SearchItem[] = [];

  for (const c of source.characters) {
    const full = names.get(c.id) || 'Nameless soul';
    const label = c.nickname ? `${full} (${c.nickname})` : full;
    items.push({
      key: `character:${c.id}`,
      kind: 'character',
      label,
      sub: `${c.race} · Lv ${c.level} · ${c.origin}`,
      haystack: fold(`${label} ${c.race} ${c.origin} ${c.temperament}`),
      target: { kind: 'soul', id: c.id },
    });
  }

  for (const r of source.routines) {
    const keepers = r.participantIds.map((id) => names.get(id)).filter(Boolean).join(', ');
    items.push({
      key: `routine:${r.id}`,
      kind: 'routine',
      label: r.name,
      sub: [r.scope === 'personal' ? 'Personal' : 'Global', r.schedule, r.location, keepers].filter(Boolean).join(' · '),
      haystack: fold(`${r.name} ${r.schedule} ${r.location ?? ''} ${r.note ?? ''} ${keepers} ${r.forks.map((f) => f.label).join(' ')}`),
      target: { kind: 'routine', id: r.id },
    });
  }

  for (const n of source.dialogue) {
    const kind: SearchKind = n.kind === 'choice' ? 'option' : 'line';
    items.push({
      key: `dialogue:${n.id}`,
      kind,
      label: clip(n.text),
      sub: n.speaker,
      haystack: fold(`${n.text} ${n.speaker} ${(n.variants ?? []).map((v) => v.text).join(' ')} ${n.impact?.goal ?? ''} ${n.impact?.obstacle ?? ''}`),
      target: { kind: 'dialogue', id: n.id },
    });
  }

  for (const b of source.relations) {
    const from = names.get(b.fromId);
    const to = names.get(b.toId);
    if (!from || !to) continue;
    items.push({
      key: `bond:${b.id}`,
      kind: 'bond',
      label: `${from} – ${to}`,
      sub: [b.kind, b.note].filter(Boolean).join(' · '),
      haystack: fold(`${from} ${to} ${b.kind} ${b.note}`),
      target: { kind: 'bond', fromId: b.fromId },
    });
  }

  const party = (id: string): string => (id === PLAYER_ID ? 'Player' : (names.get(id) ?? 'Missing soul'));
  for (const i of source.interactions) {
    const kind = INTERACTION_KIND_INFO[i.kind]?.label ?? i.kind;
    const label = `${kind}: ${party(i.sourceId)} → ${party(i.targetId)}`;
    items.push({
      key: `interaction:${i.id}`,
      kind: 'interaction',
      label,
      sub: [i.trigger, i.note].filter(Boolean).join(' · '),
      haystack: fold(`${label} ${i.trigger} ${i.note}`),
      target: { kind: 'interaction', id: i.id },
    });
  }

  for (const a of source.actions) {
    items.push({
      key: `action:${a.id}`,
      kind: 'action',
      label: a.label,
      sub: a.group,
      haystack: fold(`${a.label} ${a.group}`),
      target: { kind: 'command', id: a.id },
    });
  }

  return items;
}

export function searchIndex(items: SearchItem[], query: string, limit = 40): SearchHit[] {
  const q = fold(query.trim());
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    if (!tokens.every((t) => item.haystack.includes(t))) continue;
    const label = fold(item.label);
    const score = label.startsWith(q)
      ? 0
      : label.split(/[\s(–-]+/).some((w) => w.startsWith(tokens[0]))
        ? 1
        : label.includes(q)
          ? 2
          : 3;
    scored.push({ item, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind) ||
      a.item.label.localeCompare(b.item.label),
  );
  return scored.slice(0, limit).map(({ item }) => {
    const at = fold(item.label).indexOf(tokens[0]);
    if (at < 0) return { ...item, before: item.label, match: '', after: '' };
    return {
      ...item,
      before: item.label.slice(0, at),
      match: item.label.slice(at, at + tokens[0].length),
      after: item.label.slice(at + tokens[0].length),
    };
  });
}
