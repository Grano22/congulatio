import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Sparkles, Sprout } from 'lucide';
import type { IconNode } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { InteractionsStore } from '../store/interactionsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { ShellStore } from '../store/shellStore';
import { CommandsService } from './commands';
import { SEARCH_TAGS, SearchHit, buildSearchIndex, searchIndex } from '../domain/search';

const SEARCH_RUNE: IconNode = [
  ['rect', { x: '4.5', y: '2.5', width: '15', height: '19', rx: '3' }],
  ['path', { d: 'M12 7.5 L15.5 12 L12 16.5 L8.5 12 Z' }],
];

const OWN_COMMAND = 'search.focus';

@Component({
  selector: 'app-global-search',
  imports: [LucideIcon],
  styleUrl: './global-search.css',
  host: { '(document:pointerdown)': 'onOutside($event)' },
  templateUrl: './global-search.html',
})
export class GlobalSearch {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);
  private readonly commands = inject(CommandsService);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly searchIcon = SEARCH_RUNE;
  protected readonly sproutIcon = Sprout;
  protected readonly sparkleIcon = Sparkles;
  protected readonly tags = SEARCH_TAGS;
  protected readonly listId = 'global-search-results';
  protected readonly shortcut = this.commands.shortcut(this.commands.get(OWN_COMMAND)!);

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly focused = signal(false);

  private readonly index = computed(() =>
    buildSearchIndex({
      characters: this.characters.characters(),
      dialogue: this.dialogues.nodes(),
      routines: this.relations.routines(),
      relations: this.relations.relations(),
      interactions: this.interactions.interactions(),
      actions: this.commands.all.filter((c) => c.id !== OWN_COMMAND).map((c) => ({ id: c.id, label: c.label, group: c.group })),
    }),
  );
  protected readonly hits = computed(() => searchIndex(this.index(), this.query()));
  protected readonly engaged = computed(() => this.focused() || this.query().length > 0);
  protected readonly showList = computed(() => this.open() && this.query().trim().length > 0);

  constructor() {
    effect(() => {
      if (this.shell.searchFocus() === 0) return;
      untracked(() => {
        const el = this.input().nativeElement;
        el.focus();
        el.select();
        this.open.set(true);
      });
    });
  }

  protected optionId(i: number): string {
    return `${this.listId}-${i}`;
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.hits().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        if (count) this.active.set((this.active() + 1) % count);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set((this.active() - 1 + count) % count);
        return;
      case 'Enter': {
        event.preventDefault();
        const hit = this.hits()[this.active()];
        if (hit) this.go(hit);
        return;
      }
      case 'Escape':
        event.preventDefault();
        if (this.query()) this.clear();
        else this.input().nativeElement.blur();
        return;
    }
  }

  protected go(hit: SearchHit): void {
    const target = hit.target;
    switch (target.kind) {
      case 'soul':
        this.characters.select(target.id);
        this.workspace.focusOn({ kind: 'soul', id: target.id });
        this.workspace.open('character');
        break;
      case 'dialogue':
        this.workspace.focusOn({ kind: 'dialogue', id: target.id });
        this.workspace.open('dialogue');
        break;
      case 'routine':
        this.workspace.focusOn({ kind: 'routine', id: target.id });
        this.workspace.open('relations');
        break;
      case 'bond':
        this.workspace.focusOn({ kind: 'soul', id: target.fromId });
        this.workspace.open('relations');
        break;
      case 'interaction':
        this.workspace.focusOn({ kind: 'interaction', id: target.id });
        this.workspace.open('interactions');
        break;
      case 'command':
        this.commands.run(target.id);
        break;
    }
    this.clear();
    this.input().nativeElement.blur();
  }

  protected onOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private clear(): void {
    this.query.set('');
    this.input().nativeElement.value = '';
    this.open.set(false);
    this.active.set(0);
  }
}
