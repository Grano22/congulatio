import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { Suite, chromePath, listRows, wait } from './support.mjs';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngFile(width, height) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set([x % 256, y % 256, 128], y * (width * 3 + 1) + 1 + x * 3);
  }
  const file = join(mkdtempSync(join(tmpdir(), 'congulatio-e2e-')), 'avatar.png');
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  return file;
}

async function press(page, ...keys) {
  for (const k of keys) await page.keyboard.down(k);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}

async function clickText(page, text, selector = 'button') {
  const clicked = await page.evaluate(
    (text, selector) => {
      const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text) && !b.disabled);
      el?.click();
      return Boolean(el);
    },
    text,
    selector,
  );
  if (!clicked) throw new Error(`No enabled ${selector} reads "${text}"`);
}

const statusText = (page) => page.$eval('.statusbar', (e) => e.innerText.replace(/\s+/g, ' '));
const soulCount = async (page) => Number((await statusText(page)).match(/(\d+) souls/i)?.[1] ?? NaN);
const path = (page) => new URL(page.url()).pathname;

async function openPage(browser, baseUrl, errors, tag) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  return page;
}

export async function appSuite(baseUrl) {
  const suite = new Suite('App flows');
  const email = `scribe${Date.now()}@example.com`;
  const errors = [];
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
  const step = async (label, fn) => {
    try {
      const detail = await fn();
      suite.check(label, true, detail ?? '');
    } catch (e) {
      suite.check(label, false, e.message);
      throw e;
    }
  };
  try {
    const a = await openPage(browser, baseUrl, errors, 'device A');

    await step('a visitor is sent to the login page', async () => {
      await a.waitForSelector('.login__card', { timeout: 15000 });
      if (path(a) !== '/login') throw new Error(`landed on ${path(a)}`);
    });

    await step('a wanderer enters anonymously', async () => {
      await clickText(a, 'Enter as a wanderer');
      await a.waitForSelector('.topbar__account', { timeout: 15000 });
    });

    let uid = '';
    await step('saving pushes the tome to Firestore under the wanderer', async () => {
      await press(a, MOD, 'KeyS');
      const syncedOwner = () =>
        a.evaluate(
          () =>
            new Promise((resolve) => {
              const open = indexedDB.open('congulatio');
              open.onerror = () => resolve('');
              open.onsuccess = () => {
                const request = open.result.transaction('sync').objectStore('sync').getAll();
                request.onsuccess = () => resolve(String(request.result.find((r) => r.syncedAt)?.owner ?? ''));
                request.onerror = () => resolve('');
              };
            }),
        );
      for (let i = 0; i < 30 && !uid; i++) {
        uid = await syncedOwner();
        if (!uid) await wait(500);
      }
      if (!uid) throw new Error('the browser never recorded a finished sync');
      const rows = await listRows(uid);
      if (!rows.length) throw new Error('no rows found');
      return `${rows.length} rows`;
    });

    await step('the account dialog shows the storage limit', async () => {
      await a.click('.topbar__account');
      await a.waitForSelector('.acc__meter');
      return (await a.$eval('.acc__block .acc__row', (e) => e.textContent.trim())).replace(/\s+/g, ' ');
    });

    await step('an avatar uploads and counts toward the limit', async () => {
      const input = await a.$('.acc__upload input');
      await input.uploadFile(pngFile(320, 240));
      await a.waitForSelector('.acc__avatar img', { timeout: 15000 });
      await a.waitForFunction(() => !/portrait 0 B/.test(document.querySelector('.acc__block')?.textContent ?? ''), { timeout: 5000 });
    });

    await step('the session and tome survive a reload', async () => {
      await clickText(a, 'Close');
      await a.reload({ waitUntil: 'domcontentloaded' });
      await a.waitForSelector('.topbar__account', { timeout: 15000 });
      if (path(a) !== '/') throw new Error(`reloaded into ${path(a)}`);
      if (/unsaved/i.test(await statusText(a))) throw new Error('the reloaded tome looks unsaved');
    });

    await step('a wanderer links an e-mail and becomes an account', async () => {
      await a.click('.topbar__account');
      await a.waitForSelector('.acc__link-form');
      await a.type('.acc__link-form input[type=email]', email);
      await a.type('.acc__link-form input[type=password]', 'secret123');
      await clickText(a, 'Link e-mail');
      await a.waitForFunction(() => document.querySelector('.acc__badge')?.textContent.includes('Account'), { timeout: 15000 });
      await clickText(a, 'Close');
    });

    let souls = 0;
    await step('new souls are saved and synced', async () => {
      const before = await soulCount(a);
      await press(a, MOD, 'Alt', 'KeyN');
      await press(a, MOD, 'Alt', 'KeyN');
      await wait(700);
      souls = await soulCount(a);
      if (souls !== before + 2) throw new Error(`expected ${before + 2} souls, saw ${souls}`);
      await press(a, MOD, 'KeyS');
      await wait(2500);
    });

    const b = await openPage(browser, baseUrl, errors, 'device B');
    await step('a second device signs in and pulls the same tome', async () => {
      await b.waitForSelector('.login__card', { timeout: 15000 });
      await b.type('input[name=email]', email);
      await b.type('input[name=password]', 'secret123');
      await clickText(b, 'Sign in');
      await b.waitForSelector('.topbar__account', { timeout: 15000 });
      await b.waitForFunction((n) => new RegExp(`${n} souls`, 'i').test(document.querySelector('.statusbar')?.innerText ?? ''), { timeout: 15000 }, souls);
      if (/unsaved/i.test(await statusText(b))) throw new Error('the pulled tome looks unsaved');
    });

    await step('signing out returns to the login page', async () => {
      await b.click('.topbar__account');
      await b.waitForSelector('.acc__who');
      await clickText(b, 'Sign out');
      await wait(400);
      if (!(await b.$('.login__card'))) await clickText(b, 'Sign out anyway');
      await b.waitForSelector('.login__card', { timeout: 10000 });
    });

    await step('offline mode works and survives a reload', async () => {
      await clickText(b, 'Work offline on this device');
      await b.waitForSelector('.topbar__account', { timeout: 10000 });
      await b.reload({ waitUntil: 'domcontentloaded' });
      await b.waitForSelector('.topbar__account', { timeout: 10000 });
      if (!/this device only/i.test(await statusText(b))) throw new Error('the status bar does not say offline');
    });
  } catch {
    return suite;
  } finally {
    suite.check('no page errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
  }
  return suite;
}
