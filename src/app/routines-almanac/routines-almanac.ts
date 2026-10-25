import { Component, DestroyRef, booleanAttribute, computed, inject, input, output, signal } from '@angular/core';
import { CalendarClock, Pencil, Plus, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { RelationsStore } from '../store/relationsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { ShellStore } from '../store/shellStore';
import { Routine, RoutineDraft, TIME_SLOTS, TimeSlot, scopeOf, slotOf, validateRoutine } from '../domain/relations';

const CONFIRM_MS = 4000;

const SLOT_LABEL = Object.fromEntries(TIME_SLOTS.map((s) => [s.key, s.label])) as Record<TimeSlot, string>;

const emptyDraft = (): RoutineDraft => ({
  name: '',
  schedule: 'Every day',
  scope: 'global',
  slot: 'morning',
  location: '',
  note: '',
  participantIds: [],
  forks: [],
});

@Component({
  selector: 'app-routines-almanac',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './routines-almanac.css',
  templateUrl: './routines-almanac.html',
})
export class RoutinesAlmanac {
  private readonly relations = inject(RelationsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);

  readonly closable = input(false, { transform: booleanAttribute });
  readonly close = output<void>();

  protected readonly xIcon = X;
  protected readonly plusIcon = Plus;
  protected readonly pencilIcon = Pencil;
  protected readonly calendarIcon = CalendarClock;
  protected readonly slots = TIME_SLOTS;
  protected readonly slotLabel = SLOT_LABEL;

  protected readonly filter = signal('');
  protected readonly editingId = signal<string | 'new' | null>(null);
  protected readonly draft = signal<RoutineDraft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  private confirmTimer?: ReturnType<typeof setTimeout>;

  private readonly globals = computed(() =>
    this.relations
      .routines()
      .filter((r) => scopeOf(r) === 'global')
      .sort(
        (a, b) =>
          TIME_SLOTS.findIndex((s) => s.key === slotOf(a)) - TIME_SLOTS.findIndex((s) => s.key === slotOf(b)) ||
          a.name.localeCompare(b.name),
      ),
  );

  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return q
      ? this.globals().filter((r) => `${r.name} ${r.schedule} ${r.location ?? ''}`.toLowerCase().includes(q))
      : this.globals();
  });

  protected readonly subtitle = computed(() => `${this.globals().length} shared routines`);

  protected readonly focusedId = computed(() => {
    const f = this.workspace.focus();
    return f?.kind === 'routine' ? f.id : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.confirmTimer));
  }

  protected slotFor(r: Routine): TimeSlot {
    return slotOf(r);
  }

  protected select(r: Routine): void {
    this.workspace.focusOn({ kind: 'routine', id: r.id });
  }

  protected openNew(): void {
    this.draft.set(emptyDraft());
    this.error.set(null);
    this.editingId.set('new');
  }

  protected edit(r: Routine): void {
    const { id, ...rest } = r;
    this.draft.set({ ...rest, slot: slotOf(r), location: r.location ?? '', note: r.note ?? '' });
    this.error.set(null);
    this.editingId.set(id);
    this.select(r);
  }

  protected patch<K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]): void {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
    this.error.set(null);
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
    const clean: RoutineDraft = { ...draft, name: draft.name.trim(), schedule: draft.schedule.trim(), location: draft.location?.trim(), note: draft.note?.trim() };
    const others = this.relations.routines().filter((r) => r.id !== editing);
    const problem = validateRoutine(clean, others);
    if (problem) {
      this.error.set(problem);
      return;
    }
    if (editing === 'new') {
      const id = this.relations.addRoutine(clean);
      this.workspace.focusOn({ kind: 'routine', id });
      this.shell.notify('success', `Added the global routine “${clean.name}”.`);
    } else {
      this.relations.updateRoutine(editing, clean);
      this.shell.notify('success', `Updated “${clean.name}”.`);
    }
    this.cancel();
  }

  protected remove(r: Routine): void {
    if (this.confirmId() !== r.id) {
      this.confirmId.set(r.id);
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmId.set(null), CONFIRM_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirmId.set(null);
    this.relations.removeRoutine(r.id);
    if (this.focusedId() === r.id) this.workspace.focusOn(null);
    if (this.editingId() === r.id) this.cancel();
    this.shell.notify('success', `Removed “${r.name}”. Undo brings it back.`);
  }
}
