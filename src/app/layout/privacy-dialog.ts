import { Component, computed, inject } from '@angular/core';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { PRIVACY_SECTIONS, PRIVACY_SUMMARY, PRIVACY_UPDATED } from '../domain/privacyNotice';

@Component({
  selector: 'app-privacy-dialog',
  imports: [RpgModal, RpgButton],
  template: `
    <app-rpg-modal title="Privacy & your data" width="42rem" [open]="open()" (closed)="shell.closeDialog()">
      <p class="prv__lead">How Congulatio handles personal data under the EU General Data Protection Regulation (GDPR).</p>
      <ul class="prv__summary">
        @for (line of summary; track $index) {
          <li>{{ line }}</li>
        }
      </ul>
      @for (section of sections; track section.heading) {
        <section class="prv__section">
          <h3>{{ section.heading }}</h3>
          <ul>
            @for (item of section.items; track $index) {
              <li>{{ item }}</li>
            }
          </ul>
        </section>
      }
      <p class="prv__updated">Last updated {{ updated }}.</p>
      <app-rpg-button modalFooter variant="wood" size="sm" (click)="openAccount()">Manage my data</app-rpg-button>
      <app-rpg-button modalFooter variant="gold" size="sm" (click)="shell.closeDialog()">Close</app-rpg-button>
    </app-rpg-modal>
  `,
  styles: [
    `
      .prv__lead {
        margin: 0 0 0.6rem;
        font-size: 0.9rem;
        color: var(--color-ink-700);
      }
      .prv__summary {
        margin: 0 0 0.6rem;
        padding: 0.6rem 0.8rem 0.6rem 1.8rem;
        list-style: disc;
        border-radius: 8px;
        border: 1px solid var(--color-moss-400);
        background: rgba(85, 122, 56, 0.12);
        font-size: 0.88rem;
        line-height: 1.45;
      }
      .prv__section h3 {
        margin: 0.9rem 0 0.3rem;
        font-family: var(--font-display);
        font-size: 0.78rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-ink-800);
      }
      .prv__section ul {
        margin: 0;
        padding-left: 1.15rem;
        list-style: disc;
        font-size: 0.86rem;
        line-height: 1.45;
      }
      .prv__updated {
        margin: 1rem 0 0;
        font-size: 0.78rem;
        font-style: italic;
        color: var(--color-ink-500);
      }
    `,
  ],
})
export class PrivacyDialog {
  protected readonly shell = inject(ShellStore);
  protected readonly open = computed(() => this.shell.dialog() === 'privacy');
  protected readonly summary = PRIVACY_SUMMARY;
  protected readonly sections = PRIVACY_SECTIONS;
  protected readonly updated = PRIVACY_UPDATED;

  protected openAccount(): void {
    this.shell.open('account');
  }
}
