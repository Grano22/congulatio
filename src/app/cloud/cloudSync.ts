import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { Session } from './session';
import { firebaseFirestore } from './firebase';
import { cloudErrorMessage } from './authErrors';
import { TomeHistory } from '../store/tomeHistory';
import { ShellStore } from '../store/shellStore';
import { NetworkStore } from '../store/networkStore';
import { SYNC, TOMES, TomeVault, VaultSync, VaultTome } from '../store/tomeVault';
import {
  CloudRow,
  META_KIND,
  RowTooLargeError,
  chunkWrites,
  decideSync,
  hashesOf,
  planPush,
  readMeta,
  rowsToTome,
  tomeToRows,
} from '../domain/cloudSync';

export const TABLE = 'app_tables';
const SYNC_DELAY_MS = 800;

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'over-quota' | 'error';

type Sdk = typeof import('firebase/firestore');

@Injectable({ providedIn: 'root' })
export class CloudSync {
  private readonly session = inject(Session);
  private readonly history = inject(TomeHistory);
  private readonly vault = inject(TomeVault);
  private readonly shell = inject(ShellStore);
  private readonly network = inject(NetworkStore);

  readonly status = signal<SyncStatus>('off');
  readonly error = signal<string | null>(null);
  readonly syncedAt = signal<string | null>(null);
  readonly tomeBytes = signal(0);
  readonly pendingBytes = signal(0);
  readonly active = computed(() => {
    const user = this.session.user();
    return Boolean(user && this.session.cloud() && this.history.owner() === user.uid);
  });
  readonly pending = computed(() => {
    if (!this.active()) return false;
    const saved = this.history.savedAt();
    const synced = this.syncedAt();
    return Boolean(saved && (!synced || saved > synced));
  });

  private running?: Promise<void>;
  private again = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const active = this.active();
      untracked(() => {
        if (active) {
          void this.sync();
        } else {
          clearTimeout(this.timer);
          this.status.set('off');
          this.syncedAt.set(null);
          this.tomeBytes.set(0);
        }
      });
    });
    effect(() => {
      this.history.savedAt();
      untracked(() => {
        if (this.active()) this.schedule();
      });
    });
    effect(() => {
      const online = this.network.online();
      untracked(() => {
        if (!this.active()) return;
        if (online) void this.sync();
        else this.status.set('offline');
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  sync(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  }

  async removeEverything(): Promise<boolean> {
    const owner = this.history.owner();
    if (!owner || !this.active()) return false;
    try {
      const [db, sdk] = await Promise.all([firebaseFirestore(), import('firebase/firestore')]);
      const rows = await this.fetchRows(db, sdk, owner);
      for (const chunk of chunkWrites(rows.map(([id]) => ({ id, bytes: 0 })))) {
        const batch = sdk.writeBatch(db);
        for (const { id } of chunk) batch.delete(sdk.doc(db, TABLE, id));
        await batch.commit();
      }
      await this.vault.remove(SYNC, owner);
      this.tomeBytes.set(0);
      this.syncedAt.set(null);
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), SYNC_DELAY_MS);
  }

  private async run(): Promise<void> {
    const owner = this.history.owner();
    if (!owner || !this.active()) return;
    if (!this.network.online()) {
      this.status.set('offline');
      return;
    }
    this.status.set('syncing');
    this.error.set(null);
    try {
      const [db, sdk] = await Promise.all([firebaseFirestore(), import('firebase/firestore')]);
      const [local, state, metaRows] = await Promise.all([
        this.vault.get<VaultTome>(TOMES, owner).catch(() => undefined),
        this.vault.get<VaultSync>(SYNC, owner).catch(() => undefined),
        this.fetchRows(db, sdk, owner, true),
      ]);
      if (this.history.owner() !== owner) return;
      const remote = readMeta(metaRows.map(([, r]) => r));
      const decision = decideSync(local?.savedAt ?? null, state?.syncedAt ?? null, remote?.savedAt ?? null);
      if (remote) this.tomeBytes.set(remote.usage);
      if (decision.action === 'pull') await this.pull(db, sdk, owner, decision.conflict);
      else if (decision.action === 'push' && local) await this.push(db, sdk, owner, local, state, remote?.savedAt ?? null, decision.conflict);
      else this.syncedAt.set(state?.syncedAt ?? remote?.savedAt ?? null);
      if (this.status() === 'syncing') this.status.set('idle');
    } catch (e) {
      this.fail(e);
    }
  }

  private async pull(db: Firestore, sdk: Sdk, owner: string, conflict: boolean): Promise<void> {
    const rows = await this.fetchRows(db, sdk, owner);
    const list = rows.map(([, r]) => r);
    const meta = readMeta(list);
    if (!meta || this.history.owner() !== owner) return;
    const tome = rowsToTome(list);
    const localHashes = hashesOf(tomeToRows(owner, this.history.current(), meta.savedAt));
    const remoteHashes = hashesOf(rows);
    const same = Object.keys(remoteHashes).length === Object.keys(localHashes).length && Object.entries(remoteHashes).every(([id, h]) => localHashes[id] === h);
    if (same) {
      await this.history.markSaved(meta.savedAt);
    } else {
      await this.history.adopt(tome, meta.savedAt, conflict ? 'Took the newer tome from the cloud' : 'Synced from the cloud');
      this.shell.notify('info', conflict ? 'The cloud had a newer tome. Undo brings back the one from this browser.' : 'The tome was updated from the cloud.');
    }
    await this.remember(owner, meta.savedAt, remoteHashes);
    this.tomeBytes.set(meta.usage);
  }

  private async push(
    db: Firestore,
    sdk: Sdk,
    owner: string,
    local: VaultTome,
    state: VaultSync | undefined,
    remoteSavedAt: string | null,
    conflict: boolean,
  ): Promise<void> {
    let rows: Map<string, CloudRow>;
    try {
      rows = tomeToRows(owner, local.tome, local.savedAt);
    } catch (e) {
      if (e instanceof RowTooLargeError) {
        this.status.set('error');
        this.error.set(`${e.message} Make the portrait smaller or remove it to sync.`);
        return;
      }
      throw e;
    }
    const usage = readMeta([rows.get(`${owner}~${META_KIND}`)!])?.usage ?? 0;
    this.pendingBytes.set(usage);
    const quota = this.session.quotaBytes();
    if (quota !== null && usage > quota) {
      this.status.set('over-quota');
      this.error.set('The tome is larger than your cloud storage. It stays saved in this browser.');
      return;
    }
    const previous =
      state && state.syncedAt === remoteSavedAt ? state.hashes : remoteSavedAt ? hashesOf(await this.fetchRows(db, sdk, owner)) : {};
    const plan = planPush(rows, previous);
    const writes = [...plan.deletes.map((id) => ({ id, row: null as CloudRow | null, bytes: 0 })), ...plan.upserts.map(([id, row]) => ({ id, row, bytes: row.bytes }))];
    for (const chunk of chunkWrites(writes)) {
      const batch = sdk.writeBatch(db);
      for (const { id, row } of chunk) {
        const ref = sdk.doc(db, TABLE, id);
        if (row) batch.set(ref, row);
        else batch.delete(ref);
      }
      await batch.commit();
    }
    await this.remember(owner, local.savedAt, hashesOf(rows));
    this.tomeBytes.set(usage);
    if (conflict) this.shell.notify('info', 'This browser had the newer tome, so it replaced the cloud copy.');
  }

  private async fetchRows(db: Firestore, sdk: Sdk, owner: string, metaOnly = false): Promise<[string, CloudRow][]> {
    const table = sdk.collection(db, TABLE);
    const constraints = [sdk.where('owner', '==', owner), ...(metaOnly ? [sdk.where('kind', '==', META_KIND)] : [])];
    const snapshot = await sdk.getDocs(sdk.query(table, ...constraints));
    return snapshot.docs.map((d) => [d.id, d.data() as CloudRow]);
  }

  private async remember(owner: string, syncedAt: string, hashes: Record<string, string>): Promise<void> {
    await this.vault.put(SYNC, { owner, syncedAt, hashes } satisfies VaultSync).catch(() => undefined);
    this.syncedAt.set(syncedAt);
  }

  private fail(e: unknown): void {
    this.status.set(this.network.online() ? 'error' : 'offline');
    this.error.set(cloudErrorMessage(e, 'The cloud sync failed. Your work stays in this browser.'));
  }
}
