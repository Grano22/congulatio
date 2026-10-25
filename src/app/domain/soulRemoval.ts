import type { RandomCharacter } from './randomCharacter';
import type { DialogueNode } from './dialogue';
import type { CharacterRelation, Routine } from './relations';
import { scopeOf } from './relations';
import type { Interaction } from './interactions';
import { applyRemoval, descendantsOf, planRemoval } from './dialogueRemoval';

export type SoulScene = {
  rootId: string;
  title: string;
  steps: number;
  spokenLines: DialogueNode[];
};

export type SoulRemovalPlan = {
  soul: RandomCharacter;
  bonds: CharacterRelation[];
  interactions: Interaction[];
  personalRoutines: Routine[];
  leftRoutines: Routine[];
  scenes: SoulScene[];
  sharedName: boolean;
};

export type SoulRemovalInput = {
  characters: RandomCharacter[];
  dialogue: DialogueNode[];
  relations: CharacterRelation[];
  routines: Routine[];
  interactions: Interaction[];
};

const clip = (text: string, max = 48): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function planSoulRemoval(soulId: string, input: SoulRemovalInput): SoulRemovalPlan | null {
  const soul = input.characters.find((c) => c.id === soulId);
  if (!soul) return null;
  const personalRoutines = input.routines.filter((r) => scopeOf(r) === 'personal' && r.ownerId === soulId);
  const spoken = input.dialogue.filter((n) => n.kind === 'line' && n.speaker === soul.firstName);
  const roots = input.dialogue.filter((n) => n.parentId === null);
  const scenes = roots
    .map((root) => {
      const ids = new Set([root.id, ...descendantsOf(root.id, input.dialogue).map((r) => r.node.id)]);
      return {
        rootId: root.id,
        title: clip(root.text),
        steps: ids.size,
        spokenLines: spoken.filter((n) => ids.has(n.id)),
      };
    })
    .filter((s) => s.spokenLines.length > 0);
  return {
    soul,
    bonds: input.relations.filter((r) => r.fromId === soulId || r.toId === soulId),
    interactions: input.interactions.filter((i) => i.sourceId === soulId || i.targetId === soulId),
    personalRoutines,
    leftRoutines: input.routines.filter((r) => !personalRoutines.includes(r) && r.participantIds.includes(soulId)),
    scenes,
    sharedName: input.characters.some((c) => c.id !== soulId && c.firstName === soul.firstName),
  };
}

export function applySoulRemoval(plan: SoulRemovalPlan, removeSceneIds: Set<string>, input: SoulRemovalInput): SoulRemovalInput {
  const soulId = plan.soul.id;
  const dropRoutines = new Set(plan.personalRoutines.map((r) => r.id));
  let result: SoulRemovalInput = {
    characters: input.characters.filter((c) => c.id !== soulId),
    dialogue: input.dialogue,
    relations: input.relations.filter((r) => r.fromId !== soulId && r.toId !== soulId),
    routines: input.routines
      .filter((r) => !dropRoutines.has(r.id))
      .map((r) => (r.participantIds.includes(soulId) ? { ...r, participantIds: r.participantIds.filter((id) => id !== soulId) } : r)),
    interactions: input.interactions.filter((i) => i.sourceId !== soulId && i.targetId !== soulId),
  };
  for (const scene of plan.scenes) {
    if (!removeSceneIds.has(scene.rootId) || !result.dialogue.some((n) => n.id === scene.rootId)) continue;
    const everything = new Set(descendantsOf(scene.rootId, result.dialogue).map((r) => r.node.id));
    const removal = planRemoval(scene.rootId, everything, result.dialogue, result.routines, result.interactions);
    const after = applyRemoval(removal, result.dialogue, result.routines, result.interactions);
    result = { ...result, dialogue: after.nodes, routines: after.routines, interactions: after.interactions };
  }
  return result;
}
