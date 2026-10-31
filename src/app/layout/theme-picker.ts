import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { Check, Palette } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { ThemePreview } from '../ui/theme-preview';
import { THEMES, ThemeId } from '../domain/themes';
import { ThemeStore } from '../store/themeStore';
import { CommandsService } from './commands';

@Component({
  selector: 'app-theme-picker',
  imports: [LucideIcon, ThemePreview],
  host: { '(document:pointerdown)': 'onOutside($event)' },
  styles: [
    `
      :host {
        position: relative;
        display: inline-flex;
        flex: none;
      }
      .tpk__trigger {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 7px;
        border: 1px solid var(--color-wood-950);
        color: var(--color-parchment-300);
        background: linear-gradient(180deg, var(--color-wood-600), var(--color-wood-800));
        box-shadow:
          inset 0 1px 0 rgb(var(--sheen-rgb) / 0.18),
          0 2px 3px rgba(0, 0, 0, 0.4);
        cursor: pointer;
      }
      .tpk__trigger:hover,
      .tpk__trigger--open {
        color: var(--color-gold-200);
        filter: brightness(1.15);
      }
      .tpk__menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 60;
        width: 17rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem;
        border-radius: 10px;
        border: 1px solid var(--color-wood-600);
        background: linear-gradient(180deg, var(--color-stone-800), var(--color-stone-900));
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65);
        animation: tpk-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .tpk__head {
        margin: 0.1rem 0.3rem 0.2rem;
        font-family: var(--font-display);
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-parchment-400);
      }
      .tpk__item {
        display: grid;
        grid-template-columns: 5.2rem minmax(0, 1fr) 1rem;
        align-items: center;
        gap: 0.6rem;
        padding: 0.4rem;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: var(--color-parchment-100);
        text-align: left;
        cursor: pointer;
      }
      .tpk__item:hover,
      .tpk__item:focus-visible {
        outline: none;
        background: var(--color-wood-800);
        border-color: var(--color-wood-600);
      }
      .tpk__item--on {
        border-color: var(--color-gold-500);
        box-shadow: 0 0 10px rgb(var(--accent-rgb) / 0.25);
      }
      .tpk__text {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }
      .tpk__name {
        font-family: var(--font-display);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--color-gold-200);
      }
      .tpk__desc {
        font-size: 0.74rem;
        line-height: 1.3;
        color: var(--color-parchment-300);
      }
      .tpk__check {
        color: var(--color-gold-300);
      }
      .tpk__keys {
        margin: 0.15rem 0.3rem 0;
        font-size: 0.72rem;
        color: var(--color-parchment-400);
      }
      @keyframes tpk-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tpk__menu {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <button
      type="button"
      class="tpk__trigger"
      aria-haspopup="menu"
      [class.tpk__trigger--open]="open()"
      [attr.aria-expanded]="open()"
      [attr.title]="'Theme: ' + store.current().label"
      [attr.aria-label]="'Theme: ' + store.current().label"
      (click)="toggle()"
      (keydown.arrowdown)="$event.preventDefault(); show()"
    >
      <app-lucide-icon [icon]="paletteIcon" iconClass="ic-16" [strokeWidth]="1.8" />
    </button>
    @if (open()) {
      <div class="tpk__menu" role="menu" aria-label="Theme" (keydown)="onKey($event)">
        <p class="tpk__head" role="presentation">Theme</p>
        @for (t of themes; track t.id) {
          <button
            type="button"
            role="menuitemradio"
            class="tpk__item"
            tabindex="-1"
            [class.tpk__item--on]="store.id() === t.id"
            [attr.aria-checked]="store.id() === t.id"
            [attr.data-theme-option]="t.id"
            (click)="choose(t.id)"
          >
            <app-theme-preview [theme]="t.id" />
            <span class="tpk__text">
              <span class="tpk__name">{{ t.label }}</span>
              <span class="tpk__desc">{{ t.description }}</span>
            </span>
            @if (store.id() === t.id) {
              <app-lucide-icon class="tpk__check" [icon]="checkIcon" iconClass="ic-14" [strokeWidth]="2.4" />
            }
          </button>
        }
        <p class="tpk__keys" role="presentation">Next theme: {{ nextKeys }}</p>
      </div>
    }
  `,
})
export class ThemePicker {
  protected readonly store = inject(ThemeStore);
  protected readonly themes = THEMES;
  protected readonly paletteIcon = Palette;
  protected readonly checkIcon = Check;
  protected readonly open = signal(false);
  private readonly commands = inject(CommandsService);
  protected readonly nextKeys = this.commands.shortcut(this.commands.get('view.theme.next')!);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.show();
  }

  protected show(): void {
    this.open.set(true);
    afterNextRender(() => this.items().find((i) => i.dataset['themeOption'] === this.store.id())?.focus(), { injector: this.injector });
  }

  protected choose(id: ThemeId): void {
    this.store.set(id);
    this.close(true);
  }

  protected onKey(event: KeyboardEvent): void {
    const items = this.items();
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(current + step + items.length) % items.length]?.focus();
        return;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
        return;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        return;
      case 'Tab':
        this.close(false);
        return;
    }
  }

  protected onOutside(event: PointerEvent): void {
    if (this.open() && !(this.host.nativeElement as HTMLElement).contains(event.target as Node)) this.close(false);
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.tpk__trigger')?.focus();
  }

  private items(): HTMLElement[] {
    return [...(this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tpk__item')];
  }
}
