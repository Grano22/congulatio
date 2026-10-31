import { VIEW_MODES, fallbackTab, isThemeChoice, isViewModeId, modeForTab, resolveTheme, viewMode } from './viewModes';

describe('viewModes', () => {
  const npc = viewMode('npc-flow');
  const dnd = viewMode('dnd');

  it('keeps dialogues out of the D&D view and in the NPC flow view', () => {
    expect(dnd.tabs).not.toContain('dialogue');
    expect(dnd.navigators).not.toContain('dialogues');
    expect(npc.tabs).toContain('dialogue');
    expect(npc.navigators).toContain('dialogues');
  });

  it('marks only the D&D view as beta', () => {
    expect(VIEW_MODES.filter((m) => m.beta).map((m) => m.id)).toEqual(['dnd']);
  });

  it('falls back to the first tab of a view when the current one is not part of it', () => {
    expect(fallbackTab(dnd, 'dialogue')).toBe('character');
    expect(fallbackTab(dnd, 'relations')).toBe('relations');
  });

  it('finds a view that can show a tab', () => {
    expect(modeForTab(dnd, 'dialogue').id).toBe('npc-flow');
    expect(modeForTab(npc, 'sheet').id).toBe('dnd');
    expect(modeForTab(dnd, 'character').id).toBe('dnd');
  });

  it('follows the view theme unless a theme is chosen', () => {
    expect(resolveTheme('auto', dnd)).toBe('dragonfire');
    expect(resolveTheme('forge', dnd)).toBe('forge');
  });

  it('validates stored values', () => {
    expect(isViewModeId('dnd')).toBe(true);
    expect(isViewModeId('pathfinder')).toBe(false);
    expect(isThemeChoice('auto')).toBe(true);
    expect(isThemeChoice('neon')).toBe(false);
    expect(viewMode('nope' as never).id).toBe('npc-flow');
  });
});
