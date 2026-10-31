import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CharactersStore, INITIAL_SOULS } from './charactersStore';
import { DialoguesStore } from './dialoguesStore';
import { RelationsStore } from './relationsStore';
import { InteractionsStore } from './interactionsStore';
import { AttributesStore } from './attributesStore';
import { ShellStore } from './shellStore';
import { TOMES, TomeVault, VaultTome } from './tomeVault';
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

const LEGACY_SAVE_KEY = 'congulatio.tome.v1';
export const LOCAL_OWNER = 'local';
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

type LegacySavedTome = { format: typeof TOME_FORMAT; version: number; savedAt: string; tome: TomeSnapshot; changeset: ChangesetEntry[] };

const now = (): string => new Date().toISOString();

@Injectable({ providedIn: 'root' })
export class TomeHistory {
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly attributes = inject(AttributesStore);
  private readonly shell = inject(ShellStore);
  private readonly vault = inject(TomeVault);

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
  readonly owner = signal<string | null>(null);
  private opening?: { owner: string; done: Promise<void> };
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
    this.entries.set([{ id: this.nextId++, label: 'Opened tome', details: [], at: now(), snapshot: this.current() }]);
    this.savedSnapshot.set(this.current());
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

  open(owner: string, carryCurrent = false): Promise<void> {
    if (this.owner() === owner) return Promise.resolve();
    if (this.opening?.owner === owner) return this.opening.done;
    const done = this.read(owner, carryCurrent).finally(() => {
      if (this.opening?.done === done) this.opening = undefined;
    });
    this.opening = { owner, done };
    return done;
  }

  close(): void {
    this.opening = undefined;
    this.owner.set(null);
    this.load(INITIAL_TOME, null, [], 'Opened tome');
  }

  save(): void {
    void this.persist().then((ok) => ok && this.shell.notify('success', 'The tome and its changeset were saved in this browser.'));
  }

  async persist(): Promise<boolean> {
    this.flush();
    const savedAt = now();
    const tome = this.current();
    try {
      await this.vault.put(TOMES, { owner: this.owner() ?? LOCAL_OWNER, savedAt, tome, changeset: this.changeset() });
    } catch {
      this.shell.notify('error', 'The browser database refused the tome. Export it to a file instead.');
      return false;
    }
    this.savedAt.set(savedAt);
    this.savedSnapshot.set(tome);
    return true;
  }

  async adopt(snapshot: TomeSnapshot, savedAt: string, label: string): Promise<void> {
    this.apply(snapshot, label);
    await this.markSaved(savedAt);
  }

  async markSaved(savedAt: string): Promise<void> {
    this.flush();
    const tome = this.current();
    this.savedAt.set(savedAt);
    this.savedSnapshot.set(tome);
    try {
      await this.vault.put(TOMES, { owner: this.owner() ?? LOCAL_OWNER, savedAt, tome, changeset: this.changeset() });
    } catch {
      this.shell.notify('error', 'The browser database refused the tome. Export it to a file instead.');
    }
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

  private async read(owner: string, carryCurrent: boolean): Promise<void> {
    let record: VaultTome | undefined;
    try {
      record = (await this.vault.get<VaultTome>(TOMES, owner)) ?? (carryCurrent ? await this.carry(owner) : await this.migrateLegacy(owner));
    } catch {
      this.shell.notify('error', 'The browser database could not be opened, so the tome lives only until this tab closes.');
    }
    this.flush();
    this.owner.set(owner);
    if (!record) {
      this.load(INITIAL_TOME, null, [], 'Opened tome');
      return;
    }
    try {
      this.load(validateSnapshot(record.tome), record.savedAt, Array.isArray(record.changeset) ? record.changeset : [], 'Opened saved tome');
    } catch {
      this.load(INITIAL_TOME, null, [], 'Opened tome');
      this.shell.notify('error', 'The saved tome was damaged and could not be opened.');
    }
    void this.vault.persist();
  }

  private load(snapshot: TomeSnapshot, savedAt: string | null, changeset: ChangesetEntry[], label: string): void {
    clearTimeout(this.timer);
    this.pending.set(false);
    this.restore(snapshot);
    this.savedAt.set(savedAt);
    this.savedSnapshot.set(this.current());
    this.archived.set(changeset);
    this.entries.set([{ id: this.nextId++, label, details: [], at: now(), snapshot: this.current() }]);
    this.index.set(0);
  }

  private async carry(owner: string): Promise<VaultTome> {
    this.flush();
    const record: VaultTome = { owner, savedAt: now(), tome: this.current(), changeset: this.changeset() };
    await this.vault.put(TOMES, record);
    return record;
  }

  private async migrateLegacy(owner: string): Promise<VaultTome | undefined> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LEGACY_SAVE_KEY);
    } catch {
      return undefined;
    }
    if (!raw) return undefined;
    try {
      const data = JSON.parse(raw) as Partial<LegacySavedTome>;
      if (data.format !== TOME_FORMAT) return undefined;
      const record: VaultTome = {
        owner,
        savedAt: String(data.savedAt ?? now()),
        tome: validateSnapshot(data.tome),
        changeset: Array.isArray(data.changeset) ? data.changeset : [],
      };
      await this.vault.put(TOMES, record);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      return record;
    } catch {
      return undefined;
    }
  }
}
