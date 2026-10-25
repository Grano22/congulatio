import type { DialogueNode } from './dialogue';

export type Suggestion = { label: string; group: string };

export const IN_THIS_WORLD = 'In this world';

export const COMMON_GOALS: Suggestion[] = [
  { label: 'Coordinated attack', group: 'Combat' },
  { label: 'Defending the settlement', group: 'Combat' },
  { label: 'Hunting a beast', group: 'Combat' },
  { label: 'Avenging a wrong', group: 'Combat' },
  { label: 'Selling & buying', group: 'Trade' },
  { label: 'Trading intelligence', group: 'Trade' },
  { label: 'Escorting a caravan', group: 'Trade' },
  { label: 'Paying off a debt', group: 'Trade' },
  { label: 'Claiming a reward', group: 'Trade' },
  { label: 'Convincing to join an initiative', group: 'Diplomacy' },
  { label: 'Recruiting into the group', group: 'Diplomacy' },
  { label: 'Swearing into the clan', group: 'Diplomacy' },
  { label: 'Forging an alliance', group: 'Diplomacy' },
  { label: 'Brokering peace', group: 'Diplomacy' },
  { label: 'Winning respect', group: 'Diplomacy' },
  { label: 'Gathering supplies', group: 'Survival' },
  { label: 'Building a shelter', group: 'Survival' },
  { label: 'Healing the sick', group: 'Survival' },
  { label: 'Rescuing a captive', group: 'Survival' },
  { label: 'Uncovering a secret', group: 'Lore' },
  { label: 'Finding a lost relic', group: 'Lore' },
];

export const OBSTACLES: Suggestion[] = [
  { label: 'High fees', group: 'Coin' },
  { label: 'Lack of coin', group: 'Coin' },
  { label: 'Debt collectors', group: 'Coin' },
  { label: 'Wild nature', group: 'Nature' },
  { label: 'Harsh winter', group: 'Nature' },
  { label: 'Blocked pass', group: 'Nature' },
  { label: 'Broken bridge', group: 'Nature' },
  { label: 'Cursed ground', group: 'Nature' },
  { label: 'Ending food', group: 'Supplies' },
  { label: 'Running out of water', group: 'Supplies' },
  { label: 'Sickness', group: 'Supplies' },
  { label: 'Wounded companion', group: 'Supplies' },
  { label: 'Bandits on the road', group: 'Threats' },
  { label: 'Rival faction', group: 'Threats' },
  { label: 'Watchful guards', group: 'Threats' },
  { label: 'Distrust between clans', group: 'People' },
  { label: 'Old grudge', group: 'People' },
  { label: 'Language barrier', group: 'People' },
  { label: 'Superstition', group: 'People' },
  { label: 'Pride', group: 'People' },
  { label: 'Missing map', group: 'Knowledge' },
];

export function withWorldValues(presets: Suggestion[], nodes: DialogueNode[], field: 'goal' | 'obstacle'): Suggestion[] {
  const known = new Set(presets.map((s) => s.label.toLowerCase()));
  const used = new Set<string>();
  for (const node of nodes) {
    const value = node.impact?.[field]?.trim();
    if (value && !known.has(value.toLowerCase())) used.add(value);
  }
  return [...[...used].sort().map((label) => ({ label, group: IN_THIS_WORLD })), ...presets];
}
