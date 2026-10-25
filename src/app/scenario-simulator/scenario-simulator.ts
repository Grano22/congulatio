import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CircleAlert, CircleCheck, FlaskConical, RotateCcw } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { IMPACT_AXES } from '../domain/dialogue';
import { MOTIVATIONS, Motivation, SimulationOutcome, simulateScenario } from '../domain/simulation';

type SimNotice = { kind: 'success' | 'error'; text: string };

const NOTICE_MS = 3500;

const clip = (text: string, max = 48): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

@Component({
  selector: 'app-scenario-simulator',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './scenario-simulator.css',
  templateUrl: './scenario-simulator.html',
})
export class ScenarioSimulator {
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly workspace = inject(WorkspaceStore);

  protected readonly motivations = MOTIVATIONS;
  protected readonly axes = IMPACT_AXES;
  protected readonly simulateIcon = FlaskConical;
  protected readonly resetIcon = RotateCcw;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;

  protected readonly souls = this.characters.characters;

  protected readonly scenarios = computed(() =>
    this.dialogues
      .nodes()
      .filter((n) => n.parentId === null)
      .map((root) => {
        const routine = this.relations.routines().find((r) => r.forks.some((f) => f.dialogueId === root.id));
        return { id: root.id, speaker: root.speaker, label: `${routine ? `${routine.name} — ` : ''}${clip(root.text)}` };
      }),
  );

  protected readonly scenarioId = signal('');
  protected readonly actorId = signal('');
  protected readonly chosen = signal<Motivation[]>([]);
  protected readonly outcome = signal<SimulationOutcome | null>(null);
  protected readonly notice = signal<SimNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.noticeTimer));
  }

  protected pickActor(id: string): void {
    this.actorId.set(id);
    if (id) this.workspace.focusOn({ kind: 'soul', id });
  }

  protected isChosen(m: Motivation): boolean {
    return this.chosen().includes(m);
  }

  protected toggle(m: Motivation): void {
    this.chosen.update((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  }

  protected simulate(): void {
    const scenario = this.scenarios().find((s) => s.id === this.scenarioId());
    const actor = this.souls().find((c) => c.id === this.actorId());
    if (!scenario) return this.notify('error', 'Choose a scenario to play out.');
    if (!actor) return this.notify('error', 'Choose a soul to walk the scenario.');
    if (!this.chosen().length) return this.notify('error', 'Pick at least one motivation.');
    if (actor.firstName === scenario.speaker) {
      return this.notify('error', `${actor.firstName} cannot face themselves. Pick another soul.`);
    }
    this.outcome.set(
      simulateScenario(
        scenario.id,
        this.dialogues.nodes(),
        actor,
        this.chosen(),
        this.souls(),
        this.relations.relations(),
      ),
    );
    this.notify('success', `${actor.firstName} played the scenario through.`);
  }

  protected reset(): void {
    this.outcome.set(null);
    this.chosen.set([]);
  }

  protected signed(value: number): string {
    return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
  }

  private notify(kind: SimNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
