import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { TomeHistory } from '../store/tomeHistory';
import { Session } from '../cloud/session';
import { CloudSync, SyncStatus } from '../cloud/cloudSync';
import { AccountStore } from '../cloud/account';
import { formatBytes } from '../domain/cloudSync';
import { DEFAULT_QUOTA } from '../cloud/firebaseConfig';

const KIND_LABEL = { offline: 'No account', anonymous: 'Wanderer', account: 'Account' } as const;

const SYNC_LABEL: Record<SyncStatus, string> = {
  off: 'Not synced',
  idle: 'In sync',
  syncing: 'Syncing…',
  offline: 'Offline, will sync when the connection returns',
  'over-quota': 'Over the storage limit',
  error: 'Sync failed',
};

@Component({
  selector: 'app-account-dialog',
  imports: [RpgModal, RpgButton, DatePipe],
  styleUrl: './account-dialog.css',
  templateUrl: './account-dialog.html',
})
export class AccountDialog {
  protected readonly shell = inject(ShellStore);
  protected readonly session = inject(Session);
  protected readonly sync = inject(CloudSync);
  protected readonly account = inject(AccountStore);
  private readonly router = inject(Router);

  protected readonly open = computed(() => this.shell.dialog() === 'account');
  protected readonly user = this.session.user;
  protected readonly kindLabel = computed(() => KIND_LABEL[this.user()?.kind ?? 'offline']);
  protected readonly syncLabel = computed(() => SYNC_LABEL[this.sync.status()]);
  protected readonly initial = computed(() => (this.user()?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
  protected readonly bytes = formatBytes;
  protected readonly accountQuota = DEFAULT_QUOTA.account;

  protected readonly name = signal('');
  protected readonly linkEmail = signal('');
  protected readonly linkPassword = signal('');
  private readonly history = inject(TomeHistory);
  protected readonly confirmDelete = signal<'cloud' | 'account' | null>(null);
  protected readonly confirmSignOut = this.account.confirmSignOut;
  protected readonly signOutWarning = this.account.signOutWarning;

  constructor() {
    effect(() => {
      if (!this.open()) {
        untracked(() => {
          this.account.confirmSignOut.set(false);
          this.confirmDelete.set(null);
        });
        return;
      }
      untracked(() => {
        this.name.set(this.user()?.name ?? '');
        this.session.error.set(null);
        this.account.error.set(null);
        void this.account.refreshBrowser();
      });
    });
  }

  protected pickAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.account.uploadAvatar(file).then((ok) => ok && this.shell.notify('success', 'Your portrait was updated.'));
  }

  protected async saveName(): Promise<void> {
    if (await this.account.rename(this.name())) this.shell.notify('success', 'Your name was updated.');
  }

  protected syncNow(): Promise<void> {
    return this.account.saveAndSync();
  }

  protected async linkWithGoogle(): Promise<void> {
    if (await this.session.linkGoogle()) this.shell.notify('success', 'Your ledger is now kept by your Google account.');
  }

  protected async linkWithEmail(event: Event): Promise<void> {
    event.preventDefault();
    if (await this.session.linkEmail(this.linkEmail(), this.linkPassword(), this.name())) {
      this.linkPassword.set('');
      this.shell.notify('success', 'Your ledger is now kept by your e-mail account.');
    }
  }

  protected async refreshLimits(): Promise<void> {
    if (await this.session.refreshQuota()) this.shell.notify('info', 'Storage limits refreshed.');
  }

  protected exportTome(): void {
    this.history.exportTome(true);
  }

  protected openPrivacy(): void {
    this.shell.open('privacy');
  }

  protected async deleteCloud(): Promise<void> {
    if (this.confirmDelete() !== 'cloud') {
      this.confirmDelete.set('cloud');
      return;
    }
    this.confirmDelete.set(null);
    await this.account.deleteCloudData();
  }

  protected async deleteAccount(): Promise<void> {
    if (this.confirmDelete() !== 'account') {
      this.confirmDelete.set('account');
      return;
    }
    this.confirmDelete.set(null);
    if (await this.account.deleteAccount()) this.shell.closeDialog();
  }

  protected signIn(): void {
    this.shell.closeDialog();
    void this.router.navigate(['/login']);
  }

  protected async signOut(): Promise<void> {
    if ((await this.account.signOut()) === 'signed-out') this.shell.closeDialog();
  }
}
