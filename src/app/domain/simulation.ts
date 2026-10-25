import type { RandomCharacter } from './randomCharacter';
import type { CharacterRelation } from './relations';
import { DialogueImpact, DialogueNode, IMPACT_AXES, ImpactAxis, VariantTone, impactOf } from './dialogue';

export type Motivation = 'wealth' | 'honor' | 'safety' | 'curiosity' | 'kinship' | 'power';

export const MOTIVATIONS: { key: Motivation; label: string }[] = [
  { key: 'wealth', label: 'Wealth' },
  { key: 'honor', label: 'Honor' },
  { key: 'safety', label: 'Safety' },
  { key: 'curiosity', label: 'Curiosity' },
  { key: 'kinship', label: 'Kinship' },
  { key: 'power', label: 'Power' },
];

const TEMPERAMENT_LEANING: Record<string, Partial<Record<Motivation, number>>> = {
  Stubborn: { honor: 0.5, power: 0.5 },
  Cunning: { wealth: 0.5, curiosity: 0.5 },
  Jolly: { kinship: 0.5, wealth: 0.25 },
  Melancholic: { safety: 0.5 },
  Fierce: { power: 0.5, honor: 0.5 },
  Wise: { curiosity: 0.5, safety: 0.25 },
  Gregarious: { kinship: 0.5, curiosity: 0.25 },
  Brooding: { safety: 0.5, power: 0.25 },
  Kind: { kinship: 0.75 },
  Scheming: { power: 0.5, wealth: 0.5 },
};

const WORD_PULL: { pattern: RegExp; pull: Partial<Record<Motivation, number>> }[] = [
  { pattern: /\b(accept|challenge|duty|promise|honou?r)\b/i, pull: { honor: 1.5, power: 0.75, safety: -1 } },
  { pattern: /\b(demand|take|threat|force|more)\b/i, pull: { power: 1.5, safety: -0.5 } },
  { pattern: /\b(ask|legend|tale|whom|gossip|secret)\b/i, pull: { curiosity: 1.5 } },
  { pattern: /\b(leave|turn|walk|flee)\b/i, pull: { safety: 1.5, honor: -0.5 } },
  { pattern: /\b(reward|haggle|coin|price|gold)\b/i, pull: { wealth: 1.5 } },
  { pattern: /\b(offering|gift|help|friend)\b/i, pull: { kinship: 1.5 } },
];

const WARM_RELATIONS = new Set(['kin', 'ally', 'bond', 'mentor']);

const MAX_STEPS = 40;

const LOOKAHEAD_DEPTH = 3;

const FUTURE_DISCOUNT = 0.6;

export type SimulationStep = {
  nodeId: string;
  speaker: string;
  text: string;
  kind: DialogueNode['kind'];
  tone?: VariantTone;
  reasons: string[];
  passedOver: number;
};

export type SimulationOutcome = {
  steps: SimulationStep[];
  totals: Record<ImpactAxis, number>;
  goals: string[];
  obstacles: string[];
  verdict: string;
};

function motivationPull(choice: DialogueNode): Record<Motivation, number> {
  const impact = impactOf(choice);
  const pull: Record<Motivation, number> = {
    wealth: impact.economy,
    honor: impact.attitude * 0.5,
    safety: impact.environment - Math.max(0, -impact.attitude) * 0.5,
    curiosity: impact.goal ? 1 : 0,
    kinship: impact.attitude,
    power: -impact.attitude * 0.25 + (impact.obstacle ? 0.5 : 0),
  };
  for (const { pattern, pull: extra } of WORD_PULL) {
    if (!pattern.test(choice.text)) continue;
    for (const [m, v] of Object.entries(extra) as [Motivation, number][]) pull[m] += v;
  }
  return pull;
}

function weightsFor(actor: RandomCharacter, motivations: Motivation[]): Record<Motivation, number> {
  const weights = Object.fromEntries(MOTIVATIONS.map((m) => [m.key, 0])) as Record<Motivation, number>;
  for (const m of motivations) weights[m] += 1;
  for (const [m, v] of Object.entries(TEMPERAMENT_LEANING[actor.temperament] ?? {}) as [Motivation, number][]) {
    weights[m] += v;
  }
  return weights;
}

function scoreChoice(choice: DialogueNode, weights: Record<Motivation, number>): { score: number; reasons: string[] } {
  const pull = motivationPull(choice);
  const parts = MOTIVATIONS.map((m) => ({ label: m.label, value: pull[m.key] * weights[m.key] }));
  const reasons = parts
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((p) => p.label);
  return { score: parts.reduce((s, p) => s + p.value, 0), reasons };
}

function stanceTone(
  speaker: RandomCharacter | undefined,
  actor: RandomCharacter,
  relations: CharacterRelation[],
  attitude: number,
): VariantTone {
  const relation = speaker
    ? relations.find(
        (r) => (r.fromId === speaker.id && r.toId === actor.id) || (r.fromId === actor.id && r.toId === speaker.id),
      )
    : undefined;
  let mood = relation ? (relation.kind === 'rival' ? -2 : WARM_RELATIONS.has(relation.kind) ? 2 : 0) : 0;
  mood += attitude;
  return mood >= 2 ? 'warm' : mood <= -2 ? 'hostile' : 'neutral';
}

function spokenText(node: DialogueNode, tone: VariantTone): { text: string; tone?: VariantTone } {
  const variant = node.variants?.find((v) => v.tone === tone);
  return variant ? { text: variant.text, tone } : { text: node.text };
}

function verdictFor(actor: RandomCharacter, totals: Record<ImpactAxis, number>, goals: string[]): string {
  const shifts: string[] = [];
  if (totals.economy > 0) shifts.push('leaves with a heavier purse');
  if (totals.economy < 0) shifts.push('leaves poorer');
  if (totals.attitude > 0) shifts.push('earns warmer welcomes');
  if (totals.attitude < 0) shifts.push('is met with colder looks');
  if (totals.environment > 0) shifts.push('leaves the land kinder');
  if (totals.environment < 0) shifts.push('leaves the land scarred');
  const head = shifts.length
    ? `${actor.firstName} ${shifts.slice(0, -1).join(', ')}${shifts.length > 1 ? ' and ' : ''}${shifts[shifts.length - 1]}.`
    : `Nothing in the world shifts for ${actor.firstName}.`;
  return goals.length ? `${head} The path now bends toward: ${goals.join('; ')}.` : head;
}

export function simulateScenario(
  rootId: string,
  dialogue: DialogueNode[],
  actor: RandomCharacter,
  motivations: Motivation[],
  characters: RandomCharacter[],
  relations: CharacterRelation[],
): SimulationOutcome {
  const children = new Map<string, DialogueNode[]>();
  for (const node of dialogue) {
    if (!node.parentId) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const weights = weightsFor(actor, motivations);
  const totals: Record<ImpactAxis, number> = { economy: 0, environment: 0, attitude: 0 };
  const goals: string[] = [];
  const obstacles: string[] = [];
  const steps: SimulationStep[] = [];

  const future = (choiceId: string, depth: number): number => {
    if (depth === 0) return 0;
    const reply = (children.get(choiceId) ?? [])[0];
    const options = reply ? (children.get(reply.id) ?? []).filter((n) => n.kind === 'choice') : [];
    if (!options.length) return 0;
    return Math.max(
      ...options.map((o) => scoreChoice(o, weights).score + FUTURE_DISCOUNT * future(o.id, depth - 1)),
    );
  };

  const absorb = (impact: DialogueImpact): void => {
    for (const axis of IMPACT_AXES) totals[axis.key] += impact[axis.key];
    if (impact.goal && !goals.includes(impact.goal)) goals.push(impact.goal);
    if (impact.obstacle && !obstacles.includes(impact.obstacle)) obstacles.push(impact.obstacle);
  };

  let current = dialogue.find((n) => n.id === rootId);
  while (current && steps.length < MAX_STEPS) {
    if (current.kind === 'line') {
      const speakerName = current.speaker;
      const speaker = characters.find((c) => c.firstName === speakerName);
      const spoken = spokenText(current, stanceTone(speaker, actor, relations, totals.attitude));
      steps.push({ nodeId: current.id, speaker: current.speaker, kind: 'line', reasons: [], passedOver: 0, ...spoken });
    } else {
      steps.push({ nodeId: current.id, speaker: actor.firstName, kind: 'choice', text: current.text, reasons: [], passedOver: 0 });
    }
    absorb(impactOf(current));

    const next = children.get(current.id) ?? [];
    const choices = next.filter((n) => n.kind === 'choice');
    if (choices.length) {
      const ranked = choices
        .map((choice) => {
          const own = scoreChoice(choice, weights);
          return { choice, reasons: own.reasons, score: own.score + FUTURE_DISCOUNT * future(choice.id, LOOKAHEAD_DEPTH) };
        })
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      steps.push({
        nodeId: best.choice.id,
        speaker: actor.firstName,
        kind: 'choice',
        text: spokenText(best.choice, 'neutral').text,
        reasons: best.reasons,
        passedOver: choices.length - 1,
      });
      absorb(impactOf(best.choice));
      current = (children.get(best.choice.id) ?? [])[0];
    } else {
      current = next[0];
    }
  }

  return { steps, totals, goals, obstacles, verdict: verdictFor(actor, totals, goals) };
}
