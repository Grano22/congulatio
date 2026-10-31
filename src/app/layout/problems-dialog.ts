import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ErrorReportForm } from '../ui/error-report-form';
import { ShellStore } from '../store/shellStore';
import { ErrorLog } from '../store/errorLog';

@Component({
  selector: 'app-problems-dialog',
  imports: [RpgModal, RpgButton, ErrorReportForm, DatePipe],
  template: `
    <app-rpg-modal title="Problems & error reports" width="40rem" [open]="open()" (closed)="shell.closeDialog()">
      <p class="pr__lead">
        Errors are remembered only in this browser, one line per kind of problem. Nothing is sent unless you choose to
        report it below.
      </p>
      @if (log.entries().length === 0) {
        <p class="pr__empty">No problems recorded. 🎉</p>
      } @else {
        <ul class="pr__list" role="list">
          @for (e of log.entries(); track e.id) {
            <li class="pr__item" [class.pr__item--on]="selected() === e.id">
              <button type="button" class="pr__pick" [attr.aria-expanded]="selected() === e.id" (click)="toggle(e.id)">
                <span class="pr__msg">{{ e.name }}: {{ e.message }}</span>
                <span class="pr__meta">
                  {{ e.count }}× · last {{ e.lastSeen | date: 'short' }} · v{{ e.appVersion }}{{ e.critical ? ' · critical' : '' }}{{ e.reportedAt ? ' · reported' : '' }}
                </span>
              </button>
              @if (selected() === e.id) {
                <div class="pr__form">
                  <app-error-report-form [entry]="e" />
                </div>
              }
            </li>
          }
        </ul>
      }
      <app-rpg-button modalFooter variant="danger" size="sm" [disabled]="log.entries().length === 0" (click)="clear()">Clear the list</app-rpg-button>
      <app-rpg-button modalFooter variant="gold" size="sm" (click)="shell.closeDialog()">Close</app-rpg-button>
    </app-rpg-modal>
  `,
  styles: [
    `
      .pr__lead,
      .pr__empty {
        margin: 0 0 0.6rem;
        font-size: 0.88rem;
        color: var(--color-ink-700);
      }
      .pr__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .pr__item {
        border: 1px solid var(--color-ink-300);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.25);
      }
      .pr__item--on {
        border-color: var(--color-wood-500);
      }
      .pr__pick {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        width: 100%;
        padding: 0.5rem 0.7rem;
        border: 0;
        background: none;
        font: inherit;
        text-align: left;
        color: inherit;
        cursor: pointer;
      }
      .pr__msg {
        font-size: 0.88rem;
        word-break: break-word;
      }
      .pr__meta {
        font-size: 0.75rem;
        color: var(--color-ink-500);
      }
      .pr__form {
        padding: 0 0.7rem 0.7rem;
      }
    `,
  ],
})
export class ProblemsDialog {
  protected readonly shell = inject(ShellStore);
  protected readonly log = inject(ErrorLog);
  protected readonly open = computed(() => this.shell.dialog() === 'problems');
  protected readonly selected = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.log.markSeen());
    });
  }

  protected toggle(id: string): void {
    this.selected.update((s) => (s === id ? null : id));
  }

  protected clear(): void {
    this.selected.set(null);
    this.log.clear();
  }
}
