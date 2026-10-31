import type { FirebaseOptions } from 'firebase/app';

export type EmulatorConfig = {
  host: string;
  authPort: number;
  firestorePort: number;
  storagePort: number;
};

export type CloudConfig = {
  stage: string;
  firebase: FirebaseOptions;
  emulators: EmulatorConfig | null;
};

export const CLOUD_CONFIG_URL = 'firebase-config.json';

export const MIB = 1024 * 1024;

export const DEFAULT_QUOTA = {
  anonymous: 2 * MIB,
  account: 50 * MIB,
};

export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_SIDE = 256;

const REQUIRED: (keyof FirebaseOptions)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
const OPTIONAL: (keyof FirebaseOptions)[] = ['storageBucket', 'messagingSenderId', 'measurementId'];

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const port = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

export function parseCloudConfig(value: unknown): CloudConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const source = (typeof raw['firebase'] === 'object' && raw['firebase'] !== null ? raw['firebase'] : {}) as Record<string, unknown>;
  const firebase: FirebaseOptions = {};
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    const v = text(source[key]);
    if (v) firebase[key] = v;
  }
  if (REQUIRED.some((key) => !firebase[key])) return null;
  const emu = raw['emulators'];
  const emulators =
    typeof emu === 'object' && emu !== null
      ? {
          host: text((emu as Record<string, unknown>)['host']) || '127.0.0.1',
          authPort: port((emu as Record<string, unknown>)['authPort'], 9099),
          firestorePort: port((emu as Record<string, unknown>)['firestorePort'], 8080),
          storagePort: port((emu as Record<string, unknown>)['storagePort'], 9199),
        }
      : null;
  return { stage: text(raw['stage']) || 'production', firebase, emulators };
}

let loaded: Promise<CloudConfig | null> | undefined;

export function loadCloudConfig(): Promise<CloudConfig | null> {
  loaded ??= (async () => {
    try {
      const response = await fetch(new URL(CLOUD_CONFIG_URL, document.baseURI), { cache: 'no-cache' });
      if (!response.ok) return null;
      return parseCloudConfig(await response.json());
    } catch {
      return null;
    }
  })();
  return loaded;
}
