// UI integration test: loads every use-case preset in the real app (production build served
// by `vite preview`), visits every configuration tab, and checks that
//   1. nothing throws (page errors / React crashes),
//   2. the header KPIs and every nav-rail summary line match a recorded golden snapshot.
// The golden file catches unintended changes to what the UI shows -- including regressions
// from refactors that don't touch the calculator engine. After an intentional change, run
//   UPDATE_GOLDEN=1 npm run test:ui
// and review the diff of tests/ui/preset-snapshot.json.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { USE_CASE_PRESETS } from '../../src/data/presets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOLDEN = join(ROOT, 'tests', 'ui', 'preset-snapshot.json');
const PORT = 4310 + Math.floor(Math.random() * 500);
const URL = `http://localhost:${PORT}/`;
const UPDATE = process.env.UPDATE_GOLDEN === '1';

let server;
let browser;

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`preview server did not start on ${url}`);
}

before(async () => {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/ not found -- run `npm run build` first (npm run test:ui does this).');
  }
  server = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: 'ignore',
  });
  await waitForServer(URL);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function readState(page) {
  const kpis = {
    gpus: await page.getByTestId('kpi-gpus').innerText(),
    nodes: await page.getByTestId('kpi-nodes').innerText(),
    power: await page.getByTestId('kpi-power').innerText(),
    status: await page.getByTestId('kpi-status').innerText(),
  };
  const nav = await page.$$eval('[data-testid^="nav-"]', els => Object.fromEntries(
    els.map(el => [el.dataset.testid.slice(4), el.querySelector('.truncate')?.textContent ?? ''])
  ));
  // Full results-pane text (reviewable line diff) ...
  const results = (await page.getByTestId('results-pane').innerText()).split('\n').map(l => l.trim()).filter(Boolean);
  return { kpis, nav, results };
}

const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

test('every preset renders every tab and matches the golden snapshot', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });

  const snapshot = {};
  for (const preset of USE_CASE_PRESETS) {
    await page.getByTestId('preset-select').selectOption(preset.id);
    const tabs = await page.$$eval('[data-testid^="nav-"]', els => els.map(el => el.dataset.testid));
    // ... plus a hash of every configuration tab's text, so a refactor that moves tab code
    // around is checked tab by tab without storing thousands of lines.
    const configPaneHashes = {};
    for (const tab of tabs) {
      await page.getByTestId(tab).click();
      assert.equal(errors.length, 0, `${preset.id} / ${tab}: ${errors.join('; ')}`);
      configPaneHashes[tab.slice(4)] = hash(await page.getByTestId('config-pane').innerText());
    }
    await page.getByTestId(tabs[0]).click();
    snapshot[preset.id] = { ...(await readState(page)), configPaneHashes };
  }
  await page.close();

  if (UPDATE || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, JSON.stringify(snapshot, null, 2) + '\n');
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  for (const preset of USE_CASE_PRESETS) {
    assert.deepEqual(snapshot[preset.id], golden[preset.id], `UI output changed for preset ${preset.id}`);
  }
});

test('pin a scenario, compare it with another, and export a report', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByTestId('preset-select').selectOption('ent-rag-assistant');
  await page.getByTestId('pin-scenario').click();
  await page.getByTestId('preset-select').selectOption('ent-agent-sql-analysis');
  const table = page.getByTestId('scenario-compare');
  const text = await table.innerText();
  assert.match(text, /Departmental RAG/i);
  assert.match(text, /SQL Analysis Agent/i);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-report').click()]);
  const path = await download.path();
  const html = readFileSync(path, 'utf8');
  assert.match(html, /AI Infrastructure Sizing Report/);
  assert.match(html, /Comparison with scenario A/);
  assert.match(html, /Bill of materials/);
  assert.equal(errors.length, 0, errors.join('; '));
  await page.close();
});
