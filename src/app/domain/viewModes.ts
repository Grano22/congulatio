export type EditorTabId = 'character' | 'sculptor' | 'sheet' | 'dialogue' | 'routines' | 'interactions' | 'relations' | 'simulation';

export type NavigatorId = 'codex' | 'routines' | 'attributes' | 'dialogues' | 'quests' | 'world';

export type ViewModeId = 'npc-flow' | 'dnd';

export type ViewMode = {
  id: ViewModeId;
  label: string;
  short: string;
  description: string;
  beta: boolean;
  tabs: EditorTabId[];
  navigators: NavigatorId[];
};

export const DEFAULT_VIEW_MODE: ViewModeId = 'npc-flow';

export const VIEW_MODES: ViewMode[] = [
  {
    id: 'npc-flow',
    label: 'Game NPC Flow Design',
    short: 'NPC Flow',
    description: 'Characters, dialogues, routines, interactions and simulations for game NPCs.',
    beta: false,
    tabs: ['character', 'sculptor', 'dialogue', 'routines', 'interactions', 'relations', 'simulation'],
    navigators: ['codex', 'routines', 'attributes', 'dialogues', 'quests', 'world'],
  },
  {
    id: 'dnd',
    label: 'Dungeons & Dragons',
    short: 'D&D',
    description: 'Tabletop characters with 5e-style sheets, printable as a PDF or a card. Dialogues stay in the NPC Flow view.',
    beta: true,
    tabs: ['character', 'sheet', 'sculptor', 'relations'],
    navigators: ['codex', 'attributes', 'quests', 'world'],
  },
];

export const isViewModeId = (value: unknown): value is ViewModeId => VIEW_MODES.some((m) => m.id === value);

export const viewMode = (id: ViewModeId): ViewMode => VIEW_MODES.find((m) => m.id === id) ?? VIEW_MODES[0];

export const allowsTab = (mode: ViewMode, tab: EditorTabId): boolean => mode.tabs.includes(tab);

export const fallbackTab = (mode: ViewMode, tab: EditorTabId): EditorTabId => (allowsTab(mode, tab) ? tab : mode.tabs[0]);

export const modeForTab = (current: ViewMode, tab: EditorTabId): ViewMode =>
  allowsTab(current, tab) ? current : (VIEW_MODES.find((m) => allowsTab(m, tab)) ?? current);
