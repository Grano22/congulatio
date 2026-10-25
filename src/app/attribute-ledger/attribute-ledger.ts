import { Component, DestroyRef, booleanAttribute, inject, input, output, signal } from '@angular/core';
import { Pencil, Plus, SlidersHorizontal, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { AttributesStore } from '../store/attributesStore';
import { ShellStore } from '../store/shellStore';
import { CORE_ATTRIBUTES, CustomAttribute, CustomAttributeDraft, validateCustomAttribute } from '../domain/attributes';

const CONFIRM_MS = 4000;

const emptyDraft = (): CustomAttributeDraft => ({ key: '', name: '', min: 0, max: 20, defaultValue: 10, description: '' });

@Component({
  selector: 'app-attribute-ledger',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './attribute-ledger.css',
  templateUrl: './attribute-ledger.html',
})
export class AttributeLedger {
  protected readonly store = inject(AttributesStore);
  private readonly shell = inject(ShellStore);

  readonly closable = input(false, { transform: booleanAttribute });
  readonly close = output<void>();

  protected readonly xIcon = X;
  protected readonly plusIcon = Plus;
  protected readonly pencilIcon = Pencil;
  protected readonly slidersIcon = SlidersHorizontal;
  protected readonly core = CORE_ATTRIBUTES;

  protected readonly editingId = signal<string | 'new' | null>(null);
  protected readonly draft = signal<CustomAttributeDraft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  private confirmTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected openNew(): void {
    this.draft.set(emptyDraft());
    this.error.set(null);
    this.editingId.set('new');
  }

  protected edit(a: CustomAttribute): void {
    const { id, ...rest } = a;
    this.draft.set({ ...rest });
    this.error.set(null);
    this.editingId.set(id);
  }

  protected patch<K extends keyof CustomAttributeDraft>(key: K, value: CustomAttributeDraft[K]): void {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
    this.error.set(null);
  }

  protected patchNumber(key: 'min' | 'max' | 'defaultValue', raw: string): void {
    this.patch(key, raw.trim() === '' ? Number.NaN : Number(raw));
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.draft.set(null);
    this.error.set(null);
  }

  protected save(): void {
    const draft = this.draft();
    const editing = this.editingId();
    if (!draft || !editing) return;
    const clean = { ...draft, key: draft.key.trim().toUpperCase(), name: draft.name.trim(), description: draft.description.trim() };
    const problem = validateCustomAttribute(clean, this.store.defs().filter((d) => d.id !== editing));
    if (problem) {
      this.error.set(problem);
      return;
    }
    if (editing === 'new') {
      this.store.add(clean);
      this.shell.notify('success', `Added the ${clean.key} attribute. Every soul starts at ${clean.defaultValue}.`);
    } else {
      this.store.update(editing, clean);
      this.shell.notify('success', `Updated ${clean.key}.`);
    }
    this.cancel();
  }

  protected remove(a: CustomAttribute): void {
    if (this.confirmId() !== a.id) {
      this.confirmId.set(a.id);
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmId.set(null), CONFIRM_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirmId.set(null);
    this.store.remove(a.id);
    if (this.editingId() === a.id) this.cancel();
    this.shell.notify('success', `Removed ${a.key}. Undo brings it and every soul's value back.`);
  }
}
