import { INITIAL_SOULS } from '../store/charactersStore';
import { SAMPLE_DIALOGUE_NODES } from './dialogue';
import { SAMPLE_RELATIONS, SAMPLE_ROUTINES } from './relations';
import { SAMPLE_INTERACTIONS } from './interactions';
import { SoulRemovalInput, applySoulRemoval, planSoulRemoval } from './soulRemoval';

const tome: SoulRemovalInput = {
  characters: INITIAL_SOULS,
  dialogue: SAMPLE_DIALOGUE_NODES,
  relations: SAMPLE_RELATIONS,
  routines: SAMPLE_ROUTINES,
  interactions: SAMPLE_INTERACTIONS,
};

describe('soul removal', () => {
  it('finds everything tied to the soul', () => {
    const plan = planSoulRemoval('soul-001', tome)!;
    expect(plan.bonds.map((b) => b.id).sort()).toEqual(['rel-1', 'rel-4']);
    expect(plan.interactions.map((i) => i.id)).toEqual(['act-3']);
    expect(plan.personalRoutines.map((r) => r.id)).toEqual(['rt-ledger']);
    expect(plan.leftRoutines.map((r) => r.id)).toEqual(['rt-hall']);
    expect(plan.scenes).toEqual([]);
  });

  it('lists the scenes where the soul speaks', () => {
    const plan = planSoulRemoval('soul-004', tome)!;
    expect(plan.scenes.map((s) => s.rootId)).toEqual(['m1']);
    expect(plan.scenes[0].steps).toBe(9);
    expect(plan.sharedName).toBe(false);
  });

  it('removes the soul and every reference to it in one result', () => {
    const plan = planSoulRemoval('soul-001', tome)!;
    const after = applySoulRemoval(plan, new Set(), tome);
    expect(after.characters.some((c) => c.id === 'soul-001')).toBe(false);
    expect(after.relations.some((r) => r.fromId === 'soul-001' || r.toId === 'soul-001')).toBe(false);
    expect(after.interactions.some((i) => i.sourceId === 'soul-001' || i.targetId === 'soul-001')).toBe(false);
    expect(after.routines.some((r) => r.id === 'rt-ledger')).toBe(false);
    expect(after.routines.find((r) => r.id === 'rt-hall')?.participantIds).toEqual(['soul-003']);
    expect(after.dialogue).toBe(tome.dialogue);
  });

  it('removes chosen scenes and cleans links into them', () => {
    const plan = planSoulRemoval('soul-004', tome)!;
    const after = applySoulRemoval(plan, new Set(['m1']), tome);
    expect(after.dialogue.some((n) => n.id.startsWith('m'))).toBe(false);
    expect(after.routines.find((r) => r.id === 'rt-market')?.forks).toEqual([]);
    expect(after.interactions.some((i) => i.dialogueId?.startsWith('m'))).toBe(false);
  });

  it('keeps scenes that were not chosen', () => {
    const plan = planSoulRemoval('soul-004', tome)!;
    const after = applySoulRemoval(plan, new Set(), tome);
    expect(after.dialogue).toBe(tome.dialogue);
  });

  it('returns nothing for an unknown soul', () => {
    expect(planSoulRemoval('nobody', tome)).toBeNull();
  });
});
