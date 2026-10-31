import { createRequire } from 'node:module';
import { Suite, chromePath, wait } from './support.mjs';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const AXE = require.resolve('axe-core/axe.min.js');

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const BLOCKING = new Set(['serious', 'critical']);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function audit(page, include) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(
    async (include, tags) => {
      const result = await window.axe.run(include ? { include: [include] } : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), count: v.nodes.length }));
    },
    include,
    TAGS,
  );
}

async function clickText(page, text, selector = 'button') {
  const ok = await page.evaluate(
    (text, selector) => {
      const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text) && !b.disabled && b.getClientRects().length > 0);
      el?.click();
      return Boolean(el);
    },
    text,
    selector,
  );
  if (!ok) throw new Error(`No ${selector} reads "${text}"`);
}

async function closeDialogs(page) {
  for (let i = 0; i < 3 && (await page.$('dialog[open]')); i++) {
    await page.keyboard.press('Escape');
    await wait(250);
  }
}

export async function a11ySuite(baseUrl) {
  const suite = new Suite('Accessibility (axe-core, WCAG 2.2 AA)');
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
  const findings = new Map();
  const record = (where, violations) => {
    for (const v of violations) {
      const key = v.id;
      const entry = findings.get(key) ?? { ...v, where: new Set(), count: 0 };
      entry.where.add(where);
      entry.count += v.count;
      findings.set(key, entry);
    }
    const blocking = violations.filter((v) => BLOCKING.has(v.impact));
    suite.check(where, blocking.length === 0, blocking.map((v) => `${v.id}×${v.count}`).join(', ') || (violations.length ? `${violations.length} minor` : ''));
  };
  try {
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('dialog[open] .wel__news', { timeout: 20000 });
    await wait(500);
    record('welcome dialog', await audit(page, 'dialog[open]'));
    await clickText(page, 'Start forging');
    await wait(500);

    const tabs = [
      ['Character', 'Digit1'],
      ['Sculptor', 'Digit2'],
      ['Dialogue', 'Digit3'],
      ['Routines', 'Digit4'],
      ['Interactions', 'Digit5'],
      ['Relations', 'Digit6'],
      ['Simulation', 'Digit7'],
    ];
    for (const [name, key] of tabs) {
      await page.keyboard.down('Alt');
      await page.keyboard.press(key);
      await page.keyboard.up('Alt');
      await wait(1200);
      record(`workbench · ${name} tab`, await audit(page));
    }

    await page.click('[data-mode=dnd]');
    await page.waitForSelector('[data-tab=sheet]', { timeout: 4000 });
    await page.click('[data-tab=sheet]');
    await page.waitForSelector('app-dnd-sheet .dnd__abilities li', { timeout: 8000 });
    await wait(600);
    record('D&D view · character sheet', await audit(page));
    for (const theme of ['ebony', 'dragonfire']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await wait(300);
      record(`D&D view · character sheet (${theme} theme)`, await audit(page));
    }
    await page.click('[data-mode=npc-flow]');
    await page.keyboard.down('Alt');
    await page.keyboard.press('Digit1');
    await page.keyboard.up('Alt');
    await wait(900);
    for (const theme of ['ebony', 'dragonfire']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await wait(300);
      record(`workbench · Character tab (${theme} theme)`, await audit(page));
    }
    await page.evaluate(() => (document.documentElement.dataset.theme = 'forge'));
    await wait(300);

    const dialogs = [
      ['account menu', async () => page.click('app-account-menu .amenu__trigger'), 'app-account-menu'],
      ['account dialog', async () => clickText(page, 'Account & storage', '[role=menuitem]'), 'dialog[open]'],
      ['settings dialog', async () => press(page, MOD, 'Alt', 'KeyP'), 'dialog[open]'],
      ['history dialog', async () => press(page, MOD, 'Shift', 'KeyH'), 'dialog[open]'],
      ['quick tour', async () => page.keyboard.press('F1'), 'dialog[open]'],
      ['privacy notice', async () => (await clickText(page, 'Help'), clickText(page, 'Privacy', '[role=menuitem]')), 'dialog[open]'],
      ['problems dialog', async () => (await clickText(page, 'Help'), clickText(page, 'Problems', '[role=menuitem]')), 'dialog[open]'],
      ['about dialog', async () => (await clickText(page, 'Help'), clickText(page, 'About', '[role=menuitem]')), 'dialog[open]'],
    ];
    for (const [name, open, scope] of dialogs) {
      if (name !== 'account dialog') await closeDialogs(page);
      await open();
      await wait(600);
      record(name, await audit(page, scope));
    }
    await closeDialogs(page);

    await page.goto(new URL('login', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.login__card', { timeout: 15000 });
    await wait(400);
    record('sign-in page', await audit(page));
  } catch (e) {
    suite.check('audit finished', false, e.message);
  } finally {
    await browser.close();
  }
  if (findings.size) {
    console.log('\nAccessibility findings by rule:');
    for (const f of [...findings.values()].sort((a, b) => (BLOCKING.has(b.impact) ? 1 : 0) - (BLOCKING.has(a.impact) ? 1 : 0))) {
      console.log(`  [${f.impact}] ${f.id} ×${f.count} — ${f.help}\n      where: ${[...f.where].join('; ')}\n      e.g. ${f.nodes.join(' | ')}`);
    }
  }
  return suite;
}

async function press(page, ...keys) {
  for (const k of keys) await page.keyboard.down(k);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}
