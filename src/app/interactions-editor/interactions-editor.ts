import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Coins,
  Gift,
  KeyRound,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Plus,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Swords,
  X,
} from 'lucide';
import type { IconNode } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { SuggestInput } from '../ui/suggest-input';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { InteractionsStore } from '../store/interactionsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import {
  INTERACTION_KIND_INFO,
  INTERACTION_KIND_ORDER,
  Interaction,
  InteractionDraft,
  InteractionKind,
  PLAYER_ID,
  TRIGGER_SUGGESTIONS,
  validateInteraction,
} from '../domain/interactions';
import { flattenDialogueTree } from '../domain/dialogue';
import type { Suggestion } from '../domain/interests';

type SortKey = 'kind' | 'source' | 'target' | 'trigger';

type ActNotice = { kind: 'success' | 'error'; text: string };

const KIND_ICON: Record<InteractionKind, IconNode> = {
  combat: Swords,
  threat: ShieldAlert,
  trade: Coins,
  gift: Gift,
  quest: ScrollText,
  talk: MessageCircle,
  spell: Sparkles,
  steal: KeyRound,
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'source', label: 'Source' },
  { key: 'target', label: 'Target' },
  { key: 'trigger', label: 'Trigger' },
];

const NOTICE_MS = 3500;
const CONFIRM_MS = 4000;

const clip = (text: string, max = 48): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

@Component({
  selector: 'app-interactions-editor',
  imports: [RpgPanel, RpgButton, LucideIcon, SuggestInput],
  styleUrl: './interactions-editor.css',
  templateUrl: './interactions-editor.html',
})
export class InteractionsEditor {
  private readonly store = inject(InteractionsStore);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly workspace = inject(WorkspaceStore);

  protected readonly kindInfo = INTERACTION_KIND_INFO;
  protected readonly kindIcon = KIND_ICON;
  protected readonly kinds = INTERACTION_KIND_ORDER;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly plusIcon = Plus;
  protected readonly arrowRightIcon = ArrowRight;
  protected readonly pencilIcon = Pencil;
  protected readonly xIcon = X;
  protected readonly dialogueIcon = MessagesSquare;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;

  protected readonly kindFilter = signal<InteractionKind | 'all'>('all');
  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('kind');
  protected readonly editingId = signal<string | 'new' | null>(null);
  protected readonly draft = signal<InteractionDraft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmRemoveId = signal<string | null>(null);
  protected readonly notice = signal<ActNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private confirmTimer?: ReturnType<typeof setTimeout>;

  protected readonly parties = computed(() => [
    { id: PLAYER_ID, label: 'Player' },
    ...this.characters.characters().map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim() })),
  ]);
  private readonly partyName = computed(() => new Map(this.parties().map((p) => [p.id, p.label])));

  protected readonly dialogueGroups = computed(() => {
    const groups: { title: string; options: { id: string; label: string }[] }[] = [];
    for (const row of flattenDialogueTree(this.dialogues.nodes())) {
      if (row.depth === 0) groups.push({ title: clip(row.node.text, 40), options: [] });
      groups[groups.length - 1].options.push({
        id: row.node.id,
        label: `${'· '.repeat(row.depth)}${row.node.speaker}: ${clip(row.node.text, 52)}`,
      });
    }
    return groups;
  });

  protected readonly triggerSuggestions = computed<Suggestion[]>(() => {
    const known = new Set(TRIGGER_SUGGESTIONS.map((t) => t.label.toLowerCase()));
    const used = [...new Set(this.store.interactions().map((i) => i.trigger.trim()))]
      .filter((t) => t && !known.has(t.toLowerCase()))
      .sort()
      .map((label) => ({ label, group: 'In this world' }));
    return [...used, ...TRIGGER_SUGGESTIONS];
  });

  protected readonly kindCounts = computed(() => {
    const counts = new Map<InteractionKind, number>();
    for (const i of this.store.interactions()) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
    return counts;
  });

  protected readonly rows = computed(() => {
    const names = this.partyName();
    const nodes = new Map(this.dialogues.nodes().map((n) => [n.id, n]));
    const q = this.query().trim().toLowerCase();
    const kind = this.kindFilter();
    const sort = this.sortBy();
    const rows = this.store
      .interactions()
      .map((act) => ({
        act,
        source: names.get(act.sourceId) ?? 'Missing soul',
        target: names.get(act.targetId) ?? 'Missing soul',
        dialogue: act.dialogueId ? (nodes.get(act.dialogueId) ?? null) : null,
        broken: !names.has(act.sourceId) || !names.has(act.targetId),
      }))
      .filter((r) => kind === 'all' || r.act.kind === kind)
      .filter(
        (r) =>
          !q ||
          `${INTERACTION_KIND_INFO[r.act.kind].label} ${r.source} ${r.target} ${r.act.trigger} ${r.act.note}`.toLowerCase().includes(q),
      );
    const key = (r: (typeof rows)[number]): string =>
      sort === 'kind'
        ? `${INTERACTION_KIND_ORDER.indexOf(r.act.kind)}`.padStart(2, '0') + r.source
        : sort === 'source'
          ? r.source
          : sort === 'target'
            ? r.target
            : r.act.trigger;
    return rows.sort((a, b) => key(a).localeCompare(key(b)));
  });

  protected readonly focusedId = computed(() => {
    const f = this.workspace.focus();
    return f?.kind === 'interaction' ? f.id : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.noticeTimer);
      clearTimeout(this.confirmTimer);
    });
  }

  protected select(act: Interaction): void {
    this.workspace.focusOn({ kind: 'interaction', id: act.id });
  }

  protected openNew(): void {
    const focus = this.workspace.focus();
    const firstSoul = this.characters.characters()[0]?.id ?? '';
    this.draft.set({
      kind: 'talk',
      sourceId: PLAYER_ID,
      targetId: focus?.kind === 'soul' ? focus.id : firstSoul,
      trigger: '',
      dialogueId: null,
      note: '',
    });
    this.error.set(null);
    this.editingId.set('new');
  }

  protected edit(act: Interaction): void {
    const { id, ...draft } = act;
    this.draft.set(draft);
    this.error.set(null);
    this.editingId.set(id);
    this.select(act);
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.draft.set(null);
    this.error.set(null);
  }

  protected patch<K extends keyof InteractionDraft>(key: K, value: InteractionDraft[K]): void {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
    this.error.set(null);
  }

  protected swapParties(): void {
    this.draft.update((d) => (d ? { ...d, sourceId: d.targetId, targetId: d.sourceId } : d));
  }

  protected save(): void {
    const draft = this.draft();
    const editing = this.editingId();
    if (!draft || !editing) return;
    const clean = { ...draft, trigger: draft.trigger.trim(), note: draft.note.trim() };
    const problem = validateInteraction(clean, new Set(this.partyName().keys()));
    if (problem) {
      this.error.set(problem);
      this.notify('error', problem);
      return;
    }
    const label = `${INTERACTION_KIND_INFO[clean.kind].label} ${this.partyName().get(clean.sourceId)} → ${this.partyName().get(clean.targetId)}`;
    if (editing === 'new') {
      const id = this.store.add(clean);
      this.workspace.focusOn({ kind: 'interaction', id });
      this.notify('success', `Inscribed ${label}.`);
    } else {
      this.store.update(editing, clean);
      this.notify('success', `Updated ${label}.`);
    }
    this.cancel();
  }

  protected remove(act: Interaction): void {
    if (this.confirmRemoveId() !== act.id) {
      this.confirmRemoveId.set(act.id);
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmRemoveId.set(null), CONFIRM_MS);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirmRemoveId.set(null);
    this.store.remove(act.id);
    if (this.editingId() === act.id) this.cancel();
    if (this.focusedId() === act.id) this.workspace.focusOn(null);
    this.notify('success', `Removed the ${INTERACTION_KIND_INFO[act.kind].label.toLowerCase()} interaction.`);
  }

  protected openDialogue(act: Interaction): void {
    if (!act.dialogueId) return;
    this.workspace.focusOn({ kind: 'dialogue', id: act.dialogueId });
    this.workspace.open('dialogue');
  }

  protected clip(text: string, max?: number): string {
    return clip(text, max);
  }

  private notify(kind: ActNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
