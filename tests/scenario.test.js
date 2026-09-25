import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, applyPresetConfig } from '../src/state/config.js';
import { computeScenario } from '../src/utils/scenario.js';
import { USE_CASE_PRESETS } from '../src/data/presets.js';

test('every preset only sets known config fields', () => {
  for (const p of USE_CASE_PRESETS) {
    const unknown = Object.keys(p.config).filter(k => !(k in DEFAULT_CONFIG));
    assert.deepEqual(unknown, [], `${p.id} sets unknown fields: ${unknown.join(', ')}`);
  }
});

test('computeScenario runs for the default config and every preset', () => {
  const configs = [['default', DEFAULT_CONFIG], ...USE_CASE_PRESETS.map(p => [p.id, applyPresetConfig(DEFAULT_CONFIG, p.config)])];
  for (const [id, config] of configs) {
    const s = computeScenario(config);
    assert.ok(s.results.totalGpus > 0, `${id}: no GPUs`);
    assert.ok(Number.isFinite(s.cost.tcoUsd), `${id}: TCO not finite`);
  }
});

test('applyPresetConfig resets fields a preset omits to their fallbacks', () => {
  const dirty = { ...DEFAULT_CONFIG, oversubscriptionRatio: 3, enableMlops: true };
  const legacy = { ...USE_CASE_PRESETS[0].config };
  delete legacy.oversubscriptionRatio;
  delete legacy.enableMlops;
  const next = applyPresetConfig(dirty, legacy);
  assert.equal(next.oversubscriptionRatio, 1);
  assert.equal(next.enableMlops, false);
});

test('computeScenario is pure: same config, same numbers', () => {
  const config = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS[0].config);
  assert.equal(computeScenario(config).cost.tcoUsd, computeScenario({ ...config }).cost.tcoUsd);
});

test('memory sizing never uses more GPUs than the minimum-TP layout', () => {
  for (const p of USE_CASE_PRESETS.filter(p => p.config.workloadType === 'inference')) {
    const s = computeScenario(applyPresetConfig(DEFAULT_CONFIG, p.config));
    if (s.memorySizing) assert.ok(s.results.totalGpus < s.memorySizing.minimalGpus, p.id);
    assert.equal(s.memory.isOOM, false, `${p.id} OOM`);
  }
});

test('latency solver meets reachable targets and reports unreachable ones', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-agent-tool-use').config);
  const s = computeScenario({ ...base, latencyTargetsEnabled: true, targetTtftSec: 3, targetTpotMs: 25 });
  assert.ok(s.latencySolve.met);
  assert.ok(s.throughput.tpotMs <= 25);
  assert.ok(s.sla.ttftBaselineSec <= 3);
  // Guardrails alone add ~1.4s here, so a 0.5s TTFT target cannot be met.
  const u = computeScenario({ ...base, latencyTargetsEnabled: true, targetTtftSec: 0.5, targetTpotMs: 25 });
  assert.equal(u.latencySolve.met, false);
  assert.ok(u.latencySolve.fixedLatencySec > 0.5);
});

test('memory headroom margin keeps free memory on every GPU', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'neo-maas-inference').config);
  const s = computeScenario({ ...base, memoryHeadroomPct: 10 });
  const physicalUsable = s.gpu.vramGb * 0.9;
  assert.ok(s.memory.perGpuTotalUsedGb <= physicalUsable * 0.9 + 1e-9);
});

test('wide expert parallelism spreads experts and removes pipeline stages', () => {
  const base = { ...DEFAULT_CONFIG, selectedModelId: 'kimi-k2', selectedPlatformId: 'cisco-c885a-h200', kvPrecision: 'fp8', contextLength: 32768, concurrency: 2048 };
  const single = computeScenario(base);
  const wide = computeScenario({ ...base, expertParallelNodes: 2 });
  assert.ok(single.pp > 1, 'a 1T model needs PP on one H200 chassis');
  assert.equal(wide.pp, 1);
  assert.equal(wide.results.epNodes, 2);
  assert.ok(wide.memory.perGpuWeightsGb < single.memory.perGpuWeightsGb);
  assert.ok(wide.throughput.t_a2a > 0);
  // Dense models ignore the setting.
  const dense = computeScenario({ ...DEFAULT_CONFIG, expertParallelNodes: 4 });
  assert.equal(dense.results.epNodes, 1);
});

test('reasoning tokens lengthen sequences and slow answers', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-agent-sql-analysis').config);
  const plain = computeScenario(base);
  const thinking = computeScenario({ ...base, reasoningTokensPerOutputToken: 5 });
  assert.equal(thinking.workloadShape.thinkingTokens, thinking.workloadShape.visibleOutputTokens * 5);
  assert.ok(thinking.workloadShape.sequenceTokens > plain.workloadShape.sequenceTokens);
  assert.ok(thinking.results.totalGpus >= plain.results.totalGpus);
  assert.ok(thinking.memory.kvCacheTotalGb * thinking.dp > plain.memory.kvCacheTotalGb * plain.dp);
});

test('a short/long request mix needs no more KV than all-long requests', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-agent-swe').config);
  const allLong = computeScenario(base);
  const mixed = computeScenario({ ...base, requestMixEnabled: true, shortRequestPct: 80, shortRequestTokens: 8192 });
  assert.ok(mixed.workloadShape.avgSequenceTokens < mixed.workloadShape.sequenceTokens);
  assert.ok(mixed.results.totalGpus <= allLong.results.totalGpus);
});

test('offloading idle sessions sizes GPUs for active sessions only', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-agent-swe').config);
  const all = computeScenario({ ...base, enableKvOffload: true, kvActiveSessionPct: 100 });
  const quarter = computeScenario({ ...base, enableKvOffload: true, kvActiveSessionPct: 25 });
  assert.equal(quarter.workloadShape.gpuResidentSessions, Math.ceil(base.concurrency * 0.25));
  assert.ok(quarter.results.totalGpus < all.results.totalGpus);
});

import { scenarioMetrics, compareMetrics } from '../src/utils/compare.js';
import { buildReportHtml } from '../src/utils/report.js';

test('comparison marks the cheaper / faster side and computes deltas', () => {
  const a = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-rag-assistant').config);
  const b = { ...a, concurrency: a.concurrency * 4 };
  const rows = compareMetrics(scenarioMetrics(a, computeScenario(a)), scenarioMetrics(b, computeScenario(b)));
  const gpus = rows.find(r => r.label === 'GPUs');
  assert.equal(gpus.winner, 'a');
  assert.ok(gpus.delta > 0);
  assert.equal(rows.find(r => r.label === 'Model').winner, null);
});

test('report HTML escapes content and includes every section', () => {
  const config = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS[0].config);
  const scenario = computeScenario(config);
  const pinned = { label: 'A <script>', metrics: scenarioMetrics(config, scenario) };
  const html = buildReportHtml({ config, scenario, label: 'B & co', pinned, bomText: '<bom>' });
  for (const section of ['Summary', 'Comparison with scenario A', 'Key assumptions', 'Bill of materials']) assert.ok(html.includes(section), section);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('B &amp; co') && html.includes('&lt;bom&gt;'));
});

test('speculative decoding speeds up low-batch decode and is ignored when it would not help', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-rag-assistant').config);
  const low = computeScenario({ ...base, concurrency: 1, enableSpeculativeDecoding: true, specAcceptanceRate: 0.7, specNumTokens: 4 });
  const sp = low.throughput.speculative;
  assert.ok(Math.abs(sp.expectedTokensPerStep - (1 - 0.7 ** 5) / 0.3) < 1e-9);
  assert.ok(sp.helps && low.throughput.tpotMs < sp.tpotWithoutMs);
  assert.ok(low.memory.draftWeightGb > 0);
  const high = computeScenario({ ...base, concurrency: 256, enableSpeculativeDecoding: true, specAcceptanceRate: 0.5 });
  assert.equal(high.throughput.speculative.helps, false);
  assert.equal(Number(high.throughput.tpotMs), high.throughput.speculative.tpotWithoutMs);
});

test('prefix caching switch and chunked prefill switch change the sizing', () => {
  const base = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-rag-assistant').config);
  const on = computeScenario(base);
  const off = computeScenario({ ...base, enablePrefixCaching: false });
  assert.ok(off.memory.kvCacheTotalGb > on.memory.kvCacheTotalGb);
  const docs = applyPresetConfig(DEFAULT_CONFIG, USE_CASE_PRESETS.find(p => p.id === 'ent-document-analysis').config);
  const chunked = computeScenario(docs);
  const unchunked = computeScenario({ ...docs, enableChunkedPrefill: false });
  assert.ok(unchunked.memory.perGpuActGb > chunked.memory.perGpuActGb);
});
