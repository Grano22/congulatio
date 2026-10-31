import {
  ErrorEntry,
  MAX_ENTRIES,
  buildPayload,
  coarseBrowser,
  describeError,
  fingerprint,
  isBurst,
  isChunkFailure,
  isNoise,
  issueUrl,
  recordError,
  redact,
} from './errorReport';

const at = '2026-10-31T10:00:00.000Z';
const context = { source: 'handler', route: '/', appVersion: '0.3.0', at, critical: false };

describe('error reports', () => {
  it('redacts e-mails, tokens, keys, long ids and URL hosts', () => {
    const fakeKey = ['AI', 'za', 'Sy', 'X'.repeat(33)].join('');
    const text = redact(
      `jan@example.com eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl ${fakeKey} https://host.example/path/x.js?token=1 abcdefghijklmnopqrstuvwxyz0123456789`,
    );
    expect(text).not.toContain('jan@example.com');
    expect(text).toContain('[email]');
    expect(text).toContain('[token]');
    expect(text).toContain('[key]');
    expect(text).toContain('/path/x.js');
    expect(text).not.toContain('host.example');
    expect(text).not.toContain('token=1');
    expect(text).toContain('[id]');
  });

  it('describes errors, rejections and plain values', () => {
    expect(describeError(new TypeError('boom')).name).toBe('TypeError');
    expect(describeError({ rejection: new Error('async') }).message).toBe('async');
    expect(describeError('text').message).toBe('text');
  });

  it('gives the same fingerprint across builds and changing numbers', () => {
    const a = fingerprint('TypeError', 'Cannot read 12 of undefined', 'TypeError\n at f (https://x/chunk-AB12CD.js:10:5)\n at g (https://x/main-Z9.js:1:1)');
    const b = fingerprint('TypeError', 'Cannot read 99 of undefined', 'TypeError\n at f (https://x/chunk-QQ77RR.js:44:9)\n at g (https://x/main-K1.js:2:2)');
    expect(a).toBe(b);
    expect(fingerprint('TypeError', 'Something else', '')).not.toBe(a);
  });

  it('keeps unique entries with counts, newest first and capped', () => {
    let entries: ErrorEntry[] = [];
    entries = recordError(entries, { name: 'Error', message: 'a', stack: '' }, context).entries;
    entries = recordError(entries, { name: 'Error', message: 'b', stack: '' }, context).entries;
    const again = recordError(entries, { name: 'Error', message: 'a', stack: '' }, { ...context, at: 'later', critical: true });
    expect(again.entries.length).toBe(2);
    expect(again.entries[0].message).toBe('a');
    expect(again.entry.count).toBe(2);
    expect(again.entry.lastSeen).toBe('later');
    expect(again.entry.critical).toBe(true);
    let many: ErrorEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) many = recordError(many, { name: 'E', message: `m${'x'.repeat(i)}`, stack: '' }, context).entries;
    expect(many.length).toBe(MAX_ENTRIES);
  });

  it('ignores cross-origin and harmless browser noise', () => {
    expect(isNoise('Script error.')).toBe(true);
    expect(isNoise('An ErrorEvent with no error occurred. See Error.cause for details: Script error.')).toBe(true);
    expect(isNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isNoise('Cannot read properties of undefined')).toBe(false);
  });

  it('spots failed lazy chunks and bursts', () => {
    expect(isChunkFailure('TypeError', 'Failed to fetch dynamically imported module: https://x/chunk-1.js')).toBe(true);
    expect(isChunkFailure('TypeError', 'x is undefined')).toBe(false);
    expect(isBurst([1000, 2000, 3000, 4000, 5000], 6000)).toBe(true);
    expect(isBurst([1000, 2000], 6000)).toBe(false);
  });

  it('reduces the user agent to browser and system', () => {
    expect(coarseBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.1.2 Safari/537.36')).toBe('Chrome 140 on macOS');
    expect(coarseBrowser('Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox 131 on Windows');
  });

  it('builds a bounded payload without personal data in the note', () => {
    const { entry } = recordError([], { name: 'Error', message: 'm', stack: 's' }, { ...context, route: '/login?next=x#y' });
    const payload = buildPayload(entry, { browser: 'Chrome 140 on macOS', online: true, note: ' write to me at a@b.co ' });
    expect(payload.route).toBe('/login');
    expect(payload.note).toBe('write to me at [email]');
    expect(Object.keys(payload)).not.toContain('uid');
    const url = issueUrl('https://github.com/o/r', payload);
    expect(url.startsWith('https://github.com/o/r/issues/new?')).toBe(true);
    expect(url.length).toBeLessThan(8000);
  });
});
