import { equalWeights, equalizePair, resizePair } from './paneSplit';

describe('paneSplit', () => {
  it('gives every open pane the same share', () => {
    expect(equalWeights(['codex', 'routines', 'attributes'])).toEqual({ codex: 1, routines: 1, attributes: 1 });
  });

  it('moves height between the two panes around a divider and leaves the rest alone', () => {
    const weights = { codex: 1, routines: 1, attributes: 1 };
    const next = resizePair(weights, { a: 'codex', b: 'routines', startA: 200, startB: 200, weightA: 1, weightB: 1 }, 50, 120);
    expect(next['codex']).toBeCloseTo(1.25);
    expect(next['routines']).toBeCloseTo(0.75);
    expect(next['attributes']).toBe(1);
  });

  it('keeps both panes at least the minimum height', () => {
    const drag = { a: 'codex', b: 'routines', startA: 200, startB: 200, weightA: 1, weightB: 1 };
    const grown = resizePair({}, drag, 1000, 120);
    expect(grown['routines']).toBeCloseTo((2 * 120) / 400);
    const shrunk = resizePair({}, drag, -1000, 120);
    expect(shrunk['codex']).toBeCloseTo((2 * 120) / 400);
  });

  it('evens out a pair on double-click', () => {
    expect(equalizePair({ codex: 1.5, routines: 0.5, attributes: 1 }, 'codex', 'routines')).toEqual({ codex: 1, routines: 1, attributes: 1 });
  });
});
