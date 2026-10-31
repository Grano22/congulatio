import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { FIRESTORE_URL, Suite, chromePath, listRows, wait } from './support.mjs';

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
      const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text) && !b.disabled && b.getClientRects().length > 0);
      el?.click();
      return Boolean(el);
    },
    text,
    selector,
  );
  if (!clicked) throw new Error(`No enabled ${selector} reads "${text}"`);
}

async function dismissWelcome(page) {
  const shown = await page
    .waitForFunction(() => [...document.querySelectorAll('dialog[open] .rmodal__title')].some((t) => /welcome|what.s new/i.test(t.textContent)), { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return false;
  await clickText(page, 'Start forging').catch(() => clickText(page, 'Back to the forge'));
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 4000 });
  return true;
}

const MENU = 'app-account-menu .amenu__trigger';

async function openAccountDialog(page) {
  await page.click(MENU);
  await page.waitForSelector('.amenu__panel');
  await clickText(page, 'Account & storage', '[role=menuitem]');
  await page.waitForSelector('dialog[open] .acc__who');
}

const statusText = (page) => page.$eval('.statusbar', (e) => e.innerText.replace(/\s+/g, ' '));
const soulCount = async (page) => Number((await statusText(page)).match(/(\d+) souls/i)?.[1] ?? NaN);
const path = (page) => new URL(page.url()).pathname;

async function openPage(browser, baseUrl, errors, tag) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', (e) => !e.message.includes('E2E burst') && errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('E2E burst') && errors.push(`${tag}: ${m.text()}`));
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

    await step('a visitor lands in the workbench without signing in', async () => {
      await a.waitForSelector(MENU, { timeout: 15000 });
      if (path(a) !== '/') throw new Error(`landed on ${path(a)}`);
      if (!/this device only/i.test(await statusText(a))) throw new Error('the status bar does not say offline');
    });

    await step('a first visit shows the welcome dialog with account benefits and data handling', async () => {
      await a.waitForSelector('dialog[open] .wel__perks', { timeout: 5000 });
      await a.waitForSelector('dialog[open] .wel__privacy');
    });

    await step('the quick tour stays open when started from the welcome dialog', async () => {
      await clickText(a, 'Take the quick tour');
      await wait(500);
      const titles = await a.$$eval('dialog[open] .rmodal__title', (t) => t.map((x) => x.textContent.trim()));
      if (!titles.includes('Quick tour')) throw new Error(`open dialogs: ${titles.join(', ') || 'none'}`);
      await a.keyboard.press('Escape');
      await a.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 4000 });
    });

    await step('the privacy notice opens from the Help menu', async () => {
      await clickText(a, 'Help');
      await clickText(a, 'Privacy', '[role=menuitem]');
      await a.waitForFunction(() => [...document.querySelectorAll('dialog[open] .rmodal__title')].some((t) => /privacy/i.test(t.textContent)), { timeout: 4000 });
      if (!(await a.$eval('dialog[open]', (d) => /GDPR/.test(d.textContent)))) throw new Error('no GDPR wording');
      await a.keyboard.press('Escape');
      await a.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 4000 });
    });

    await step('settings turn autosave off and remember it', async () => {
      await wait(300);
      await press(a, MOD, 'Alt', 'KeyP');
      await a.waitForSelector('dialog[open] .set__toggle input');
      const toggle = await a.$('dialog[open] .set__toggle input');
      if (!(await toggle.evaluate((i) => i.checked))) throw new Error('autosave should start on');
      await toggle.click();
      await a.keyboard.press('Escape');
      await wait(300);
      await a.reload({ waitUntil: 'domcontentloaded' });
      await a.waitForSelector(MENU, { timeout: 15000 });
      await press(a, MOD, 'Alt', 'KeyP');
      await a.waitForSelector('dialog[open] .set__toggle input');
      const after = await a.$eval('dialog[open] .set__toggle input', (i) => i.checked);
      if (after) throw new Error('autosave came back on after a reload');
      await a.click('dialog[open] .set__toggle input');
      await a.keyboard.press('Escape');
      await a.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 4000 });
    });

    await step('the account menu offers sign in without an account', async () => {
      await a.click(MENU);
      await a.waitForSelector('.amenu__panel');
      const items = await a.$$eval('.amenu__panel [role=menuitem]', (b) => b.map((x) => x.textContent.trim()));
      if (!items.some((t) => /sign in/i.test(t)) || items.some((t) => /sign out/i.test(t))) throw new Error(items.join(' | '));
      await a.keyboard.press('Escape');
    });

    let carried = 0;
    await step('offline work is saved in the browser and survives a reload', async () => {
      await press(a, MOD, 'Alt', 'KeyN');
      await wait(600);
      carried = await soulCount(a);
      await press(a, MOD, 'KeyS');
      await wait(800);
      await a.reload({ waitUntil: 'domcontentloaded' });
      await a.waitForSelector(MENU, { timeout: 15000 });
      if (await dismissWelcome(a)) throw new Error('the welcome dialog came back after it was dismissed');
      const after = await soulCount(a);
      if (after !== carried) throw new Error(`expected ${carried} souls after reload, saw ${after}`);
      return `${carried} souls`;
    });

    await step('a visitor opens sign-in from the top bar and enters as a wanderer', async () => {
      await clickText(a, 'Sign in');
      await a.waitForSelector('.login__card', { timeout: 15000 });
      await clickText(a, 'Enter as a wanderer');
      await a.waitForFunction(() => location.pathname === '/' && document.querySelector('app-account-menu .amenu__trigger'), { timeout: 15000 });
    });

    await step('the new wanderer starts with the tome that was open', async () => {
      await a.waitForFunction((n) => new RegExp(`${n} souls`, 'i').test(document.querySelector('.statusbar')?.innerText ?? ''), { timeout: 10000 }, carried);
    });

    let uid = '';
    await step('the carried tome is pushed to Firestore under the wanderer', async () => {
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
      await openAccountDialog(a);
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
      await a.waitForSelector(MENU, { timeout: 15000 });
      if (path(a) !== '/') throw new Error(`reloaded into ${path(a)}`);
      if (/unsaved/i.test(await statusText(a))) throw new Error('the reloaded tome looks unsaved');
      if (/this device only/i.test(await statusText(a))) throw new Error('the reload signed the wanderer out');
    });

    await step('a wanderer links an e-mail and becomes an account', async () => {
      await openAccountDialog(a);
      await a.waitForSelector('.acc__link-form');
      await a.type('.acc__link-form input[type=email]', email);
      await a.type('.acc__link-form input[type=password]', 'secret123');
      await clickText(a, 'Link e-mail');
      await a.waitForFunction(() => document.querySelector('.acc__badge')?.textContent.includes('Account'), { timeout: 15000 });
      await clickText(a, 'Close');
    });

    await step('a burst of errors opens the crash screen with reload and report options', async () => {
      await a.evaluate(() => {
        for (let i = 0; i < 6; i++) window.dispatchEvent(new ErrorEvent('error', { error: new Error('E2E burst of failures'), message: 'E2E burst of failures' }));
      });
      await a.waitForSelector('[role=alertdialog]', { timeout: 5000 });
      const buttons = await a.$$eval('[role=alertdialog] button', (b) => b.map((x) => x.textContent.trim()));
      for (const label of ['Save my work & reload', 'Reload', 'Keep working']) if (!buttons.includes(label)) throw new Error(`missing ${label}: ${buttons.join(' | ')}`);
    });

    await step('a signed-in user reports it only after consenting, without any user id', async () => {
      await clickText(a, 'Report this problem', 'summary');
      const sendDisabled = () => a.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.textContent.trim() === 'Send report')?.disabled);
      if ((await sendDisabled()) !== true) throw new Error('Send report should wait for consent');
      await a.click('[role=alertdialog] .erf__consent input');
      await a.waitForFunction(() => [...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.textContent.trim() === 'Send report')?.disabled === false, { timeout: 3000 }).catch(() => undefined);
      if ((await sendDisabled()) !== false) throw new Error('Send report should be enabled after consent');
      await clickText(a, 'Send report');
      await a.waitForFunction(() => /Thank you/.test(document.querySelector('[role=alertdialog]')?.textContent ?? ''), { timeout: 15000 });
      const res = await fetch(`${FIRESTORE_URL}/error_reports?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
      const docs = ((await res.json()).documents ?? []).filter((d) => d.fields?.message?.stringValue === 'E2E burst of failures');
      if (!docs.length) throw new Error('no report stored');
      const keys = Object.keys(docs.at(-1).fields);
      for (const forbidden of ['uid', 'owner', 'email', 'userId']) if (keys.includes(forbidden)) throw new Error(`report contains ${forbidden}`);
      return `${keys.length} fields`;
    });

    await step('keep working closes the crash screen and the problem stays listed', async () => {
      await clickText(a, 'Keep working');
      await a.waitForFunction(() => !document.querySelector('[role=alertdialog]'), { timeout: 4000 });
      if (!/problem/i.test(await statusText(a))) throw new Error('status bar does not list the problem');
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
      await b.waitForSelector(MENU, { timeout: 15000 });
      await dismissWelcome(b);
      await clickText(b, 'Sign in');
      await b.waitForSelector('.login__card', { timeout: 15000 });
      await b.type('input[name=email]', email);
      await b.type('input[name=password]', 'secret123');
      await clickText(b, 'Sign in');
      await b.waitForSelector(MENU, { timeout: 15000 });
      await b.waitForFunction((n) => new RegExp(`${n} souls`, 'i').test(document.querySelector('.statusbar')?.innerText ?? ''), { timeout: 15000 }, souls);
      if (/unsaved/i.test(await statusText(b))) throw new Error('the pulled tome looks unsaved');
    });

    await step('signing out from the account menu returns to the tome kept in this browser', async () => {
      await b.click(MENU);
      await b.waitForSelector('.amenu__panel');
      await clickText(b, 'Sign out', '[role=menuitem]');
      await wait(600);
      if (await b.$('dialog[open] .acc__who')) await clickText(b, 'Sign out anyway');
      await b.waitForFunction(() => /this device only/i.test(document.querySelector('.statusbar')?.innerText ?? ''), { timeout: 10000 });
      if (path(b) !== '/') throw new Error(`signed out into ${path(b)}`);
    });

    await step('the signed-out browser stays offline after a reload', async () => {
      await b.reload({ waitUntil: 'domcontentloaded' });
      await b.waitForSelector(MENU, { timeout: 10000 });
      if (!/this device only/i.test(await statusText(b))) throw new Error('the status bar does not say offline');
    });

    await step('deleting the account removes its cloud data', async () => {
      if (!(await listRows(uid)).length) throw new Error('expected rows before deleting');
      await openAccountDialog(a);
      await clickText(a, 'Delete account');
      await clickText(a, 'Really delete account?');
      await a.waitForFunction(() => /this device only/i.test(document.querySelector('.statusbar')?.innerText ?? ''), { timeout: 15000 });
      const left = await listRows(uid);
      if (left.length) throw new Error(`${left.length} rows left`);
    });
  } catch {
    return suite;
  } finally {
    suite.check('no page errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
  }
  return suite;
}
