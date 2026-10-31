import { Injectable } from '@angular/core';
import type { ChangesetEntry, TomeSnapshot } from '../domain/tome';

const DB_NAME = 'congulatio';
const DB_VERSION = 2;
export const TOMES = 'tomes';
export const SYNC = 'sync';
export const SETTINGS = 'settings';

export type VaultTome = {
  owner: string;
  savedAt: string;
  tome: TomeSnapshot;
  changeset: ChangesetEntry[];
};

export type VaultSync = {
  owner: string;
  syncedAt: string | null;
  hashes: Record<string, string>;
};

export type VaultSetting<T = unknown> = {
  key: string;
  value: T;
};

type StoreName = typeof TOMES | typeof SYNC | typeof SETTINGS;

const promised = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

@Injectable({ providedIn: 'root' })
export class TomeVault {
  private db?: Promise<IDBDatabase>;

  get available(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  async get<T extends object>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.open();
    return promised<T | undefined>(db.transaction(store, 'readonly').objectStore(store).get(key));
  }

  async put(store: StoreName, value: object): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await this.done(tx);
  }

  async remove(store: StoreName, key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await this.done(tx);
  }

  async setting<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.get<VaultSetting<T>>(SETTINGS, key))?.value;
    } catch {
      return undefined;
    }
  }

  async remember<T>(key: string, value: T | undefined): Promise<void> {
    try {
      if (value === undefined) await this.remove(SETTINGS, key);
      else await this.put(SETTINGS, { key, value } satisfies VaultSetting<T>);
    } catch {
      return;
    }
  }

  async persist(): Promise<boolean> {
    try {
      return (await navigator.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }

  async estimate(): Promise<{ usage: number; quota: number } | null> {
    try {
      const e = await navigator.storage?.estimate?.();
      return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
    } catch {
      return null;
    }
  }

  private done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('The browser database refused the write.'));
    });
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.available) return reject(new Error('This browser has no IndexedDB.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TOMES)) db.createObjectStore(TOMES, { keyPath: 'owner' });
        if (!db.objectStoreNames.contains(SYNC)) db.createObjectStore(SYNC, { keyPath: 'owner' });
        if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Congulatio tabs to upgrade the browser database.'));
    }).catch((e) => {
      this.db = undefined;
      throw e;
    });
    return this.db;
  }
}
