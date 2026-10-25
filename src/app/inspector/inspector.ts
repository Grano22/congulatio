import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { CalendarClock, CircleAlert, CircleCheck, Cog, Lock, LockOpen, ListTree, Map as MapIcon, PersonStanding, Swords, Trash } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { PixelAvatar } from '../ui/pixel-avatar';
import { CharactersStore } from '../store/charactersStore';
import { DialoguesStore } from '../store/dialoguesStore';
import { RelationsStore } from '../store/relationsStore';
import { InteractionsStore } from '../store/interactionsStore';
import { EditorTabId, Focus, WorkspaceStore } from '../store/workspaceStore';
import { ShellStore } from '../store/shellStore';
import type { RandomCharacter, SoulStatus } from '../domain/randomCharacter';
import {
  AttributeRow,
  TEMPERAMENT_NAMES,
  attributeRows,
  attributeToken,
  attributesOf,
  clampAttribute,
  parseAttributeValue,
} from '../domain/attributes';
import { AttributesStore } from '../store/attributesStore';
import { INTERACTION_KINDS, INTERACTION_LABEL, InteractionKind, interactionOf } from '../domain/dialogue';
import { TIME_SLOTS, scopeOf, sceneParticipants, slotOf } from '../domain/relations';
import { INTERACTION_KIND_INFO, PLAYER_ID } from '../domain/interactions';

type InspectorNotice = { kind: 'success' | 'error'; text: string };

type InspectorLink = { focus: Focus; label: string; tag: string; tone?: string };

const NOTICE_MS = 3000;
const LEVEL_MIN = 1;
const DOUBLE_CLICK_MS = 240;
const COPIED_MS = 1400;
const LEVEL_MAX = 99;

const STATUS_OPTIONS: { key: SoulStatus; label: string }[] = [
  { key: 'alive', label: 'Alive' },
  { key: 'quest', label: 'On Quest' },
  { key: 'resting', label: 'Resting' },
];

const clip = (text: string, max = 44): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

@Component({
  selector: 'app-inspector',
  imports: [RpgPanel, RpgButton, LucideIcon, PixelAvatar],
  styleUrl: './inspector.css',
  templateUrl: './inspector.html',
})
export class Inspector {
  private readonly workspace = inject(WorkspaceStore);
  private readonly shell = inject(ShellStore);
  private readonly attributeDefs = inject(AttributesStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  protected readonly readonly = this.shell.inspectorReadonly;
  private readonly characters = inject(CharactersStore);
  private readonly dialogues = inject(DialoguesStore);
  private readonly relations = inject(RelationsStore);
  private readonly interactions = inject(InteractionsStore);

  protected readonly trashIcon = Trash;
  protected readonly forgeIcon = Swords;
  protected readonly sculptIcon = PersonStanding;
  protected readonly mapIcon = MapIcon;
  protected readonly dialogueIcon = ListTree;
  protected readonly routinesIcon = CalendarClock;
  protected readonly lockIcon = Lock;
  protected readonly unlockIcon = LockOpen;
  protected readonly actsIcon = Cog;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;
  protected readonly levelMin = LEVEL_MIN;
  protected readonly levelMax = LEVEL_MAX;
  protected readonly statuses = STATUS_OPTIONS;
  protected readonly temperaments = TEMPERAMENT_NAMES;
  protected readonly interactionKinds = INTERACTION_KINDS;
  protected readonly timeSlots = TIME_SLOTS;
  protected readonly slotOf = slotOf;
  protected readonly scopeOf = scopeOf;

  protected readonly focus = this.workspace.focus;
  protected readonly notice = signal<InspectorNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  private readonly soulName = computed(
    () => new Map(this.characters.characters().map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()])),
  );

  protected readonly soul = computed(() => {
    const f = this.focus();
    return f?.kind === 'soul' ? (this.characters.characters().find((c) => c.id === f.id) ?? null) : null;
  });
  protected readonly routine = computed(() => {
    const f = this.focus();
    return f?.kind === 'routine' ? (this.relations.routines().find((r) => r.id === f.id) ?? null) : null;
  });
  protected readonly step = computed(() => {
    const f = this.focus();
    return f?.kind === 'dialogue' ? (this.dialogues.nodes().find((n) => n.id === f.id) ?? null) : null;
  });

  protected readonly interaction = computed(() => {
    const f = this.focus();
    return f?.kind === 'interaction' ? (this.interactions.interactions().find((i) => i.id === f.id) ?? null) : null;
  });

  protected readonly interactionDetail = computed(() => {
    const act = this.interaction();
    if (!act) return null;
    const party = (id: string): InspectorLink | null =>
      id === PLAYER_ID || !this.soulName().has(id) ? null : { focus: { kind: 'soul', id }, label: this.soulName().get(id)!, tag: id === act.sourceId ? 'source' : 'target' };
    const dialogue = act.dialogueId ? this.dialogues.nodes().find((n) => n.id === act.dialogueId) : undefined;
    return {
      kind: INTERACTION_KIND_INFO[act.kind].label,
      sourceName: act.sourceId === PLAYER_ID ? 'Player' : (this.soulName().get(act.sourceId) ?? 'Missing soul'),
      targetName: act.targetId === PLAYER_ID ? 'Player' : (this.soulName().get(act.targetId) ?? 'Missing soul'),
      souls: [party(act.sourceId), party(act.targetId)].filter((l): l is InspectorLink => !!l),
      dialogue: dialogue
        ? ({ focus: { kind: 'dialogue', id: dialogue.id }, label: clip(dialogue.text), tag: dialogue.speaker } as InspectorLink)
        : null,
    };
  });

  protected readonly attributeRows = computed(() => {
    const c = this.soul();
    return c ? attributeRows(c, this.attributeDefs.defs()) : [];
  });
  protected readonly editingAttrId = signal<string | null>(null);
  protected readonly copiedAttrId = signal<string | null>(null);
  private clickTimer?: ReturnType<typeof setTimeout>;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  protected readonly soulLinks = computed(() => {
    const c = this.soul();
    if (!c) return null;
    const relations: InspectorLink[] = this.relations
      .relations()
      .filter((r) => r.fromId === c.id || r.toId === c.id)
      .map<InspectorLink>((r) => {
        const other = r.fromId === c.id ? r.toId : r.fromId;
        return { focus: { kind: 'soul', id: other }, label: this.soulName().get(other) ?? other, tag: r.kind, tone: r.kind };
      })
      .filter((l) => this.soulName().has(l.focus.id));
    const routines: InspectorLink[] = this.relations
      .routines()
      .filter((r) => r.participantIds.includes(c.id))
      .map<InspectorLink>((r) => ({ focus: { kind: 'routine', id: r.id }, label: r.name, tag: r.schedule }));
    const nodes = this.dialogues.nodes();
    const scenes: InspectorLink[] = nodes
      .filter((n) => n.parentId === null)
      .filter((root) =>
        nodes.some(
          (n) =>
            this.rootOf(n.id) === root.id &&
            sceneParticipants(n.id, nodes, this.characters.characters(), this.relations.routines()).some(
              (p) => p.characterId === c.id,
            ),
        ),
      )
      .map<InspectorLink>((root) => ({ focus: { kind: 'dialogue', id: root.id }, label: clip(root.text), tag: root.speaker }));
    const acts: InspectorLink[] = this.interactions
      .interactions()
      .filter((i) => i.sourceId === c.id || i.targetId === c.id)
      .map((i) => {
        const otherId = i.sourceId === c.id ? i.targetId : i.sourceId;
        const other = otherId === PLAYER_ID ? 'Player' : (this.soulName().get(otherId) ?? 'Missing soul');
        return {
          focus: { kind: 'interaction', id: i.id },
          label: `${i.sourceId === c.id ? '→' : '←'} ${other} · ${i.trigger}`,
          tag: INTERACTION_KIND_INFO[i.kind].label,
        };
      });
    return { relations, routines, scenes, acts };
  });

  protected readonly routineLinks = computed(() => {
    const r = this.routine();
    if (!r) return null;
    const nodes = this.dialogues.nodes();
    return {
      participants: r.participantIds
        .filter((id) => this.soulName().has(id))
        .map<InspectorLink>((id) => ({ focus: { kind: 'soul', id }, label: this.soulName().get(id)!, tag: 'keeps' })),
      forks: r.forks
        .map((f) => ({ fork: f, node: nodes.find((n) => n.id === f.dialogueId) }))
        .filter((x) => !!x.node)
        .map<InspectorLink>((x) => ({ focus: { kind: 'dialogue', id: x.node!.id }, label: clip(x.node!.text), tag: x.fork.label })),
    };
  });

  protected readonly stepDetail = computed(() => {
    const n = this.step();
    if (!n) return null;
    const nodes = this.dialogues.nodes();
    const parent = nodes.find((p) => p.id === n.parentId) ?? null;
    const label = (id: string): string => {
      const node = nodes.find((x) => x.id === id)!;
      return INTERACTION_LABEL[interactionOf(node, nodes.find((x) => x.id === node.parentId) ?? null)];
    };
    return {
      interaction: interactionOf(n, parent),
      follows: parent
        ? ({ focus: { kind: 'dialogue', id: parent.id }, label: clip(parent.text), tag: parent.speaker } as InspectorLink)
        : null,
      next: nodes
        .filter((c) => c.parentId === n.id)
        .map<InspectorLink>((c) => ({ focus: { kind: 'dialogue', id: c.id }, label: clip(c.text), tag: `${c.speaker} · ${label(c.id)}` })),
      souls: sceneParticipants(n.id, nodes, this.characters.characters(), this.relations.routines()).map<InspectorLink>((p) => ({
        focus: { kind: 'soul', id: p.characterId },
        label: this.soulName().get(p.characterId) ?? p.characterId,
        tag: p.role,
      })),
    };
  });

  protected readonly subtitle = computed(() => {
    const f = this.focus();
    if (!f) return this.readonly() ? 'Nothing examined · read-only' : 'Nothing examined';
    const suffix = this.readonly() ? ' · read-only' : '';
    const label =
      f.kind === 'soul'
        ? 'The examined soul'
        : f.kind === 'routine'
          ? 'The examined routine'
          : f.kind === 'interaction'
            ? 'The examined interaction'
            : 'The examined step';
    return label + suffix;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.noticeTimer);
      clearTimeout(this.clickTimer);
      clearTimeout(this.copiedTimer);
    });
  }

  protected toggleReadonly(): void {
    this.shell.inspectorReadonly.update((v) => !v);
    this.editingAttrId.set(null);
  }

  protected follow(link: InspectorLink): void {
    this.workspace.focusOn(link.focus);
  }

  protected open(tab: EditorTabId): void {
    const c = this.soul();
    if (c && (tab === 'character' || tab === 'sculptor')) this.characters.select(c.id);
    this.workspace.open(tab);
  }

  protected setSoulField<K extends 'origin' | 'temperament' | 'status' | 'note'>(key: K, value: RandomCharacter[K]): void {
    if (this.readonly()) return;
    const c = this.soul();
    if (c) this.characters.save({ ...c, [key]: value });
  }

  protected setLevel(raw: string | number): void {
    if (this.readonly()) return;
    const c = this.soul();
    if (!c) return;
    const level = Math.round(Number(raw));
    if (!Number.isFinite(level) || level < LEVEL_MIN || level > LEVEL_MAX) {
      this.notify('error', `Level must be between ${LEVEL_MIN} and ${LEVEL_MAX}.`);
      return;
    }
    this.characters.save({ ...c, level });
  }

  protected setAttributeValue(row: AttributeRow, value: number): void {
    if (this.readonly()) return;
    const c = this.soul();
    if (!c) return;
    if (row.custom) {
      this.characters.save({ ...c, customAttributes: { ...(c.customAttributes ?? {}), [row.id]: value } });
    } else {
      this.characters.save({ ...c, attributes: { ...attributesOf(c), [row.key]: clampAttribute(value) } });
    }
  }

  protected onValueClick(row: AttributeRow): void {
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => this.copyAttribute(row), DOUBLE_CLICK_MS);
  }

  protected onValueDblClick(row: AttributeRow): void {
    clearTimeout(this.clickTimer);
    if (this.readonly()) return;
    this.editingAttrId.set(row.id);
    afterNextRender(
      () => {
        const input = this.host.nativeElement.querySelector('[data-attr-edit]') as HTMLInputElement | null;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected commitAttributeEdit(row: AttributeRow, raw: string): void {
    if (this.readonly()) return;
    if (this.editingAttrId() !== row.id) return;
    const parsed = parseAttributeValue(raw, row.min, row.max);
    if (typeof parsed === 'string') {
      this.notify('error', `${row.key}: ${parsed}`);
      this.editingAttrId.set(null);
      return;
    }
    this.editingAttrId.set(null);
    if (parsed !== row.value) this.setAttributeValue(row, parsed);
  }

  private copyAttribute(row: AttributeRow): void {
    const c = this.soul();
    if (!c) return;
    const token = attributeToken(`${c.firstName} ${c.lastName}`.trim(), row.key, row.value);
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      this.notify('error', 'This browser does not allow copying here.');
      return;
    }
    clipboard.writeText(token).then(
      () => {
        clearTimeout(this.copiedTimer);
        this.copiedAttrId.set(row.id);
        this.copiedTimer = setTimeout(() => this.copiedAttrId.set(null), COPIED_MS);
        this.notify('success', `Copied ${token}`);
      },
      () => this.notify('error', 'The browser blocked copying to the clipboard.'),
    );
  }

  protected setRoutineField(key: 'name' | 'schedule' | 'location' | 'note' | 'slot', value: string): void {
    if (this.readonly()) return;
    const r = this.routine();
    if (!r) return;
    if (key === 'name' && !value.trim()) {
      this.notify('error', 'A routine needs a name.');
      return;
    }
    this.relations.updateRoutine(r.id, { [key]: value });
  }

  protected setStepText(text: string): void {
    if (this.readonly()) return;
    const n = this.step();
    if (!n) return;
    if (!text.trim()) {
      this.notify('error', 'A step cannot be left blank.');
      return;
    }
    this.dialogues.update(n.id, { text });
  }

  protected setStepInteraction(value: string): void {
    if (this.readonly()) return;
    const n = this.step();
    if (n) this.dialogues.update(n.id, { interaction: value as InteractionKind });
  }

  protected removeStep(id: string): void {
    if (this.readonly()) return;
    this.shell.confirmRemoveDialogue(id);
  }

  protected removeSoul(): void {
    if (this.readonly()) return;
    const c = this.soul();
    if (c) this.shell.confirmRemoveSoul(c.id);
  }

  private rootOf(id: string): string {
    const nodes = this.dialogues.nodes();
    let node = nodes.find((n) => n.id === id);
    while (node?.parentId) node = nodes.find((n) => n.id === node!.parentId);
    return node?.id ?? id;
  }

  private notify(kind: InspectorNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
