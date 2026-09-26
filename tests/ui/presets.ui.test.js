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
import { LESSONS } from '../../src/learning/lessons.js';

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
    els.map(el => [el.dataset.testid.slice(4), el.querySelector('[data-nav-meta]')?.textContent ?? ''])
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
  await page.goto(`${URL}#/advanced`, { waitUntil: 'networkidle' });

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
  await page.goto(`${URL}#/advanced`, { waitUntil: 'networkidle' });
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

test('guided setup recommends a design and applies it', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${URL}#/advanced`, { waitUntil: 'networkidle' });
  await page.getByTestId('guided-setup').click();
  const dialog = page.getByTestId('guided-setup-dialog');
  await dialog.getByRole('button', { name: /^AI agents/ }).click();
  await dialog.getByRole('button', { name: /^Long/ }).click();
  const recommendation = await page.getByTestId('guided-recommendation').innerText();
  assert.match(recommendation, /GPUs/);
  const gpus = Number(recommendation.match(/([\d,]+) GPUs/)[1].replace(/,/g, ''));
  await page.getByTestId('guided-apply').click();
  assert.equal(await page.getByTestId('guided-setup-dialog').count(), 0, 'dialog closes after applying');
  assert.equal(Number((await page.getByTestId('kpi-gpus').innerText()).replace(/,/g, '')), gpus);
  assert.equal(await page.getByTestId('preset-select').inputValue(), '');
  assert.equal(errors.length, 0, errors.join('; '));
  await page.close();
});

test('home page on first visit, then the last-used mode', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  assert.equal(await page.getByTestId('mode-card-learn').count(), 1, 'first visit shows the home page');
  await page.getByTestId('open-advanced').click();
  assert.match(page.url(), /#\/advanced$/);
  assert.equal(await page.getByTestId('kpi-gpus').count(), 1);
  // A later visit to the root opens the last-used mode.
  await page.goto(URL, { waitUntil: 'networkidle' });
  assert.equal(await page.getByTestId('kpi-gpus').count(), 1, 'remembered mode skips the home page');
  // Switch to Learning from the header; the product name returns home.
  await page.getByTestId('mode-learn').click();
  assert.match(page.url(), /#\/learn$/);
  assert.equal(await page.getByTestId('lesson-list').count(), 1);
  await page.getByTestId('go-home').click();
  assert.equal(await page.getByTestId('mode-card-advanced').count(), 1);
  assert.equal(errors.length, 0, errors.join('; '));
  await context.close();
});

test('learning: complete lesson 1 and open the design in Advanced mode', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByTestId('start-learning').click();
  await page.getByTestId('lesson-memory').click();
  const next = page.getByTestId('next-step');
  const control = (id, v) => page.getByTestId(`control-${id}-${v}`).click();

  await next.click();                                   // read
  await page.getByTestId('predict-option-2').click();   // ~141 GB
  await next.click();
  await next.click();                                   // read
  assert.equal(await next.isDisabled(), true, 'a task blocks Next until it is done');
  await control('selectedPrecisionId', 'fp8');
  assert.equal(await page.getByTestId('metric-gpus').innerText().then(t => t.includes('1')), true);
  await next.click();
  await page.getByTestId('predict-option-1').click();   // ~405 GB
  await next.click();
  await control('selectedModelId', 'llama3-405b');
  assert.match(await page.getByTestId('metric-gpus').innerText(), /\b4\b/);
  await next.click();
  await control('selectedModelId', 'llama33-70b');
  await control('selectedPrecisionId', 'int4');
  await next.click();
  await page.getByTestId('finish-lesson').click();
  assert.equal(await page.getByTestId('lesson-complete').count(), 1);

  await page.getByTestId('open-in-advanced').click();
  assert.match(page.url(), /#\/advanced$/);
  assert.equal(await page.getByTestId('kpi-gpus').innerText(), '1');

  // Progress shows on the home page and the next lesson is offered.
  await page.getByTestId('go-home').click();
  assert.match(await page.getByTestId('start-learning').innerText(), /Resume: lesson 2/);
  assert.equal(errors.length, 0, errors.join('; '));
  await context.close();
});

test('learning: capstone brief and scored quiz', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${URL}#/learn/capstone`, { waitUntil: 'networkidle' });
  const next = page.getByTestId('next-step');
  await next.click();
  assert.equal(await next.isDisabled(), true, 'the brief blocks Next until met');
  assert.equal(await page.getByTestId('brief-met').count(), 0);
  await page.getByTestId('control-selectedPlatformId-cisco-c885a-h200').click();
  await page.getByTestId('control-selectedPrecisionId-fp8').click();
  await page.getByTestId('control-kvPrecision-fp8').click();
  assert.equal(await page.getByTestId('brief-met').count(), 1);
  await next.click();

  const quiz = LESSONS.capstone.steps.find(s => s.kind === 'quiz');
  // Two wrong answers, the rest right: 10/12 = 83%, a pass.
  for (const [i, q] of quiz.questions.entries()) {
    const pick = i < 2 ? (q.answer + 1) % q.options.length : q.answer;
    await page.getByTestId(`quiz-${i}-${pick}`).click();
  }
  await page.getByTestId('quiz-submit').click();
  assert.match(await page.getByTestId('quiz-score').innerText(), /10 of 12 \(83%\)[\s\S]*Passed/);
  await next.click();
  await page.getByTestId('finish-lesson').click();
  await page.getByTestId('all-lessons').click();
  assert.match(await page.getByTestId('lesson-list').innerText(), /Best quiz score: 83%/);
  assert.equal(errors.length, 0, errors.join('; '));
  await context.close();
});

// Any visible element reaching past the viewport edge, outside a deliberate horizontal scroller.
function overflowAudit() {
  const vw = document.documentElement.clientWidth;
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) out.push(`${el.tagName} ${String(el.className).slice(0, 50)}`);
  }
  return out.slice(0, 5);
}

const ADVANCED_TABS = ['workload', 'platform', 'sharding', 'network', 'facility', 'storage', 'rag', 'stack', 'guardrails', 'ingress', 'hadr', 'mlops', 'mig', 'sla', 'cost', 'planning'];

for (const width of [360, 768, 1024, 1280]) {
  test(`responsive: every calculator section fits a ${width}px-wide screen`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${URL}#/advanced`, { waitUntil: 'networkidle' });
    const narrow = width < 1024;
    const problems = {};
    for (const tab of ADVANCED_TABS) {
      if (narrow) await page.getByTestId('open-sections').click();
      await page.getByTestId(`nav-${tab}`).click();
      const found = await page.evaluate(overflowAudit);
      if (found.length) problems[tab] = found;
    }
    if (narrow) await page.getByTestId('pane-results').click();
    const results = await page.evaluate(overflowAudit);
    if (results.length) problems.results = results;
    assert.deepEqual(problems, {}, `content past the screen edge at ${width}px`);
    assert.equal(errors.length, 0, errors.join('; '));
    await context.close();
  });
}

test('responsive: phone journey through the calculator', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${URL}#/advanced`, { waitUntil: 'networkidle' });
  // Header actions live in the "more" menu on a phone.
  await page.getByTestId('header-menu').click();
  await page.getByTestId('menu-preset-select').selectOption('ent-agent-tool-use');
  await page.keyboard.press('Escape');
  await page.getByTestId('open-sections').click();
  await page.getByTestId('nav-sharding').click();
  assert.match(await page.getByTestId('config-pane').innerText(), /Sharding/);
  // The summary bar switches to results and back.
  await page.getByTestId('summary-bar').click();
  assert.equal(await page.getByTestId('results-pane').count(), 1);
  assert.equal(await page.getByTestId('config-pane').count(), 0);
  assert.match(await page.getByTestId('sizing-status').innerText(), /Fits/);
  await page.getByTestId('summary-bar').click();
  assert.equal(await page.getByTestId('config-pane').count(), 1);
  // Report download from the menu.
  await page.getByTestId('header-menu').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export-report').click()]);
  assert.match(readFileSync(await download.path(), 'utf8'), /AI Infrastructure Sizing Report/);
  // Guided setup opens full screen and applies.
  await page.getByTestId('header-menu').click();
  await page.getByTestId('menu-guided-setup').click();
  await page.getByTestId('guided-apply').click();
  assert.equal(await page.getByTestId('guided-setup-dialog').count(), 0);
  assert.equal(errors.length, 0, errors.join('; '));
  await context.close();
});
