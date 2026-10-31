export type ThemeId = 'forge' | 'ebony' | 'dragonfire';

export type Theme = { id: ThemeId; label: string; description: string; chromeColor: string };

export const DEFAULT_THEME: ThemeId = 'forge';

export const THEMES: Theme[] = [
  { id: 'forge', label: 'Forge', description: 'Carved oak, gilded brass and fresh parchment', chromeColor: '#31200d' },
  { id: 'ebony', label: 'Ebony Tome', description: 'A dark wooden book bound in brass, with aged vellum pages', chromeColor: '#18110c' },
  { id: 'dragonfire', label: 'Dragonfire', description: 'Glowing embers on charred iron and bone-white pages', chromeColor: '#1d1a1a' },
];

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

export const theme = (id: ThemeId): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const nextTheme = (id: ThemeId): ThemeId => THEMES[(THEMES.findIndex((t) => t.id === id) + 1) % THEMES.length].id;
