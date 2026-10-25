import { Injectable, inject } from '@angular/core';
import { CharactersStore } from '../store/charactersStore';
import { EditorTabId, WorkspaceStore } from '../store/workspaceStore';
import { LAYOUT_PRESETS, ShellStore } from '../store/shellStore';
import { TomeHistory } from '../store/tomeHistory';
import { generateRandomCharacter } from '../domain/randomCharacter';

export type KeyChord = {
  code: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  inText?: boolean;
};

export type Command = {
  id: string;
  label: string;
  group: string;
  keys?: KeyChord[];
  enabled?: () => boolean;
  checked?: () => boolean;
  run: () => void;
};

export const TAB_ORDER: { id: EditorTabId; label: string }[] = [
  { id: 'character', label: 'Character forge' },
  { id: 'sculptor', label: 'Sculptor' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'routines', label: 'Routines' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'relations', label: 'Relations map' },
  { id: 'simulation', label: 'Simulation' },
];

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const KEY_NAMES: Record<string, string> = {
  Slash: '/',
  Backslash: '\\',
  Period: '.',
  Comma: ',',
  F1: 'F1',
};

export function chordLabel(chord: KeyChord): string {
  const key = KEY_NAMES[chord.code] ?? chord.code.replace(/^Key|^Digit/, '');
  const parts = [
    chord.mod ? (IS_MAC ? '⌘' : 'Ctrl') : '',
    chord.alt ? (IS_MAC ? '⌥' : 'Alt') : '',
    chord.shift ? (IS_MAC ? '⇧' : 'Shift') : '',
    key,
  ].filter(Boolean);
  return parts.join(IS_MAC ? '' : '+');
}

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' ||
    (target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'file'].includes((target as HTMLInputElement).type)));

@Injectable({ providedIn: 'root' })
export class CommandsService {
  private readonly history = inject(TomeHistory);
  private readonly shell = inject(ShellStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly characters = inject(CharactersStore);

  readonly all: Command[] = [
    { id: 'tome.save', group: 'File', label: 'Save tome', keys: [{ code: 'KeyS', mod: true, inText: true }], run: () => this.history.save() },
    { id: 'tome.import', group: 'File', label: 'Open tome from file…', keys: [{ code: 'KeyO', mod: true, inText: true }], run: () => this.pickTomeFile() },
    { id: 'tome.export', group: 'File', label: 'Export tome', keys: [{ code: 'KeyE', mod: true, shift: true, inText: true }], run: () => this.history.exportTome(false) },
    { id: 'tome.exportHistory', group: 'File', label: 'Export tome with history', run: () => this.history.exportTome(true) },
    { id: 'tome.reset', group: 'File', label: 'Reset tome…', run: () => this.shell.open('reset') },

    {
      id: 'edit.undo',
      group: 'Edit',
      label: 'Undo',
      keys: [{ code: 'KeyZ', mod: true }],
      enabled: () => this.history.canUndo(),
      run: () => this.history.undo(),
    },
    {
      id: 'edit.redo',
      group: 'Edit',
      label: 'Redo',
      keys: [{ code: 'KeyZ', mod: true, shift: true }, { code: 'KeyY', mod: true }],
      enabled: () => this.history.canRedo(),
      run: () => this.history.redo(),
    },
    { id: 'edit.history', group: 'Edit', label: 'History & changeset…', keys: [{ code: 'KeyH', mod: true, shift: true, inText: true }], run: () => this.shell.open('history') },

    {
      id: 'view.left',
      group: 'View',
      label: 'Codex wing',
      keys: [{ code: 'KeyB', mod: true, inText: true }],
      checked: () => this.shell.leftVisible(),
      run: () => this.shell.leftVisible.update((v) => !v),
    },
    {
      id: 'view.inspector',
      group: 'View',
      label: 'Inspector',
      keys: [{ code: 'KeyB', mod: true, alt: true, inText: true }],
      checked: () => this.shell.inspectorVisible(),
      run: () => this.shell.inspectorVisible.update((v) => !v),
    },
    {
      id: 'view.inspectorReadonly',
      group: 'View',
      label: 'Inspector read-only',
      keys: [{ code: 'KeyR', mod: true, alt: true, inText: true }],
      checked: () => this.shell.inspectorReadonly(),
      run: () => this.shell.inspectorReadonly.update((v) => !v),
    },
    ...LAYOUT_PRESETS.map<Command>((p) => ({
      id: `view.preset.${p.id}`,
      group: 'Layout',
      label: p.label,
      checked: () => this.shell.activePreset() === p.id,
      run: () => this.shell.applyPreset(p.id),
    })),
    {
      id: 'view.maximize',
      group: 'View',
      label: 'Maximize stage',
      keys: [{ code: 'KeyM', mod: true, alt: true, inText: true }],
      checked: () => this.shell.maximized(),
      run: () => this.shell.maximized.update((v) => !v),
    },
    {
      id: 'view.fullscreen',
      group: 'View',
      label: 'Fullscreen',
      keys: [{ code: 'KeyF', mod: true, alt: true, inText: true }],
      checked: () => this.shell.fullscreen(),
      run: () => this.shell.toggleFullscreen(),
    },
    {
      id: 'search.focus',
      group: 'Go to',
      label: 'Search the tome',
      keys: [{ code: 'KeyK', mod: true, inText: true }],
      run: () => this.shell.searchFocus.update((n) => n + 1),
    },
    ...TAB_ORDER.map<Command>((t, i) => ({
      id: `tab.${t.id}`,
      group: 'Go to',
      label: t.label,
      keys: [{ code: `Digit${i + 1}`, alt: true, inText: true }],
      checked: () => this.workspace.tab() === t.id,
      run: () => this.workspace.open(t.id),
    })),

    { id: 'tools.summon', group: 'Tools', label: 'Summon a random soul into the codex', keys: [{ code: 'KeyN', mod: true, alt: true, inText: true }], run: () => this.summon() },
    {
      id: 'tools.sculpt',
      group: 'Tools',
      label: 'Sculpt the focused soul',
      enabled: () => this.workspace.focus()?.kind === 'soul',
      run: () => this.openForFocusedSoul('sculptor'),
    },
    { id: 'tools.simulate', group: 'Tools', label: 'Simulate a scenario', run: () => this.workspace.open('simulation') },
    { id: 'tools.map', group: 'Tools', label: 'Show focus on the relations map', run: () => this.workspace.open('relations') },

    { id: 'help.tour', group: 'Help', label: 'Quick tour & shortcuts', keys: [{ code: 'F1', inText: true }, { code: 'Slash', shift: true }], run: () => this.shell.open('tour') },
    { id: 'help.about', group: 'Help', label: 'About Congulatio', run: () => this.shell.open('about') },
  ];

  private readonly byId = new Map(this.all.map((c) => [c.id, c]));

  get(id: string): Command | undefined {
    return this.byId.get(id);
  }

  isEnabled(command: Command): boolean {
    return command.enabled ? command.enabled() : true;
  }

  run(id: string): void {
    const command = this.byId.get(id);
    if (command && this.isEnabled(command)) command.run();
  }

  shortcut(command: Command): string {
    return command.keys?.length ? chordLabel(command.keys[0]) : '';
  }

  handleKey(event: KeyboardEvent): boolean {
    if (this.shell.dialog()) return false;
    const mod = IS_MAC ? event.metaKey : event.ctrlKey;
    const inText = isTextTarget(event.target);
    for (const command of this.all) {
      for (const chord of command.keys ?? []) {
        if (chord.code !== event.code) continue;
        if (!!chord.mod !== mod || !!chord.shift !== event.shiftKey || !!chord.alt !== event.altKey) continue;
        if (inText && !chord.inText) continue;
        event.preventDefault();
        this.run(command.id);
        return true;
      }
    }
    return false;
  }

  private summon(): void {
    const soul = generateRandomCharacter();
    this.characters.save(soul);
    this.workspace.focusOn({ kind: 'soul', id: soul.id });
    this.shell.notify('success', `${soul.firstName} ${soul.lastName} was summoned into the codex.`);
  }

  private openForFocusedSoul(tab: EditorTabId): void {
    const focus = this.workspace.focus();
    if (focus?.kind === 'soul') this.characters.select(focus.id);
    this.workspace.open(tab);
  }

  private pickTomeFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void this.history.importFile(file);
    });
    input.click();
  }
}
