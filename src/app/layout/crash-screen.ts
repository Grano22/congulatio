import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { ErrorLog } from '../store/errorLog';
import { TomeHistory } from '../store/tomeHistory';
import { ErrorReportForm } from '../ui/error-report-form';
import { isChunkFailure } from '../domain/errorReport';

@Component({
  selector: 'app-crash-screen',
  imports: [ErrorReportForm],
  template: `
    @if (log.critical(); as e) {
      <div class="crash" role="alertdialog" aria-modal="true" aria-labelledby="crash-title" aria-describedby="crash-lead">
        <section class="crash__card">
          <h2 id="crash-title" class="crash__title" tabindex="-1" #title>Something went wrong</h2>
          <p id="crash-lead" class="crash__lead">
            @if (chunk(e.name, e.message)) {
              Part of Congulatio could not be loaded — perhaps you went offline or a new version was published. Reloading
              usually fixes it.
            } @else {
              Congulatio hit an unexpected problem and may not work properly until it is reloaded.
            }
            Your last saved tome is safe in this browser.
          </p>
          @if (history.dirty()) {
            <p class="crash__warn">You have unsaved edits. “Save my work &amp; reload” keeps them.</p>
          }
          @if (saveError()) {
            <p class="crash__warn" role="alert">{{ saveError() }}</p>
          }
          <div class="crash__actions">
            <button type="button" class="rbtn rbtn--gold rbtn--md" (click)="saveAndReload()">Save my work &amp; reload</button>
            <button type="button" class="rbtn rbtn--wood rbtn--md" (click)="reload()">Reload</button>
            <button type="button" class="rbtn rbtn--ghost rbtn--md crash__ghost" (click)="dismiss()">Keep working</button>
          </div>
          <details class="crash__details" [open]="reporting()" (toggle)="reporting.set($any($event.target).open)">
            <summary>Report this problem (optional)</summary>
            <app-error-report-form [entry]="e" />
          </details>
          <details class="crash__details">
            <summary>Technical details</summary>
            <pre tabindex="0">{{ e.name }}: {{ e.message }}{{ e.stack ? '\n' + e.stack : '' }}</pre>
          </details>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .crash {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(10, 7, 3, 0.82);
      }
      .crash__card {
        width: min(36rem, 100%);
        max-height: calc(100dvh - 2rem);
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.4rem;
        border: 2px solid var(--color-wood-950);
        border-radius: 12px;
        background: linear-gradient(168deg, #f4e8c8, #dcc48f);
        color: var(--color-ink-900);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.7), inset 0 0 0 2px var(--color-blood-400);
      }
      .crash__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.15rem;
        color: var(--color-blood-600);
        outline: none;
      }
      .crash__lead,
      .crash__warn {
        margin: 0;
        line-height: 1.45;
      }
      .crash__warn {
        padding: 0.45rem 0.6rem;
        border-radius: 6px;
        background: rgba(180, 146, 42, 0.18);
        border: 1px solid var(--color-gold-600);
        font-size: 0.9rem;
      }
      .crash__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .crash__ghost {
        color: var(--color-ink-800);
        border-color: var(--color-ink-400);
      }
      .crash__details summary {
        cursor: pointer;
        font-size: 0.86rem;
        color: var(--color-mana-600);
        margin-bottom: 0.4rem;
      }
      .crash__details pre {
        max-height: 10rem;
        overflow: auto;
        margin: 0;
        padding: 0.5rem;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.08);
        font-size: 0.72rem;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ],
})
export class CrashScreen {
  protected readonly log = inject(ErrorLog);
  protected readonly history = inject(TomeHistory);
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly reporting = signal(false);
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.log.critical()) queueMicrotask(() => this.title()?.nativeElement.focus());
    });
  }

  protected chunk(name: string, message: string): boolean {
    return isChunkFailure(name, message);
  }

  protected async saveAndReload(): Promise<void> {
    this.saveError.set(null);
    if (this.history.owner() && this.history.dirty() && !(await this.history.persist())) {
      this.saveError.set('Your edits could not be saved. Export the tome from the File menu before reloading.');
      return;
    }
    location.reload();
  }

  protected reload(): void {
    location.reload();
  }

  protected dismiss(): void {
    this.log.dismissCritical();
  }
}
