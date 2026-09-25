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
