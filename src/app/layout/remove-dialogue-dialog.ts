import { Component, computed, inject, linkedSignal } from '@angular/core';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { InteractionsStore } from '../store/interactionsStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { DescendantRow, applyRemoval, descendantsOf, planRemoval } from '../domain/dialogueRemoval';

type Branch = { head: DescendantRow; rows: DescendantRow[]; ids: string[] };

@Component({
  selector: 'app-remove-dialogue-dialog',
  imports: [RpgModal, RpgButton],
  styleUrl: './remove-dialogue-dialog.css',
  templateUrl: './remove-dialogue-dialog.html',
})
export class RemoveDialogueDialog {
  protected readonly shell = inject(ShellStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);
  private readonly workspace = inject(WorkspaceStore);

  protected readonly target = computed(() => this.dialogues.nodes().find((n) => n.id === this.shell.removeDialogueId()) ?? null);
  private readonly rows = computed(() => {
    const t = this.target();
    return t ? descendantsOf(t.id, this.dialogues.nodes()) : [];
  });

  protected readonly selected = linkedSignal(() => new Set(this.rows().map((r) => r.node.id)));
  protected readonly expanded = linkedSignal<Set<string>>(() => (this.rows().length <= 6 ? new Set(this.rows().map((r) => r.branchId)) : new Set()));

  protected readonly branches = computed<Branch[]>(() => {
    const branches: Branch[] = [];
    for (const row of this.rows()) {
      if (row.depth === 1) branches.push({ head: row, rows: [], ids: [row.node.id] });
      else {
        const b = branches[branches.length - 1];
        b.rows.push(row);
        b.ids.push(row.node.id);
      }
    }
    return branches;
  });

  protected readonly plan = computed(() => {
    const t = this.target();
    return t
      ? planRemoval(t.id, this.selected(), this.dialogues.nodes(), this.relations.routines(), this.interactions.interactions())
      : null;
  });

  protected branchState(b: Branch): 'all' | 'some' | 'none' {
    const n = b.ids.filter((id) => this.selected().has(id)).length;
    return n === b.ids.length ? 'all' : n === 0 ? 'none' : 'some';
  }

  protected isChecked(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleBranch(b: Branch): void {
    const removeAll = this.branchState(b) !== 'all';
    this.selected.update((set) => {
      const next = new Set(set);
      for (const id of b.ids) {
        if (removeAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  protected toggleExpanded(b: Branch): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(b.head.node.id)) next.delete(b.head.node.id);
      else next.add(b.head.node.id);
      return next;
    });
  }

  protected selectAll(remove: boolean): void {
    this.selected.set(remove ? new Set(this.rows().map((r) => r.node.id)) : new Set());
  }

  protected confirm(): void {
    const plan = this.plan();
    const target = this.target();
    if (!plan || !target) return;
    const after = applyRemoval(plan, this.dialogues.nodes(), this.relations.routines(), this.interactions.interactions());
    this.dialogues.replaceAll(after.nodes);
    if (after.routines !== this.relations.routines()) this.relations.replaceAll(this.relations.relations(), after.routines);
    if (after.interactions !== this.interactions.interactions()) this.interactions.replaceAll(after.interactions);
    this.workspace.focusOn(plan.detached.length ? { kind: 'dialogue', id: plan.detached[0] } : null);
    const standalone = plan.detached.length ? `, ${plan.detached.length} now standalone` : '';
    this.shell.notify('success', `Removed ${plan.removed.size} step${plan.removed.size === 1 ? '' : 's'}${standalone}. Undo brings them back.`);
    this.close();
  }

  protected close(): void {
    this.shell.closeDialog();
    this.shell.removeDialogueId.set(null);
  }
}
