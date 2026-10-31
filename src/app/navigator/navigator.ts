import { Component, computed, inject, linkedSignal, output, signal } from '@angular/core';
import { BookOpen, CalendarClock, Compass, Globe, Map, MessagesSquare, SlidersHorizontal } from 'lucide';
import type { IconNode } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { NavigatorPage } from './navigator-page';
import { CharactersGalery } from '../characters-galery/characters-galery';
import { RoutinesAlmanac } from '../routines-almanac/routines-almanac';
import { AttributeLedger } from '../attribute-ledger/attribute-ledger';
import { ShellStore } from '../store/shellStore';
import { ViewStore } from '../store/viewStore';
import { PairDrag, equalWeights, equalizePair, resizePair } from '../domain/paneSplit';
import type { NavigatorId } from '../domain/viewModes';

export type { NavigatorId };

interface NavigatorDef {
  id: NavigatorId;
  label: string;
  icon: IconNode;
}

const NAVIGATORS: NavigatorDef[] = [
  { id: 'codex', label: 'Codex of Characters', icon: BookOpen },
  { id: 'routines', label: 'Routine Almanac', icon: CalendarClock },
  { id: 'attributes', label: 'Attribute Ledger', icon: SlidersHorizontal },
  { id: 'dialogues', label: 'Dialogue Threads', icon: MessagesSquare },
  { id: 'quests', label: 'Quest Board', icon: Map },
  { id: 'world', label: 'World Atlas', icon: Globe },
];

const MIN_ROW_PX = 120;

@Component({
  selector: 'app-navigator',
  imports: [LucideIcon, NavigatorPage, CharactersGalery, RoutinesAlmanac, AttributeLedger],
  styleUrl: './navigator.css',
  templateUrl: './navigator.html',
})
export class Navigator {
  private readonly shell = inject(ShellStore);
  private readonly view = inject(ViewStore);
  readonly width = this.shell.leftWidth;
  readonly dragging = signal<number>(-1);
  readonly focusCharacter = output<void>();

  protected readonly navigators = computed(() => NAVIGATORS.filter((def) => this.view.allowsNavigator(def.id)));
  protected readonly compassIcon = Compass;
  protected readonly open = signal<NavigatorId[]>(['codex']);

  protected readonly openDefs = computed(() =>
    this.open()
      .filter((id) => this.view.allowsNavigator(id))
      .map((id) => NAVIGATORS.find((def) => def.id === id)!),
  );
  protected readonly isEmpty = computed(() => this.openDefs().length === 0);
  private readonly openKey = computed(() => this.openDefs().map((d) => d.id).join('|'));
  protected readonly weights = linkedSignal({
    source: this.openKey,
    computation: (key: string) => equalWeights(key ? key.split('|') : []),
  });

  protected paneStyle(def: NavigatorDef): { [key: string]: string } {
    const style: { [key: string]: string } = { flex: `${this.weights()[def.id] ?? 1} 1 0px` };
    if (this.paneDrag) style['transition'] = 'none';
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

  private paneDrag: (PairDrag & { startY: number }) | null = null;
  private widthDrag: { startX: number; startWidth: number } | null = null;

  protected beginPaneDrag(index: number, event: PointerEvent): void {
    const defs = this.openDefs();
    const a = defs[index]?.id;
    const b = defs[index + 1]?.id;
    const divider = event.currentTarget as HTMLElement;
    const paneA = divider.previousElementSibling as HTMLElement | null;
    const paneB = divider.nextElementSibling as HTMLElement | null;
    if (!a || !b || !paneA || !paneB) return;
    const w = this.weights();
    this.paneDrag = {
      a,
      b,
      startA: paneA.getBoundingClientRect().height,
      startB: paneB.getBoundingClientRect().height,
      weightA: w[a] ?? 1,
      weightB: w[b] ?? 1,
      startY: event.clientY,
    };
    this.dragging.set(index);
    divider.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected onPaneDragMove(event: PointerEvent): void {
    const drag = this.paneDrag;
    if (!drag) return;
    this.weights.update((w) => resizePair(w, drag, event.clientY - drag.startY, MIN_ROW_PX));
  }

  protected endPaneDrag(): void {
    if (!this.paneDrag) return;
    this.paneDrag = null;
    this.dragging.set(-1);
  }

  protected equalizePair(index: number): void {
    const defs = this.openDefs();
    const a = defs[index]?.id;
    const b = defs[index + 1]?.id;
    if (a && b) this.weights.update((w) => equalizePair(w, a, b));
  }

  protected beginWidthDrag(event: PointerEvent): void {
    const nav = (event.currentTarget as HTMLElement).parentElement;
    this.widthDrag = { startX: event.clientX, startWidth: nav?.getBoundingClientRect().width ?? this.width() };
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
