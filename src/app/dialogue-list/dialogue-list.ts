import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { CornerDownRight, CornerLeftUp, Plus, Trash2 } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { SoulMultiselect, SoulOption } from '../ui/soul-multiselect';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { InteractionsStore } from '../store/interactionsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { ShellStore } from '../store/shellStore';
import {
  DialogueNode,
  IMPACT_AXES,
  INTERACTION_KINDS,
  INTERACTION_LABEL,
  InteractionKind,
  flattenDialogueTree,
  impactChips,
  impactOf,
  interactionOf,
} from '../domain/dialogue';
import { SceneStatus, sceneLinks, statusOf } from '../domain/dialogueRemoval';
import { HighlightPart, highlightParts, matchesAll, searchTokens } from '../domain/textHighlight';
import { sceneParticipants } from '../domain/relations';

type DialogueEntry = {
  node: DialogueNode;
  level: number;
  interaction: InteractionKind;
  parent: DialogueNode | null;
  next: { node: DialogueNode; interaction: InteractionKind }[];
  chips: string[];
};

type DialogueScene = {
  id: string;
  title: string;
  participantIds: string[];
  entries: DialogueEntry[];
  status: SceneStatus;
  linkedBy: string;
  code: string;
  color: string;
};

const GOLDEN_ANGLE = 137.508;

function sceneColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.round((Math.abs(h) * GOLDEN_ANGLE) % 360)} 48% 36%)`;
}

type StatusFilter = 'all' | SceneStatus;

type EntryOrder = 'reading' | 'level';

type ViewEntry = DialogueEntry & { textParts: HighlightPart[]; speakerParts: HighlightPart[]; nextParts: HighlightPart[][] };

type ViewScene = Omit<DialogueScene, 'entries'> & {
  entries: ViewEntry[];
  groups: { level: number | null; entries: ViewEntry[] }[];
};

type StandaloneDraft = { speaker: string; kind: DialogueNode['kind']; text: string };

let standaloneCounter = 0;

const hasImpact = (n: DialogueNode): boolean => {
  const impact = impactOf(n);
  return IMPACT_AXES.some((a) => impact[a.key] !== 0) || !!impact.goal || !!impact.obstacle;
};

const FLASH_MS = 1400;

const clip = (text: string, max = 64): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

@Component({
  selector: 'app-dialogue-list',
  imports: [LucideIcon, SoulMultiselect],
  styleUrl: './dialogue-list.css',
  templateUrl: './dialogue-list.html',
})
export class DialogueList {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);

  readonly selectedId = model<string | null>(null);

  protected readonly nextIcon = CornerDownRight;
  protected readonly backIcon = CornerLeftUp;
  protected readonly trashIcon = Trash2;
  protected readonly plusIcon = Plus;
  protected readonly interactionKinds = INTERACTION_KINDS;
  protected readonly interactionLabel = INTERACTION_LABEL;
  protected readonly clip = clip;

  protected readonly soulFilter = signal<string[]>([]);
  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly kindFilter = signal<'all' | DialogueNode['kind']>('all');
  protected readonly interactionFilter = signal<'all' | InteractionKind>('all');
  protected readonly aiOnly = signal(false);
  protected readonly impactOnly = signal(false);
  protected readonly levelFrom = signal(1);
  protected readonly levelTo = signal<number | null>(null);
  protected readonly order = signal<EntryOrder>('reading');
  protected readonly newLine = signal<StandaloneDraft | null>(null);
  protected readonly newLineError = signal<string | null>(null);

  protected readonly activeFilters = computed(
    () =>
      (this.soulFilter().length ? 1 : 0) +
      (this.query().trim() ? 1 : 0) +
      (this.statusFilter() !== 'all' ? 1 : 0) +
      (this.kindFilter() !== 'all' ? 1 : 0) +
      (this.interactionFilter() !== 'all' ? 1 : 0) +
      (this.aiOnly() ? 1 : 0) +
      (this.impactOnly() ? 1 : 0) +
      (this.levelFrom() > 1 || this.levelTo() !== null ? 1 : 0),
  );

  protected readonly speakers = computed(() => [...new Set([...this.characters.characters().map((c) => c.firstName), 'Narrator', 'You'])]);
  protected readonly flashId = signal<string | null>(null);
  private readonly scrollTarget = signal<string | null>(null);
  private flashTimer?: ReturnType<typeof setTimeout>;

  protected readonly soulOptions = computed<SoulOption[]>(() =>
    this.characters.characters().map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim(), sub: c.race })),
  );

  private readonly soulNames = computed(
    () => new Map(this.characters.characters().map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()])),
  );

  private readonly scenes = computed<DialogueScene[]>(() => {
    const nodes = this.dialogues.nodes();
    const characters = this.characters.characters();
    const routines = this.relations.routines();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const children = new Map<string, DialogueNode[]>();
    for (const n of nodes) {
      if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
    }
    const interactionFor = (n: DialogueNode): InteractionKind =>
      interactionOf(n, n.parentId ? (byId.get(n.parentId) ?? null) : null);

    const links = sceneLinks(nodes, routines, this.interactions.interactions());
    const scenes: DialogueScene[] = [];
    for (const row of flattenDialogueTree(nodes)) {
      if (row.depth === 0) {
        const routine = routines.find((r) => r.forks.some((f) => f.dialogueId === row.node.id));
        const link = links.get(row.node.id);
        const linkedBy = link
          ? [...link.routines, link.interactions ? `${link.interactions} interaction${link.interactions === 1 ? '' : 's'}` : '']
              .filter(Boolean)
              .join(', ')
          : '';
        scenes.push({
          id: row.node.id,
          title: routine?.name ?? clip(row.node.text, 40),
          participantIds: [],
          entries: [],
          status: statusOf(row.node.id, links),
          linkedBy,
          code: `S${scenes.length + 1}`,
          color: sceneColor(row.node.id),
        });
      }
      const scene = scenes[scenes.length - 1];
      const parent = row.node.parentId ? (byId.get(row.node.parentId) ?? null) : null;
      scene.entries.push({
        node: row.node,
        level: row.depth + 1,
        interaction: interactionFor(row.node),
        parent,
        next: (children.get(row.node.id) ?? []).map((c) => ({ node: c, interaction: interactionFor(c) })),
        chips: impactChips(row.node),
      });
      for (const p of sceneParticipants(row.node.id, nodes, characters, routines)) {
        if (!scene.participantIds.includes(p.characterId)) scene.participantIds.push(p.characterId);
      }
    }
    return scenes;
  });

  protected readonly maxLevel = computed(() => Math.max(1, ...this.scenes().flatMap((sc) => sc.entries.map((e) => e.level))));
  protected readonly levels = computed(() => Array.from({ length: this.maxLevel() }, (_, i) => i + 1));

  protected readonly visibleScenes = computed<ViewScene[]>(() => {
    const wanted = this.soulFilter();
    const status = this.statusFilter();
    const tokens = searchTokens(this.query());
    const kind = this.kindFilter();
    const interaction = this.interactionFilter();
    const aiOnly = this.aiOnly();
    const impactOnly = this.impactOnly();
    const from = this.levelFrom();
    const to = this.levelTo() ?? Infinity;
    const byLevel = this.order() === 'level';
    const view = (e: DialogueEntry): ViewEntry => ({
      ...e,
      textParts: highlightParts(e.node.text, tokens),
      speakerParts: highlightParts(e.node.speaker, tokens),
      nextParts: e.next.map((n) => highlightParts(clip(n.node.text), tokens)),
    });
    return this.scenes()
      .filter((sc) => status === 'all' || sc.status === status)
      .filter((sc) => !wanted.length || wanted.every((id) => sc.participantIds.includes(id)))
      .map((sc) => {
        const entries = sc.entries
          .filter(
            (e) =>
              e.level >= from &&
              e.level <= to &&
              (!tokens.length || matchesAll(`${e.node.text} ${e.node.speaker} ${(e.node.variants ?? []).map((v) => v.text).join(' ')}`, tokens)) &&
              (kind === 'all' || e.node.kind === kind) &&
              (interaction === 'all' || e.interaction === interaction) &&
              (!aiOnly || !!e.node.generated) &&
              (!impactOnly || hasImpact(e.node)),
          )
          .map(view);
        const ordered = byLevel ? [...entries].sort((a, b) => a.level - b.level) : entries;
        const groups = byLevel
          ? [...new Set(ordered.map((e) => e.level))].map((level) => ({ level, entries: ordered.filter((e) => e.level === level) }))
          : [{ level: null, entries: ordered }];
        return { ...sc, entries: ordered, groups };
      })
      .filter((sc) => sc.entries.length > 0);
  });

  protected setLevelFrom(value: number): void {
    this.levelFrom.set(value);
    const to = this.levelTo();
    if (to !== null && to < value) this.levelTo.set(value);
  }

  protected setLevelTo(value: number): void {
    this.levelTo.set(value >= this.maxLevel() ? null : value);
    if (value < this.levelFrom()) this.levelFrom.set(value);
  }

  protected clearFilters(): void {
    this.soulFilter.set([]);
    this.query.set('');
    this.statusFilter.set('all');
    this.kindFilter.set('all');
    this.interactionFilter.set('all');
    this.aiOnly.set(false);
    this.impactOnly.set(false);
    this.levelFrom.set(1);
    this.levelTo.set(null);
  }

  protected openNewLine(): void {
    this.newLine.set({ speaker: this.speakers()[0] ?? 'Narrator', kind: 'line', text: '' });
    this.newLineError.set(null);
  }

  protected patchNewLine(changes: Partial<StandaloneDraft>): void {
    this.newLine.update((d) => (d ? { ...d, ...changes } : d));
    this.newLineError.set(null);
  }

  protected createNewLine(): void {
    const draft = this.newLine();
    if (!draft) return;
    const text = draft.text.trim();
    if (!draft.speaker.trim()) return this.newLineError.set('Choose who speaks.');
    if (!text) return this.newLineError.set('Write the line first.');
    standaloneCounter += 1;
    const id = `sa-${Date.now().toString(36)}-${standaloneCounter.toString(36)}`;
    this.dialogues.add({ id, parentId: null, kind: draft.kind, speaker: draft.kind === 'choice' ? 'You' : draft.speaker, text });
    this.newLine.set(null);
    this.clearFilters();
    this.goTo(id);
    this.shell.notify('success', 'Added a standalone line. Write on from it in the Story Composer.');
  }

  protected readonly entryCount = computed(() => this.visibleScenes().reduce((n, s) => n + s.entries.length, 0));

  constructor() {
    effect(() => {
      const focus = this.workspace.focus();
      if (focus?.kind !== 'dialogue') return;
      untracked(() => {
        const hidden = !this.visibleScenes().some((scene) => scene.entries.some((e) => e.node.id === focus.id));
        if (hidden) this.clearFilters();
        if (hidden || focus.id !== this.selectedId()) this.goTo(focus.id);
      });
    });
    afterRenderEffect(() => {
      const id = this.scrollTarget();
      if (!id) return;
      const row = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row?.focus({ preventScroll: true });
      this.scrollTarget.set(null);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.flashTimer));
  }

  protected participantNames(scene: { participantIds: string[] }): string[] {
    return scene.participantIds.map((id) => this.soulNames().get(id) ?? id);
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.workspace.focusOn({ kind: 'dialogue', id });
  }

  protected toSceneStart(id: string): void {
    const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-scene="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  protected remove(id: string): void {
    this.shell.confirmRemoveDialogue(id);
  }

  protected goTo(id: string): void {
    this.selectedId.set(id);
    this.workspace.focusOn({ kind: 'dialogue', id });
    this.scrollTarget.set(id);
    clearTimeout(this.flashTimer);
    this.flashId.set(id);
    this.flashTimer = setTimeout(() => this.flashId.set(null), FLASH_MS);
  }
}
