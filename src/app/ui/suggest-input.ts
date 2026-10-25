import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';
import type { Suggestion } from '../domain/interests';

type MatchedSuggestion = Suggestion & { before: string; match: string; after: string };

type SuggestionGroup = { group: string; items: MatchedSuggestion[] };

const MAX_RESULTS = 40;

let suggestCounter = 0;

@Component({
  selector: 'app-suggest-input',
  styleUrl: './suggest-input.css',
  host: { '(document:pointerdown)': 'onOutside($event)' },
  template: `
    <div class="sug" [class.sug--open]="open()">
      <input
        class="rpg-input sug__input"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && activeIndex() >= 0 ? optionId(activeIndex()) : null"
        [attr.aria-label]="label()"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($any($event.target).value)"
        (focus)="show()"
        (click)="show()"
        (keydown)="onKey($event)"
      />
      @if (value()) {
        <button type="button" class="sug__clear" [attr.aria-label]="'Clear ' + label()" (click)="pick('')">×</button>
      }
      @if (open()) {
        <ul class="sug__list" role="listbox" [id]="listId" [attr.aria-label]="label()">
          @for (group of groups(); track group.group) {
            <li class="sug__group" role="presentation">{{ group.group }}</li>
            @for (item of group.items; track item.label) {
              @let index = indexOf(item);
              <li
                class="sug__option"
                role="option"
                [id]="optionId(index)"
                [class.sug__option--active]="index === activeIndex()"
                [attr.aria-selected]="item.label === value()"
                (pointerdown)="$event.preventDefault()"
                (pointerenter)="activeIndex.set(index)"
                (click)="pick(item.label)"
              >{{ item.before }}<mark>{{ item.match }}</mark>{{ item.after }}</li>
            }
          } @empty {
            <li class="sug__none" role="presentation">
              No preset matches. Press Enter to keep “{{ value() }}”.
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SuggestInput {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly suggestions = input.required<Suggestion[]>();
  readonly value = model('');
  readonly placeholder = input('');
  readonly label = input('Suggestions');

  protected readonly listId = `sug-list-${++suggestCounter}`;
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  private readonly typed = signal(false);

  private readonly matches = computed<MatchedSuggestion[]>(() => {
    const query = this.typed() ? this.value().trim().toLowerCase() : '';
    const found: MatchedSuggestion[] = [];
    for (const s of this.suggestions()) {
      const at = query ? s.label.toLowerCase().indexOf(query) : 0;
      if (at < 0) continue;
      const length = query ? query.length : 0;
      found.push({ ...s, before: s.label.slice(0, at), match: s.label.slice(at, at + length), after: s.label.slice(at + length) });
      if (found.length >= MAX_RESULTS) break;
    }
    return found;
  });

  protected readonly groups = computed<SuggestionGroup[]>(() => {
    const groups: SuggestionGroup[] = [];
    for (const item of this.matches()) {
      const last = groups.find((g) => g.group === item.group);
      if (last) last.items.push(item);
      else groups.push({ group: item.group, items: [item] });
    }
    return groups;
  });

  private readonly ordered = computed(() => this.groups().flatMap((g) => g.items));

  protected indexOf(item: MatchedSuggestion): number {
    return this.ordered().indexOf(item);
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected show(): void {
    if (this.open()) return;
    this.typed.set(false);
    this.open.set(true);
    this.activeIndex.set(this.ordered().findIndex((s) => s.label === this.value()));
  }

  protected onInput(text: string): void {
    this.value.set(text);
    this.typed.set(true);
    this.open.set(true);
    this.activeIndex.set(text.trim() && this.ordered().length ? 0 : -1);
  }

  protected pick(label: string): void {
    this.value.set(label);
    this.close();
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.ordered().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) return this.show();
        if (count) this.activeIndex.set((this.activeIndex() + 1) % count);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        return;
      case 'Enter': {
        if (!this.open()) return;
        event.preventDefault();
        const active = this.ordered()[this.activeIndex()];
        if (active) this.pick(active.label);
        else this.close();
        return;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  protected onOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private close(): void {
    this.open.set(false);
    this.typed.set(false);
    this.activeIndex.set(-1);
  }
}
