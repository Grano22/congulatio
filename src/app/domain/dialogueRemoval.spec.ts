import { SAMPLE_DIALOGUE_NODES } from './dialogue';
import { SAMPLE_ROUTINES } from './relations';
import { SAMPLE_INTERACTIONS } from './interactions';
import { applyRemoval, descendantsOf, planRemoval, rootOf, sceneLinks, statusOf } from './dialogueRemoval';

const nodes = SAMPLE_DIALOGUE_NODES;

describe('dialogue removal', () => {
  it('lists descendants grouped by their first branch', () => {
    const rows = descendantsOf('d3', nodes);
    expect(rows.map((r) => r.node.id)).toEqual(['d4', 'd5', 'd6', 'd7']);
    expect(rows.map((r) => r.branchId)).toEqual(['d4', 'd4', 'd6', 'd6']);
  });

  it('removing only the parent leaves its children as standalone roots', () => {
    const plan = planRemoval('d3', new Set(), nodes, [], []);
    expect([...plan.removed]).toEqual(['d3']);
    expect(plan.detached.sort()).toEqual(['d4', 'd6']);
    const after = applyRemoval(plan, nodes, [], []);
    expect(after.nodes.find((n) => n.id === 'd4')?.parentId).toBeNull();
    expect(after.nodes.find((n) => n.id === 'd5')?.parentId).toBe('d4');
  });

  it('removes the chosen descendants with the parent', () => {
    const plan = planRemoval('d3', new Set(['d4', 'd5', 'd6', 'd7']), nodes, [], []);
    expect(plan.removed.size).toBe(5);
    expect(plan.detached).toEqual([]);
  });

  it('a kept grandchild under a removed child becomes standalone', () => {
    const plan = planRemoval('d3', new Set(['d4']), nodes, [], []);
    expect(plan.detached.sort()).toEqual(['d5', 'd6']);
  });

  it('cuts routine forks and unlinks interactions pointing at removed steps', () => {
    const plan = planRemoval('m1', new Set(descendantsOf('m1', nodes).map((r) => r.node.id)), nodes, SAMPLE_ROUTINES, SAMPLE_INTERACTIONS);
    expect(plan.forksCut.map((f) => f.forkId).sort()).toEqual(['rt-market-f1', 'rt-market-f2']);
    expect(plan.interactionsUnlinked).toEqual(['act-2']);
    const after = applyRemoval(plan, nodes, SAMPLE_ROUTINES, SAMPLE_INTERACTIONS);
    expect(after.routines.find((r) => r.id === 'rt-market')?.forks).toEqual([]);
    expect(after.interactions.find((i) => i.id === 'act-2')?.dialogueId).toBeNull();
  });

  it('classifies scenes as connected or standalone', () => {
    const links = sceneLinks(nodes, SAMPLE_ROUTINES, SAMPLE_INTERACTIONS);
    expect(statusOf('d1', links)).toBe('connected');
    expect(links.get('m1')?.routines).toEqual(['Market Haggling']);
    const after = applyRemoval(planRemoval('d3', new Set(), nodes, [], []), nodes, [], []);
    expect(statusOf(rootOf('d4', after.nodes), sceneLinks(after.nodes, [], []))).toBe('standalone');
  });
});
