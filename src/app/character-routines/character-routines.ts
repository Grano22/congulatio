import { Component, DestroyRef, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { CircleAlert, CircleCheck, LogOut, Pencil, Plus, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { Focus, WorkspaceStore } from '../store/workspaceStore';
import { Routine, RoutineDraft, RoutineFork, TIME_SLOTS, TimeSlot, scopeOf, slotOf, validateRoutine } from '../domain/relations';
import { flattenDialogueTree } from '../domain/dialogue';

type RoutineNotice = { kind: 'success' | 'error'; text: string };

const NOTICE_MS = 3500;
const CONFIRM_MS = 4000;

let forkCounter = 0;
const newForkId = (): string => `fork-${Date.now().toString(36)}-${(++forkCounter).toString(36)}`;

const clip = (text: string, max = 48): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

@Component({
  selector: 'app-character-routines',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './character-routines.css',
  templateUrl: './character-routines.html',
})
export class CharacterRoutines {
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly workspace = inject(WorkspaceStore);

  protected readonly plusIcon = Plus;
  protected readonly pencilIcon = Pencil;
  protected readonly xIcon = X;
  protected readonly leaveIcon = LogOut;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;
  protected readonly slots = TIME_SLOTS;

  protected readonly souls = this.characters.characters;
  protected readonly soulId = linkedSignal<Focus | null, string>({
    source: () => this.workspace.focus(),
    computation: (focus, previous) => {
      const candidates = untracked(() => this.candidatesFor(focus));
      if (previous && candidates.includes(previous.value)) return previous.value;
      return candidates[0] ?? previous?.value ?? this.characters.selectedId() ?? this.characters.characters()[0]?.id ?? '';
    },
  });
  protected readonly soul = computed(() => this.souls().find((c) => c.id === this.soulId()) ?? null);

  protected readonly editingId = signal<string | 'new' | null>(null);
  protected readonly draft = signal<RoutineDraft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmId = signal<string | null>(null);
  protected readonly notice = signal<RoutineNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private confirmTimer?: ReturnType<typeof setTimeout>;

  private readonly mine = computed(() =>
    this.relations.routines().filter((r) => r.participantIds.includes(this.soulId()) || (scopeOf(r) === 'personal' && r.ownerId === this.soulId())),
  );

  protected readonly day = computed(() =>
    TIME_SLOTS.map((slot) => {
      const routines = this.mine().filter((r) => slotOf(r) === slot.key);
      return { slot, routines, clash: routines.length > 1 };
    }),
  );

  protected readonly joinable = computed(() =>
    this.relations
      .routines()
      .filter((r) => scopeOf(r) === 'global' && !r.participantIds.includes(this.soulId()))
      .map((r) => ({ routine: r, slot: TIME_SLOTS.find((s) => s.key === slotOf(r))!, busy: this.mine().some((m) => slotOf(m) === slotOf(r)) })),
  );

  protected readonly dialogueGroups = computed(() => {
    const groups: { title: string; options: { id: string; label: string }[] }[] = [];
    for (const row of flattenDialogueTree(this.dialogues.nodes())) {
      if (row.depth === 0) groups.push({ title: clip(row.node.text, 40), options: [] });
      groups[groups.length - 1].options.push({ id: row.node.id, label: `${'· '.repeat(row.depth)}${row.node.speaker}: ${clip(row.node.text)}` });
    }
    return groups;
  });

  private readonly dialogueText = computed(() => new Map(this.dialogues.nodes().map((n) => [n.id, n.text])));

  protected readonly focusedRoutineId = computed(() => {
    const f = this.workspace.focus();
    return f?.kind === 'routine' ? f.id : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.noticeTimer);
      clearTimeout(this.confirmTimer);
    });
  }

  private candidatesFor(focus: Focus | null): string[] {
    if (focus?.kind === 'soul') return [focus.id];
    if (focus?.kind !== 'routine') return [];
    const routine = this.relations.routines().find((r) => r.id === focus.id);
    return routine ? [...(routine.ownerId ? [routine.ownerId] : []), ...routine.participantIds] : [];
  }

  protected scopeOf(r: Routine): 'global' | 'personal' {
    return scopeOf(r);
  }

  protected forkTarget(fork: RoutineFork): string {
    return clip(this.dialogueText().get(fork.dialogueId) ?? 'missing step', 40);
  }

  protected pickSoul(id: string): void {
    this.soulId.set(id);
    this.cancel();
    if (id) this.workspace.focusOn({ kind: 'soul', id });
  }

  protected select(r: Routine): void {
    this.workspace.focusOn({ kind: 'routine', id: r.id });
  }

  protected join(r: Routine): void {
    const soul = this.soul();
    if (!soul) return;
    this.relations.joinRoutine(r.id, soul.id);
    this.notify('success', `${soul.firstName} now keeps “${r.name}”.`);
  }

  protected leave(r: Routine): void {
    const soul = this.soul();
    if (!soul) return;
    this.relations.leaveRoutine(r.id, soul.id);
    this.notify('success', `${soul.firstName} no longer keeps “${r.name}”.`);
  }

  protected openNew(slot: TimeSlot = 'morning'): void {
    const soul = this.soul();
    if (!soul) return;
    this.draft.set({
      name: '',
      schedule: 'Every day',
      scope: 'personal',
      ownerId: soul.id,
      slot,
      location: '',
      note: '',
      participantIds: [soul.id],
      forks: [],
    });
    this.error.set(null);
    this.editingId.set('new');
  }

  protected edit(r: Routine): void {
    const { id, ...rest } = r;
    this.draft.set({ ...rest, slot: slotOf(r), location: r.location ?? '', note: r.note ?? '', forks: r.forks.map((f) => ({ ...f })) });
    this.error.set(null);
    this.editingId.set(id);
    this.select(r);
  }

  protected patch<K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]): void {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
    this.error.set(null);
  }

  protected addFork(): void {
    this.draft.update((d) => (d ? { ...d, forks: [...d.forks, { id: newForkId(), label: '', dialogueId: '' }] } : d));
  }

  protected patchFork(id: string, changes: Partial<RoutineFork>): void {
    this.draft.update((d) => (d ? { ...d, forks: d.forks.map((f) => (f.id === id ? { ...f, ...changes } : f)) } : d));
    this.error.set(null);
  }

  protected removeFork(id: string): void {
    this.draft.update((d) => (d ? { ...d, forks: d.forks.filter((f) => f.id !== id) } : d));
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
    const clean: RoutineDraft = {
      ...draft,
      name: draft.name.trim(),
      schedule: draft.schedule.trim(),
      location: draft.location?.trim(),
      note: draft.note?.trim(),
      forks: draft.forks.map((f) => ({ ...f, label: f.label.trim() })),
    };
    const problem = validateRoutine(clean, this.relations.routines().filter((r) => r.id !== editing));
    if (problem) {
      this.error.set(problem);
      return;
    }
    if (editing === 'new') {
      const id = this.relations.addRoutine(clean);
      this.workspace.focusOn({ kind: 'routine', id });
      this.notify('success', `Added “${clean.name}” to ${this.soul()?.firstName}'s day.`);
    } else {
      this.relations.updateRoutine(editing, clean);
      this.notify('success', `Updated “${clean.name}”.`);
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
    if (this.editingId() === r.id) this.cancel();
    if (this.focusedRoutineId() === r.id) this.workspace.focusOn(null);
    this.notify('success', `Removed “${r.name}”. Undo brings it back.`);
  }

  private notify(kind: RoutineNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
