import { Component, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, booleanAttribute, inject, input, model, signal, viewChild } from '@angular/core';
import { ChevronLeft, ChevronRight } from 'lucide';
import type { IconNode } from 'lucide';
import { LucideIcon } from './lucide-icon';

export interface RpgTab {
  id: string;
  label: string;
  icon?: IconNode;
}

const SCROLL_RATIO = 0.7;
const EDGE_TOLERANCE = 2;
const TAB_MARGIN = 8;

@Component({
  selector: 'app-rpg-tabs',
  styles: [
    `:host {
      display: flex;
      flex: 1;
      min-width: 0;
    }`,
  ],
  imports: [LucideIcon],
  template: `
    <div class="rtabs" [class.rtabs--overflow]="overflowing()">
      @if (overflowing()) {
        <button
          type="button"
          class="rtabs__arrow"
          aria-label="Scroll tabs left"
          tabindex="-1"
          [disabled]="!canScrollLeft()"
          (click)="scrollBy(-1)"
        >
          <app-lucide-icon [icon]="leftIcon" iconClass="ic-14" [strokeWidth]="2.4" />
        </button>
      }
      <nav class="rtabs__track" role="tablist" [attr.aria-label]="label()" #track (scroll)="measure()">
        @for (tab of tabs(); track tab.id; let i = $index) {
          <button
            type="button"
            class="rtab"
            role="tab"
            [class.rtab--active]="active() === tab.id"
            [class.rtab--collapsed]="collapseInactive() && tab.icon && active() !== tab.id"
            [attr.aria-selected]="active() === tab.id"
            [attr.aria-label]="tab.label"
            [attr.title]="active() === tab.id ? null : tab.label"
            [attr.tabindex]="active() === tab.id ? 0 : -1"
            [attr.data-tab]="tab.id"
            (click)="active.set(tab.id)"
            (keydown)="onKey($event, i)"
          >
            @if (tab.icon) {
              <app-lucide-icon [icon]="tab.icon" iconClass="ic-16 rtab__icon" />
            }
            <span class="rtab__label">{{ tab.label }}</span>
          </button>
        }
      </nav>
      @if (overflowing()) {
        <button
          type="button"
          class="rtabs__arrow"
          aria-label="Scroll tabs right"
          tabindex="-1"
          [disabled]="!canScrollRight()"
          (click)="scrollBy(1)"
        >
          <app-lucide-icon [icon]="rightIcon" iconClass="ic-14" [strokeWidth]="2.4" />
        </button>
      }
    </div>
  `,
})
export class RpgTabs {
  readonly tabs = input.required<RpgTab[]>();
  readonly active = model.required<string>();
  readonly label = input('Editor');
  readonly collapseInactive = input(true, { transform: booleanAttribute });

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly leftIcon = ChevronLeft;
  protected readonly rightIcon = ChevronRight;
  protected readonly overflowing = signal(false);
  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.track().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
      this.measure();
    });
    afterRenderEffect(() => {
      const id = this.active();
      this.tabs();
      const track = this.track().nativeElement;
      const tab = track.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`);
      if (tab) {
        const start = tab.offsetLeft - track.offsetLeft;
        const end = start + tab.offsetWidth;
        if (start < track.scrollLeft) track.scrollTo({ left: start - TAB_MARGIN, behavior: 'smooth' });
        else if (end > track.scrollLeft + track.clientWidth) {
          track.scrollTo({ left: end - track.clientWidth + TAB_MARGIN, behavior: 'smooth' });
        }
      }
      this.measure();
    });
  }

  protected measure(): void {
    const el = this.track().nativeElement;
    const overflow = el.scrollWidth - el.clientWidth > EDGE_TOLERANCE;
    this.overflowing.set(overflow);
    this.canScrollLeft.set(overflow && el.scrollLeft > EDGE_TOLERANCE);
    this.canScrollRight.set(overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_TOLERANCE);
  }

  protected scrollBy(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * SCROLL_RATIO, behavior: 'smooth' });
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.active.set(tabs[next].id);
    this.track().nativeElement.querySelector<HTMLElement>(`[data-tab="${CSS.escape(tabs[next].id)}"]`)?.focus();
  }
}
