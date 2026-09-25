import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, applyPresetConfig } from '../src/state/config.js';
import { computeScenario } from '../src/utils/scenario.js';
import { USE_CASE_PRESETS } from '../src/data/presets.js';
import { demandDriver, scaleDemand, fitPowerBudget, sensitivityAnalysis, growthPlan } from '../src/utils/whatIf.js';

const preset = (id) => applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === id).config);

test('energy: annual energy is facility kW around the clock, carbon follows grid intensity', () => {
  const s = computeScenario(DEFAULT_CONFIG);
  assert.ok(Math.abs(s.energy.annualMwh - s.cost.billedFacilityPowerKw * 8760 / 1000) < 1e-6);
  assert.ok(Math.abs(s.energy.annualTco2 - s.energy.annualMwh * DEFAULT_CONFIG.gridCarbonKgPerKwh) < 1e-6);
  // At 50% utilization the cluster draws power for twice the hours per token it produces.
  const e = s.energy;
  assert.ok(e.kwhPer1MOutputTokensAtUtilization > e.kwhPer1MOutputTokensAtLoad);
  const zero = computeScenario({ ...DEFAULT_CONFIG, gridCarbonKgPerKwh: 0 });
  assert.equal(zero.energy.annualTco2, 0);
});

test('energy: training reports the run energy and emissions', () => {
  const s = computeScenario(preset('neo-frontier-pretrain'));
  assert.ok(s.energy.trainingRunMwh > 0);
  assert.ok(Math.abs(s.energy.trainingRunTco2 - s.energy.trainingRunMwh * 0.37) < 1e-6);
});

test('rent vs buy: reserved applies the discount, scaled-to-use follows utilization', () => {
  const c = { ...DEFAULT_CONFIG, cloudReservedDiscountPct: 40, dutyCyclePct: 25 };
  const s = computeScenario(c);
  const o = Object.fromEntries(s.rentVsBuy.options.map(x => [x.id, x.usd]));
  const nonGpu = s.rentVsBuy.nonGpuUsd;
  assert.equal(o.own, s.cost.tcoUsd);
  assert.ok(Math.abs((o.reserved - nonGpu) - (o['on-demand'] - nonGpu) * 0.6) < 1e-6);
  assert.ok(Math.abs((o.elastic - nonGpu) - (o['on-demand'] - nonGpu) * 0.25) < 1e-6);
  assert.equal(s.rentVsBuy.options.filter(x => x.cheapest).length, 1);
  const training = computeScenario(preset('ent-full-finetune'));
  assert.ok(!training.rentVsBuy.options.some(x => x.id === 'elastic'), 'no scaled-to-use option for a training run');
});

test('cooling and rack power: liquid-only platforms and oversized servers raise advisories', () => {
  const nvl = computeScenario({ ...DEFAULT_CONFIG, selectedVendor: 'nvidia', selectedPlatformId: 'nvidia-gb200-nvl72' });
  assert.ok(nvl.warnings.some(w => w.startsWith('Cooling:')));
  const liquid = computeScenario({ ...DEFAULT_CONFIG, selectedVendor: 'nvidia', selectedPlatformId: 'nvidia-gb200-nvl72', coolingType: 'liquid' });
  assert.ok(!liquid.warnings.some(w => w.startsWith('Cooling:')));
  const tight = computeScenario({ ...DEFAULT_CONFIG, rackPowerKw: 8 });
  assert.ok(tight.warnings.some(w => w.startsWith('Rack power:')));
  // A higher rack limit packs more servers per rack.
  const big = preset('neo-maas-inference');
  assert.ok(computeScenario({ ...big, rackPowerKw: 80 }).facility.totalRacks < computeScenario({ ...big, rackPowerKw: 28 }).facility.totalRacks);
});

test('scaleDemand follows the sizing mode', () => {
  assert.equal(demandDriver(DEFAULT_CONFIG).key, 'concurrency');
  assert.equal(scaleDemand(DEFAULT_CONFIG, 2).concurrency, DEFAULT_CONFIG.concurrency * 2);
  const traffic = { ...DEFAULT_CONFIG, sizingInputMode: 'traffic', trafficInputType: 'rps' };
  assert.equal(scaleDemand(traffic, 3).peakRequestsPerSec, DEFAULT_CONFIG.peakRequestsPerSec * 3);
  assert.equal(demandDriver(preset('ent-full-finetune')).key, 'manualDp');
});

test('power budget: the fitted design fits and a little more demand would not', () => {
  const c = preset('ent-agent-tool-use');
  const budget = 200;
  const fit = fitPowerBudget(c, budget);
  assert.ok(fit.fits);
  assert.ok(fit.best.kw <= budget);
  assert.ok(fit.best.demand > fit.current.demand);
  const beyond = computeScenario(scaleDemand(c, (fit.best.demand * 1.1) / c.concurrency));
  assert.ok(beyond.cost.billedFacilityPowerKw > budget * 0.9, 'the fit should be near the budget, not far below it');
  const none = fitPowerBudget(c, 1);
  assert.equal(none.fits, false);
  assert.equal(fitPowerBudget(c, 0).eligible, false);
});

test('sensitivity: rows sorted by swing, GPU price moves TCO in the right direction', () => {
  const a = sensitivityAnalysis(DEFAULT_CONFIG, 'tco');
  assert.ok(a.eligible);
  for (let i = 1; i < a.rows.length; i++) assert.ok(a.rows[i - 1].swing >= a.rows[i].swing);
  const gpu = a.rows.find(r => r.key === 'gpuUnitPriceUsd');
  assert.ok(gpu.lowValue < a.baseValue && gpu.highValue > a.baseValue);
  assert.ok(!a.rows.some(r => r.key === 'dutyCyclePct'), 'utilization does not change TCO');
  const perToken = sensitivityAnalysis(DEFAULT_CONFIG, 'costPer1M');
  const util = perToken.rows.find(r => r.key === 'dutyCyclePct');
  assert.ok(util.highValue < util.lowValue, 'higher utilization lowers cost per token');
});

test('growth plan: GPUs never shrink, a refresh re-buys the design, totals add up', () => {
  const c = { ...preset('ent-agent-tool-use'), enableGrowthPlan: true, tcoYears: 5, demandGrowthPctPerYear: 50, refreshYear: 4 };
  const g = growthPlan(c);
  assert.ok(g.eligible);
  assert.equal(g.rows.length, 5);
  for (let i = 1; i < g.rows.length; i++) assert.ok(g.rows[i].gpusInstalled >= g.rows[i - 1].gpusInstalled);
  const refresh = g.rows.find(r => r.refresh);
  assert.equal(refresh.year, 4);
  assert.equal(refresh.gpusBought, refresh.gpusInstalled);
  const sum = g.rows.reduce((t, r) => t + r.capexUsd + r.opexUsd, 0);
  assert.ok(Math.abs(sum - g.totalUsd) < 1e-6);
  // With no growth and no refresh, phasing equals buying up front.
  const flat = growthPlan({ ...c, demandGrowthPctPerYear: 0, refreshYear: 0 });
  assert.ok(Math.abs(flat.savingsVsUpfrontUsd) < 1);
  assert.equal(growthPlan(preset('ent-full-finetune')).eligible, false);
});
