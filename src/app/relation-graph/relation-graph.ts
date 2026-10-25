import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, output, signal, untracked, viewChild } from '@angular/core';
import { CircleAlert, CircleCheck, Link2, Swords, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { Focus, WorkspaceStore } from '../store/workspaceStore';
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GraphEdge,
  GraphNode,
  RELATION_KINDS,
  RelationKind,
  buildRelationGraph,
  characterNodeId,
  dialogueNodeId,
  routineNodeId,
} from '../domain/relations';

type GraphNotice = { kind: 'success' | 'error'; text: string };

type GraphLink = { edge: GraphEdge; other: GraphNode };

type GraphLinkGroup = { heading: string; links: GraphLink[] };

type NodeDetail = { heading: string; meta: string[]; body: string };

const NOTICE_MS = 3500;

const TRAIL_LIMIT = 8;

const GROUP_ORDER = [
  'Relations',
  'Routines',
  'Kept by',
  'Forks',
  'Forked from',
  'Follows',
  'Leads to',
  'In the scene',
  'Takes part in',
];

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  character: 'Soul',
  routine: 'Routine',
  line: 'Line',
  choice: 'Option',
};

@Component({
  selector: 'app-relation-graph',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './relation-graph.css',
  templateUrl: './relation-graph.html',
})
export class RelationGraphView {
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relationsStore = inject(RelationsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  readonly focusCharacter = output<void>();

  protected readonly nodeWidth = GRAPH_NODE_WIDTH;
  protected readonly nodeHeight = GRAPH_NODE_HEIGHT;
  protected readonly relationKinds = RELATION_KINDS;
  protected readonly kindLabel = KIND_LABEL;
  protected readonly linkIcon = Link2;
  protected readonly forgeIcon = Swords;
  protected readonly xIcon = X;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;

  protected readonly graph = computed(() =>
    buildRelationGraph(
      this.characters.characters(),
      this.dialogues.nodes(),
      this.relationsStore.relations(),
      this.relationsStore.routines(),
    ),
  );
  private readonly nodeById = computed(() => new Map(this.graph().nodes.map((n) => [n.id, n])));

  protected readonly selectedId = signal<string | null>(null);
  protected readonly trail = signal<string[]>([]);
  protected readonly bindTargetId = signal('');
  protected readonly bindKind = signal<RelationKind>('ally');
  protected readonly notice = signal<GraphNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  protected readonly selectedNode = computed(() => {
    const id = this.selectedId();
    return id ? (this.nodeById().get(id) ?? null) : null;
  });

  protected readonly trailNodes = computed(() =>
    this.trail()
      .map((id) => this.nodeById().get(id))
      .filter((n) => !!n),
  );

  private readonly links = computed<GraphLink[]>(() => {
    const id = this.selectedId();
    if (!id) return [];
    return this.graph()
      .edges.filter((e) => e.from === id || e.to === id)
      .map((edge) => ({ edge, other: this.nodeById().get(edge.from === id ? edge.to : edge.from)! }));
  });

  protected readonly linkGroups = computed<GraphLinkGroup[]>(() => {
    const groups = new Map<string, GraphLink[]>();
    for (const link of this.links()) {
      const heading = this.headingFor(link.edge);
      groups.set(heading, [...(groups.get(heading) ?? []), link]);
    }
    return GROUP_ORDER.filter((h) => groups.has(h)).map((heading) => ({ heading, links: groups.get(heading)! }));
  });

  private readonly activeEdgeIds = computed(() => new Set(this.links().map((l) => l.edge.id)));
  private readonly neighbourIds = computed(() => new Set(this.links().map((l) => l.other.id)));

  protected readonly visibleEdges = computed(() =>
    this.graph().edges.filter((e) => e.kind !== 'presence' || this.activeEdgeIds().has(e.id)),
  );

  protected readonly detail = computed<NodeDetail | null>(() => {
    const node = this.selectedNode();
    if (!node) return null;
    if (node.kind === 'character') {
      const c = this.characters.characters().find((ch) => ch.id === node.refId);
      if (!c) return null;
      return {
        heading: [c.firstName, c.lastName, c.nickname].filter(Boolean).join(' '),
        meta: [`${c.race} · Lv ${c.level}`, c.origin, c.temperament],
        body: c.note,
      };
    }
    if (node.kind === 'routine') {
      const r = this.relationsStore.routines().find((rt) => rt.id === node.refId);
      if (!r) return null;
      return { heading: r.name, meta: [r.schedule, `${r.forks.length} forks`], body: '' };
    }
    const line = this.dialogues.nodes().find((d) => d.id === node.refId);
    if (!line) return null;
    return { heading: line.speaker, meta: [KIND_LABEL[node.kind]], body: line.text };
  });

  protected readonly bindTargets = computed(() => {
    const node = this.selectedNode();
    if (node?.kind !== 'character') return [];
    return this.characters.characters().filter((c) => c.id !== node.refId);
  });

  constructor() {
    effect(() => {
      const focus = this.workspace.focus();
      if (!focus) return;
      const nodeId = this.nodeIdFor(focus);
      if (nodeId === untracked(this.selectedId) || !untracked(this.nodeById).has(nodeId)) return;
      untracked(() => this.step(nodeId));
      afterNextRender(() => this.reveal(nodeId), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.noticeTimer));
  }

  protected step(nodeId: string, reveal = false): void {
    this.selectedId.set(nodeId);
    this.trail.update((t) => (t[t.length - 1] === nodeId ? t : [...t, nodeId].slice(-TRAIL_LIMIT)));
    this.bindTargetId.set('');
    const node = this.nodeById().get(nodeId);
    if (node) this.workspace.focusOn(this.focusFor(node));
    if (reveal) this.reveal(nodeId);
  }

  protected backTo(index: number): void {
    const id = this.trail()[index];
    this.trail.update((t) => t.slice(0, index + 1));
    this.selectedId.set(id);
    const node = this.nodeById().get(id);
    if (node) this.workspace.focusOn(this.focusFor(node));
    this.reveal(id);
  }

  protected clearTrail(): void {
    this.trail.set([]);
    this.selectedId.set(null);
  }

  protected isSelected(node: GraphNode): boolean {
    return node.id === this.selectedId();
  }

  protected isDimmed(node: GraphNode): boolean {
    return this.selectedId() !== null && !this.isSelected(node) && !this.neighbourIds().has(node.id);
  }

  protected isEdgeActive(edge: GraphEdge): boolean {
    return this.activeEdgeIds().has(edge.id);
  }

  protected isEdgeDimmed(edge: GraphEdge): boolean {
    return this.selectedId() !== null && !this.isEdgeActive(edge);
  }

  protected bindRelation(): void {
    const node = this.selectedNode();
    const targetId = this.bindTargetId();
    if (node?.kind !== 'character') return;
    if (!targetId) {
      this.notify('error', 'Choose a soul to bind with.');
      return;
    }
    const taken = this.relationsStore
      .relations()
      .some(
        (r) =>
          (r.fromId === node.refId && r.toId === targetId) || (r.fromId === targetId && r.toId === node.refId),
      );
    if (taken) {
      this.notify('error', 'These souls are already bound.');
      return;
    }
    const target = this.characters.characters().find((c) => c.id === targetId);
    this.relationsStore.bind({ fromId: node.refId, toId: targetId, kind: this.bindKind(), note: '' });
    this.bindTargetId.set('');
    this.notify('success', `Bound to ${target?.firstName ?? 'the soul'} as ${this.bindKind()}.`);
  }

  protected unbind(edge: GraphEdge): void {
    this.relationsStore.unbind(edge.id.slice('relation:'.length));
    this.notify('success', `The ${edge.label} bond was severed.`);
  }

  protected openInForge(): void {
    const node = this.selectedNode();
    if (node?.kind !== 'character') return;
    this.characters.select(node.refId);
    this.focusCharacter.emit();
  }

  private focusFor(node: GraphNode): Focus {
    return { kind: node.kind === 'character' ? 'soul' : node.kind === 'routine' ? 'routine' : 'dialogue', id: node.refId };
  }

  private nodeIdFor(focus: Focus): string {
    return focus.kind === 'soul' ? characterNodeId(focus.id) : focus.kind === 'routine' ? routineNodeId(focus.id) : dialogueNodeId(focus.id);
  }

  private headingFor(edge: GraphEdge): string {
    const outgoing = edge.from === this.selectedId();
    switch (edge.kind) {
      case 'relation':
        return 'Relations';
      case 'routine':
        return outgoing ? 'Routines' : 'Kept by';
      case 'fork':
        return outgoing ? 'Forks' : 'Forked from';
      case 'reply':
        return outgoing ? 'Leads to' : 'Follows';
      case 'presence':
        return outgoing ? 'In the scene' : 'Takes part in';
    }
  }

  private reveal(nodeId: string): void {
    const node = this.nodeById().get(nodeId);
    const el = this.canvas()?.nativeElement;
    if (!node || !el) return;
    el.scrollTo({
      left: node.x + GRAPH_NODE_WIDTH / 2 - el.clientWidth / 2,
      top: node.y + GRAPH_NODE_HEIGHT / 2 - el.clientHeight / 2,
      behavior: 'smooth',
    });
  }

  private notify(kind: GraphNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
