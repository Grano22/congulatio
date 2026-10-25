import type { Suggestion } from './interests';

export type InteractionKind = 'combat' | 'trade' | 'quest' | 'spell' | 'steal' | 'talk' | 'gift' | 'threat';

export type InteractionTone = 'blood' | 'gold' | 'mana' | 'moss' | 'ink';

export const INTERACTION_KIND_INFO: Record<InteractionKind, { label: string; tone: InteractionTone }> = {
  combat: { label: 'Combat', tone: 'blood' },
  threat: { label: 'Threat', tone: 'blood' },
  trade: { label: 'Trade', tone: 'gold' },
  gift: { label: 'Gift', tone: 'gold' },
  quest: { label: 'Quest', tone: 'moss' },
  talk: { label: 'Talk', tone: 'moss' },
  spell: { label: 'Spell', tone: 'mana' },
  steal: { label: 'Steal', tone: 'ink' },
};

export const INTERACTION_KIND_ORDER = Object.keys(INTERACTION_KIND_INFO) as InteractionKind[];

export const PLAYER_ID = 'player';

export type Interaction = {
  id: string;
  kind: InteractionKind;
  sourceId: string;
  targetId: string;
  trigger: string;
  dialogueId: string | null;
  note: string;
};

export const TRIGGER_SUGGESTIONS: Suggestion[] = [
  { label: 'On greet', group: 'Meeting' },
  { label: 'On target spotted', group: 'Meeting' },
  { label: 'When alone with the target', group: 'Meeting' },
  { label: 'On quest accepted', group: 'Progress' },
  { label: 'On quest completed', group: 'Progress' },
  { label: 'On level up', group: 'Progress' },
  { label: 'On HP < 20%', group: 'Combat' },
  { label: 'On ally fallen', group: 'Combat' },
  { label: 'On weapon drawn', group: 'Combat' },
  { label: 'On lock found', group: 'World' },
  { label: 'On item stolen', group: 'World' },
  { label: 'At dawn', group: 'Time' },
  { label: 'At nightfall', group: 'Time' },
  { label: 'On market day', group: 'Time' },
];

export const SAMPLE_INTERACTIONS: Interaction[] = [
  { id: 'act-1', kind: 'combat', sourceId: PLAYER_ID, targetId: 'soul-003', trigger: 'On target spotted', dialogueId: 'd1', note: 'The hall challenge turns to steel.' },
  { id: 'act-2', kind: 'trade', sourceId: 'soul-004', targetId: PLAYER_ID, trigger: 'On greet', dialogueId: 'm1', note: '' },
  { id: 'act-3', kind: 'quest', sourceId: 'soul-001', targetId: PLAYER_ID, trigger: 'On level up', dialogueId: null, note: 'Aldric offers work to proven hands.' },
  { id: 'act-4', kind: 'spell', sourceId: 'soul-002', targetId: PLAYER_ID, trigger: 'On HP < 20%', dialogueId: null, note: 'A healing word when it matters.' },
  { id: 'act-5', kind: 'steal', sourceId: 'soul-005', targetId: 'soul-004', trigger: 'On lock found', dialogueId: 'v4', note: '' },
];

export type InteractionDraft = Omit<Interaction, 'id'>;

export function validateInteraction(draft: InteractionDraft, knownIds: Set<string>): string | null {
  if (!draft.sourceId) return 'Choose who starts the interaction.';
  if (!draft.targetId) return 'Choose who it is aimed at.';
  if (draft.sourceId === draft.targetId) return 'A soul cannot interact with itself.';
  if (!knownIds.has(draft.sourceId) || !knownIds.has(draft.targetId)) return 'One of the souls is no longer in the codex.';
  if (!draft.trigger.trim()) return 'Give the interaction a trigger.';
  return null;
}
