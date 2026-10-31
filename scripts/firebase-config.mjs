import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'public/firebase-config.json');
const envFile = resolve(root, process.env.FIREBASE_ENV_FILE ?? '.env.local');

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const env = { ...readEnvFile(envFile), ...Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k.startsWith('FIREBASE_') && v)) };
const emulators = /^(1|true|yes)$/i.test(env.FIREBASE_EMULATORS ?? '');
const projectId = env.FIREBASE_PROJECT_ID || (emulators ? 'demo-congulatio' : '');

const firebase = {
  apiKey: env.FIREBASE_API_KEY || (emulators ? 'demo-api-key' : ''),
  authDomain: env.FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ''),
  projectId,
  storageBucket: env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : ''),
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.FIREBASE_APP_ID || (emulators ? '1:000000000000:web:demo' : ''),
  measurementId: env.FIREBASE_MEASUREMENT_ID || '',
};

const missing = ['apiKey', 'projectId', 'appId'].filter((key) => !firebase[key]);

if (missing.length) {
  if (existsSync(target) && env.FIREBASE_KEEP_EXISTING !== 'false') {
    console.log(`firebase-config: no Firebase settings found, keeping the existing ${target}`);
  } else {
    rmSync(target, { force: true });
    console.log('firebase-config: no Firebase settings found, the build works on this device only');
  }
  process.exit(0);
}

const config = {
  stage: env.FIREBASE_STAGE || (emulators ? 'emulators' : 'production'),
  firebase: Object.fromEntries(Object.entries(firebase).filter(([, v]) => v)),
  emulators: emulators
    ? {
        host: env.FIREBASE_EMULATOR_HOST || '127.0.0.1',
        authPort: Number(env.FIREBASE_AUTH_EMULATOR_PORT || 9099),
        firestorePort: Number(env.FIREBASE_FIRESTORE_EMULATOR_PORT || 8080),
        storagePort: Number(env.FIREBASE_STORAGE_EMULATOR_PORT || 9199),
      }
    : null,
};

writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
console.log(`firebase-config: wrote the ${config.stage} settings for project ${projectId}${emulators ? ' (emulators)' : ''}`);
