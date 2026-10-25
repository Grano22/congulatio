import type { RandomCharacter } from './randomCharacter';
import type { DialogueNode } from './dialogue';
import type { CharacterRelation } from './relations';

export type AiAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

export const MAX_OPTIONS = 4;
const MAX_TEXT = 220;

export type DraftStep = {
  key: string;
  parentKey: string | null;
  parentId: string | null;
  kind: DialogueNode['kind'];
  speaker: string;
  text: string;
  include: boolean;
};

export class StoryAiError extends Error {}

const optionSchema = {
  type: 'object',
  properties: {
    option: { type: 'string', description: 'What the player says or does, short' },
    reply: { type: 'string', description: 'How the speaker answers, in quotes, one or two sentences' },
  },
  required: ['option', 'reply'],
  additionalProperties: false,
};

export const NEXT_STEPS_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    options: { type: 'array', minItems: 1, maxItems: MAX_OPTIONS, items: optionSchema },
  },
  required: ['options'],
  additionalProperties: false,
};

export const SCENE_SCHEMA = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
    options: { type: 'array', minItems: 2, maxItems: MAX_OPTIONS, items: optionSchema },
  },
  required: ['opening', 'options'],
  additionalProperties: false,
};

export const POLISH_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
};

export const SYSTEM_PROMPT = [
  'You write dialogue for a fantasy role-playing game.',
  'Characters speak in a grounded, slightly old-fashioned voice that fits their temperament.',
  'NPC lines are wrapped in “curly quotes”. Player options are short actions or questions without quotes.',
  'Never mention being an AI. Keep every line under 30 words. Answer only with the requested JSON.',
].join(' ');

function describeSoul(soul: RandomCharacter | undefined, speaker: string, relations: CharacterRelation[]): string {
  if (!soul) return `${speaker} is the speaker.`;
  const name = `${soul.firstName} ${soul.lastName}`.trim();
  const bonds = relations
    .filter((r) => r.fromId === soul.id || r.toId === soul.id)
    .map((r) => `${r.kind}${r.note ? ` (${r.note})` : ''}`)
    .slice(0, 3);
  return [
    `${name}${soul.nickname ? ` "${soul.nickname}"` : ''} is a ${soul.temperament.toLowerCase()} ${soul.race.toLowerCase()} of ${soul.origin}, level ${soul.level}.`,
    soul.note ? `About them: ${soul.note}` : '',
    bonds.length ? `Their bonds: ${bonds.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function lineageOf(nodeId: string, nodes: DialogueNode[]): DialogueNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: DialogueNode[] = [];
  for (let cur = byId.get(nodeId); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) path.unshift(cur);
  return path;
}

export function speakerFor(nodeId: string, nodes: DialogueNode[]): string {
  const path = lineageOf(nodeId, nodes);
  return [...path].reverse().find((n) => n.kind === 'line')?.speaker ?? path[0]?.speaker ?? 'Stranger';
}

export function nextStepsPrompt(
  cursorId: string,
  nodes: DialogueNode[],
  characters: RandomCharacter[],
  relations: CharacterRelation[],
  count: number,
  hint: string,
): string {
  const path = lineageOf(cursorId, nodes);
  const cursor = path[path.length - 1];
  const speaker = speakerFor(cursorId, nodes);
  const soul = characters.find((c) => c.firstName === speaker);
  const transcript = path.map((n) => (n.kind === 'choice' ? `Player: ${n.text}` : `${n.speaker}: ${n.text}`)).join('\n');
  const existing = nodes.filter((n) => n.parentId === cursor.id).map((n) => n.text);
  return [
    describeSoul(soul, speaker, relations),
    `The conversation so far:\n${transcript}`,
    cursor.kind === 'choice'
      ? `First write "reply": how ${speaker} answers the player's last option. Then write ${count} different "options" the player could say next, each with ${speaker}'s "reply".`
      : `Write ${count} different "options" the player could say next, each with ${speaker}'s "reply". Leave out "reply" at the top level.`,
    existing.length ? `Avoid repeating these existing branches: ${existing.join(' | ')}` : '',
    hint.trim() ? `Direction from the writer: ${hint.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function scenePrompt(soul: RandomCharacter, relations: CharacterRelation[], topic: string, count: number): string {
  return [
    describeSoul(soul, soul.firstName, relations),
    `Start a new scene where the player meets ${soul.firstName}.`,
    topic.trim() ? `The scene is about: ${topic.trim()}` : 'Pick a fitting everyday situation for them.',
    `Write "opening": ${soul.firstName}'s first line. Then write ${count} different "options" for the player, each with ${soul.firstName}'s "reply".`,
  ].join('\n\n');
}

export function polishPrompt(text: string, kind: DialogueNode['kind'], speaker: string, soul: RandomCharacter | undefined, relations: CharacterRelation[]): string {
  return [
    kind === 'line' ? describeSoul(soul, speaker, relations) : 'The player is a travelling adventurer.',
    kind === 'line'
      ? `Rewrite this line so ${speaker} says it in their own voice, keeping its meaning. Wrap it in “curly quotes”.`
      : 'Rewrite this player option as a short, vivid action or question, keeping its meaning. No quotes.',
    `Text: ${text.trim()}`,
    'Answer with "text" only.',
  ].join('\n\n');
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';

function parseJson(raw: string): Record<string, unknown> {
  try {
    const data = JSON.parse(raw);
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    throw new StoryAiError('The model answered in a shape the composer could not read. Try again.');
  }
  throw new StoryAiError('The model answered in a shape the composer could not read. Try again.');
}

function parseOptions(value: unknown): { option: string; reply: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((o) => (typeof o === 'object' && o !== null ? { option: clean((o as Record<string, unknown>)['option']), reply: clean((o as Record<string, unknown>)['reply']) } : null))
    .filter((o): o is { option: string; reply: string } => !!o && !!o.option && !!o.reply)
    .slice(0, MAX_OPTIONS);
}

let draftCounter = 0;
const draftKey = (): string => `draft-${++draftCounter}`;

function optionDrafts(options: { option: string; reply: string }[], parentKey: string | null, parentId: string | null, speaker: string): DraftStep[] {
  return options.flatMap(({ option, reply }) => {
    const optionKey = draftKey();
    return [
      { key: optionKey, parentKey, parentId, kind: 'choice' as const, speaker: 'You', text: option, include: true },
      { key: draftKey(), parentKey: optionKey, parentId: null, kind: 'line' as const, speaker, text: reply, include: true },
    ];
  });
}

export function parseNextSteps(raw: string, cursor: DialogueNode, speaker: string): DraftStep[] {
  const data = parseJson(raw);
  const options = parseOptions(data['options']);
  if (cursor.kind === 'choice') {
    const reply = clean(data['reply']);
    if (!reply) throw new StoryAiError(`The model forgot ${speaker}'s answer. Try again.`);
    const replyKey = draftKey();
    return [
      { key: replyKey, parentKey: null, parentId: cursor.id, kind: 'line', speaker, text: reply, include: true },
      ...optionDrafts(options, replyKey, null, speaker),
    ];
  }
  if (!options.length) throw new StoryAiError('The model suggested no usable options. Try again or add a direction.');
  return optionDrafts(options, null, cursor.id, speaker);
}

export function parseScene(raw: string, speaker: string): DraftStep[] {
  const data = parseJson(raw);
  const opening = clean(data['opening']);
  const options = parseOptions(data['options']);
  if (!opening || !options.length) throw new StoryAiError('The model did not write a complete scene. Try again.');
  const openingKey = draftKey();
  return [
    { key: openingKey, parentKey: null, parentId: null, kind: 'line', speaker, text: opening, include: true },
    ...optionDrafts(options, openingKey, null, speaker),
  ];
}

export function parsePolish(raw: string): string {
  const text = clean(parseJson(raw)['text']);
  if (!text) throw new StoryAiError('The model returned an empty rewrite. Try again.');
  return text;
}

export function effectiveDrafts(drafts: DraftStep[]): DraftStep[] {
  const included = new Set<string>();
  const kept: DraftStep[] = [];
  for (const d of drafts) {
    if (!d.include || !d.text.trim()) continue;
    if (d.parentKey && !included.has(d.parentKey)) continue;
    included.add(d.key);
    kept.push(d);
  }
  return kept;
}

export function materialize(drafts: DraftStep[], makeId: () => string): DialogueNode[] {
  const ids = new Map<string, string>();
  return effectiveDrafts(drafts).map((d) => {
    const id = makeId();
    ids.set(d.key, id);
    return {
      id,
      parentId: d.parentKey ? ids.get(d.parentKey)! : d.parentId,
      kind: d.kind,
      speaker: d.speaker,
      text: d.text.trim(),
      generated: true,
    };
  });
}
