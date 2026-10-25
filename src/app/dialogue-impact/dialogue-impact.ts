import { Component, computed, inject, input } from '@angular/core';
import { Plus, X } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { SuggestInput } from '../ui/suggest-input';
import { COMMON_GOALS, OBSTACLES, withWorldValues } from '../domain/interests';
import { DialoguesStore } from '../store/dialoguesStore';
import {
  DialogueImpact,
  DialogueVariant,
  IMPACT_AXES,
  IMPACT_LIMIT,
  INTERACTION_KINDS,
  InteractionKind,
  interactionOf,
  ImpactAxis,
  VARIANT_TONES,
  VariantTone,
  impactOf,
} from '../domain/dialogue';

let variantCounter = 0;

@Component({
  selector: 'app-dialogue-impact',
  imports: [RpgButton, LucideIcon, SuggestInput],
  styleUrl: './dialogue-impact.css',
  templateUrl: './dialogue-impact.html',
})
export class DialogueImpactEditor {
  private readonly dialogues = inject(DialoguesStore);

  readonly nodeId = input<string | null>(null);

  protected readonly axes = IMPACT_AXES;
  protected readonly limit = IMPACT_LIMIT;
  protected readonly tones = VARIANT_TONES;
  protected readonly interactionKinds = INTERACTION_KINDS;
  protected readonly plusIcon = Plus;
  protected readonly xIcon = X;

  protected readonly node = computed(() => this.dialogues.nodes().find((n) => n.id === this.nodeId()) ?? null);
  protected readonly impact = computed(() => {
    const node = this.node();
    return node ? impactOf(node) : null;
  });
  private readonly otherNodes = computed(() => this.dialogues.nodes().filter((n) => n.id !== this.nodeId()));
  protected readonly goalSuggestions = computed(() => withWorldValues(COMMON_GOALS, this.otherNodes(), 'goal'));
  protected readonly obstacleSuggestions = computed(() => withWorldValues(OBSTACLES, this.otherNodes(), 'obstacle'));
  protected readonly variants = computed(() => this.node()?.variants ?? []);
  protected readonly interaction = computed(() => {
    const node = this.node();
    if (!node) return null;
    const parent = this.dialogues.nodes().find((n) => n.id === node.parentId) ?? null;
    return interactionOf(node, parent);
  });

  protected setInteraction(value: string): void {
    const node = this.node();
    if (node) this.dialogues.update(node.id, { interaction: value as InteractionKind });
  }

  protected setAxis(axis: ImpactAxis, value: string): void {
    this.patchImpact({ [axis]: Number(value) });
  }

  protected setInterest(field: 'goal' | 'obstacle', value: string): void {
    this.patchImpact({ [field]: value });
  }

  protected addVariant(): void {
    variantCounter += 1;
    const node = this.node();
    if (!node) return;
    const variant: DialogueVariant = { id: `${node.id}-v${Date.now().toString(36)}${variantCounter}`, tone: 'warm', text: node.text };
    this.writeVariants([...this.variants(), variant]);
  }

  protected setVariantTone(id: string, tone: string): void {
    this.writeVariants(this.variants().map((v) => (v.id === id ? { ...v, tone: tone as VariantTone } : v)));
  }

  protected setVariantText(id: string, text: string): void {
    this.writeVariants(this.variants().map((v) => (v.id === id ? { ...v, text } : v)));
  }

  protected removeVariant(id: string): void {
    this.writeVariants(this.variants().filter((v) => v.id !== id));
  }

  protected signed(value: number): string {
    return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
  }

  private patchImpact(changes: Partial<DialogueImpact>): void {
    const node = this.node();
    if (!node) return;
    this.dialogues.update(node.id, { impact: { ...impactOf(node), ...changes } });
  }

  private writeVariants(variants: DialogueVariant[]): void {
    const node = this.node();
    if (node) this.dialogues.update(node.id, { variants });
  }
}
