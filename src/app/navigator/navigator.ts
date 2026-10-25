import { Component, computed, inject, output, signal } from '@angular/core';
import { BookOpen, CalendarClock, Compass, Globe, Map, MessagesSquare, SlidersHorizontal } from 'lucide';
import type { IconNode } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { NavigatorPage } from './navigator-page';
import { CharactersGalery } from '../characters-galery/characters-galery';
import { RoutinesAlmanac } from '../routines-almanac/routines-almanac';
import { AttributeLedger } from '../attribute-ledger/attribute-ledger';
import { ShellStore } from '../store/shellStore';

export type NavigatorId = 'codex' | 'routines' | 'attributes' | 'dialogues' | 'quests' | 'world';

interface NavigatorDef {
  id: NavigatorId;
  label: string;
  icon: IconNode;
}

/** Fixed order of the rail runes. Open sections themselves are stacked in
 *  recency order — the most recently opened one sits on top. */
const NAVIGATORS: NavigatorDef[] = [
  { id: 'codex', label: 'Codex of Characters', icon: BookOpen },
  { id: 'routines', label: 'Routine Almanac', icon: CalendarClock },
  { id: 'attributes', label: 'Attribute Ledger', icon: SlidersHorizontal },
  { id: 'dialogues', label: 'Dialogue Threads', icon: MessagesSquare },
  { id: 'quests', label: 'Quest Board', icon: Map },
  { id: 'world', label: 'World Atlas', icon: Globe },
];

const MIN_ROW_PX = 120;
const DIVIDER_PX = 10;

type Heights = Record<NavigatorId, number>;

const DEFAULT_HEIGHTS: Heights = { codex: 340, routines: 300, attributes: 300, dialogues: 260, quests: 240, world: 220 };

/**
 * Left sidebar: a carved icon rail plus a split view of the open navigator
 * sections, stacked vertically (side by side, below each other), newest
 * section on top. Every section keeps its own pixel height — dragging a
 * divider resizes ONLY the section above it (the boundary line is glued to
 * the cursor, 1:1), all other sections keep their size and simply shift.
 * When the sections together are taller than the sidebar, the sidebar
 * scrolls (themed scrollbar); when they are shorter, a wood floor remains
 * below them. No absolutely positioned elements — normal flex flow.
 */
@Component({
  selector: 'app-navigator',
  imports: [LucideIcon, NavigatorPage, CharactersGalery, RoutinesAlmanac, AttributeLedger],
  styleUrl: './navigator.css',
  templateUrl: './navigator.html',
})
export class Navigator {
  private readonly shell = inject(ShellStore);
  readonly width = this.shell.leftWidth;
  readonly dragging = signal<number>(-1);
  /** the codex asked for the forge — a soul was clicked, or a new one engraved */
  readonly focusCharacter = output<void>();

  protected readonly navigators = NAVIGATORS;
  protected readonly compassIcon = Compass;
  protected readonly open = signal<NavigatorId[]>(['codex']);
  protected readonly heights = signal<Heights>(DEFAULT_HEIGHTS);

  protected readonly isEmpty = computed(() => this.open().length === 0);
  /** stack order = recency of opening: newest section on top */
  protected readonly openDefs = computed(() =>
    this.open().map((id) => NAVIGATORS.find((def) => def.id === id)!),
  );

  /** fixed px height per section — dragging resizes only the section above
   *  the divider, so nothing else can ever be re-proportioned. A lone
   *  section (no dividers) stretches to fill the sidebar. */
  protected paneStyle(def: NavigatorDef): { [key: string]: string } {
    const style: { [key: string]: string } =
      this.openDefs().length === 1
        ? { flex: '1 1 0px' }
        : { flex: 'none', height: `${this.heights()[def.id]}px` };
    // while a divider is held, no CSS transition may run on any pane —
    // the boundary must track the cursor with zero lag (inline style beats
    // the class-based rule in the global stylesheet)
    if (this.paneDrag) {
      style['transition'] = 'none';
    }
    return style;
  }

  protected isOpen(id: NavigatorId): boolean {
    return this.open().includes(id);
  }

  protected toggle(id: NavigatorId): void {
    this.open.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]));
  }

  protected closeNavigator(id: NavigatorId): void {
    this.open.update((list) => list.filter((x) => x !== id));
  }

  /* ---- section resize (drag the horizontal divider) ----
     Only the section ABOVE the divider is resized. Every other section
     keeps its exact height and merely shifts position. The boundary line
     (centre of the strip) follows the cursor 1:1 — exact, no gap, no lag —
     until the section reaches the minimum height. */

  private paneDrag: {
    index: number;
    idA: NavigatorId;
    startA: number;
    /** y of the divider's top edge (bottom of section A) at drag start */
    startEdgeY: number;
    /** where inside the strip the pointer grabbed, in px */
    offset: number;
  } | null = null;
  private widthDrag: { startX: number; startWidth: number } | null = null;

  protected beginPaneDrag(index: number, event: PointerEvent): void {
    const defs = this.openDefs();
    const idA = defs[index]?.id;
    const idB = defs[index + 1]?.id;
    if (!idA || !idB) return;

    const divider = event.currentTarget as HTMLElement;
    const rect = divider.getBoundingClientRect();

    this.paneDrag = {
      index,
      idA,
      startA: this.heights()[idA],
      startEdgeY: rect.top,
      offset: event.clientY - rect.top,
    };
    this.dragging.set(index);
    divider.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onPaneDragMove(event: PointerEvent): void {
    const drag = this.paneDrag;
    if (!drag) return;
    // centre of the strip passes exactly through the cursor (the grab
    // point is normalised away on the very first move — ≤ half a strip)
    const targetEdgeY = event.clientY - DIVIDER_PX / 2;
    const delta = targetEdgeY - drag.startEdgeY;
    const a = Math.max(drag.startA + delta, MIN_ROW_PX);
    if (a !== this.heights()[drag.idA]) {
      this.heights.update((h) => ({ ...h, [drag.idA]: a }));
    }
  }

  protected endPaneDrag(): void {
    if (!this.paneDrag) return;
    this.paneDrag = null;
    this.dragging.set(-1);
  }

  /** Double-click a divider: the two sections connected by it become EQUAL
   *  and together fill the remaining space after their sibling sections
   *  (at the siblings' current sizes) and the divider strips. 4 sections
   *  open → the pair takes the sidebar minus the other two; 2 sections
   *  open → each becomes half of the sidebar. Works for any N. */
  protected equalizePair(index: number, split: HTMLElement | undefined): void {
    const defs = this.openDefs();
    const idA = defs[index]?.id;
    const idB = defs[index + 1]?.id;
    if (!idA || !idB) return;

    const h = this.heights();
    const others = defs.reduce(
      (sum, def) => (def.id === idA || def.id === idB ? sum : sum + h[def.id]),
      0,
    );
    const dividers = (defs.length - 1) * DIVIDER_PX;
    const avail = split ? split.clientHeight : 0;
    const each = Math.max((avail - others - dividers) / 2, MIN_ROW_PX);
    this.heights.update((x) => ({ ...x, [idA]: each, [idB]: each }));
  }

  /* ---- sidebar width (drag the right edge) ---- */

  protected beginWidthDrag(event: PointerEvent): void {
    this.widthDrag = { startX: event.clientX, startWidth: this.width() };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onWidthDragMove(event: PointerEvent): void {
    const drag = this.widthDrag;
    if (!drag) return;
    this.shell.setLeftWidth(drag.startWidth + (event.clientX - drag.startX));
  }

  protected endWidthDrag(): void {
    this.widthDrag = null;
  }
}