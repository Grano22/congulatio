import { buildSearchIndex, searchIndex } from './search';
import { INITIAL_SOULS } from '../store/charactersStore';
import { SAMPLE_DIALOGUE_NODES } from './dialogue';
import { SAMPLE_RELATIONS, SAMPLE_ROUTINES } from './relations';
import { SAMPLE_INTERACTIONS } from './interactions';

describe('tome search', () => {
  const index = buildSearchIndex({
    characters: INITIAL_SOULS,
    dialogue: SAMPLE_DIALOGUE_NODES,
    routines: SAMPLE_ROUTINES,
    relations: SAMPLE_RELATIONS,
    interactions: SAMPLE_INTERACTIONS,
    actions: [{ id: 'tome.save', label: 'Save tome', group: 'File' }],
  });

  it('labels characters with full name and nickname', () => {
    const [hit] = searchIndex(index, 'aldric');
    expect(hit.kind).toBe('character');
    expect(hit.label).toBe('Aldric Blackwood (the Bold)');
  });

  it('finds every kind of object', () => {
    const kinds = new Set(
      ['grumhag', 'market', 'thief', 'steal a loaf', 'rival', 'save tome', 'on lock found'].flatMap((q) =>
        searchIndex(index, q).map((h) => h.kind),
      ),
    );
    expect([...kinds].sort()).toEqual(['action', 'bond', 'character', 'interaction', 'line', 'option', 'routine']);
  });

  it('ranks a label prefix above a match in the details', () => {
    const hits = searchIndex(index, 'wren');
    expect(hits[0].label.startsWith('Wren')).toBe(true);
    expect(hits.some((h) => h.kind === 'line')).toBe(true);
  });

  it('requires every word and ignores accents and case', () => {
    expect(searchIndex(index, 'SERAPHINE moon').length).toBeGreaterThan(0);
    expect(searchIndex(index, 'seraphine dragon')).toEqual([]);
  });

  it('marks the matched part of the label', () => {
    const [hit] = searchIndex(index, 'black');
    expect(hit.match.toLowerCase()).toBe('black');
    expect(hit.before + hit.match + hit.after).toBe(hit.label);
  });
});
