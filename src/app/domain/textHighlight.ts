export type HighlightPart = { text: string; hit: boolean };

export const searchTokens = (query: string): string[] =>
  query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

export const matchesAll = (haystack: string, tokens: string[]): boolean => {
  const lower = haystack.toLowerCase();
  return tokens.every((t) => lower.includes(t));
};

export function highlightParts(text: string, tokens: string[]): HighlightPart[] {
  if (!tokens.length || !text) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const token of tokens) {
    for (let at = lower.indexOf(token); at >= 0; at = lower.indexOf(token, at + token.length)) {
      ranges.push([at, at + token.length]);
    }
  }
  if (!ranges.length) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
