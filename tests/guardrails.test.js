/**
 * Guardrails / Safety Classifier Layer Test Suite (Phase 6 of the architecture roadmap)
 * Validates eligibility gating, request-rate derivation from cluster throughput, guard-GPU
 * throughput sizing, per-request latency sizing (input vs. output guard), and the
 * calculateCost() capex/power integration alongside RAG.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateGuardrails, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { GUARDRAIL_MODELS } from '../src/data/guardrails.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getGuardModel = (id) => GUARDRAIL_MODELS.find(m => m.id === id);

const l40s = getGpu('l40s-pcie');
const lg1b = getGuardModel('llama-guard-3-1b');
const lg8b = getGuardModel('llama-guard-3-8b');

function buildInfra({ workloadType = 'inference', concurrency = 256, dp = 16 } = {}) {
  const model = getModel('llama3-8b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h100');
  const gpu = getGpu(platform.gpuId);
  return calculateInfra({
    workloadType, model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.2, promptTokenRatio: 0.75, contextLength: 8192,
    concurrency, gpu, platform, tp: 1, pp: 1, dp,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: {
      servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'colocated',
      enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
      llmdDisaggregationMode: 'heterogeneous', secondaryPlatform: platform, secondaryGpu: gpu,
      prefillNodes: 1, decodeNodes: 2,
    },
  });
}

const baseGuardConfig = (infraResults, overrides = {}) => ({
  enabled: true,
  infraResults,
  guardModel: lg8b,
  guardGpu: l40s,
  guardGpuUnitPriceUsd: 8500,
  ...overrides,
});

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const g = calculateGuardrails({ enabled: false });
    assert.equal(g.enabled, false);
    assert.equal(g.eligible, false);
  });

  it('is ineligible for training workloads', () => {
    const infra = buildInfra({ workloadType: 'training' });
    const g = calculateGuardrails(baseGuardConfig(infra));
    assert.equal(g.eligible, false);
    assert.match(g.reason, /training/i);
  });

  it('is ineligible when both input and output guards are disabled', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra, { enableInputGuard: false, enableOutputGuard: false }));
    assert.equal(g.eligible, false);
    assert.match(g.reason, /input guard or output guard/i);
  });

  it('is eligible for colocated inference with at least one guard enabled', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra));
    assert.equal(g.eligible, true);
    assert.equal(g.reason, null);
  });
});

describe('2. Request Rate Derivation', () => {
  it('requestRatePerSec is derived from cluster throughput, not a hardcoded constant', () => {
    const lowConcurrency = buildInfra({ concurrency: 32, dp: 2 });
    const highConcurrency = buildInfra({ concurrency: 512, dp: 32 });
    const gLow = calculateGuardrails(baseGuardConfig(lowConcurrency));
    const gHigh = calculateGuardrails(baseGuardConfig(highConcurrency));
    assert.ok(gHigh.requestRatePerSec > gLow.requestRatePerSec);
  });
});

describe('3. Guard-GPU Throughput Sizing', () => {
  it('a larger guard model needs more GPUs for the same request rate', () => {
    const infra = buildInfra();
    const g1b = calculateGuardrails(baseGuardConfig(infra, { guardModel: lg1b }));
    const g8b = calculateGuardrails(baseGuardConfig(infra, { guardModel: lg8b }));
    assert.ok(g8b.guardGpusNeeded >= g1b.guardGpusNeeded);
  });

  it('input-only or output-only guard needs fewer or equal GPUs than both enabled', () => {
    const infra = buildInfra();
    const both = calculateGuardrails(baseGuardConfig(infra));
    const inputOnly = calculateGuardrails(baseGuardConfig(infra, { enableOutputGuard: false }));
    const outputOnly = calculateGuardrails(baseGuardConfig(infra, { enableInputGuard: false }));
    assert.ok(inputOnly.guardGpusNeeded <= both.guardGpusNeeded);
    assert.ok(outputOnly.guardGpusNeeded <= both.guardGpusNeeded);
  });

  it('guardGpusNeeded is always at least 1 when eligible', () => {
    const infra = buildInfra({ concurrency: 8, dp: 1 });
    const g = calculateGuardrails(baseGuardConfig(infra, { guardModel: lg1b }));
    assert.ok(g.guardGpusNeeded >= 1);
  });
});

describe('4. Per-Request Latency Sizing', () => {
  it('a larger guard model adds more latency than a smaller one', () => {
    const infra = buildInfra();
    const g1b = calculateGuardrails(baseGuardConfig(infra, { guardModel: lg1b }));
    const g8b = calculateGuardrails(baseGuardConfig(infra, { guardModel: lg8b }));
    assert.ok(g8b.addedTtftSec > g1b.addedTtftSec);
    assert.ok(g8b.addedTotalLatencySec > g1b.addedTotalLatencySec);
  });

  it('addedTtftSec equals inputGuardLatencySec (only the input guard blocks generation start)', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra));
    assert.equal(g.addedTtftSec, g.inputGuardLatencySec);
  });

  it('with only the input guard enabled, addedTotalLatencySec equals addedTtftSec (no output guard tail)', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra, { enableOutputGuard: false }));
    assert.equal(g.outputGuardLatencySec, 0);
    assert.equal(g.addedTotalLatencySec, g.addedTtftSec);
  });

  it('with only the output guard enabled, addedTtftSec is 0 (no input guard latency)', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra, { enableInputGuard: false }));
    assert.equal(g.inputGuardLatencySec, 0);
    assert.equal(g.addedTtftSec, 0);
    assert.ok(g.addedTotalLatencySec > 0);
  });
});

describe('5. Cost & Power Integration', () => {
  it('with guardrails disabled (defaults), calculateCost() is unaffected (guardrailsCapexUsd=0)', () => {
    const infra = buildInfra();
    const cost = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    assert.equal(cost.guardrailsCapexUsd, 0);
  });

  it('guardrails capex adds exactly to totalCapexUsd', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra));
    const costNoGuard = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    const costWithGuard = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      guardrailsComputeCapexUsd: g.guardrailsComputeCapexUsd, guardrailsItPowerKw: g.guardrailsItPowerKw,
    });
    assert.ok(Math.abs((costWithGuard.totalCapexUsd - costNoGuard.totalCapexUsd) - g.guardrailsComputeCapexUsd) < 1e-6);
    assert.equal(costWithGuard.guardrailsCapexUsd, g.guardrailsComputeCapexUsd);
  });

  it('guardrails IT power increases annual power cost', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra));
    const costNoGuard = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    const costWithGuard = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      guardrailsComputeCapexUsd: g.guardrailsComputeCapexUsd, guardrailsItPowerKw: g.guardrailsItPowerKw,
    });
    assert.ok(costWithGuard.annualPowerCostUsd > costNoGuard.annualPowerCostUsd);
  });

  it('RAG and guardrails capex/power are independent and additive when both present', () => {
    const infra = buildInfra();
    const g = calculateGuardrails(baseGuardConfig(infra));
    const costNeither = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    const costBoth = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: 50000, ragItPowerKw: 5,
      guardrailsComputeCapexUsd: g.guardrailsComputeCapexUsd, guardrailsItPowerKw: g.guardrailsItPowerKw,
    });
    const expectedTotal = costNeither.totalCapexUsd + 50000 + g.guardrailsComputeCapexUsd;
    assert.ok(Math.abs(costBoth.totalCapexUsd - expectedTotal) < 1e-6);
  });
});

describe('6. Data Catalog Sanity', () => {
  it('every guardrail model has a verified positive parameter count', () => {
    for (const m of GUARDRAIL_MODELS) {
      assert.ok(m.paramsBillion > 0, `${m.id} paramsBillion`);
      assert.ok(m.name && m.vendor, `${m.id} name/vendor`);
    }
  });
});
