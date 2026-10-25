import type { RandomCharacter } from './randomCharacter';
import type { DialogueNode } from './dialogue';

export type RelationKind = 'kin' | 'ally' | 'rival' | 'bond' | 'mentor';

export const RELATION_KINDS: RelationKind[] = ['kin', 'ally', 'rival', 'bond', 'mentor'];

export type CharacterRelation = {
  id: string;
  fromId: string;
  toId: string;
  kind: RelationKind;
  note: string;
};

export type RoutineFork = {
  id: string;
  label: string;
  dialogueId: string;
};

export type RoutineScope = 'global' | 'personal';

export type TimeSlot = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export const TIME_SLOTS: { key: TimeSlot; label: string; hours: string }[] = [
  { key: 'dawn', label: 'Dawn', hours: '5–7' },
  { key: 'morning', label: 'Morning', hours: '7–11' },
  { key: 'midday', label: 'Midday', hours: '11–14' },
  { key: 'afternoon', label: 'Afternoon', hours: '14–17' },
  { key: 'dusk', label: 'Dusk', hours: '17–19' },
  { key: 'evening', label: 'Evening', hours: '19–22' },
  { key: 'night', label: 'Night', hours: '22–24' },
  { key: 'midnight', label: 'Midnight', hours: '0–5' },
];

export type Routine = {
  id: string;
  name: string;
  schedule: string;
  participantIds: string[];
  forks: RoutineFork[];
  scope?: RoutineScope;
  ownerId?: string;
  slot?: TimeSlot;
  location?: string;
  note?: string;
};

export type RoutineDraft = Omit<Routine, 'id'>;

const SLOT_WORDS: { pattern: RegExp; slot: TimeSlot }[] = [
  { pattern: /\bmidnight\b/i, slot: 'midnight' },
  { pattern: /\b(dawn|sunrise|daybreak)\b/i, slot: 'dawn' },
  { pattern: /\b(dusk|sunset|twilight)\b/i, slot: 'dusk' },
  { pattern: /\b(noon|midday)\b/i, slot: 'midday' },
  { pattern: /\bafternoon\b/i, slot: 'afternoon' },
  { pattern: /\bevening\b/i, slot: 'evening' },
  { pattern: /\b(night|nightfall)\b/i, slot: 'night' },
  { pattern: /\bmorning\b/i, slot: 'morning' },
];

export const inferSlot = (schedule: string): TimeSlot =>
  SLOT_WORDS.find((w) => w.pattern.test(schedule))?.slot ?? 'morning';

export const slotOf = (routine: Routine): TimeSlot => routine.slot ?? inferSlot(routine.schedule);

export const scopeOf = (routine: Routine): RoutineScope => routine.scope ?? 'global';

export function validateRoutine(draft: RoutineDraft, others: Routine[]): string | null {
  const name = draft.name.trim();
  if (!name) return 'A routine needs a name.';
  if (!draft.schedule.trim()) return 'Say when it happens, for example “every day” or “market days”.';
  if (draft.scope === 'personal' && !draft.ownerId) return 'A personal routine needs a soul to belong to.';
  const clash = others.find(
    (r) =>
      r.name.trim().toLowerCase() === name.toLowerCase() &&
      scopeOf(r) === (draft.scope ?? 'global') &&
      (draft.scope !== 'personal' || r.ownerId === draft.ownerId),
  );
  if (clash) return draft.scope === 'personal' ? 'This soul already has a routine with that name.' : 'A global routine with that name already exists.';
  if (draft.forks.some((f) => !f.label.trim() || !f.dialogueId)) return 'Every fork needs a label and a dialogue step.';
  return null;
}

export const SAMPLE_RELATIONS: CharacterRelation[] = [
  { id: 'rel-1', fromId: 'soul-001', toId: 'soul-003', kind: 'rival', note: 'An old grudge over the hall' },
  { id: 'rel-2', fromId: 'soul-002', toId: 'soul-005', kind: 'bond', note: 'A promise to visit, still unkept' },
  { id: 'rel-3', fromId: 'soul-004', toId: 'soul-002', kind: 'ally', note: 'Bread traded for elvish remedies' },
  { id: 'rel-4', fromId: 'soul-001', toId: 'soul-004', kind: 'mentor', note: 'Taught her to read a ledger' },
];

export const SAMPLE_ROUTINES: Routine[] = [
  {
    id: 'rt-hall',
    name: 'Challenge at the Hall',
    schedule: 'Dusk, every Moonday',
    participantIds: ['soul-003', 'soul-001'],
    forks: [
      { id: 'rt-hall-f1', label: 'A challenger arrives', dialogueId: 'd1' },
      { id: 'rt-hall-f2', label: 'Talk turns to legend', dialogueId: 'd10' },
    ],
  },
  {
    id: 'rt-market',
    name: 'Market Haggling',
    schedule: 'Dawn, on market days',
    participantIds: ['soul-004', 'soul-002'],
    forks: [
      { id: 'rt-market-f1', label: 'The stall opens', dialogueId: 'm1' },
      { id: 'rt-market-f2', label: 'Gossip turns grim', dialogueId: 'm5' },
    ],
  },
  {
    id: 'rt-crypt',
    name: 'Vigil in the Crypt',
    schedule: 'Midnight',
    participantIds: ['soul-005', 'soul-002'],
    forks: [
      { id: 'rt-crypt-f1', label: 'A midnight knock', dialogueId: 'v1' },
      { id: 'rt-crypt-f2', label: 'An offering is left', dialogueId: 'v4' },
    ],
  },
  {
    id: 'rt-watch',
    name: 'Night Watch on the Walls',
    schedule: 'Every night',
    scope: 'global',
    slot: 'night',
    location: 'Valemark walls',
    note: 'Any soul with a spear and a grudge against sleep may join.',
    participantIds: [],
    forks: [],
  },
  {
    id: 'rt-ledger',
    name: 'Tallying the Ledger of Slights',
    schedule: 'Every evening',
    scope: 'personal',
    ownerId: 'soul-001',
    slot: 'evening',
    location: 'Blackwood study',
    note: 'Aldric counts who wronged him today. The third entry is always underlined.',
    participantIds: ['soul-001'],
    forks: [],
  },
];

export type GraphNodeKind = 'character' | 'routine' | 'line' | 'choice';

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  refId: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
};

export type GraphEdgeKind = 'relation' | 'routine' | 'fork' | 'reply' | 'presence';

export type GraphEdge = {
  id: string;
  kind: GraphEdgeKind;
  from: string;
  to: string;
  label: string;
  relationKind?: RelationKind;
  path: string;
  labelX: number;
  labelY: number;
};

export type RelationGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

export type SceneRole = 'speaks' | 'present';

export const GRAPH_NODE_WIDTH = 184;
export const GRAPH_NODE_HEIGHT = 48;
const COLUMN_WIDTH = 250;
const ROW_PITCH = 68;
const MARGIN = 32;
const MARGIN_LEFT = 150;
const DIALOGUE_COLUMN = 2;

export const characterNodeId = (id: string): string => `character:${id}`;
export const routineNodeId = (id: string): string => `routine:${id}`;
export const dialogueNodeId = (id: string): string => `dialogue:${id}`;

const clip = (text: string, max = 26): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const columnX = (column: number): number => MARGIN_LEFT + column * COLUMN_WIDTH;

const centerY = (node: GraphNode): number => node.y + GRAPH_NODE_HEIGHT / 2;

const average = (values: number[]): number => values.reduce((s, v) => s + v, 0) / values.length;

function layoutDialogueRows(dialogue: DialogueNode[]): Map<string, { depth: number; row: number }> {
  const children = new Map<string, DialogueNode[]>();
  for (const node of dialogue) {
    const key = node.parentId ?? '';
    children.set(key, [...(children.get(key) ?? []), node]);
  }
  const placed = new Map<string, { depth: number; row: number }>();
  let nextRow = 0;
  const place = (node: DialogueNode, depth: number): number => {
    const kids = children.get(node.id) ?? [];
    let row: number;
    if (kids.length === 0) {
      row = nextRow;
      nextRow += 1;
    } else {
      const rows = kids.map((kid) => place(kid, depth + 1));
      row = (rows[0] + rows[rows.length - 1]) / 2;
    }
    placed.set(node.id, { depth, row });
    return row;
  };
  for (const root of children.get('') ?? []) {
    place(root, 0);
    nextRow += 0.5;
  }
  return placed;
}

function settleColumn(desired: { id: string; y: number | null }[]): Map<string, number> {
  const anchored = desired.filter((d) => d.y !== null).sort((a, b) => a.y! - b.y!);
  const loose = desired.filter((d) => d.y === null);
  const settled = new Map<string, number>();
  let last = MARGIN - ROW_PITCH;
  for (const d of [...anchored, ...loose]) {
    const y = Math.max(d.y ?? last + ROW_PITCH, last + ROW_PITCH, MARGIN);
    settled.set(d.id, y);
    last = y;
  }
  return settled;
}

function curve(x1: number, y1: number, x2: number, y2: number): { path: string; labelX: number; labelY: number } {
  const pull = Math.max(60, Math.abs(x2 - x1) * 0.4) * Math.sign(x2 - x1 || 1);
  return {
    path: `M ${x1} ${y1} C ${x1 + pull} ${y1}, ${x2 - pull} ${y2}, ${x2} ${y2}`,
    labelX: (x1 + x2) / 2,
    labelY: (y1 + y2) / 2 - 6,
  };
}

function sideArc(x: number, y1: number, y2: number): { path: string; labelX: number; labelY: number } {
  const controlX = x - 40 - Math.abs(y2 - y1) * 0.35;
  return {
    path: `M ${x} ${y1} Q ${controlX} ${(y1 + y2) / 2}, ${x} ${y2}`,
    labelX: (x + controlX) / 2,
    labelY: (y1 + y2) / 2 + 4,
  };
}

export function sceneParticipants(
  dialogueId: string,
  dialogue: DialogueNode[],
  characters: RandomCharacter[],
  routines: Routine[],
): { characterId: string; role: SceneRole }[] {
  const byId = new Map(dialogue.map((n) => [n.id, n]));
  const node = byId.get(dialogueId);
  if (!node) return [];
  const lineage = new Set<string>();
  for (let cur: DialogueNode | undefined = node; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
    lineage.add(cur.id);
  }
  const known = new Set(characters.map((c) => c.id));
  const speakers = characters.filter((c) => c.firstName === node.speaker).map((c) => c.id);
  const present = routines
    .filter((r) => r.forks.some((f) => lineage.has(f.dialogueId)))
    .flatMap((r) => r.participantIds)
    .filter((id) => known.has(id) && !speakers.includes(id));
  return [
    ...speakers.map((characterId) => ({ characterId, role: 'speaks' as const })),
    ...[...new Set(present)].map((characterId) => ({ characterId, role: 'present' as const })),
  ];
}

export function buildRelationGraph(
  characters: RandomCharacter[],
  dialogue: DialogueNode[],
  relations: CharacterRelation[],
  routines: Routine[],
): RelationGraph {
  const nodes = new Map<string, GraphNode>();

  const dialogueRows = layoutDialogueRows(dialogue);
  for (const line of dialogue) {
    const spot = dialogueRows.get(line.id)!;
    nodes.set(dialogueNodeId(line.id), {
      id: dialogueNodeId(line.id),
      kind: line.kind,
      refId: line.id,
      title: clip(line.text),
      subtitle: `${line.speaker} · ${line.kind === 'choice' ? 'Option' : 'Line'}`,
      x: columnX(DIALOGUE_COLUMN + spot.depth),
      y: MARGIN + spot.row * ROW_PITCH,
    });
  }

  const routineY = settleColumn(
    routines.map((r) => {
      const targets = r.forks.map((f) => nodes.get(dialogueNodeId(f.dialogueId))).filter((n) => !!n);
      return { id: r.id, y: targets.length ? average(targets.map((n) => n.y)) : null };
    }),
  );
  for (const routine of routines) {
    nodes.set(routineNodeId(routine.id), {
      id: routineNodeId(routine.id),
      kind: 'routine',
      refId: routine.id,
      title: clip(routine.name),
      subtitle: routine.schedule,
      x: columnX(1),
      y: routineY.get(routine.id)!,
    });
  }

  const characterY = settleColumn(
    characters.map((c) => {
      const joined = routines.filter((r) => r.participantIds.includes(c.id)).map((r) => routineY.get(r.id)!);
      return { id: c.id, y: joined.length ? average(joined) : null };
    }),
  );
  for (const character of characters) {
    nodes.set(characterNodeId(character.id), {
      id: characterNodeId(character.id),
      kind: 'character',
      refId: character.id,
      title: clip(`${character.firstName} ${character.lastName}`.trim() || 'Nameless soul'),
      subtitle: `${character.race} · Lv ${character.level}`,
      x: columnX(0),
      y: characterY.get(character.id)!,
    });
  }

  const edges: GraphEdge[] = [];
  const forward = (id: string, kind: GraphEdgeKind, from: GraphNode, to: GraphNode, label: string): GraphEdge => ({
    id,
    kind,
    from: from.id,
    to: to.id,
    label,
    ...curve(from.x + GRAPH_NODE_WIDTH, centerY(from), to.x, centerY(to)),
  });

  for (const relation of relations) {
    const from = nodes.get(characterNodeId(relation.fromId));
    const to = nodes.get(characterNodeId(relation.toId));
    if (!from || !to) continue;
    edges.push({
      id: `relation:${relation.id}`,
      kind: 'relation',
      from: from.id,
      to: to.id,
      label: relation.kind,
      relationKind: relation.kind,
      ...sideArc(from.x, centerY(from), centerY(to)),
    });
  }

  for (const routine of routines) {
    const routineNode = nodes.get(routineNodeId(routine.id))!;
    for (const participantId of routine.participantIds) {
      const character = nodes.get(characterNodeId(participantId));
      if (character) edges.push(forward(`routine:${routine.id}:${participantId}`, 'routine', character, routineNode, 'keeps'));
    }
    for (const fork of routine.forks) {
      const target = nodes.get(dialogueNodeId(fork.dialogueId));
      if (target) edges.push(forward(`fork:${fork.id}`, 'fork', routineNode, target, fork.label));
    }
  }

  for (const line of dialogue) {
    if (!line.parentId) continue;
    const parent = nodes.get(dialogueNodeId(line.parentId));
    const child = nodes.get(dialogueNodeId(line.id))!;
    if (parent) edges.push(forward(`reply:${line.id}`, 'reply', parent, child, line.kind === 'choice' ? 'option' : 'answer'));
  }

  for (const line of dialogue) {
    const lineNode = nodes.get(dialogueNodeId(line.id))!;
    for (const { characterId, role } of sceneParticipants(line.id, dialogue, characters, routines)) {
      const character = nodes.get(characterNodeId(characterId))!;
      edges.push({
        id: `presence:${line.id}:${characterId}`,
        kind: 'presence',
        from: lineNode.id,
        to: character.id,
        label: role,
        ...curve(lineNode.x, centerY(lineNode), character.x + GRAPH_NODE_WIDTH, centerY(character)),
      });
    }
  }

  const all = [...nodes.values()];
  return {
    nodes: all,
    edges,
    width: Math.max(...all.map((n) => n.x + GRAPH_NODE_WIDTH), columnX(1)) + MARGIN,
    height: Math.max(...all.map((n) => n.y + GRAPH_NODE_HEIGHT), MARGIN) + MARGIN,
  };
}
