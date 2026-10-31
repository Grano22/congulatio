export type PaneWeights = Record<string, number>;

export const equalWeights = (ids: readonly string[]): PaneWeights => Object.fromEntries(ids.map((id) => [id, 1]));

export type PairDrag = { a: string; b: string; startA: number; startB: number; weightA: number; weightB: number };

export function resizePair(weights: PaneWeights, drag: PairDrag, delta: number, min: number): PaneWeights {
  const total = drag.startA + drag.startB;
  if (total <= 0) return weights;
  const lowest = Math.min(min, total / 2);
  const heightA = Math.min(total - lowest, Math.max(lowest, drag.startA + delta));
  const sum = drag.weightA + drag.weightB;
  const weightA = (sum * heightA) / total;
  return { ...weights, [drag.a]: weightA, [drag.b]: sum - weightA };
}

export function equalizePair(weights: PaneWeights, a: string, b: string): PaneWeights {
  const each = ((weights[a] ?? 1) + (weights[b] ?? 1)) / 2;
  return { ...weights, [a]: each, [b]: each };
}
