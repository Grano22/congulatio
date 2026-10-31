import { TOME_FORMAT, TOME_VERSION, TomeSnapshot, validateSnapshot } from './tome';

export const TOME_KINDS = ['characters', 'dialogue', 'relations', 'routines', 'interactions', 'attributeDefs'] as const;
export type TomeKind = (typeof TOME_KINDS)[number];
export const META_KIND = 'meta';

export type CloudRow = {
  owner: string;
  kind: TomeKind | typeof META_KIND;
  entityId: string;
  position: number;
  json: string;
  hash: string;
  bytes: number;
  updatedAt: string;
};

export type CloudMeta = {
  format: typeof TOME_FORMAT;
  version: number;
  savedAt: string;
  usage: number;
};

export type SyncAction = 'idle' | 'push' | 'pull';
export type SyncDecision = { action: SyncAction; conflict: boolean };

export const ROW_LIMIT_BYTES = 900_000;

const encoder = new TextEncoder();

export const byteLength = (text: string): number => encoder.encode(text).length;

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, '0')}-${text.length.toString(36)}`;
}

export const rowId = (owner: string, kind: CloudRow['kind'], entityId?: string): string =>
  entityId === undefined ? `${owner}~${kind}` : `${owner}~${kind}~${encodeURIComponent(entityId)}`;

const row = (owner: string, kind: CloudRow['kind'], entityId: string, position: number, json: string, updatedAt: string): CloudRow => ({
  owner,
  kind,
  entityId,
  position,
  json,
  hash: hashText(`${position}|${json}`),
  bytes: byteLength(json),
  updatedAt,
});

export class RowTooLargeError extends Error {
  constructor(readonly kind: string, readonly entityId: string, readonly bytes: number) {
    super(`One ${kind} entry is ${Math.ceil(bytes / 1024)} KiB, more than a cloud row can hold.`);
  }
}

export function tomeToRows(owner: string, tome: TomeSnapshot, savedAt: string): Map<string, CloudRow> {
  const rows = new Map<string, CloudRow>();
  for (const kind of TOME_KINDS) {
    (tome[kind] as { id: string }[]).forEach((item, position) => {
      const entry = row(owner, kind, item.id, position, JSON.stringify(item), savedAt);
      if (entry.bytes > ROW_LIMIT_BYTES) throw new RowTooLargeError(kind, item.id, entry.bytes);
      rows.set(rowId(owner, kind, item.id), entry);
    });
  }
  const usage = [...rows.values()].reduce((sum, r) => sum + r.bytes, 0);
  const meta: CloudMeta = { format: TOME_FORMAT, version: TOME_VERSION, savedAt, usage };
  rows.set(rowId(owner, META_KIND), row(owner, META_KIND, META_KIND, 0, JSON.stringify(meta), savedAt));
  return rows;
}

export function readMeta(rows: CloudRow[]): CloudMeta | null {
  const meta = rows.find((r) => r.kind === META_KIND);
  if (!meta) return null;
  try {
    const value = JSON.parse(meta.json) as Partial<CloudMeta>;
    if (value.format !== TOME_FORMAT || typeof value.savedAt !== 'string') return null;
    return { format: TOME_FORMAT, version: Number(value.version) || 1, savedAt: value.savedAt, usage: Number(value.usage) || 0 };
  } catch {
    return null;
  }
}

export function rowsToTome(rows: CloudRow[]): TomeSnapshot {
  const lists: Record<string, unknown[]> = Object.fromEntries(TOME_KINDS.map((k) => [k, []]));
  const sorted = [...rows].filter((r) => r.kind !== META_KIND).sort((a, b) => a.position - b.position);
  for (const r of sorted) lists[r.kind]?.push(JSON.parse(r.json));
  return validateSnapshot(lists);
}

export const hashesOf = (rows: Iterable<[string, CloudRow]>): Record<string, string> =>
  Object.fromEntries([...rows].map(([id, r]) => [id, r.hash]));

export function planPush(rows: Map<string, CloudRow>, previous: Record<string, string>): { upserts: [string, CloudRow][]; deletes: string[] } {
  const upserts = [...rows].filter(([id, r]) => previous[id] !== r.hash || r.kind === META_KIND);
  upserts.sort(([, a], [, b]) => Number(a.kind === META_KIND) - Number(b.kind === META_KIND));
  const deletes = Object.keys(previous).filter((id) => !rows.has(id));
  return { upserts, deletes };
}

export function decideSync(localSavedAt: string | null, syncedAt: string | null, remoteSavedAt: string | null): SyncDecision {
  const localChanged = Boolean(localSavedAt) && (!syncedAt || localSavedAt! > syncedAt);
  if (!remoteSavedAt) return { action: localSavedAt ? 'push' : 'idle', conflict: false };
  if (remoteSavedAt === syncedAt) return { action: localChanged ? 'push' : 'idle', conflict: false };
  if (!localChanged) return { action: 'pull', conflict: false };
  if (localSavedAt === remoteSavedAt) return { action: 'idle', conflict: false };
  return { action: remoteSavedAt > localSavedAt! ? 'pull' : 'push', conflict: true };
}

export function chunkWrites<T extends { bytes: number }>(items: T[], maxOps = 450, maxBytes = 8 * 1024 * 1024): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    if (current.length && (current.length >= maxOps || size + item.bytes > maxBytes)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
