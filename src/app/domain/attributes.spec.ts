import { INITIAL_SOULS } from '../store/charactersStore';
import { CustomAttributeDraft, SAMPLE_CUSTOM_ATTRIBUTES, attributeRows, attributeToken, parseAttributeValue, validateCustomAttribute } from './attributes';

const draft = (over: Partial<CustomAttributeDraft>): CustomAttributeDraft => ({
  key: 'FTH',
  name: 'Faith',
  min: 0,
  max: 10,
  defaultValue: 5,
  description: '',
  ...over,
});

describe('custom attributes', () => {
  it('accepts a well formed attribute', () => {
    expect(validateCustomAttribute(draft({}), SAMPLE_CUSTOM_ATTRIBUTES)).toBeNull();
  });

  it('rejects bad keys, clashes and broken ranges', () => {
    expect(validateCustomAttribute(draft({ key: '9X' }), [])).toContain('starting with a letter');
    expect(validateCustomAttribute(draft({ key: 'str' }), [])).toContain('core attribute');
    expect(validateCustomAttribute(draft({ key: 'lck' }), SAMPLE_CUSTOM_ATTRIBUTES)).toContain('already uses LCK');
    expect(validateCustomAttribute(draft({ min: 10, max: 10 }), [])).toContain('below the highest');
    expect(validateCustomAttribute(draft({ defaultValue: 11 }), [])).toContain('inside the range');
  });

  it('lists core attributes then custom ones with defaults', () => {
    const rows = attributeRows(INITIAL_SOULS[0], SAMPLE_CUSTOM_ATTRIBUTES);
    expect(rows.slice(0, 6).map((r) => r.key)).toEqual(['STR', 'DEX', 'INT', 'WIS', 'CON', 'CHA']);
    expect(rows.find((r) => r.key === 'LCK')?.value).toBe(10);
    const withLuck = { ...INITIAL_SOULS[0], customAttributes: { 'attr-luck': 18 } };
    expect(attributeRows(withLuck, SAMPLE_CUSTOM_ATTRIBUTES).find((r) => r.key === 'LCK')?.value).toBe(18);
  });

  it('builds a marked copy token', () => {
    expect(attributeToken('Aldric Blackwood', 'STR', 78)).toBe('[[Aldric Blackwood.STR=78]]');
  });

  it('parses typed values within range', () => {
    expect(parseAttributeValue(' 42 ', 0, 100)).toBe(42);
    expect(parseAttributeValue('-5', -10, 10)).toBe(-5);
    expect(parseAttributeValue('4.5', 0, 10)).toBe('Enter a whole number.');
    expect(parseAttributeValue('200', 0, 100)).toBe('Keep it between 0 and 100.');
  });
});
