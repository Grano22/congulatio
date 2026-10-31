import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { LOCAL_OWNER } from '../store/tomeHistory';
import { DEFAULT_QUOTA, loadCloudConfig } from './firebaseConfig';
import { firebaseAuth } from './firebase';
import { cloudErrorMessage } from './authErrors';

export type SessionKind = 'offline' | 'anonymous' | 'account';

export type SessionUser = {
  uid: string;
  kind: SessionKind;
  name: string;
  email: string | null;
  photoURL: string | null;
  providers: string[];
  quotaBytes: number | null;
  admin: boolean;
};

export const OFFLINE_USER: SessionUser = {
  uid: LOCAL_OWNER,
  kind: 'offline',
  name: 'Local scribe',
  email: null,
  photoURL: null,
  providers: [],
  quotaBytes: null,
  admin: false,
};

@Injectable({ providedIn: 'root' })
export class Session {
  readonly configured = signal(false);
  readonly stage = signal<string | null>(null);
  readonly emulated = signal(false);
  readonly user = signal<SessionUser>(OFFLINE_USER);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly cloud = computed(() => this.user().kind !== 'offline');
  readonly quotaBytes = computed(() => {
    const user = this.user();
    if (user.kind === 'offline') return null;
    return user.quotaBytes ?? (user.kind === 'anonymous' ? DEFAULT_QUOTA.anonymous : DEFAULT_QUOTA.account);
  });

  private readonly started: Promise<void>;
  private signingIn = false;
  private carryLocalTome = false;

  constructor() {
    this.started = this.start();
  }

  whenReady(): Promise<void> {
    return this.started;
  }

  takeLocalTome(): boolean {
    const carry = this.carryLocalTome;
    this.carryLocalTome = false;
    return carry;
  }

  enterAnonymously(): Promise<boolean> {
    return this.signIn(async (sdk, auth) => {
      await sdk.signInAnonymously(auth);
      return true;
    });
  }

  signInWithGoogle(): Promise<boolean> {
    return this.signIn(async (sdk, auth) => {
      const credential = await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
      return sdk.getAdditionalUserInfo(credential)?.isNewUser === true;
    });
  }

  signInWithEmail(email: string, password: string): Promise<boolean> {
    return this.signIn(async (sdk, auth) => {
      await sdk.signInWithEmailAndPassword(auth, email.trim(), password);
      return false;
    });
  }

  register(email: string, password: string, name: string): Promise<boolean> {
    return this.signIn(async (sdk, auth) => {
      const { user } = await sdk.createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await sdk.updateProfile(user, { displayName: name.trim() });
      return true;
    });
  }

  resetPassword(email: string): Promise<boolean> {
    return this.run(async (sdk, auth) => {
      await sdk.sendPasswordResetEmail(auth, email.trim());
    });
  }

  linkGoogle(): Promise<boolean> {
    return this.run(async (sdk, auth) => {
      const user = this.requireUser(auth.currentUser);
      await sdk.linkWithPopup(user, new sdk.GoogleAuthProvider());
      await user.reload();
      await this.adopt(auth.currentUser, true);
    });
  }

  linkEmail(email: string, password: string, name: string): Promise<boolean> {
    return this.run(async (sdk, auth) => {
      const user = this.requireUser(auth.currentUser);
      await sdk.linkWithCredential(user, sdk.EmailAuthProvider.credential(email.trim(), password));
      if (name.trim()) await sdk.updateProfile(user, { displayName: name.trim() });
      await user.reload();
      await this.adopt(auth.currentUser, true);
    });
  }

  updateProfile(changes: { displayName?: string; photoURL?: string | null }): Promise<boolean> {
    return this.run(async (sdk, auth) => {
      const user = this.requireUser(auth.currentUser);
      await sdk.updateProfile(user, changes);
      await this.adopt(user);
    });
  }

  refreshQuota(): Promise<boolean> {
    return this.run(async (_sdk, auth) => {
      await this.adopt(auth.currentUser, true);
    });
  }

  async signOut(): Promise<void> {
    this.error.set(null);
    if (!this.cloud()) return;
    await this.run(async (sdk, auth) => {
      await sdk.signOut(auth);
    });
    this.user.set(OFFLINE_USER);
  }

  private async signIn(action: (sdk: typeof import('firebase/auth'), auth: import('firebase/auth').Auth) => Promise<boolean>): Promise<boolean> {
    const wasOffline = !this.cloud();
    this.signingIn = true;
    try {
      return await this.run(async (sdk, auth) => {
        const fresh = await action(sdk, auth);
        this.carryLocalTome = wasOffline && fresh;
        await this.adopt(auth.currentUser);
      });
    } finally {
      this.signingIn = false;
    }
  }

  private async start(): Promise<void> {
    const config = await loadCloudConfig();
    this.configured.set(Boolean(config));
    this.stage.set(config?.stage ?? null);
    this.emulated.set(Boolean(config?.emulators));
    if (!config) {
      this.ready.set(true);
      return;
    }
    try {
      const [auth, sdk] = await Promise.all([firebaseAuth(), import('firebase/auth')]);
      await auth.authStateReady();
      await this.adopt(auth.currentUser);
      sdk.onAuthStateChanged(auth, (user) => {
        if (this.signingIn) return;
        if ((user?.uid ?? OFFLINE_USER.uid) !== this.user().uid) void this.adopt(user);
      });
    } catch (e) {
      this.error.set(cloudErrorMessage(e, 'The cloud could not be reached. You can still work on this device.'));
    }
    this.ready.set(true);
  }

  private async adopt(user: User | null, forceRefresh = false): Promise<void> {
    if (!user) {
      this.user.set(OFFLINE_USER);
      return;
    }
    let claims: Record<string, unknown> = {};
    try {
      claims = (await user.getIdTokenResult(forceRefresh)).claims;
    } catch {
      claims = {};
    }
    const quota = Number(claims['storageQuota']);
    this.user.set({
      uid: user.uid,
      kind: user.isAnonymous ? 'anonymous' : 'account',
      name: user.displayName || user.email?.split('@')[0] || (user.isAnonymous ? 'Wandering scribe' : 'Scribe'),
      email: user.email,
      photoURL: user.photoURL,
      providers: user.providerData.map((p) => p.providerId),
      quotaBytes: Number.isFinite(quota) && quota > 0 ? quota : null,
      admin: claims['admin'] === true,
    });
  }

  private requireUser(user: User | null): User {
    if (!user) throw new Error('Sign in first.');
    return user;
  }

  private async run(action: (sdk: typeof import('firebase/auth'), auth: import('firebase/auth').Auth) => Promise<void>): Promise<boolean> {
    if (!this.configured()) {
      this.error.set('The cloud is not configured for this build, so only this device is available.');
      return false;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const [auth, sdk] = await Promise.all([firebaseAuth(), import('firebase/auth')]);
      await action(sdk, auth);
      return true;
    } catch (e) {
      this.error.set(cloudErrorMessage(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
