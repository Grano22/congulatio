import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { AUTH_URL, PROJECT_ID, assertSafeTarget, wait } from './support.mjs';
import { rulesSuite } from './rules.e2e.mjs';
import { appSuite } from './app.e2e.mjs';
import { a11ySuite } from './a11y.e2e.mjs';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.E2E_PORT ?? 4300);
const attachedUrl = process.env.E2E_BASE_URL;
const baseUrl = attachedUrl ?? `http://localhost:${port}`;
const only = process.argv.slice(2);
const wants = (suite) => !only.length || only.includes(suite);

assertSafeTarget(baseUrl);

async function waitForUrl(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`${url} did not answer within ${ms / 1000}s`);
}

async function reachable(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

const start = (command, args) => spawn(command, args, { cwd: root, stdio: 'ignore', detached: process.platform !== 'win32' });

function signal(child, name) {
  try {
    if (process.platform === 'win32') child.kill(name);
    else process.kill(-child.pid, name);
  } catch {
    return;
  }
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  signal(child, 'SIGINT');
  const done = await Promise.race([exited.then(() => true), wait(15_000).then(() => false)]);
  if (!done) signal(child, 'SIGKILL');
}

let server;
let emulators;

try {
  if (!(await reachable(AUTH_URL))) {
    console.log('Starting the Firebase emulators…');
    emulators = start('npx', ['-y', 'firebase-tools@15.34.2', 'emulators:start', '--project', PROJECT_ID, '--only', 'auth,firestore,storage']);
    await waitForUrl(AUTH_URL, 180_000);
    await waitForUrl('http://127.0.0.1:8080', 60_000);
    await waitForUrl('http://127.0.0.1:9199', 60_000);
  }
  if (!attachedUrl && (wants('app') || wants('a11y'))) {
    console.log(`Starting the dev server on ${baseUrl} with the emulator settings from e2e/fixtures…`);
    server = start('npx', ['ng', 'serve', '--configuration', 'emulators', '--port', String(port)]);
    await waitForUrl(baseUrl, 180_000);
  }

  const suites = [];
  if (wants('rules')) suites.push(await rulesSuite());
  if (wants('app')) suites.push(await appSuite(baseUrl));
  if (wants('a11y')) suites.push(await a11ySuite(baseUrl));
  for (const suite of suites) suite.print();
  const failed = suites.reduce((n, s) => n + s.failed, 0);
  const total = suites.reduce((n, s) => n + s.results.length, 0);
  console.log(`\n${total - failed} of ${total} checks passed`);
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.error(`\nEnd-to-end run stopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all([stop(server), stop(emulators)]);
}
