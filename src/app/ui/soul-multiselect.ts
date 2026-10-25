import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';

export type SoulOption = { id: string; label: string; sub: string };

let pickerCounter = 0;

@Component({
  selector: 'app-soul-multiselect',
  styleUrl: './soul-multiselect.css',
  host: { '(document:pointerdown)': 'onOutside($event)' },
  template: `
    <div class="sms" [class.sms--open]="open()">
      <div
        class="sms__field"
        role="combobox"
        tabindex="0"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        [attr.aria-controls]="listId"
        [attr.aria-label]="label()"
        [attr.aria-activedescendant]="open() && active() ? optionId(active()!) : null"
        (click)="toggleOpen()"
        (keydown)="onKey($event)"
      >
        @for (s of selectedOptions(); track s.id) {
          <span class="sms__chip">
            {{ s.label }}
            <button type="button" class="sms__chip-x" [attr.aria-label]="'Remove ' + s.label" (click)="$event.stopPropagation(); toggle(s.id)">×</button>
          </span>
        } @empty {
          <span class="sms__placeholder">{{ placeholder() }}</span>
        }
        <span class="sms__caret" aria-hidden="true">▾</span>
      </div>

      @if (open()) {
        <div class="sms__panel">
          <input
            class="rpg-input sms__search"
            placeholder="Search souls…"
            [value]="query()"
            (input)="query.set($any($event.target).value); active.set(filtered()[0]?.id ?? null)"
            (keydown)="onKey($event)"
            aria-label="Search souls"
          />
          <ul class="sms__list" role="listbox" aria-multiselectable="true" [id]="listId">
            @for (o of filtered(); track o.id) {
              <li
                class="sms__option"
                role="option"
                [id]="optionId(o.id)"
                [class.sms__option--active]="active() === o.id"
                [attr.aria-selected]="isSelected(o.id)"
                (pointerenter)="active.set(o.id)"
                (click)="toggle(o.id)"
              >
                <span class="sms__check" [class.sms__check--on]="isSelected(o.id)" aria-hidden="true">✓</span>
                <span class="sms__name">{{ o.label }}</span>
                <span class="sms__sub">{{ o.sub }}</span>
              </li>
            } @empty {
              <li class="sms__none">No soul matches.</li>
            }
          </ul>
          @if (selected().length) {
            <button type="button" class="sms__clear" (click)="selected.set([])">Clear selection</button>
          }
        </div>
      }
    </div>
  `,
})
export class SoulMultiselect {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<SoulOption[]>();
  readonly selected = model<string[]>([]);
  readonly placeholder = input('All souls');
  readonly label = input('Filter by souls');

  protected readonly listId = `sms-list-${++pickerCounter}`;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => `${o.label} ${o.sub}`.toLowerCase().includes(q)) : this.options();
  });
  protected readonly selectedOptions = computed(() =>
    this.selected()
      .map((id) => this.options().find((o) => o.id === id))
      .filter((o) => !!o),
  );

  protected optionId(id: string): string {
    return `${this.listId}-${id}`;
  }

  protected isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  protected toggle(id: string): void {
    this.selected.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  protected toggleOpen(): void {
    this.open() ? this.close() : this.show();
  }

  protected onKey(event: KeyboardEvent): void {
    const list = this.filtered();
    const index = list.findIndex((o) => o.id === this.active());
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) return this.show();
        this.active.set(list[Math.min(list.length - 1, index + 1)]?.id ?? null);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(list[Math.max(0, index - 1)]?.id ?? null);
        return;
      case 'Enter':
        event.preventDefault();
        if (!this.open()) return this.show();
        if (this.active()) this.toggle(this.active()!);
        return;
      case ' ':
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        if (!this.open()) return this.show();
        if (this.active()) this.toggle(this.active()!);
        return;
      case 'Escape':
        this.close();
        return;
    }
  }

  protected onOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private show(): void {
    this.open.set(true);
    this.active.set(this.filtered()[0]?.id ?? null);
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
  }
}
