import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CloudUpload, LogIn, LogOut, UserRound } from 'lucide';
import { LucideIcon } from '../ui/lucide-icon';
import { ShellStore } from '../store/shellStore';
import { Session } from '../cloud/session';
import { CloudSync } from '../cloud/cloudSync';
import { AccountStore } from '../cloud/account';

const KIND_LABEL = { offline: 'No account', anonymous: 'Wanderer', account: 'Account' } as const;

@Component({
  selector: 'app-account-menu',
  imports: [LucideIcon],
  styleUrl: './account-menu.css',
  templateUrl: './account-menu.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
})
export class AccountMenu {
  protected readonly session = inject(Session);
  protected readonly sync = inject(CloudSync);
  protected readonly account = inject(AccountStore);
  private readonly shell = inject(ShellStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly signInIcon = LogIn;
  protected readonly signOutIcon = LogOut;
  protected readonly accountIcon = UserRound;
  protected readonly syncIcon = CloudUpload;

  protected readonly initial = computed(() => this.session.user().name.trim().charAt(0).toUpperCase() || '?');
  protected readonly kindLabel = computed(() => KIND_LABEL[this.session.user().kind]);
  protected readonly status = computed(() => {
    const user = this.session.user();
    if (user.kind === 'offline') return 'Saved in this browser only';
    if (this.sync.pending()) return 'Changes waiting to sync';
    const status = this.sync.status();
    if (status === 'idle') return 'Cloud in sync';
    if (status === 'syncing') return 'Syncing…';
    if (status === 'offline') return 'Offline, will sync later';
    if (status === 'over-quota') return 'Cloud storage full';
    if (status === 'error') return 'Sync failed';
    return 'Cloud';
  });
  protected readonly dot = computed(() => {
    if (!this.session.cloud()) return 'local';
    if (this.sync.pending() && this.sync.status() === 'idle') return 'syncing';
    return this.sync.status();
  });

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[role=menuitem]')?.focus());
  }

  protected close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger().nativeElement.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onMenuKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  protected signIn(): void {
    this.close();
    void this.router.navigate(['/login']);
  }

  protected openAccount(): void {
    this.close();
    this.shell.open('account');
  }

  protected saveAndSync(): void {
    this.close();
    void this.account.saveAndSync();
  }

  protected async signOut(): Promise<void> {
    this.close();
    if ((await this.account.signOut()) === 'needs-confirmation') this.shell.open('account');
  }
}
