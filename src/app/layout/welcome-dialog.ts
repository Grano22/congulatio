import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { WelcomeStore } from '../store/welcomeStore';
import { Session } from '../cloud/session';
import { DEFAULT_QUOTA, MIB } from '../cloud/firebaseConfig';
import { RELEASES } from '../domain/releaseNotes';
import { PRIVACY_SUMMARY } from '../domain/privacyNotice';
import { APP_VERSION } from './app-version';

@Component({
  selector: 'app-welcome-dialog',
  imports: [RpgModal, RpgButton],
  styleUrl: './welcome-dialog.css',
  templateUrl: './welcome-dialog.html',
})
export class WelcomeDialog {
  protected readonly shell = inject(ShellStore);
  protected readonly welcome = inject(WelcomeStore);
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly version = APP_VERSION;
  protected readonly privacy = PRIVACY_SUMMARY;
  protected readonly accountQuota = `${DEFAULT_QUOTA.account / MIB} MiB`;
  protected readonly open = computed(() => this.shell.dialog() === 'welcome');
  private readonly snapshotFirstVisit = signal(true);
  protected readonly firstVisit = this.snapshotFirstVisit.asReadonly();
  protected readonly releases = computed(() => {
    const since = this.welcome.releases();
    return since.length ? since : RELEASES.slice(0, 1);
  });
  protected readonly title = computed(() => (this.firstVisit() ? 'Welcome to Congulatio' : `What’s new in v${this.version}`));
  protected readonly offerAccount = computed(() => !this.session.cloud() && this.session.configured());

  constructor() {
    effect(() => {
      if (this.open()) untracked(() => this.snapshotFirstVisit.set(this.welcome.firstVisit()));
    });
  }

  protected close(): void {
    this.shell.closeDialog();
    void this.welcome.dismiss();
  }

  protected tour(): void {
    void this.welcome.dismiss();
    this.shell.open('tour');
  }

  protected readPrivacy(): void {
    void this.welcome.dismiss();
    this.shell.open('privacy');
  }

  protected signIn(): void {
    this.close();
    void this.router.navigate(['/login']);
  }
}
