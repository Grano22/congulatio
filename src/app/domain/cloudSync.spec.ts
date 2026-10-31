import { INITIAL_SOULS } from '../store/charactersStore';
import { SAMPLE_DIALOGUE_NODES } from './dialogue';
import { SAMPLE_RELATIONS, SAMPLE_ROUTINES } from './relations';
import { SAMPLE_INTERACTIONS } from './interactions';
import { SAMPLE_CUSTOM_ATTRIBUTES } from './attributes';
import type { TomeSnapshot } from './tome';
import {
  META_KIND,
  RowTooLargeError,
  chunkWrites,
  formatBytes,
  decideSync,
  hashesOf,
  planPush,
  readMeta,
  rowId,
  rowsToTome,
  tomeToRows,
} from './cloudSync';

const tome: TomeSnapshot = {
  characters: INITIAL_SOULS,
  dialogue: SAMPLE_DIALOGUE_NODES,
  relations: SAMPLE_RELATIONS,
  routines: SAMPLE_ROUTINES,
  interactions: SAMPLE_INTERACTIONS,
  attributeDefs: SAMPLE_CUSTOM_ATTRIBUTES,
};

describe('cloud rows', () => {
  it('round-trips a tome through rows in order', () => {
    const rows = tomeToRows('u1', tome, '2026-10-31T10:00:00.000Z');
    const back = rowsToTome([...rows.values()].reverse());
    expect(back).toEqual(tome);
  });

  it('prefixes every row id with the owner and stamps the owner on every row', () => {
    const rows = tomeToRows('u1', tome, 'now');
    for (const [id, row] of rows) {
      expect(id.startsWith('u1~')).toBe(true);
      expect(row.owner).toBe('u1');
    }
  });

  it('escapes slashes in entity ids', () => {
    expect(rowId('u1', 'characters', 'a/b')).toBe('u1~characters~a%2Fb');
  });

  it('writes a meta row with the save time and usage', () => {
    const rows = tomeToRows('u1', tome, '2026-10-31T10:00:00.000Z');
    const meta = readMeta([...rows.values()]);
    expect(meta?.savedAt).toBe('2026-10-31T10:00:00.000Z');
    expect(meta?.usage).toBe([...rows.values()].filter((r) => r.kind !== META_KIND).reduce((s, r) => s + r.bytes, 0));
  });

  it('refuses entries larger than a row', () => {
    const huge = { ...tome, characters: [{ ...tome.characters[0], portrait: 'x'.repeat(950_000) }] };
    expect(() => tomeToRows('u1', huge, 'now')).toThrow(RowTooLargeError);
  });
});

describe('push plan', () => {
  it('uploads only changed rows plus the meta row and deletes removed ones', () => {
    const before = tomeToRows('u1', tome, 'a');
    const edited = { ...tome, characters: [{ ...tome.characters[0], firstName: 'Changed' }, ...tome.characters.slice(2)] };
    const after = tomeToRows('u1', edited, 'b');
    const plan = planPush(after, hashesOf(before));
    const kinds = plan.upserts.map(([, r]) => r.kind);
    expect(kinds.filter((k) => k === 'characters').length).toBeGreaterThanOrEqual(1);
    expect(kinds.at(-1)).toBe(META_KIND);
    expect(kinds).not.toContain('dialogue');
    expect(plan.deletes).toEqual([rowId('u1', 'characters', tome.characters[1].id)]);
  });

  it('uploads everything on the first push', () => {
    const rows = tomeToRows('u1', tome, 'a');
    expect(planPush(rows, {}).upserts.length).toBe(rows.size);
  });
});

describe('sync decision', () => {
  it('stays idle when nothing exists', () => {
    expect(decideSync(null, null, null)).toEqual({ action: 'idle', conflict: false });
  });

  it('pushes a local tome the cloud has never seen', () => {
    expect(decideSync('2026-01-02', null, null).action).toBe('push');
  });

  it('pushes local saves made after the last sync', () => {
    expect(decideSync('2026-01-03', '2026-01-02', '2026-01-02')).toEqual({ action: 'push', conflict: false });
  });

  it('pulls when only the cloud moved on', () => {
    expect(decideSync('2026-01-02', '2026-01-02', '2026-01-05')).toEqual({ action: 'pull', conflict: false });
    expect(decideSync(null, null, '2026-01-05')).toEqual({ action: 'pull', conflict: false });
  });

  it('lets the newer side win when both changed', () => {
    expect(decideSync('2026-01-04', '2026-01-02', '2026-01-05')).toEqual({ action: 'pull', conflict: true });
    expect(decideSync('2026-01-06', '2026-01-02', '2026-01-05')).toEqual({ action: 'push', conflict: true });
  });
});

describe('write chunks', () => {
  it('splits by operation count and by size', () => {
    const items = Array.from({ length: 5 }, () => ({ bytes: 4 }));
    expect(chunkWrites(items, 2).map((c) => c.length)).toEqual([2, 2, 1]);
    expect(chunkWrites(items, 10, 8).map((c) => c.length)).toEqual([2, 2, 1]);
  });
});

describe('byte labels', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MiB');
  });
});
