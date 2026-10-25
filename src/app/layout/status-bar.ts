import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { ShellStore } from '../store/shellStore';
import { TomeHistory } from '../store/tomeHistory';
import { WorkspaceStore } from '../store/workspaceStore';
import { APP_VERSION } from './app-version';

@Component({
  selector: 'app-status-bar',
  imports: [DatePipe],
  styleUrl: './status-bar.css',
  templateUrl: './status-bar.html',
})
export class StatusBar {
  protected readonly shell = inject(ShellStore);
  protected readonly history = inject(TomeHistory);
  private readonly workspace = inject(WorkspaceStore);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);

  protected readonly version = APP_VERSION;
  protected readonly counts = computed(
    () =>
      `${this.characters.characters().length} souls · ${this.dialogues.nodes().length} lines · ${this.relations.relations().length} bonds`,
  );
  protected readonly focusLabel = computed(() => {
    const focus = this.workspace.focus();
    if (!focus) return null;
    if (focus.kind === 'soul') {
      const c = this.characters.characters().find((x) => x.id === focus.id);
      return c ? { title: `${c.firstName} ${c.lastName}`.trim(), sub: `${c.race} · Lv ${c.level}` } : null;
    }
    if (focus.kind === 'routine') {
      const r = this.relations.routines().find((x) => x.id === focus.id);
      return r ? { title: r.name, sub: r.schedule } : null;
    }
    const n = this.dialogues.nodes().find((x) => x.id === focus.id);
    return n ? { title: n.speaker, sub: n.text.length > 40 ? `${n.text.slice(0, 39)}…` : n.text } : null;
  });
}
