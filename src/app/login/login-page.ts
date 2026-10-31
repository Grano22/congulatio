import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Cloud, HardDrive, KeyRound, Shield, UserRound } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { Session } from '../cloud/session';
import { DEFAULT_QUOTA, MIB } from '../cloud/firebaseConfig';

type LoginMode = 'signin' | 'register' | 'reset';

@Component({
  selector: 'app-login-page',
  imports: [RpgButton, LucideIcon],
  styleUrl: './login-page.css',
  templateUrl: './login-page.html',
})
export class LoginPage {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly mode = signal<LoginMode>('signin');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly info = signal<string | null>(null);

  protected readonly shieldIcon = Shield;
  protected readonly cloudIcon = Cloud;
  protected readonly driveIcon = HardDrive;
  protected readonly keyIcon = KeyRound;
  protected readonly wandererIcon = UserRound;

  protected readonly anonymousQuota = `${DEFAULT_QUOTA.anonymous / MIB} MiB`;
  protected readonly accountQuota = `${DEFAULT_QUOTA.account / MIB} MiB`;

  protected readonly title = computed(() =>
    this.mode() === 'register' ? 'Open a new ledger' : this.mode() === 'reset' ? 'Recover your key' : 'Enter the scriptorium',
  );
  protected readonly submitLabel = computed(() =>
    this.mode() === 'register' ? 'Create account' : this.mode() === 'reset' ? 'Send reset link' : 'Sign in',
  );
  protected readonly cloudDisabled = computed(() => !this.session.configured() || this.session.busy());

  constructor() {
    effect(() => {
      if (this.session.user()) void this.router.navigateByUrl('/');
    });
  }

  protected switchTo(mode: LoginMode): void {
    this.mode.set(mode);
    this.info.set(null);
    this.session.error.set(null);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.info.set(null);
    if (this.mode() === 'reset') {
      if (await this.session.resetPassword(this.email())) this.info.set('If the account exists, a reset link is on its way to your inbox.');
      return;
    }
    if (this.mode() === 'register') await this.session.register(this.email(), this.password(), this.name());
    else await this.session.signInWithEmail(this.email(), this.password());
  }

  protected google(): void {
    void this.session.signInWithGoogle();
  }

  protected wander(): void {
    void this.session.enterAnonymously();
  }

  protected offline(): void {
    void this.session.continueOffline();
  }
}
