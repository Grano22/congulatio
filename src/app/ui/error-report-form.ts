import { Component, computed, inject, input, signal } from '@angular/core';
import { ErrorReporter } from '../cloud/errorReporter';
import { Session } from '../cloud/session';
import { ErrorEntry, MAX_NOTE } from '../domain/errorReport';

let formCounter = 0;

@Component({
  selector: 'app-error-report-form',
  template: `
    @let e = entry();
    @if (e.reportedAt && !sent()) {
      <p class="erf__done" role="status">Thank you — this problem was reported before.</p>
    }
    @if (sent()) {
      <p class="erf__done" role="status">Thank you. The report was sent without your name, e-mail or account id.</p>
    } @else {
      <label class="erf__label" [for]="id + '-note'">What were you doing? (optional, do not include personal data)</label>
      <textarea
        class="rpg-textarea erf__note"
        [id]="id + '-note'"
        [attr.maxlength]="maxNote"
        rows="3"
        [value]="note()"
        (input)="note.set($any($event.target).value)"
      ></textarea>
      <details class="erf__preview">
        <summary>Show exactly what will be shared</summary>
        <pre tabindex="0" [attr.aria-label]="'Report preview'">{{ preview() }}</pre>
      </details>
      <label class="erf__consent">
        <input type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)" />
        <span>I agree to share this technical report to help fix the problem. It contains no tome content, name, e-mail or account id.</span>
      </label>
      @if (error(); as message) {
        <p class="erf__error" role="alert">{{ message }}</p>
      }
      @if (copied()) {
        <p class="erf__done" role="status">Copied to the clipboard.</p>
      }
      <div class="erf__actions">
        @if (session.cloud()) {
          <button type="button" class="rbtn rbtn--gold rbtn--sm" [disabled]="!consent() || busy()" (click)="send()">
            {{ busy() ? 'Sending…' : 'Send report' }}
          </button>
        }
        <button type="button" class="rbtn rbtn--wood rbtn--sm" [disabled]="!consent()" (click)="copy()">Copy report</button>
        <a class="rbtn rbtn--wood rbtn--sm erf__link" [class.erf__link--off]="!consent()" [attr.aria-disabled]="!consent()" [attr.href]="consent() ? issue() : null" target="_blank" rel="noopener noreferrer">
          Open a GitHub issue
        </a>
      </div>
      @if (!session.cloud()) {
        <p class="erf__hint">Without an account nothing is sent automatically: copy the report or open a public GitHub issue yourself.</p>
      }
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .erf__label {
        font-size: 0.82rem;
        color: var(--color-ink-700);
      }
      .erf__note {
        min-height: 4rem;
      }
      .erf__preview summary {
        cursor: pointer;
        font-size: 0.82rem;
        color: var(--color-mana-600);
      }
      .erf__preview pre {
        max-height: 12rem;
        overflow: auto;
        margin: 0.4rem 0 0;
        padding: 0.5rem;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.08);
        font-size: 0.72rem;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .erf__consent {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        font-size: 0.82rem;
        cursor: pointer;
      }
      .erf__consent input {
        margin-top: 0.2rem;
        accent-color: var(--color-wood-600);
      }
      .erf__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .erf__link {
        text-decoration: none;
      }
      .erf__link--off {
        opacity: 0.5;
        pointer-events: none;
      }
      .erf__done,
      .erf__error,
      .erf__hint {
        margin: 0;
        font-size: 0.82rem;
      }
      .erf__done {
        color: var(--color-moss-600);
      }
      .erf__error {
        color: var(--color-blood-600);
      }
      .erf__hint {
        font-style: italic;
        color: var(--color-ink-500);
      }
    `,
  ],
})
export class ErrorReportForm {
  readonly entry = input.required<ErrorEntry>();

  protected readonly session = inject(Session);
  private readonly reporter = inject(ErrorReporter);

  protected readonly id = `erf-${++formCounter}`;
  protected readonly maxNote = MAX_NOTE;
  protected readonly note = signal('');
  protected readonly consent = signal(false);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = computed(() => JSON.stringify(this.reporter.payload(this.entry(), this.note()), null, 2));
  protected readonly issue = computed(() => this.reporter.issueLink(this.entry(), this.note()));

  protected async send(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const problem = await this.reporter.send(this.entry(), this.note());
    this.busy.set(false);
    if (problem) this.error.set(problem);
    else this.sent.set(true);
  }

  protected async copy(): Promise<void> {
    this.copied.set(await this.reporter.copy(this.entry(), this.note()));
    if (!this.copied()) this.error.set('The browser did not allow copying. Open the preview and copy it by hand.');
  }
}
