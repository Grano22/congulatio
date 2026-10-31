export type EditorTabId = 'character' | 'sculptor' | 'sheet' | 'dialogue' | 'routines' | 'interactions' | 'relations' | 'simulation';

export type NavigatorId = 'codex' | 'routines' | 'attributes' | 'dialogues' | 'quests' | 'world';

export type ViewModeId = 'npc-flow' | 'dnd';

export type ThemeId = 'forge' | 'dragonfire';

export type ThemeChoice = ThemeId | 'auto';

export type ViewMode = {
  id: ViewModeId;
  label: string;
  short: string;
  description: string;
  beta: boolean;
  theme: ThemeId;
  tabs: EditorTabId[];
  navigators: NavigatorId[];
};

export type Theme = { id: ThemeId; label: string; description: string };

export const DEFAULT_VIEW_MODE: ViewModeId = 'npc-flow';

export const VIEW_MODES: ViewMode[] = [
  {
    id: 'npc-flow',
    label: 'Game NPC Flow Design',
    short: 'NPC Flow',
    description: 'Characters, dialogues, routines, interactions and simulations for game NPCs.',
    beta: false,
    theme: 'forge',
    tabs: ['character', 'sculptor', 'dialogue', 'routines', 'interactions', 'relations', 'simulation'],
    navigators: ['codex', 'routines', 'attributes', 'dialogues', 'quests', 'world'],
  },
  {
    id: 'dnd',
    label: 'Dungeons & Dragons',
    short: 'D&D',
    description: 'Tabletop characters with 5e-style sheets, printable as a PDF or a card. Dialogues stay in the NPC Flow view.',
    beta: true,
    theme: 'dragonfire',
    tabs: ['character', 'sheet', 'sculptor', 'relations'],
    navigators: ['codex', 'attributes', 'quests', 'world'],
  },
];

export const THEMES: Theme[] = [
  { id: 'forge', label: 'Forge', description: 'Carved oak and gilded brass' },
  { id: 'dragonfire', label: 'Dragonfire', description: 'Ember red on dark stone' },
];

export const isViewModeId = (value: unknown): value is ViewModeId => VIEW_MODES.some((m) => m.id === value);

export const isThemeChoice = (value: unknown): value is ThemeChoice => value === 'auto' || THEMES.some((t) => t.id === value);

export const viewMode = (id: ViewModeId): ViewMode => VIEW_MODES.find((m) => m.id === id) ?? VIEW_MODES[0];

export const resolveTheme = (choice: ThemeChoice, mode: ViewMode): ThemeId => (choice === 'auto' ? mode.theme : choice);

export const allowsTab = (mode: ViewMode, tab: EditorTabId): boolean => mode.tabs.includes(tab);

export const fallbackTab = (mode: ViewMode, tab: EditorTabId): EditorTabId => (allowsTab(mode, tab) ? tab : mode.tabs[0]);

export const modeForTab = (current: ViewMode, tab: EditorTabId): ViewMode =>
  allowsTab(current, tab) ? current : (VIEW_MODES.find((m) => allowsTab(m, tab)) ?? current);
