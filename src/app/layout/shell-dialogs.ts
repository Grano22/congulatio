import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { TomeHistory } from '../store/tomeHistory';
import { EditorTabId, WorkspaceStore } from '../store/workspaceStore';
import { CommandsService, chordLabel } from './commands';
import { APP_VERSION } from './app-version';
import { RemoveDialogueDialog } from './remove-dialogue-dialog';
import { RemoveSoulDialog } from './remove-soul-dialog';


type TourStep = { title: string; text: string; tab?: EditorTabId; where: string };

const TOUR: TourStep[] = [
  {
    title: 'Welcome to the tome',
    where: 'Everywhere',
    text: 'Congulatio keeps one tome: your souls, their dialogue, the bonds between them and the routines they keep. Every change you make is written into its history, so nothing is ever lost by accident.',
  },
  {
    title: 'The Codex wing',
    where: 'Left pane',
    text: 'Browse every soul in the codex. Click one to examine it in the Inspector and load it onto the Forge. Drag the right edge of the wing to resize it, or pick a layout preset from the View menu.',
  },
  {
    title: 'Character Forge',
    where: 'Character tab',
    tab: 'character',
    text: 'Summon Soul rolls a coherent random character. Shape their identity and appearance, then Save to Codex. Saving an existing soul updates it in place.',
  },
  {
    title: 'Sculptor',
    where: 'Sculptor tab',
    tab: 'sculptor',
    text: 'Tune a low-poly 3D build with ranged sliders or body presets, pick a hair style and colour, play Mixamo animations, and press Make Avatar to turn the sculpt into the soul’s portrait.',
  },
  {
    title: 'Dialogue',
    where: 'Dialogue tab',
    tab: 'dialogue',
    text: 'The Tree lists every scene as a flat, levelled list. Filter it to the souls you care about, click a next step to jump to it, write new branches in the Story Composer and shape tone variants and world impact.',
  },
  {
    title: 'Routines',
    where: 'Routines tab & Routine Almanac',
    tab: 'routines',
    text: 'Shared routines like a market day live in the Routine Almanac in the left pane. The Routines tab plans one soul’s day from dawn to midnight: join global routines, add personal ones, link the dialogue each routine forks into, and spot clashes.',
  },
  {
    title: 'Interactions',
    where: 'Interactions tab',
    tab: 'interactions',
    text: 'A ledger of what souls do to each other: combat, trade, quests, spells, theft and more. Each has a trigger and can open a dialogue. Filter, sort, inscribe new ones and edit them in place.',
  },
  {
    title: 'Relations map',
    where: 'Relations tab',
    tab: 'relations',
    text: 'Souls, the routines they keep and the dialogue those routines fork into, drawn as one map. Walk the threads from any sentence to the souls who take part, and bind new relations.',
  },
  {
    title: 'Simulation',
    where: 'Simulation tab',
    tab: 'simulation',
    text: 'Choose a scenario, a soul and its motivations. The soul picks options by its motives and temperament, others answer in the tone their relation calls for, and the outcome sums the impact on the world.',
  },
  {
    title: 'Inspector',
    where: 'Right pane',
    text: 'Whatever is in focus appears here. Edit levels, attributes, routine schedules or dialogue text, and follow links to related souls, routines and steps. Click an attribute value to copy it as a marked token, double-click it to type a value, and use the lock for a read-only view. Define your own attributes in the Attribute Ledger.',
  },
  {
    title: 'Keeping your work',
    where: 'File & Edit menus',
    text: 'Undo and redo walk the history. Save keeps the tome and its changeset in this browser; Export writes a file you can open again, with or without the full history.',
  },
];

@Component({
  selector: 'app-shell-dialogs',
  imports: [RpgModal, RpgButton, DatePipe, RemoveDialogueDialog, RemoveSoulDialog],
  styleUrl: './shell-dialogs.css',
  templateUrl: './shell-dialogs.html',
})
export class ShellDialogs {
  protected readonly shell = inject(ShellStore);
  protected readonly history = inject(TomeHistory);
  private readonly workspace = inject(WorkspaceStore);
  private readonly commands = inject(CommandsService);

  protected readonly version = APP_VERSION;
  protected readonly tour = TOUR;
  protected readonly tourMode = signal<'guide' | 'shortcuts'>('guide');
  protected readonly tourStep = signal(0);

  protected readonly shortcutGroups = computed(() => {
    const groups: { group: string; rows: { label: string; keys: string }[] }[] = [];
    for (const command of this.commands.all) {
      if (!command.keys?.length) continue;
      const row = { label: command.label, keys: command.keys.map(chordLabel).join('  or  ') };
      const group = groups.find((g) => g.group === command.group);
      if (group) group.rows.push(row);
      else groups.push({ group: command.group, rows: [row] });
    }
    groups.push({
      group: 'Inside lists and menus',
      rows: [
        { label: 'Move between tabs, menu items or options', keys: '← → ↑ ↓' },
        { label: 'Choose the highlighted item', keys: 'Enter' },
        { label: 'Close a menu, list or dialog', keys: 'Esc' },
      ],
    });
    return groups;
  });

  protected readonly timeline = computed(() =>
    this.history
      .entries()
      .map((entry, index) => ({ entry, index, state: index === this.history.index() ? 'current' : index > this.history.index() ? 'undone' : 'done' }))
      .reverse(),
  );

  protected openTour(mode: 'guide' | 'shortcuts'): void {
    this.tourMode.set(mode);
  }

  protected stepBy(delta: number): void {
    this.tourStep.update((i) => Math.min(TOUR.length - 1, Math.max(0, i + delta)));
  }

  protected goTo(tab: EditorTabId): void {
    this.workspace.open(tab);
    this.shell.closeDialog();
  }

  protected confirmReset(): void {
    this.shell.closeDialog();
    this.history.reset();
  }

  protected jump(index: number): void {
    this.history.jumpTo(index);
  }
}
