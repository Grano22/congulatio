import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Sparkles, Square, WandSparkles } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { ShellStore } from '../store/shellStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { StoryAi } from '../store/storyAi';
import {
  DraftStep,
  MAX_OPTIONS,
  NEXT_STEPS_SCHEMA,
  POLISH_SCHEMA,
  SCENE_SCHEMA,
  StoryAiError,
  effectiveDrafts,
  materialize,
  nextStepsPrompt,
  parseNextSteps,
  parsePolish,
  parseScene,
  polishPrompt,
  scenePrompt,
  speakerFor,
} from '../domain/storyAi';

type AiMode = 'next' | 'scene';

let generatedCounter = 0;
const newNodeId = (): string => `ai-${Date.now().toString(36)}-${(++generatedCounter).toString(36)}`;

@Component({
  selector: 'app-story-ai-panel',
  imports: [RpgButton, LucideIcon],
  styleUrl: './story-ai-panel.css',
  templateUrl: './story-ai-panel.html',
})
export class StoryAiPanel {
  protected readonly ai = inject(StoryAi);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly shell = inject(ShellStore);
  private readonly workspace = inject(WorkspaceStore);

  readonly cursorId = input<string | null>(null);
  readonly draftText = input('');
  readonly polished = output<string>();
  readonly added = output<{ count: number; lastId: string; note: string }>();

  protected readonly sparkIcon = Sparkles;
  protected readonly wandIcon = WandSparkles;
  protected readonly stopIcon = Square;
  protected readonly counts = Array.from({ length: MAX_OPTIONS - 1 }, (_, i) => i + 2);

  protected readonly mode = signal<AiMode>('next');
  protected readonly count = signal(3);
  protected readonly hint = signal('');
  protected readonly topic = signal('');
  protected readonly sceneSoulId = signal('');
  protected readonly drafts = signal<DraftStep[]>([]);
  protected readonly error = signal<string | null>(null);
  private lastAction: (() => Promise<void>) | null = null;

  protected readonly souls = this.characters.characters;
  protected readonly cursor = computed(() => this.dialogues.nodes().find((n) => n.id === this.cursorId()) ?? null);
  protected readonly usable = computed(() => this.ai.availability() !== 'unsupported' && this.ai.availability() !== 'unavailable');
  protected readonly keptCount = computed(() => effectiveDrafts(this.drafts()).length);
  protected readonly draftRows = computed(() => {
    const depth = new Map<string, number>();
    return this.drafts().map((d) => {
      const level = d.parentKey ? (depth.get(d.parentKey) ?? 0) + 1 : 0;
      depth.set(d.key, level);
      return { draft: d, level };
    });
  });

  protected async download(): Promise<void> {
    this.error.set(null);
    try {
      await this.ai.prepare();
      this.shell.notify('success', 'The built-in model is ready.');
    } catch (e) {
      this.error.set(this.message(e));
    }
  }

  protected suggest(): Promise<void> {
    return this.generate(async () => {
      const cursor = this.cursor();
      if (!cursor) throw new StoryAiError('Pick a step in the Tree to write from.');
      const nodes = this.dialogues.nodes();
      const speaker = speakerFor(cursor.id, nodes);
      const prompt = nextStepsPrompt(cursor.id, nodes, this.characters.characters(), this.relations.relations(), this.count(), this.hint());
      this.drafts.set(parseNextSteps(await this.ai.run(prompt, NEXT_STEPS_SCHEMA), cursor, speaker));
    });
  }

  protected writeScene(): Promise<void> {
    return this.generate(async () => {
      const soul = this.souls().find((c) => c.id === this.sceneSoulId());
      if (!soul) throw new StoryAiError('Choose the soul the player meets.');
      const prompt = scenePrompt(soul, this.relations.relations(), this.topic(), this.count());
      this.drafts.set(parseScene(await this.ai.run(prompt, SCENE_SCHEMA), soul.firstName));
    });
  }

  protected async polish(): Promise<void> {
    const text = this.draftText().trim();
    const cursor = this.cursor();
    if (!text) {
      this.error.set('Write a line in the composer first, then polish it.');
      return;
    }
    if (!cursor) {
      this.error.set('Pick a step in the Tree to write from.');
      return;
    }
    this.error.set(null);
    const nodes = this.dialogues.nodes();
    const kind = cursor.kind === 'choice' ? 'line' : 'choice';
    const speaker = speakerFor(cursor.id, nodes);
    const soul = this.characters.characters().find((c) => c.firstName === speaker);
    try {
      const prompt = polishPrompt(text, kind, speaker, soul, this.relations.relations());
      this.polished.emit(parsePolish(await this.ai.run(prompt, POLISH_SCHEMA)));
    } catch (e) {
      this.error.set(this.message(e));
    }
  }

  protected regenerate(): void {
    if (this.lastAction) void this.generate(this.lastAction);
  }

  protected toggle(key: string): void {
    this.drafts.update((list) => list.map((d) => (d.key === key ? { ...d, include: !d.include } : d)));
  }

  protected edit(key: string, text: string): void {
    this.drafts.update((list) => list.map((d) => (d.key === key ? { ...d, text } : d)));
  }

  protected discard(): void {
    this.drafts.set([]);
    this.error.set(null);
  }

  protected addToTome(): void {
    const nodes = materialize(this.drafts(), newNodeId);
    if (!nodes.length) {
      this.error.set('Every draft is unchecked or empty. Keep at least one.');
      return;
    }
    this.dialogues.addMany(nodes);
    const last = nodes[nodes.length - 1];
    this.workspace.focusOn({ kind: 'dialogue', id: nodes[0].id });
    this.added.emit({ count: nodes.length, lastId: last.id, note: `${nodes.length} AI drafts woven in` });
    this.shell.notify('success', `Added ${nodes.length} drafted step${nodes.length === 1 ? '' : 's'} to the tome. Undo removes them.`);
    this.drafts.set([]);
  }

  private async generate(action: () => Promise<void>): Promise<void> {
    this.lastAction = action;
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(this.message(e));
    }
  }

  private message(e: unknown): string {
    return e instanceof StoryAiError ? e.message : 'Something went wrong while writing. Try again.';
  }
}
