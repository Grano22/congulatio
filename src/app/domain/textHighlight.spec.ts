import { highlightParts, matchesAll, searchTokens } from './textHighlight';

const marked = (text: string, query: string): string =>
  highlightParts(text, searchTokens(query))
    .map((p) => (p.hit ? `[${p.text}]` : p.text))
    .join('');

describe('text highlighting', () => {
  it('marks every occurrence of every word, ignoring case', () => {
    expect(marked('The door remembers the door', 'DOOR')).toBe('The [door] remembers the [door]');
    expect(marked('Ask about the reward', 'ask reward')).toBe('[Ask] about the [reward]');
  });

  it('merges overlapping matches into one mark', () => {
    expect(marked('moonsteel', 'moon oons')).toBe('[moons]teel');
  });

  it('leaves text untouched without a query or a match', () => {
    expect(marked('Hello', '')).toBe('Hello');
    expect(marked('Hello', 'xyz')).toBe('Hello');
  });

  it('requires every word to match', () => {
    expect(matchesAll('Steal a loaf', searchTokens('loaf steal'))).toBe(true);
    expect(matchesAll('Steal a loaf', searchTokens('loaf bread'))).toBe(false);
  });
});
