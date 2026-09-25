import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScenario } from '../src/utils/scenario.js';
import { CATALOG } from '../src/learning/catalog.js';
import { CONTROLS, LESSONS, METRICS, controlId, controlOptions, controlSet, controlValue } from '../src/learning/lessons.js';
import { parseRoute, routeHash } from '../src/state/route.js';

// Every combination of a lesson's control values.
function* combinations(controls, i = 0, acc = {}) {
  if (i === controls.length) { yield { ...acc }; return; }
  const id = controlId(controls[i]);
  for (const o of controlOptions(controls[i])) yield* combinations(controls, i + 1, { ...acc, ...controlSet(id, o.value) });
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
    for (const entry of lesson.controls) {
      const ctl = controlId(entry);
      assert.ok(CONTROLS[ctl], `unknown control ${ctl}`);
      assert.ok(controlOptions(entry).some(o => o.value === controlValue(ctl, c)), `${ctl} starts on one of its options (${controlValue(ctl, c)})`);
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
      if (step.kind === 'brief') {
        let solved = false;
        for (const values of combinations(lesson.controls)) {
          const c = { ...base, ...values };
          const sc = computeScenario(c);
          if (step.requirements.every(r => r.check(c, sc))) { solved = true; break; }
        }
        assert.ok(solved, `brief "${step.title}" has no solution`);
        const sc0 = computeScenario(base);
        assert.ok(!step.requirements.every(r => r.check(base, sc0)), 'the brief is not already met at the start');
      }
      if (step.kind === 'quiz') {
        assert.ok(step.questions.length >= 10 && step.passPct > 0);
        for (const q of step.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length && q.explain, q.q);
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

const lessonAt = (id, o = {}) => computeScenario({ ...LESSONS[id].start(), ...o });
const near = (actual, expected, tol, label) => assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} vs ${expected}`);
const tp = (v) => CONTROLS.tensorParallel.set(v);

test('lesson facts: sharding', () => {
  const start = lessonAt('sharding');
  assert.equal(start.tp, 4); assert.equal(start.results.totalGpus, 4);
  const tp2 = lessonAt('sharding', tp(2));
  assert.equal(tp2.memory.isOOM, true); assert.ok(tp2.memory.perGpuTotalUsedGb > 220);
  const tp8 = lessonAt('sharding', tp(8));
  near(tp8.memory.perGpuWeightsGb, 51, 1, 'TP8 weights per GPU');
  const c64 = lessonAt('sharding', { concurrency: 64 });
  assert.deepEqual([c64.tp, c64.dp, c64.results.totalGpus], [4, 2, 8]);
  const c128 = lessonAt('sharding', { concurrency: 128 });
  assert.deepEqual([c128.tp, c128.dp, c128.results.totalGpus], [8, 1, 8]);
  const h100 = lessonAt('sharding', { selectedPlatformId: 'cisco-c885a-h100', selectedPrecisionId: 'fp16' });
  assert.deepEqual([h100.tp, h100.pp, h100.results.nodes], [8, 2, 2]);
});

test('lesson facts: speed', () => {
  const one = lessonAt('speed');
  near(Number(one.throughput.tpotMs), 20, 1, 'single-user TPOT'); near(one.throughput.ttftSec, 1.0, 0.05, 'TTFT');
  const c32 = lessonAt('speed', { concurrency: 32 });
  near(Number(c32.throughput.tpotMs), 40, 1.5, 'TPOT at 32'); near(c32.throughput.batchThroughputTps, 810, 20, 'throughput at 32');
  const tp2 = lessonAt('speed', { concurrency: 32, ...tp(2) });
  near(Number(tp2.throughput.tpotMs), 22, 1, 'TP2 TPOT'); near(tp2.throughput.ttftSec, 0.54, 0.03, 'TP2 TTFT');
  const b200 = lessonAt('speed', { concurrency: 32, selectedPlatformId: 'cisco-c885a-b200' });
  near(b200.throughput.ttftSec, 0.44, 0.03, 'B200 TTFT'); near(Number(b200.throughput.tpotMs), 24, 1, 'B200 TPOT');
  const long = lessonAt('speed', { concurrency: 32, selectedPlatformId: 'cisco-c885a-b200', contextLength: 32768 });
  assert.equal(long.results.totalGpus, 2); assert.equal(long.tp, 2);
  near(Number(long.throughput.promptPflops) / Number(b200.throughput.promptPflops), 4.8, 0.3, 'prefill work ratio');
});

test('lesson facts: traffic', () => {
  const s = lessonAt('traffic');
  near(s.traffic.requestsPerSec, 1.39, 0.01, 'rate'); near(s.traffic.serviceTimeSec, 68, 3, 'service time'); near(s.traffic.concurrency, 135, 6, 'in flight');
  near(s.sla.ttftP99Sec, 9, 1.5, 'P99 at 500 users');
  const big = lessonAt('traffic', { peakActiveUsers: 5000 });
  assert.equal(big.results.totalGpus, 24); near(big.traffic.concurrency, 1550, 40, 'in flight at 5000'); assert.ok(big.sla.ttftP99Sec < 0.5);
  const head = lessonAt('traffic', { targetUtilization: 0.5 });
  assert.equal(head.results.totalGpus, 4); assert.equal(head.tp, 2); assert.ok(head.sla.ttftP99Sec < 0.8);
  const busy = lessonAt('traffic', { requestsPerUserPerHour: 60 });
  assert.equal(busy.results.totalGpus, 16); near(busy.traffic.requestsPerSec, 8.33, 0.01, 'busy rate');
});

test('lesson facts: network', () => {
  const s = lessonAt('network');
  assert.deepEqual([s.results.totalGpus, s.network.leafSwitches, s.network.spineSwitches], [32, 1, 0]);
  assert.equal(lessonAt('network', { manualDp: 8 }).network.leafSwitches, 1);
  const n128 = lessonAt('network', { manualDp: 16 }).network;
  assert.deepEqual([n128.leafSwitches, n128.spineSwitches, n128.transceivers], [8, 4, 768]);
  near(n128.effectiveBisectionTbps, 51.2, 0.1, 'bisection');
  const o2 = lessonAt('network', { manualDp: 16, oversubscriptionRatio: 2 }).network;
  assert.deepEqual([o2.spineSwitches, o2.transceivers], [2, 512]);
  near(o2.effectiveBisectionTbps, 25.6, 0.1, 'oversubscribed bisection');
});

test('lesson facts: facility', () => {
  const s = lessonAt('facility');
  near(s.facility.totalItPowerKw, 85, 2, 'IT'); near(s.facility.totalFacilityPowerKw, 115, 2, 'facility');
  assert.deepEqual([s.facility.perRack, s.facility.totalRacks], [2, 5]);
  const r15 = lessonAt('facility', { rackPowerKw: 15 }).facility;
  assert.deepEqual([r15.perRack, r15.totalRacks], [1, 9]);
  const air = lessonAt('facility', { selectedPlatformId: 'cisco-c885a-b200' });
  near(air.facility.totalItPowerKw, 118, 2, 'B200 IT'); assert.deepEqual([air.facility.perRack, air.facility.totalRacks], [1, 9]);
  const liquid = lessonAt('facility', { selectedPlatformId: 'cisco-c885a-b200', ...CONTROLS.coolingType.set('liquid') });
  assert.deepEqual([liquid.facility.perRack, liquid.facility.totalRacks], [5, 3]);
  near(air.facility.totalFacilityPowerKw - liquid.facility.totalFacilityPowerKw, 24, 2, 'facility saving');
  near(air.energy.annualMwh - liquid.energy.annualMwh, 200, 15, 'energy saving');
  near(air.cost.annualPowerCostUsd - liquid.cost.annualPowerCostUsd, 25000, 1500, 'power cost saving');
});

test('lesson facts: training', () => {
  const s = lessonAt('training');
  near(METRICS.trainingState.value(s), 1130, 10, 'training state'); near(s.memory.perGpuTotalUsedGb, 47, 1, 'ZeRO-3');
  near(s.trainingTime.computeDays, 3.9, 0.1, '10B tokens');
  assert.equal(lessonAt('training', { zeroStage: 0 }).memory.isOOM, true);
  assert.equal(lessonAt('training', { zeroStage: 1 }).memory.isOOM, true);
  near(lessonAt('training', { zeroStage: 0 }).memory.perGpuTotalUsedGb, 153, 2, 'ZeRO-0');
  const z2 = lessonAt('training', { zeroStage: 2 });
  assert.equal(z2.memory.isOOM, false); near(z2.memory.perGpuTotalUsedGb, 60, 1, 'ZeRO-2');
  near(lessonAt('training', { trainingTokensB: 100 }).trainingTime.wallClockDays, 39, 0.5, '100B tokens');
  const big = lessonAt('training', { trainingTokensB: 100, manualDp: 16 });
  near(big.trainingTime.wallClockDays, 9.8, 0.2, '128 GPUs'); near(big.trainingTime.jobMtbfHours, 390, 5, 'job MTBF'); near(big.trainingTime.goodputPct, 99, 0.3, 'goodput');
  const lora = lessonAt('training', { trainingTokensB: 100, manualDp: 16, trainingType: 'lora' });
  near(lora.trainingTime.wallClockDays, 6.5, 0.2, 'LoRA days'); assert.ok(METRICS.trainingState.value(lora) < 150);
});

test('lesson facts: cost', () => {
  const s = lessonAt('cost');
  assert.equal(s.results.totalGpus, 8);
  near(s.cost.totalCapexUsd, 392000, 1000, 'capex'); near(s.cost.annualOpexUsd, 112000, 1000, 'opex'); near(s.cost.tcoUsd, 729000, 2000, 'TCO');
  near(s.cost.effectiveUsdPerGpuHour, 3.47, 0.02, '$/GPU-h'); near(s.tokenEconomics.costPer1MOutputTokensUsd, 1.22, 0.03, '$/1M');
  near(lessonAt('cost', { dutyCyclePct: 20 }).tokenEconomics.costPer1MOutputTokensUsd, 3.05, 0.05, '20%');
  near(lessonAt('cost', { dutyCyclePct: 80 }).tokenEconomics.costPer1MOutputTokensUsd, 0.76, 0.03, '80%');
  near(s.cost.tcoUsd - lessonAt('cost', { gpuUnitPriceUsd: 25000 }).cost.tcoUsd, 133000, 2000, 'price cut saving');
  near(s.cost.tcoUsd - lessonAt('cost', { enableNvidiaAiEnterprise: false }).cost.tcoUsd, 108000, 2000, 'licence saving');
  const reserved = (x) => x.rentVsBuy.options.find(o => o.id === 'reserved').usd;
  assert.ok(reserved(s) < s.cost.tcoUsd, 'reserved cloud cheaper over 3 years');
  const five = lessonAt('cost', { tcoYears: 5 });
  assert.ok(five.cost.tcoUsd < reserved(five), 'owning cheaper over 5 years');
  near(five.cost.effectiveUsdPerGpuHour, 2.72, 0.02, '5-year $/GPU-h');
});

test('lesson facts: capstone brief', () => {
  const start = lessonAt('capstone');
  assert.ok(start.cost.totalCapexUsd > 1_500_000, 'the starting design is well over budget');
  const set = (id, v) => CONTROLS[id].set ? CONTROLS[id].set(v) : { [id]: v };
  const b200 = lessonAt('capstone', { ...set('selectedPlatformId', 'cisco-c885a-b200'), selectedPrecisionId: 'fp8', kvPrecision: 'fp8' });
  assert.equal(b200.results.totalGpus, 12); near(b200.cost.totalCapexUsd, 622000, 5000, 'B200 capex');
  const h200 = lessonAt('capstone', { ...set('selectedPlatformId', 'cisco-c885a-h200'), selectedPrecisionId: 'fp8', kvPrecision: 'fp8' });
  assert.equal(h200.results.totalGpus, 16); near(h200.cost.totalCapexUsd, 714000, 5000, 'H200 capex');
  const cheapest = [];
  for (const pl of ['cisco-c885a-h100', 'cisco-c885a-h200', 'cisco-c885a-b200']) for (const pr of ['fp16', 'fp8']) for (const kv of ['fp16', 'fp8']) {
    cheapest.push(lessonAt('capstone', { ...set('selectedPlatformId', pl), selectedPrecisionId: pr, kvPrecision: kv }).cost.totalCapexUsd);
  }
  near(Math.min(...cheapest), 622000, 5000, 'cheapest answer');
});
