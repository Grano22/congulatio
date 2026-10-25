/**
 * One entry in the dialogue tree: a spoken line, a player choice,
 * or a "next step". `parentId` (null for the opening line) links the
 * entry into the tree; its children are the following steps / options.
 */
export type DialogueNode = {
  id: string;
  parentId: string | null;
  /** 'line' = spoken dialogue / next step, 'choice' = a player option */
  kind: 'line' | 'choice';
  /** the text as written */
  text: string;
  /** who speaks — an NPC name, or 'You' for player options */
  speaker: string;
  variants?: DialogueVariant[];
  impact?: DialogueImpact;
  interaction?: InteractionKind;
  generated?: boolean;
};

export type InteractionKind =
  | 'start'
  | 'continue'
  | 'question'
  | 'reaction'
  | 'trade'
  | 'theft'
  | 'threat'
  | 'gift'
  | 'farewell';

export const INTERACTION_KINDS: { key: InteractionKind; label: string }[] = [
  { key: 'start', label: 'Started conversation' },
  { key: 'continue', label: 'Continuation' },
  { key: 'question', label: 'Asked' },
  { key: 'reaction', label: 'Reacted' },
  { key: 'trade', label: 'Traded' },
  { key: 'theft', label: 'Stole an item' },
  { key: 'threat', label: 'Threatened' },
  { key: 'gift', label: 'Gave a gift' },
  { key: 'farewell', label: 'Ended conversation' },
];

export const INTERACTION_LABEL = Object.fromEntries(INTERACTION_KINDS.map((k) => [k.key, k.label])) as Record<
  InteractionKind,
  string
>;

const INTERACTION_WORDS: { pattern: RegExp; kind: InteractionKind }[] = [
  { pattern: /\b(steal|stole|pickpocket|swipe|pilfer)\b/i, kind: 'theft' },
  { pattern: /\b(offering|gift|give)\b/i, kind: 'gift' },
  { pattern: /\b(ask|whom|what|why|how)\b/i, kind: 'question' },
  { pattern: /\b(haggle|buy|sell|trade|price|reward|pay)\b/i, kind: 'trade' },
  { pattern: /\b(demand|threat|threaten)\b/i, kind: 'threat' },
  { pattern: /\b(leave|turn|walk away|goodbye|farewell)\b/i, kind: 'farewell' },
];

export function interactionOf(node: DialogueNode, parent: DialogueNode | null): InteractionKind {
  if (node.interaction) return node.interaction;
  if (!parent) return 'start';
  if (node.kind === 'line') return parent.kind === 'choice' ? 'reaction' : 'continue';
  return INTERACTION_WORDS.find((w) => w.pattern.test(node.text))?.kind ?? 'continue';
}

export type VariantTone = 'warm' | 'neutral' | 'hostile';

export const VARIANT_TONES: VariantTone[] = ['warm', 'neutral', 'hostile'];

export type DialogueVariant = {
  id: string;
  tone: VariantTone;
  text: string;
};

export type ImpactAxis = 'economy' | 'environment' | 'attitude';

export const IMPACT_AXES: { key: ImpactAxis; label: string }[] = [
  { key: 'economy', label: 'Economy' },
  { key: 'environment', label: 'Environment' },
  { key: 'attitude', label: 'Attitude' },
];

export const IMPACT_LIMIT = 3;

export type DialogueImpact = Record<ImpactAxis, number> & {
  goal: string;
  obstacle: string;
};

export const NO_IMPACT: DialogueImpact = { economy: 0, environment: 0, attitude: 0, goal: '', obstacle: '' };

export const impactOf = (node: DialogueNode): DialogueImpact => node.impact ?? NO_IMPACT;

export function impactChips(node: DialogueNode): string[] {
  const impact = impactOf(node);
  const chips = IMPACT_AXES.filter((a) => impact[a.key] !== 0).map(
    (a) => `${a.label} ${impact[a.key] > 0 ? '+' : '−'}${Math.abs(impact[a.key])}`,
  );
  if (impact.goal) chips.push(`Goal: ${impact.goal}`);
  if (impact.obstacle) chips.push(`Obstacle: ${impact.obstacle}`);
  if (node.variants?.length) chips.push(`${node.variants.length} variant${node.variants.length === 1 ? '' : 's'}`);
  return chips;
}

const SAMPLE_IMPACTS: Record<string, Partial<DialogueImpact>> = {
  d2: { attitude: 1, goal: 'Win the hall’s respect' },
  d4: { economy: 2 },
  d6: { economy: 1, attitude: -2, obstacle: 'Grumhag’s pride' },
  d8: { attitude: -1 },
  d10: { goal: 'Uncover the undying king' },
  m2: { economy: 1, attitude: -1 },
  m4: { attitude: 1, goal: 'Learn the crypt’s secret' },
  m6: { economy: 1, attitude: -2, obstacle: 'Wren’s trust' },
  m8: { economy: -2, attitude: 1 },
  v2: { attitude: 1, goal: 'Reunite Mortimer and Seraphine' },
  v4: { economy: -1, environment: 1, attitude: 2 },
};

const SAMPLE_VARIANTS: Record<string, DialogueVariant[]> = {
  d1: [
    { id: 'd1-w', tone: 'warm', text: '“Ha! A familiar face braves my hall again.”' },
    { id: 'd1-h', tone: 'hostile', text: '“You. I warned you never to darken this door.”' },
  ],
  d7: [{ id: 'd7-h', tone: 'hostile', text: '“Greed and gall. Get out before I make you a rug.”' }],
  m1: [{ id: 'm1-w', tone: 'warm', text: '“My favourite customer! The warm loaf is yours.”' }],
  m3: [{ id: 'm3-h', tone: 'hostile', text: '“Haggle with someone who likes you, then.”' }],
  v1: [
    { id: 'v1-w', tone: 'warm', text: '“Ah, a friend of Seraphine’s. Sit, the dust is clean.”' },
    { id: 'v1-h', tone: 'hostile', text: '“The living come to gawk. Speak, then go.”' },
  ],
};

/**
 * Sample tree, shown until the store lands — a short hall-greeting
 * scene with player options and the steps that follow them.
 */
const SAMPLE_DIALOGUE_LINES: DialogueNode[] = [
  { id: 'd1', parentId: null, kind: 'line', speaker: 'Grumhag', text: '“So, a challenger comes to my hall…”' },
  { id: 'd2', parentId: 'd1', kind: 'choice', speaker: 'You', text: 'Accept the challenge' },
  { id: 'd3', parentId: 'd2', kind: 'line', speaker: 'Grumhag', text: '“Then let steel decide. Meet me at the courtyard at dawn.”' },
  { id: 'd4', parentId: 'd3', kind: 'choice', speaker: 'You', text: 'Ask about the reward' },
  { id: 'd5', parentId: 'd4', kind: 'line', speaker: 'Grumhag', text: '“A shield of moon-steel, and a name remembered.”' },
  { id: 'd6', parentId: 'd3', kind: 'choice', speaker: 'You', text: 'Demand more' },
  { id: 'd7', parentId: 'd6', kind: 'line', speaker: 'Grumhag', text: '“Greed will stain your name, stranger.”' },
  { id: 'd8', parentId: 'd1', kind: 'choice', speaker: 'You', text: 'Turn and leave' },
  { id: 'd9', parentId: 'd8', kind: 'line', speaker: 'Grumhag', text: '“The door remembers those who walk through it.”' },
  { id: 'd10', parentId: 'd1', kind: 'choice', speaker: 'You', text: 'Ask about the legend of the hall' },
  { id: 'd11', parentId: 'd10', kind: 'line', speaker: 'Grumhag', text: '“Old tales say it was built by a king who never died…”' },
  { id: 'm1', parentId: null, kind: 'line', speaker: 'Wren', text: '“Fresh bread, fresher gossip — which will it be?”' },
  { id: 'm2', parentId: 'm1', kind: 'choice', speaker: 'You', text: 'Haggle over the bread' },
  { id: 'm3', parentId: 'm2', kind: 'line', speaker: 'Wren', text: '“Haggle? Seraphine pays full price, and she has had centuries to learn thrift.”' },
  { id: 'm4', parentId: 'm1', kind: 'choice', speaker: 'You', text: 'Ask for gossip' },
  { id: 'm5', parentId: 'm4', kind: 'line', speaker: 'Wren', text: '“They say Mortimer keeps a candle lit for someone in the crypt.”' },
  { id: 'm6', parentId: 'm1', kind: 'choice', speaker: 'You', text: 'Steal a loaf while Wren looks away' },
  { id: 'm7', parentId: 'm6', kind: 'line', speaker: 'Wren', text: '“Thief! Seraphine, stop that one!”' },
  { id: 'm8', parentId: 'm7', kind: 'choice', speaker: 'You', text: 'Pay her twice over' },
  { id: 'm9', parentId: 'm8', kind: 'line', speaker: 'Wren', text: '“Hmph. Twice over buys you half a pardon.”' },
  { id: 'v1', parentId: null, kind: 'line', speaker: 'Mortimer', text: '“The living knock so rarely. Come in, before I remember why.”' },
  { id: 'v2', parentId: 'v1', kind: 'choice', speaker: 'You', text: 'Ask whom the candle is for' },
  { id: 'v3', parentId: 'v2', kind: 'line', speaker: 'Mortimer', text: '“For Seraphine. She promised to visit. Elves keep slow promises.”' },
  { id: 'v4', parentId: 'v1', kind: 'choice', speaker: 'You', text: 'Leave an offering' },
  { id: 'v5', parentId: 'v4', kind: 'line', speaker: 'Mortimer', text: '“Bread? From Wren, I suppose. Even the dead hear of her.”' },
];

export const SAMPLE_DIALOGUE_NODES: DialogueNode[] = SAMPLE_DIALOGUE_LINES.map((node) => ({
  ...node,
  ...(SAMPLE_VARIANTS[node.id] ? { variants: SAMPLE_VARIANTS[node.id] } : {}),
  ...(SAMPLE_IMPACTS[node.id] ? { impact: { ...NO_IMPACT, ...SAMPLE_IMPACTS[node.id] } } : {}),
}));

/** One rendered row of the flattened tree. */
export type DialogueTreeRow = {
  node: DialogueNode;
  depth: number;
  /** last child of its parent — the spine stops below it */
  isLastChild: boolean;
};

/**
 * Depth-first flatten of the tree (opening lines first). Rows stay in
 * reading order, so the view can render a plain vertical list where the
 * indent + connectors do the tree drawing.
 */
export function flattenDialogueTree(nodes: DialogueNode[]): DialogueTreeRow[] {
  const children = new Map<string, DialogueNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? '';
    const list = children.get(key) ?? [];
    list.push(n);
    children.set(key, list);
  }

  const rows: DialogueTreeRow[] = [];
  const walk = (siblings: DialogueNode[], depth: number): void => {
    siblings.forEach((node, i) => {
      rows.push({ node, depth, isLastChild: i === siblings.length - 1 });
      walk(children.get(node.id) ?? [], depth + 1);
    });
  };
  walk(children.get('') ?? [], 0);
  return rows;
}