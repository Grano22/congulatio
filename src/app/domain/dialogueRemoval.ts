import type { DialogueNode } from './dialogue';
import type { Routine } from './relations';
import type { Interaction } from './interactions';

export type SceneStatus = 'connected' | 'standalone';

export type DescendantRow = { node: DialogueNode; depth: number; branchId: string };

export type RemovalPlan = {
  removed: Set<string>;
  detached: string[];
  forksCut: { routineId: string; forkId: string; label: string }[];
  interactionsUnlinked: string[];
};

function childrenMap(nodes: DialogueNode[]): Map<string, DialogueNode[]> {
  const children = new Map<string, DialogueNode[]>();
  for (const n of nodes) {
    if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  }
  return children;
}

export function descendantsOf(nodeId: string, nodes: DialogueNode[]): DescendantRow[] {
  const children = childrenMap(nodes);
  const rows: DescendantRow[] = [];
  const walk = (id: string, depth: number, branchId: string): void => {
    for (const child of children.get(id) ?? []) {
      const branch = depth === 1 ? child.id : branchId;
      rows.push({ node: child, depth, branchId: branch });
      walk(child.id, depth + 1, branch);
    }
  };
  walk(nodeId, 1, nodeId);
  return rows;
}

export function rootOf(nodeId: string, nodes: DialogueNode[]): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let node = byId.get(nodeId);
  while (node?.parentId && byId.has(node.parentId)) node = byId.get(node.parentId);
  return node?.id ?? nodeId;
}

export function planRemoval(
  targetId: string,
  removeDescendants: Set<string>,
  nodes: DialogueNode[],
  routines: Routine[],
  interactions: Interaction[],
): RemovalPlan {
  const subtree = new Set(descendantsOf(targetId, nodes).map((r) => r.node.id));
  const removed = new Set([targetId, ...[...removeDescendants].filter((id) => subtree.has(id))]);
  const detached = nodes.filter((n) => !removed.has(n.id) && n.parentId !== null && removed.has(n.parentId)).map((n) => n.id);
  return {
    removed,
    detached,
    forksCut: routines.flatMap((r) =>
      r.forks.filter((f) => removed.has(f.dialogueId)).map((f) => ({ routineId: r.id, forkId: f.id, label: `${r.name}: ${f.label}` })),
    ),
    interactionsUnlinked: interactions.filter((i) => i.dialogueId && removed.has(i.dialogueId)).map((i) => i.id),
  };
}

export function applyRemoval(
  plan: RemovalPlan,
  nodes: DialogueNode[],
  routines: Routine[],
  interactions: Interaction[],
): { nodes: DialogueNode[]; routines: Routine[]; interactions: Interaction[] } {
  const detached = new Set(plan.detached);
  const cutForks = new Set(plan.forksCut.map((f) => f.forkId));
  const unlinked = new Set(plan.interactionsUnlinked);
  return {
    nodes: nodes.filter((n) => !plan.removed.has(n.id)).map((n) => (detached.has(n.id) ? { ...n, parentId: null } : n)),
    routines: cutForks.size
      ? routines.map((r) => (r.forks.some((f) => cutForks.has(f.id)) ? { ...r, forks: r.forks.filter((f) => !cutForks.has(f.id)) } : r))
      : routines,
    interactions: unlinked.size ? interactions.map((i) => (unlinked.has(i.id) ? { ...i, dialogueId: null } : i)) : interactions,
  };
}

export function sceneLinks(
  nodes: DialogueNode[],
  routines: Routine[],
  interactions: Interaction[],
): Map<string, { routines: string[]; interactions: number }> {
  const links = new Map<string, { routines: string[]; interactions: number }>();
  const entry = (rootId: string): { routines: string[]; interactions: number } => {
    let e = links.get(rootId);
    if (!e) {
      e = { routines: [], interactions: 0 };
      links.set(rootId, e);
    }
    return e;
  };
  const ids = new Set(nodes.map((n) => n.id));
  for (const r of routines) {
    for (const f of r.forks) {
      if (!ids.has(f.dialogueId)) continue;
      const e = entry(rootOf(f.dialogueId, nodes));
      if (!e.routines.includes(r.name)) e.routines.push(r.name);
    }
  }
  for (const i of interactions) {
    if (i.dialogueId && ids.has(i.dialogueId)) entry(rootOf(i.dialogueId, nodes)).interactions += 1;
  }
  return links;
}

export const statusOf = (rootId: string, links: Map<string, { routines: string[]; interactions: number }>): SceneStatus => {
  const l = links.get(rootId);
  return l && (l.routines.length || l.interactions) ? 'connected' : 'standalone';
};
