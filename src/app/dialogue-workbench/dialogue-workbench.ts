import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CornerDownRight, ListTree, PenLine, Scale } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { RpgTabs, RpgTab } from '../ui/rpg-tabs';
import { LucideIcon } from '../ui/lucide-icon';
import { DialogueNode } from '../domain/dialogue';
import { DialogueImpactEditor } from '../dialogue-impact/dialogue-impact';
import { DialogueList } from '../dialogue-list/dialogue-list';
import { StoryAiPanel } from '../story-ai/story-ai-panel';
import { DialoguesStore } from '../store/dialoguesStore';
import { WorkspaceStore } from '../store/workspaceStore';

export type WorkbenchSubTab = 'tree' | 'composer' | 'impact';

/** one line of the composer's terminal history */
interface ComposeLogEntry {
  id: number;
  /** the text as written */
  text: string;
  /** where it was woven in, e.g. “under: Grumhag” */
  note: string;
}

/**
 * Dialogue workbench — the node editor ("Dialogue Loom") is parked for now
 * (see ../dialogue-editor, still wired in app.ts as a comment). In its place:
 *   - "Tree"           a simplified, perfectly vertical view of dialogue
 *                      options and next steps
 *   - "Story Composer" an old-school writable prompt: inscribe text and a
 *                      new option is woven into the tree (like the old SMS RPGs)
 */
@Component({
  selector: 'app-dialogue-workbench',
  imports: [RpgPanel, RpgButton, RpgTabs, LucideIcon, DialogueImpactEditor, DialogueList, StoryAiPanel],
  styleUrl: './dialogue-workbench.css',
  templateUrl: './dialogue-workbench.html',
})
export class DialogueWorkbench {
  protected readonly subTabs: RpgTab[] = [
    { id: 'tree', label: 'Tree', icon: ListTree },
    { id: 'composer', label: 'Story Composer', icon: PenLine },
    { id: 'impact', label: 'Variants & Impact', icon: Scale },
  ];
  protected readonly subTab = signal<WorkbenchSubTab>('tree');
  protected readonly penLineIcon = PenLine;
  protected readonly cornerIcon = CornerDownRight;
  protected readonly scaleIcon = Scale;

  /** the dialogue tree, kept flat (node + parentId) so branches are cheap to grow */
  private readonly dialogues = inject(DialoguesStore);
  protected readonly nodes = this.dialogues.nodes;
  /** the writing cursor — the node the composer continues from */
  protected readonly selectedId = signal<string | null>(null);

  protected readonly draft = signal('');
  protected readonly log = signal<ComposeLogEntry[]>([]);
  private nextNodeId = 100;
  private nextLogId = 1;

  private readonly workspace = inject(WorkspaceStore);

  constructor() {
    effect(() => {
      const focus = this.workspace.focus();
      if (focus?.kind !== 'dialogue') return;
      untracked(() => {
        this.selectedId.set(focus.id);
        if (this.subTab() === 'composer') this.subTab.set('tree');
      });
    });
  }

  protected readonly selectedNode = computed(
    () => this.nodes().find((n) => n.id === this.selectedId()) ?? null,
  );
  /** opening line — where new branches attach when nothing is selected */
  protected readonly rootNode = computed(
    () => this.nodes().find((n) => n.parentId === null) ?? null,
  );

  protected setSubTab(id: string): void {
    this.subTab.set(id as WorkbenchSubTab);
  }

  protected onAiAdded(result: { count: number; lastId: string; note: string }): void {
    this.log.update((l) => [...l, { id: this.nextLogId++, text: `${result.count} drafted steps`, note: result.note }]);
    this.selectedId.set(result.lastId);
  }

  protected setDraft(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  /** nearest ancestor that is a spoken line — its speaker answers next */
  private nearestLineAncestor(node: DialogueNode): DialogueNode | null {
    let cur: DialogueNode | undefined = node;
    while (cur) {
      if (cur.kind === 'line') return cur;
      cur = this.nodes().find((n) => n.id === cur!.parentId) ?? undefined;
    }
    return null;
  }

  /**
   * The heart of the composer: whatever was written becomes a new entry.
   * After a spoken line the player may answer (a new Option); after an
   * option the world answers (a new Next step) — the branch just grows.
   */
  protected compose(): void {
    const text = this.draft().trim();
    if (!text) return;

    const parent = this.selectedNode() ?? this.rootNode();
    if (!parent) return;

    const id = `c${this.nextNodeId++}`;
    const kind: DialogueNode['kind'] = parent.kind === 'choice' ? 'line' : 'choice';
    const speaker = kind === 'choice' ? 'You' : (this.nearestLineAncestor(parent) ?? parent).speaker;

    this.dialogues.add({ id, parentId: parent.id, kind, speaker, text });
    // appended: the terminal reads top-down, newest just above the prompt
    this.log.update((l) => [...l, { id: this.nextLogId++, text, note: `woven under ${parent.speaker}` }]);
    this.draft.set('');
    this.selectedId.set(id);
  }
}