import { Component, computed, inject } from '@angular/core';
import { Cog, Expand, FlaskConical, ListTree, Minimize2, Maximize2, Network, PersonStanding, Shrink, Swords, CalendarClock } from 'lucide';
import { LucideIcon } from './ui/lucide-icon';
import { RpgTabs, RpgTab } from './ui/rpg-tabs';
import { TopBar } from './layout/top-bar';
import { StatusBar } from './layout/status-bar';
import { Navigator } from './navigator/navigator';
import { CharacterEditor } from './character-editor/character-editor';
// import { DialogueEditor } from './dialogue-editor/dialogue-editor'; // node editor — hidden for now, see below
import { DialogueWorkbench } from './dialogue-workbench/dialogue-workbench';
import { InteractionsEditor } from './interactions-editor/interactions-editor';
import { Inspector } from './inspector/inspector';
import { RelationGraphView } from './relation-graph/relation-graph';
import { ScenarioSimulator } from './scenario-simulator/scenario-simulator';
import { Sculptor } from './sculptor/sculptor';
import { CharacterRoutines } from './character-routines/character-routines';
import { EditorTabId, WorkspaceStore } from './store/workspaceStore';
import { ShellStore } from './store/shellStore';
import { TomeHistory } from './store/tomeHistory';
import { CommandsService } from './layout/commands';
import { ShellDialogs } from './layout/shell-dialogs';

export type { EditorTabId };

@Component({
  selector: 'app-root',
  imports: [
    LucideIcon,
    RpgTabs,
    TopBar,
    StatusBar,
    Navigator,
    CharacterEditor,
    // DialogueEditor, // node editor — hidden for now (kept in ./dialogue-editor)
    DialogueWorkbench,
    InteractionsEditor,
    Inspector,
    RelationGraphView,
    ScenarioSimulator,
    Sculptor,
    CharacterRoutines,
    ShellDialogs,
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class App {
  protected readonly tabs: RpgTab[] = [
    { id: 'character', label: 'Character', icon: Swords },
    { id: 'sculptor', label: 'Sculptor', icon: PersonStanding },
    // { id: 'dialogue', label: 'Dialogue Loom', icon: MessagesSquare }, // node editor — hidden for now
    { id: 'dialogue', label: 'Dialogue', icon: ListTree },
    { id: 'routines', label: 'Routines', icon: CalendarClock },
    { id: 'interactions', label: 'Interactions', icon: Cog },
    { id: 'relations', label: 'Relations', icon: Network },
    { id: 'simulation', label: 'Simulation', icon: FlaskConical },
  ];
  private readonly workspace = inject(WorkspaceStore);
  protected readonly activeTab = this.workspace.tab;

  protected readonly shell = inject(ShellStore);
  private readonly commands = inject(CommandsService);
  protected readonly history = inject(TomeHistory);

  protected readonly maxSectionIcon = computed(() => (this.shell.maximized() ? Minimize2 : Maximize2));
  protected readonly fullscreenIcon = computed(() => (this.shell.fullscreen() ? Shrink : Expand));

  protected openTab(id: EditorTabId): void {
    this.workspace.open(id);
  }

  protected onTabChange(id: string): void {
    this.workspace.open(id as EditorTabId);
  }

  protected toggleLeftSidebar(): void {
    this.commands.run('view.left');
  }

  protected toggleMainMaximized(): void {
    this.commands.run('view.maximize');
  }

  protected toggleFullscreen(): void {
    this.commands.run('view.fullscreen');
  }

  protected onKeydown(event: KeyboardEvent): void {
    this.commands.handleKey(event);
  }
}
