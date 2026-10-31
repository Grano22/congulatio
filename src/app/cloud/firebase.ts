import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { CloudConfig, loadCloudConfig } from './firebaseConfig';

type Loaded = { app: FirebaseApp; config: CloudConfig };

let app: Promise<Loaded> | undefined;
let auth: Promise<Auth> | undefined;
let firestore: Promise<Firestore> | undefined;
let storage: Promise<FirebaseStorage> | undefined;

const once = <T>(load: () => Promise<T>, reset: () => void): Promise<T> =>
  load().catch((e) => {
    reset();
    throw e;
  });

function firebaseApp(): Promise<Loaded> {
  app ??= once(
    async () => {
      const config = await loadCloudConfig();
      if (!config) throw new Error('The cloud is not configured.');
      return { app: (await import('firebase/app')).initializeApp(config.firebase), config };
    },
    () => (app = undefined),
  );
  return app;
}

export function firebaseAuth(): Promise<Auth> {
  auth ??= once(
    async () => {
      const [{ app: instance, config }, sdk] = await Promise.all([firebaseApp(), import('firebase/auth')]);
      const result = sdk.initializeAuth(instance, {
        persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence],
        popupRedirectResolver: sdk.browserPopupRedirectResolver,
      });
      if (config.emulators) {
        sdk.connectAuthEmulator(result, `http://${config.emulators.host}:${config.emulators.authPort}`, { disableWarnings: true });
      }
      return result;
    },
    () => (auth = undefined),
  );
  return auth;
}

export function firebaseFirestore(): Promise<Firestore> {
  firestore ??= once(
    async () => {
      const [{ app: instance, config }, sdk] = await Promise.all([firebaseApp(), import('firebase/firestore')]);
      const result = sdk.initializeFirestore(instance, { localCache: sdk.memoryLocalCache(), ignoreUndefinedProperties: true });
      if (config.emulators) sdk.connectFirestoreEmulator(result, config.emulators.host, config.emulators.firestorePort);
      return result;
    },
    () => (firestore = undefined),
  );
  return firestore;
}

export function firebaseStorage(): Promise<FirebaseStorage> {
  storage ??= once(
    async () => {
      const [{ app: instance, config }, sdk] = await Promise.all([firebaseApp(), import('firebase/storage')]);
      const result = sdk.getStorage(instance);
      if (config.emulators) sdk.connectStorageEmulator(result, config.emulators.host, config.emulators.storagePort);
      return result;
    },
    () => (storage = undefined),
  );
  return storage;
}
