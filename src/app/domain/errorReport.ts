export type ErrorEntry = {
  id: string;
  name: string;
  message: string;
  stack: string;
  source: string;
  route: string;
  appVersion: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  critical: boolean;
  reportedAt: string | null;
};

export type ErrorReportPayload = {
  fingerprint: string;
  name: string;
  message: string;
  stack: string;
  source: string;
  route: string;
  appVersion: string;
  browser: string;
  online: boolean;
  count: number;
  firstSeen: string;
  lastSeen: string;
  note: string;
};

export const MAX_MESSAGE = 500;
export const MAX_STACK = 4000;
export const MAX_NOTE = 1000;
export const MAX_ENTRIES = 30;

const CHUNK_FAILURE = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\b(?:AIza[\w-]{30,}|ya29\.[\w-]+)\b/g, '[key]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[id]')
    .replace(/https?:\/\/[^\s)'"]+/g, (url) => {
      try {
        const u = new URL(url);
        return `${u.pathname}`;
      } catch {
        return '[url]';
      }
    });
}

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function describeError(error: unknown): { name: string; message: string; stack: string } {
  const unwrapped = (error as { rejection?: unknown })?.rejection ?? (error as { reason?: unknown })?.reason ?? error;
  if (unwrapped instanceof Error) {
    return {
      name: unwrapped.name || 'Error',
      message: clip(redact(unwrapped.message || String(unwrapped)), MAX_MESSAGE),
      stack: clip(redact(unwrapped.stack ?? ''), MAX_STACK),
    };
  }
  if (typeof unwrapped === 'object' && unwrapped !== null && 'message' in unwrapped) {
    return { name: 'Error', message: clip(redact(String((unwrapped as { message: unknown }).message)), MAX_MESSAGE), stack: '' };
  }
  return { name: 'Error', message: clip(redact(String(unwrapped)), MAX_MESSAGE), stack: '' };
}

export function normalizeForFingerprint(message: string, stack: string): string {
  const frames = stack
    .split('\n')
    .slice(1, 4)
    .map((line) =>
      line
        .trim()
        .replace(/chunk-[\w-]+\.js/g, 'chunk.js')
        .replace(/main-[\w-]+\.js/g, 'main.js')
        .replace(/:\d+:\d+/g, '')
        .replace(/\?[^\s)]*/g, ''),
    );
  const text = message.replace(/\d+/g, '#').replace(/'[^']*'|"[^"]*"/g, '…');
  return [text, ...frames].join('|');
}

export function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export const fingerprint = (name: string, message: string, stack: string): string => hashText(`${name}|${normalizeForFingerprint(message, stack)}`);

const NOISE = [/^Script error\.?$/i, /ErrorEvent with no error occurred.*Script error/i, /^ResizeObserver loop/i, /Non-Error promise rejection captured with value: undefined/i];

export const isNoise = (message: string): boolean => NOISE.some((pattern) => pattern.test(message.trim()));

export const isChunkFailure = (name: string, message: string): boolean => CHUNK_FAILURE.test(`${name}: ${message}`);

export function recordError(
  entries: ErrorEntry[],
  error: { name: string; message: string; stack: string },
  context: { source: string; route: string; appVersion: string; at: string; critical: boolean },
): { entries: ErrorEntry[]; entry: ErrorEntry } {
  const id = fingerprint(error.name, error.message, error.stack);
  const existing = entries.find((e) => e.id === id);
  const entry: ErrorEntry = existing
    ? { ...existing, count: existing.count + 1, lastSeen: context.at, route: context.route, critical: existing.critical || context.critical }
    : {
        id,
        ...error,
        source: context.source,
        route: context.route,
        appVersion: context.appVersion,
        count: 1,
        firstSeen: context.at,
        lastSeen: context.at,
        critical: context.critical,
        reportedAt: null,
      };
  const rest = entries.filter((e) => e.id !== id);
  const next = [entry, ...rest].slice(0, MAX_ENTRIES);
  return { entries: next, entry };
}

export function isBurst(timestamps: number[], now: number, windowMs = 10_000, limit = 5): boolean {
  return timestamps.filter((t) => now - t <= windowMs).length >= limit;
}

export function coarseBrowser(userAgent: string): string {
  const browser =
    /Edg\/(\d+)/.exec(userAgent)?.[0].replace('Edg/', 'Edge ') ??
    /Firefox\/(\d+)/.exec(userAgent)?.[0].replace('/', ' ') ??
    /Chrome\/(\d+)/.exec(userAgent)?.[0].replace('/', ' ') ??
    (/Version\/(\d+).*Safari/.exec(userAgent) ? `Safari ${/Version\/(\d+)/.exec(userAgent)![1]}` : 'Unknown browser');
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}

export function buildPayload(entry: ErrorEntry, extra: { browser: string; online: boolean; note: string }): ErrorReportPayload {
  return {
    fingerprint: entry.id,
    name: clip(entry.name, 100),
    message: clip(entry.message, MAX_MESSAGE),
    stack: clip(entry.stack, MAX_STACK),
    source: clip(entry.source, 40),
    route: clip(entry.route.split('?')[0].split('#')[0], 100),
    appVersion: clip(entry.appVersion, 20),
    browser: clip(extra.browser, 60),
    online: extra.online,
    count: Math.min(entry.count, 100_000),
    firstSeen: entry.firstSeen,
    lastSeen: entry.lastSeen,
    note: clip(redact(extra.note.trim()), MAX_NOTE),
  };
}

export function issueUrl(repository: string, payload: ErrorReportPayload): string {
  const body = [
    payload.note ? `**What I was doing:** ${payload.note}` : '',
    '```json',
    JSON.stringify({ ...payload, note: undefined }, null, 2).slice(0, 5000),
    '```',
  ]
    .filter(Boolean)
    .join('\n');
  const title = `Error: ${payload.message}`.slice(0, 120);
  return `${repository}/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
