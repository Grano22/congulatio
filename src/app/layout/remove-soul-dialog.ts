import { Component, computed, inject, linkedSignal } from '@angular/core';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { PixelAvatar } from '../ui/pixel-avatar';
import { ShellStore } from '../store/shellStore';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { InteractionsStore } from '../store/interactionsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { SoulRemovalInput, applySoulRemoval, planSoulRemoval } from '../domain/soulRemoval';
import { INTERACTION_KIND_INFO, PLAYER_ID } from '../domain/interactions';
import { TIME_SLOTS, slotOf } from '../domain/relations';

const SLOT_LABEL = Object.fromEntries(TIME_SLOTS.map((s) => [s.key, s.label])) as Record<string, string>;

@Component({
  selector: 'app-remove-soul-dialog',
  imports: [RpgModal, RpgButton, PixelAvatar],
  styleUrl: './remove-soul-dialog.css',
  templateUrl: './remove-soul-dialog.html',
})
export class RemoveSoulDialog {
  protected readonly shell = inject(ShellStore);
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly workspace = inject(WorkspaceStore);

  private readonly input = computed<SoulRemovalInput>(() => ({
    characters: this.characters.characters(),
    dialogue: this.dialogues.nodes(),
    relations: this.relations.relations(),
    routines: this.relations.routines(),
    interactions: this.interactions.interactions(),
  }));

  protected readonly plan = computed(() => {
    const id = this.shell.removeSoulId();
    return id ? planSoulRemoval(id, this.input()) : null;
  });

  protected readonly chosenScenes = linkedSignal(() => {
    const plan = this.plan();
    return plan && !plan.sharedName ? new Set(plan.scenes.map((s) => s.rootId)) : new Set<string>();
  });

  private readonly names = computed(() => new Map(this.characters.characters().map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()])));

  protected readonly fullName = computed(() => {
    const p = this.plan();
    return p ? `${p.soul.firstName} ${p.soul.lastName}`.trim() : '';
  });

  protected readonly removedSteps = computed(() =>
    (this.plan()?.scenes ?? []).filter((s) => this.chosenScenes().has(s.rootId)).reduce((n, s) => n + s.steps, 0),
  );

  protected party(id: string): string {
    return id === PLAYER_ID ? 'Player' : (this.names().get(id) ?? 'someone');
  }

  protected other(fromId: string, toId: string): string {
    const soulId = this.plan()?.soul.id;
    return this.party(fromId === soulId ? toId : fromId);
  }

  protected kindLabel(kind: string): string {
    return INTERACTION_KIND_INFO[kind as keyof typeof INTERACTION_KIND_INFO]?.label ?? kind;
  }

  protected slotLabel(r: Parameters<typeof slotOf>[0]): string {
    return SLOT_LABEL[slotOf(r)] ?? '';
  }

  protected isChosen(rootId: string): boolean {
    return this.chosenScenes().has(rootId);
  }

  protected toggleScene(rootId: string): void {
    this.chosenScenes.update((set) => {
      const next = new Set(set);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  protected chooseAllScenes(all: boolean): void {
    this.chosenScenes.set(all ? new Set((this.plan()?.scenes ?? []).map((s) => s.rootId)) : new Set());
  }

  protected confirm(): void {
    const plan = this.plan();
    if (!plan) return;
    const before = this.input();
    const after = applySoulRemoval(plan, this.chosenScenes(), before);
    if (after.dialogue !== before.dialogue) this.dialogues.replaceAll(after.dialogue);
    if (after.relations !== before.relations || after.routines !== before.routines) {
      this.relations.replaceAll(after.relations, after.routines);
    }
    if (after.interactions !== before.interactions) this.interactions.replaceAll(after.interactions);
    this.characters.replaceAll(after.characters);
    this.workspace.focusOn(null);
    this.shell.notify('success', `${this.fullName()} and everything tied to them were removed. Undo brings it all back.`);
    this.close();
  }

  protected close(): void {
    this.shell.closeDialog();
    this.shell.removeSoulId.set(null);
  }
}
