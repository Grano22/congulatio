import { DEFAULT_THEME, THEMES, isThemeId, nextTheme, theme } from './themes';

describe('themes', () => {
  it('keeps the forge look as the default', () => {
    expect(DEFAULT_THEME).toBe('forge');
    expect(THEMES[0].id).toBe('forge');
  });

  it('cycles through every theme and wraps around', () => {
    const seen = [DEFAULT_THEME];
    for (let i = 1; i < THEMES.length; i++) seen.push(nextTheme(seen[i - 1]));
    expect(new Set(seen).size).toBe(THEMES.length);
    expect(nextTheme(seen[seen.length - 1])).toBe(DEFAULT_THEME);
  });

  it('validates stored values', () => {
    expect(isThemeId('ebony')).toBe(true);
    expect(isThemeId('auto')).toBe(false);
    expect(theme('nope' as never).id).toBe('forge');
  });
});
