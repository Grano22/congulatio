import { Component, ElementRef, inject } from '@angular/core';
import { VIEW_MODES, ViewModeId } from '../domain/viewModes';
import { ViewStore } from '../store/viewStore';
import { LucideIcon } from '../ui/lucide-icon';
import { VIEW_MODE_ICONS } from './view-mode-icons';

@Component({
  selector: 'app-view-mode-switch',
  imports: [LucideIcon],
  styles: [
    `
      :host {
        display: inline-flex;
        flex: none;
      }
      .vms {
        display: inline-flex;
        padding: 2px;
        gap: 2px;
        border-radius: 8px;
        border: 1px solid var(--color-wood-950);
        background: var(--color-wood-950);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
      }
      .vms__opt {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        height: 26px;
        padding: 0 0.55rem;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--color-parchment-300);
        font-family: var(--font-display);
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
      }
      .vms__opt:hover {
        color: var(--color-gold-200);
      }
      .vms__opt--on {
        color: var(--color-gold-200);
        background: linear-gradient(180deg, var(--color-wood-500), var(--color-wood-700));
        box-shadow:
          inset 0 1px 0 rgb(var(--sheen-rgb) / 0.3),
          0 0 0 1px var(--color-gold-600);
      }
      .vms__icon {
        color: var(--color-gold-400);
      }
      .vms__opt--on .vms__icon {
        color: var(--color-gold-200);
        filter: drop-shadow(0 0 4px rgb(var(--accent-rgb) / 0.6));
      }
      .vms__beta {
        padding: 0 0.3rem;
        border-radius: 999px;
        border: 1px solid currentColor;
        font-size: 0.52rem;
        line-height: 1.3;
      }
      @container stage (max-width: 820px) {
        .vms__label {
          display: none;
        }
      }
    `,
  ],
  template: `
    <div class="vms" role="radiogroup" aria-label="View mode" (keydown)="onKey($event)">
      @for (mode of modes; track mode.id) {
        <button
          type="button"
          role="radio"
          class="vms__opt"
          [class.vms__opt--on]="view.modeId() === mode.id"
          [attr.aria-checked]="view.modeId() === mode.id"
          [attr.tabindex]="view.modeId() === mode.id ? 0 : -1"
          [attr.aria-label]="mode.label + (mode.beta ? ' (beta)' : '')"
          [attr.title]="mode.label + (mode.beta ? ' (beta)' : '') + ': ' + mode.description"
          [attr.data-mode]="mode.id"
          (click)="view.setMode(mode.id)"
        >
          <app-lucide-icon class="vms__icon" [icon]="icons[mode.id]" iconClass="ic-14" [strokeWidth]="2" />
          <span class="vms__label">{{ mode.short }}</span>
          @if (mode.beta) {
            <span class="vms__beta">Beta</span>
          }
        </button>
      }
    </div>
  `,
})
export class ViewModeSwitch {
  protected readonly view = inject(ViewStore);
  protected readonly modes = VIEW_MODES;
  protected readonly icons = VIEW_MODE_ICONS;
  private readonly host = inject(ElementRef<HTMLElement>);

  protected onKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = VIEW_MODES.findIndex((m) => m.id === this.view.modeId());
    const next: ViewModeId = VIEW_MODES[(index + step + VIEW_MODES.length) % VIEW_MODES.length].id;
    this.view.setMode(next);
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus();
  }
}
