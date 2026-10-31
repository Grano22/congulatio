import { existsSync } from 'node:fs';

export const PROJECT_ID = process.env.E2E_PROJECT_ID ?? 'demo-congulatio';
export const EMULATOR_HOST = process.env.E2E_EMULATOR_HOST ?? '127.0.0.1';
export const AUTH_URL = `http://${EMULATOR_HOST}:9099`;
export const FIRESTORE_URL = `http://${EMULATOR_HOST}:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
export const STORAGE_URL = `http://${EMULATOR_HOST}:9199/v0/b/${PROJECT_ID}.firebasestorage.app/o`;
export const API_KEY = 'demo-api-key';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function assertSafeTarget(baseUrl) {
  if (!PROJECT_ID.startsWith('demo-')) {
    throw new Error(`Refusing to run: the project "${PROJECT_ID}" is not a demo- project. End-to-end tests only run against the Firebase emulators.`);
  }
  if (!LOCAL_HOSTS.has(EMULATOR_HOST)) throw new Error(`Refusing to run: emulator host ${EMULATOR_HOST} is not local.`);
  if (baseUrl && !LOCAL_HOSTS.has(new URL(baseUrl).hostname)) throw new Error(`Refusing to run: ${baseUrl} is not a local dev server.`);
}

export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome was not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  return found;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Suite {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  check(label, ok, detail = '') {
    this.results.push({ label, ok: Boolean(ok), detail });
  }

  get failed() {
    return this.results.filter((r) => !r.ok).length;
  }

  print() {
    console.log(`\n${this.name}`);
    for (const r of this.results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? `  (${r.detail})` : ''}`);
  }
}

export async function signUpAnonymous() {
  const res = await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = await res.json();
  if (!body.idToken) throw new Error(`The auth emulator did not sign up a user: ${JSON.stringify(body)}`);
  return { uid: body.localId, token: body.idToken };
}

export async function listRows(owner) {
  const res = await fetch(`${FIRESTORE_URL}:runQuery`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'app_tables' }],
        where: { fieldFilter: { field: { fieldPath: 'owner' }, op: 'EQUAL', value: { stringValue: owner } } },
      },
    }),
  });
  return (await res.json()).filter((r) => r.document).map((r) => r.document);
}
