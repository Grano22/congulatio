import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Session, SessionUser } from './session';
import { CloudSync } from './cloudSync';
import { firebaseFirestore, firebaseStorage } from './firebase';
import { cloudErrorMessage } from './authErrors';
import { AVATAR_MAX_BYTES, AVATAR_SIDE } from './firebaseConfig';
import { AvatarError, blobToDataUrl, squareAvatar } from './avatarImage';
import { TomeVault } from '../store/tomeVault';

const USERS = 'users';
const LOCAL_AVATAR_KEY = 'avatar.local';

type Profile = { avatarPath: string | null; avatarBytes: number };

type LocalAvatar = { dataUrl: string; bytes: number };

export type StorageMeter = {
  used: number;
  quota: number;
  tome: number;
  avatar: number;
  ratio: number;
  custom: boolean;
};

@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly session = inject(Session);
  private readonly sync = inject(CloudSync);
  private readonly vault = inject(TomeVault);

  readonly profile = signal<Profile>({ avatarPath: null, avatarBytes: 0 });
  readonly localAvatar = signal<LocalAvatar | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly browser = signal<{ usage: number; quota: number; persisted: boolean } | null>(null);

  readonly avatarUrl = computed(() => {
    const user = this.session.user();
    if (!user) return null;
    return user.kind === 'offline' ? (this.localAvatar()?.dataUrl ?? null) : user.photoURL;
  });

  readonly meter = computed<StorageMeter | null>(() => {
    const quota = this.session.quotaBytes();
    if (quota === null) return null;
    const tome = Math.max(this.sync.tomeBytes(), this.sync.status() === 'over-quota' ? this.sync.pendingBytes() : 0);
    const avatar = this.profile().avatarBytes;
    const used = tome + avatar;
    return { used, quota, tome, avatar, ratio: Math.min(1, used / quota), custom: this.session.user()?.quotaBytes != null };
  });

  constructor() {
    effect(() => {
      const user = this.session.user();
      untracked(() => void this.load(user));
    });
  }

  async refreshBrowser(): Promise<void> {
    const estimate = await this.vault.estimate();
    let persisted = false;
    try {
      persisted = (await navigator.storage?.persisted?.()) ?? false;
    } catch {
      persisted = false;
    }
    this.browser.set(estimate ? { ...estimate, persisted } : null);
  }

  async askPersistence(): Promise<void> {
    await this.vault.persist();
    await this.refreshBrowser();
  }

  async uploadAvatar(file: File): Promise<boolean> {
    const user = this.session.user();
    if (!user) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      const blob = await squareAvatar(file, AVATAR_SIDE, AVATAR_MAX_BYTES);
      if (user.kind === 'offline') {
        const local = { dataUrl: await blobToDataUrl(blob), bytes: blob.size };
        await this.vault.remember(LOCAL_AVATAR_KEY, local);
        this.localAvatar.set(local);
        return true;
      }
      const meter = this.meter();
      if (meter && meter.used - meter.avatar + blob.size > meter.quota) {
        throw new AvatarError('This portrait would go over your cloud storage limit.');
      }
      const path = `avatars/${user.uid}/avatar.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
      const [storage, sdk] = await Promise.all([firebaseStorage(), import('firebase/storage')]);
      const previous = this.profile().avatarPath;
      const ref = sdk.ref(storage, path);
      await sdk.uploadBytes(ref, blob, { contentType: blob.type, cacheControl: 'private, max-age=3600' });
      if (previous && previous !== path) await sdk.deleteObject(sdk.ref(storage, previous)).catch(() => undefined);
      const url = await sdk.getDownloadURL(ref);
      await this.saveProfile(user, { avatarPath: path, avatarBytes: blob.size }, url);
      return true;
    } catch (e) {
      this.error.set(e instanceof AvatarError ? e.message : cloudErrorMessage(e, 'The portrait could not be uploaded.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async removeAvatar(): Promise<void> {
    const user = this.session.user();
    if (!user) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (user.kind === 'offline') {
        await this.vault.remember(LOCAL_AVATAR_KEY, undefined);
        this.localAvatar.set(null);
        return;
      }
      const path = this.profile().avatarPath;
      if (path) {
        const [storage, sdk] = await Promise.all([firebaseStorage(), import('firebase/storage')]);
        await sdk.deleteObject(sdk.ref(storage, path)).catch((e: { code?: string }) => {
          if (e?.code !== 'storage/object-not-found') throw e;
        });
      }
      await this.saveProfile(user, { avatarPath: null, avatarBytes: 0 }, null);
    } catch (e) {
      this.error.set(cloudErrorMessage(e, 'The portrait could not be removed.'));
    } finally {
      this.busy.set(false);
    }
  }

  async rename(displayName: string): Promise<boolean> {
    const user = this.session.user();
    if (!user || user.kind === 'offline') return false;
    const ok = await this.session.updateProfile({ displayName: displayName.trim() });
    if (ok) await this.writeProfileDoc(user.uid, { displayName: displayName.trim() }).catch(() => undefined);
    return ok;
  }

  private async saveProfile(user: SessionUser, profile: Profile, photoURL: string | null): Promise<void> {
    await this.writeProfileDoc(user.uid, { ...profile, photoURL, kind: user.kind });
    this.profile.set(profile);
    if (!(await this.session.updateProfile({ photoURL }))) throw new Error(this.session.error() ?? 'The profile could not be updated.');
  }

  private async writeProfileDoc(uid: string, data: Record<string, unknown>): Promise<void> {
    const [db, sdk] = await Promise.all([firebaseFirestore(), import('firebase/firestore')]);
    await sdk.setDoc(sdk.doc(db, USERS, uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  private async load(user: SessionUser | null): Promise<void> {
    this.error.set(null);
    this.profile.set({ avatarPath: null, avatarBytes: 0 });
    this.localAvatar.set(null);
    if (!user) return;
    if (user.kind === 'offline') {
      this.localAvatar.set((await this.vault.setting<LocalAvatar>(LOCAL_AVATAR_KEY)) ?? null);
      return;
    }
    try {
      const [db, sdk] = await Promise.all([firebaseFirestore(), import('firebase/firestore')]);
      const snap = await sdk.getDoc(sdk.doc(db, USERS, user.uid));
      if (this.session.user()?.uid !== user.uid) return;
      const data = snap.data() ?? {};
      this.profile.set({
        avatarPath: typeof data['avatarPath'] === 'string' ? data['avatarPath'] : null,
        avatarBytes: Number(data['avatarBytes']) || 0,
      });
    } catch {
      return;
    }
  }
}
