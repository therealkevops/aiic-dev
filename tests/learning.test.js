import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScenario } from '../src/utils/scenario.js';
import { CATALOG } from '../src/learning/catalog.js';
import { CONTROLS, LESSONS, METRICS } from '../src/learning/lessons.js';
import { parseRoute, routeHash } from '../src/state/route.js';

// Every combination of a lesson's control values.
function* combinations(controls, i = 0, acc = {}) {
  if (i === controls.length) { yield { ...acc }; return; }
  for (const o of CONTROLS[controls[i]].options) yield* combinations(controls, i + 1, { ...acc, [controls[i]]: o.value });
}

test('routes round-trip', () => {
  for (const r of [{ page: 'home' }, { page: 'advanced' }, { page: 'guide' }, { page: 'learn', lessonId: null }, { page: 'learn', lessonId: 'kv-cache' }]) {
    const parsed = parseRoute(routeHash(r));
    assert.equal(parsed.page, r.page);
    if (r.page === 'learn') assert.equal(parsed.lessonId, r.lessonId);
  }
  assert.equal(parseRoute('').page, 'home');
  assert.equal(parseRoute('#/nonsense').page, 'home');
});

test('every written lesson is in the catalog, in order', () => {
  const ids = CATALOG.map(l => l.id);
  for (const id of Object.keys(LESSONS)) assert.ok(ids.includes(id), `${id} missing from catalog`);
  CATALOG.forEach((l, i) => assert.equal(l.number, i + 1));
});

for (const [id, lesson] of Object.entries(LESSONS)) {
  test(`lesson ${id}: starting design, controls, metrics and math`, () => {
    const c = lesson.start();
    const s = computeScenario(c);
    assert.equal(s.memory.isOOM, false, 'starting design fits');
    for (const ctl of lesson.controls) {
      assert.ok(CONTROLS[ctl], `unknown control ${ctl}`);
      assert.ok(CONTROLS[ctl].options.some(o => o.value === c[ctl]), `${ctl} starts on one of its options`);
    }
    for (const m of lesson.metrics) {
      assert.ok(METRICS[m], `unknown metric ${m}`);
      assert.ok(Number.isFinite(METRICS[m].value(s, c)), `${m} is a number`);
    }
    for (const step of lesson.steps) for (const h of step.highlight || []) assert.ok(lesson.metrics.includes(h), `${step.title} highlights ${h}, which the lesson does not show`);
    const rows = lesson.math(s, c);
    assert.ok(rows.length > 0 && rows.every(r => r.label && r.value));
  });

  test(`lesson ${id}: every task is solvable with the lesson's controls; predictions are well formed`, () => {
    const base = lesson.start();
    for (const step of lesson.steps) {
      if (step.kind === 'task') {
        let solved = false;
        for (const values of combinations(lesson.controls)) {
          const c = { ...base, ...values };
          if (step.check(c, computeScenario(c))) { solved = true; break; }
        }
        assert.ok(solved, `task "${step.title}" has no solution`);
        assert.ok(step.hint && step.done, `task "${step.title}" needs a hint and a done message`);
      }
      if (step.kind === 'predict') {
        assert.ok(step.answer >= 0 && step.answer < step.options.length, `"${step.title}" answer index`);
        assert.ok(step.explain);
      }
    }
    assert.equal(lesson.steps.at(-1).kind, 'recap');
  });
}

// The numbers the lesson text quotes. If the engine changes and these move, update the lesson.
test('lesson facts: memory', () => {
  const at = (o) => computeScenario({ ...LESSONS.memory.start(), ...o });
  const fp16 = at({});
  assert.ok(Math.abs(fp16.memory.weightTotalGb - 141.2) < 0.2);
  assert.equal(fp16.results.totalGpus, 2);
  assert.ok(Math.abs(fp16.memory.usableGpuCapacityGb - 120.6) < 0.2);
  const fp8 = at({ selectedPrecisionId: 'fp8' });
  assert.ok(Math.abs(fp8.memory.weightTotalGb - 72.7) < 0.2);
  assert.equal(fp8.results.totalGpus, 1);
  const big = at({ selectedModelId: 'llama3-405b', selectedPrecisionId: 'fp8' });
  assert.equal(big.results.totalGpus, 4);
  assert.equal(big.tp, 4);
  assert.equal(at({ selectedModelId: 'llama3-405b' }).results.totalGpus, 8);
  assert.ok(Math.abs(at({ selectedPrecisionId: 'int4' }).memory.weightTotalGb - 40.5) < 0.5);
});

test('lesson facts: KV cache', () => {
  const at = (o) => computeScenario({ ...LESSONS['kv-cache'].start(), ...o });
  const start = at({});
  assert.equal(start.memory.bytesPerTokenSeq, 327680);
  assert.equal(at({ concurrency: 8 }).results.totalGpus, 1);
  assert.equal(at({ concurrency: 8, contextLength: 32768 }).results.totalGpus, 2);
  assert.equal(at({ concurrency: 8, contextLength: 32768 }).dp, 2);
  assert.equal(at({ concurrency: 64, contextLength: 32768 }).results.totalGpus, 8);
  const fp8 = at({ concurrency: 64, contextLength: 32768, kvPrecision: 'fp8' });
  assert.equal(fp8.results.totalGpus, 4);
  assert.equal(fp8.memory.bytesPerTokenSeq, 163840);
});
