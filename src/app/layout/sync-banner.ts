import { Component, computed, inject, signal } from '@angular/core';
import { CloudOff, X } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { Session } from '../cloud/session';
import { CloudSync } from '../cloud/cloudSync';
import { AccountStore } from '../cloud/account';
import { TomeHistory } from '../store/tomeHistory';
import { NetworkStore } from '../store/networkStore';

const REASON = {
  offline: 'You are offline',
  error: 'The last cloud sync failed',
  'over-quota': 'Your tome is larger than your cloud storage',
} as const;

type Reason = keyof typeof REASON;

@Component({
  selector: 'app-sync-banner',
  imports: [LucideIcon],
  template: `
    @if (reason(); as r) {
      <div class="sbanner" role="status" aria-live="polite">
        <app-lucide-icon [icon]="cloudOffIcon" iconClass="ic-16" [strokeWidth]="2" />
        <p>
          <b>{{ label(r) }}.</b>
          Your changes are saved in this browser but have not reached the cloud yet. They will sync automatically when
          possible — until then they exist only here and could be lost if this browser’s data is cleared.
        </p>
        @if (r !== 'offline') {
          <button type="button" class="sbanner__act" [disabled]="sync.status() === 'syncing'" (click)="retry()">Retry sync</button>
        }
        <button type="button" class="sbanner__act" (click)="exportCopy()">Export a copy</button>
        <button type="button" class="sbanner__close" aria-label="Hide this notice" (click)="hide(r)">
          <app-lucide-icon [icon]="closeIcon" iconClass="ic-14" [strokeWidth]="2" />
        </button>
      </div>
    }
  `,
  styles: [
    `
      .sbanner {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.45rem 1rem;
        background: linear-gradient(180deg, #5a2a1a, #451d12);
        border-bottom: 1px solid var(--color-blood-400);
        color: var(--color-parchment-100);
        font-size: 0.84rem;
        line-height: 1.35;
      }
      .sbanner p {
        flex: 1;
        margin: 0;
      }
      .sbanner__act,
      .sbanner__close {
        flex: none;
        padding: 0.25rem 0.6rem;
        border-radius: 5px;
        border: 1px solid var(--color-parchment-400);
        background: transparent;
        color: var(--color-parchment-100);
        font: inherit;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .sbanner__act:hover:not(:disabled),
      .sbanner__close:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .sbanner__close {
        display: grid;
        place-items: center;
        padding: 0.25rem;
        border-color: transparent;
      }
    `,
  ],
})
export class SyncBanner {
  private readonly session = inject(Session);
  protected readonly sync = inject(CloudSync);
  private readonly account = inject(AccountStore);
  private readonly history = inject(TomeHistory);
  private readonly network = inject(NetworkStore);

  protected readonly cloudOffIcon = CloudOff;
  protected readonly closeIcon = X;
  private readonly hidden = signal<Reason | null>(null);

  protected readonly reason = computed<Reason | null>(() => {
    if (!this.session.cloud() || !(this.sync.pending() || this.history.dirty())) return null;
    const status = this.sync.status();
    const reason: Reason | null = !this.network.online() ? 'offline' : status === 'error' || status === 'over-quota' ? status : null;
    return reason && reason !== this.hidden() ? reason : null;
  });

  protected label(reason: Reason): string {
    return REASON[reason];
  }

  protected hide(reason: Reason): void {
    this.hidden.set(reason);
  }

  protected retry(): void {
    this.hidden.set(null);
    void this.account.saveAndSync();
  }

  protected exportCopy(): void {
    this.history.exportTome(false);
  }
}
