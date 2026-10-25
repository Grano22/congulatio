import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CharactersStore, INITIAL_SOULS } from './charactersStore';
import { DialoguesStore } from './dialoguesStore';
import { RelationsStore } from './relationsStore';
import { InteractionsStore } from './interactionsStore';
import { AttributesStore } from './attributesStore';
import { ShellStore } from './shellStore';
import { SAMPLE_DIALOGUE_NODES } from '../domain/dialogue';
import { SAMPLE_RELATIONS, SAMPLE_ROUTINES } from '../domain/relations';
import { SAMPLE_INTERACTIONS } from '../domain/interactions';
import { SAMPLE_CUSTOM_ATTRIBUTES } from '../domain/attributes';
import {
  ChangesetEntry,
  HistoryEntry,
  TOME_FORMAT,
  TOME_VERSION,
  TomeError,
  TomeFile,
  TomeSnapshot,
  describeChange,
  parseTomeFile,
  sameSnapshot,
  toChangeset,
  validateSnapshot,
} from '../domain/tome';

const SAVE_KEY = 'congulatio.tome.v1';
const RECORD_DELAY_MS = 450;
const HISTORY_LIMIT = 200;

export const INITIAL_TOME: TomeSnapshot = {
  characters: INITIAL_SOULS,
  dialogue: SAMPLE_DIALOGUE_NODES,
  relations: SAMPLE_RELATIONS,
  routines: SAMPLE_ROUTINES,
  interactions: SAMPLE_INTERACTIONS,
  attributeDefs: SAMPLE_CUSTOM_ATTRIBUTES,
};

type SavedTome = { format: typeof TOME_FORMAT; version: number; savedAt: string; tome: TomeSnapshot; changeset: ChangesetEntry[] };

const now = (): string => new Date().toISOString();

@Injectable({ providedIn: 'root' })
export class TomeHistory {
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly attributes = inject(AttributesStore);
  private readonly shell = inject(ShellStore);

  readonly current = computed<TomeSnapshot>(() => ({
    characters: this.characters.characters(),
    dialogue: this.dialogues.nodes(),
    relations: this.relations.relations(),
    routines: this.relations.routines(),
    interactions: this.interactions.interactions(),
    attributeDefs: this.attributes.defs(),
  }));

  readonly entries = signal<HistoryEntry[]>([]);
  readonly index = signal(0);
  readonly archived = signal<ChangesetEntry[]>([]);
  readonly savedAt = signal<string | null>(null);
  private readonly savedSnapshot = signal<TomeSnapshot | null>(null);
  private readonly pending = signal(false);
  private nextId = 1;
  private timer?: ReturnType<typeof setTimeout>;

  readonly canUndo = computed(() => this.index() > 0 || this.pending());
  readonly canRedo = computed(() => this.index() < this.entries().length - 1);
  readonly undoLabel = computed(() => (this.pending() ? 'latest edit' : (this.entries()[this.index()]?.label ?? '')));
  readonly redoLabel = computed(() => this.entries()[this.index() + 1]?.label ?? '');
  readonly dirty = computed(() => {
    const saved = this.savedSnapshot();
    return !saved || !sameSnapshot(saved, this.current());
  });

  constructor() {
    this.loadSaved();
    this.entries.set([{ id: this.nextId++, label: this.savedAt() ? 'Opened saved tome' : 'Opened tome', details: [], at: now(), snapshot: this.current() }]);
    effect(() => {
      const snapshot = this.current();
      untracked(() => this.schedule(snapshot));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  undo(): void {
    this.flush();
    if (this.index() === 0) return;
    const label = this.entries()[this.index()].label;
    this.index.update((i) => i - 1);
    this.restore(this.entries()[this.index()].snapshot);
    this.shell.notify('info', `Undid: ${label}`);
  }

  redo(): void {
    this.flush();
    if (!this.canRedo()) return;
    this.index.update((i) => i + 1);
    this.restore(this.entries()[this.index()].snapshot);
    this.shell.notify('info', `Redid: ${this.entries()[this.index()].label}`);
  }

  jumpTo(index: number): void {
    this.flush();
    if (index < 0 || index >= this.entries().length || index === this.index()) return;
    this.index.set(index);
    this.restore(this.entries()[index].snapshot);
    this.shell.notify('info', `Returned to: ${this.entries()[index].label}`);
  }

  reset(): void {
    this.apply(INITIAL_TOME, 'Reset tome');
    this.shell.notify('success', 'The tome was reset. Undo brings your work back.');
  }

  save(): void {
    this.flush();
    const savedAt = now();
    const data: SavedTome = {
      format: TOME_FORMAT,
      version: TOME_VERSION,
      savedAt,
      tome: this.current(),
      changeset: this.changeset(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      this.shell.notify('error', 'The tome is too large for browser storage. Export it to a file instead.');
      return;
    }
    this.savedAt.set(savedAt);
    this.savedSnapshot.set(this.current());
    this.shell.notify('success', 'The tome and its changeset were saved.');
  }

  exportTome(withHistory: boolean): void {
    this.flush();
    const file: TomeFile = {
      format: TOME_FORMAT,
      version: TOME_VERSION,
      exportedAt: now(),
      tome: this.current(),
      changeset: this.changeset(),
      ...(withHistory ? { history: { index: this.index(), entries: this.entries() } } : {}),
    };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const name = `congulatio-tome-${stamp}${withHistory ? '-history' : ''}.json`;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.shell.notify('error', 'The tome could not be exported.');
      return;
    }
    this.shell.notify('success', withHistory ? `Exported ${name} with its full history.` : `Exported ${name}.`);
  }

  async importFile(file: File): Promise<void> {
    let parsed: TomeFile;
    try {
      parsed = parseTomeFile(await file.text());
    } catch (e) {
      this.shell.notify('error', e instanceof TomeError ? e.message : `${file.name} could not be read.`);
      return;
    }
    this.flush();
    if (parsed.history) {
      clearTimeout(this.timer);
      this.pending.set(false);
      this.entries.set(parsed.history.entries);
      this.index.set(parsed.history.index);
      this.nextId = Math.max(0, ...parsed.history.entries.map((e) => e.id)) + 1;
      this.restore(parsed.history.entries[parsed.history.index].snapshot);
      const changeset = parsed.changeset ?? [];
      this.archived.set(changeset.slice(0, Math.max(0, changeset.length - parsed.history.index)));
      this.shell.notify('success', `Opened ${file.name} with ${parsed.history.entries.length} history steps.`);
      return;
    }
    this.apply(parsed.tome, `Imported ${file.name}`);
    this.shell.notify('success', `Imported ${file.name}. Undo returns to the previous tome.`);
  }

  private changeset(): ChangesetEntry[] {
    return [...this.archived(), ...toChangeset(this.entries().slice(1, this.index() + 1))];
  }

  private apply(snapshot: TomeSnapshot, label: string): void {
    this.flush();
    const before = this.entries()[this.index()].snapshot;
    this.restore(snapshot);
    this.push(label, describeChange(before, snapshot).details);
  }

  private schedule(snapshot: TomeSnapshot): void {
    const head = this.entries()[this.index()];
    if (!head || sameSnapshot(head.snapshot, snapshot)) {
      clearTimeout(this.timer);
      this.pending.set(false);
      return;
    }
    clearTimeout(this.timer);
    this.pending.set(true);
    this.timer = setTimeout(() => this.flush(), RECORD_DELAY_MS);
  }

  private flush(): void {
    clearTimeout(this.timer);
    this.pending.set(false);
    const head = this.entries()[this.index()];
    const snapshot = this.current();
    if (sameSnapshot(head.snapshot, snapshot)) return;
    const change = describeChange(head.snapshot, snapshot);
    this.push(change.label, change.details);
  }

  private push(label: string, details: string[]): void {
    const entry: HistoryEntry = { id: this.nextId++, label, details, at: now(), snapshot: this.current() };
    const kept = [...this.entries().slice(0, this.index() + 1), entry];
    const overflow = Math.max(0, kept.length - HISTORY_LIMIT);
    if (overflow) this.archived.update((a) => [...a, ...toChangeset(kept.slice(1, overflow + 1))]);
    const trimmed = overflow ? [kept[0], ...kept.slice(overflow + 1)] : kept;
    this.entries.set(trimmed);
    this.index.set(trimmed.length - 1);
  }

  private restore(snapshot: TomeSnapshot): void {
    this.characters.replaceAll(snapshot.characters);
    this.dialogues.replaceAll(snapshot.dialogue);
    this.relations.replaceAll(snapshot.relations, snapshot.routines);
    this.interactions.replaceAll(snapshot.interactions);
    this.attributes.replaceAll(snapshot.attributeDefs);
  }

  private loadSaved(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as Partial<SavedTome>;
      if (data.format !== TOME_FORMAT) return;
      const tome = validateSnapshot(data.tome);
      this.restore(tome);
      this.savedAt.set(String(data.savedAt ?? ''));
      this.savedSnapshot.set(this.current());
      this.archived.set(Array.isArray(data.changeset) ? data.changeset : []);
    } catch {
      this.shell.notify('error', 'The saved tome was damaged and could not be opened.');
    }
  }
}
