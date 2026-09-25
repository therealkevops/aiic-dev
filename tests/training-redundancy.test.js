/**
 * Training Spare Node Capacity Test Suite.
 * Validates eligibility gating (training-only, the inverse of HA/DR's inference-only scope),
 * spare node/GPU rounding math, and the calculateCost() capex/power integration alongside the
 * other Add-on Modules.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateTrainingRedundancy, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);

function buildTrainingInfra({ tp = 8, pp = 1, dp = 100 } = {}) {
  const model = getModel('llama3-70b');
  const precision = getPrecision('fp16');
  const platform = getPlatform('cisco-c885a-h100'); // 8 GPUs/chassis
  const gpu = getGpu(platform.gpuId);
  return calculateInfra({
    workloadType: 'training',
    trainingType: 'pretrain_sft',
    model, precision,
    contextLength: 4096,
    concurrency: 2,
    gpu, platform,
    tp, pp, dp,
    zeroStage: 3,
    networkProtocol: 'rocev2',
    pue: 1.35,
  });
}

function buildInferenceInfra() {
  const model = getModel('llama3-8b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h100');
  const gpu = getGpu(platform.gpuId);
  return calculateInfra({
    workloadType: 'inference', model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.2, promptTokenRatio: 0.75, contextLength: 8192,
    concurrency: 256, gpu, platform, tp: 1, pp: 1, dp: 16,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: {
      servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'colocated',
      enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
      llmdDisaggregationMode: 'heterogeneous', secondaryPlatform: platform, secondaryGpu: gpu,
      prefillNodes: 1, decodeNodes: 2,
    },
  });
}

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const r = calculateTrainingRedundancy({ enabled: false });
    assert.equal(r.enabled, false);
    assert.equal(r.eligible, false);
  });

  it('is ineligible for inference workloads, pointing to HA/DR instead', () => {
    const infraResults = buildInferenceInfra();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /HA\/DR/);
  });

  it('is eligible for training workloads', () => {
    const infraResults = buildTrainingInfra();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    assert.equal(r.eligible, true);
    assert.equal(r.reason, null);
  });
});

describe('2. Spare Node / GPU Rounding Math', () => {
  it('100-node cluster at 2% -> 2 spare nodes, 16 spare GPUs (8 GPUs/chassis)', () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 100 }); // 800 GPUs / 8 per chassis = 100 nodes
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    assert.equal(r.baseNodes, 100);
    assert.equal(r.gpusPerNode, 8);
    assert.equal(r.spareNodeCount, 2);
    assert.equal(r.spareGpuCount, 16);
  });

  it('rounds to the nearest whole node, not always up or down', () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 100 }); // 100 nodes
    const roundsDown = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 1.4, gpuUnitPriceUsd: 35000 }); // 1.4 -> 1
    const roundsUp = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 1.6, gpuUnitPriceUsd: 35000 }); // 1.6 -> 2
    assert.equal(roundsDown.spareNodeCount, 1);
    assert.equal(roundsUp.spareNodeCount, 2);
  });

  it('0% spare -- still eligible, but zero spare nodes/cost (distinct from disabled)', () => {
    const infraResults = buildTrainingInfra();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 0, gpuUnitPriceUsd: 35000 });
    assert.equal(r.eligible, true);
    assert.equal(r.spareNodeCount, 0);
    assert.equal(r.spareGpuCount, 0);
    assert.equal(r.spareComputeCapexUsd, 0);
    assert.equal(r.spareItPowerKw, 0);
  });

  it('a small cluster below the rounding threshold gets zero spares (matches real practice: no buffer at small scale)', () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 1 }); // 8 GPUs / 8 per chassis = 1 node
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    assert.equal(r.baseNodes, 1);
    assert.equal(r.spareNodeCount, 0);
  });

  it('negative spareNodePct is clamped to 0', () => {
    const infraResults = buildTrainingInfra();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: -5, gpuUnitPriceUsd: 35000 });
    assert.equal(r.spareNodePct, 0);
    assert.equal(r.spareNodeCount, 0);
  });
});

describe('3. Capex & Power Derivation', () => {
  it('spareComputeCapexUsd is exactly spareGpuCount * gpuUnitPriceUsd', () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 100 });
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 40000 });
    assert.equal(r.spareComputeCapexUsd, r.spareGpuCount * 40000);
  });

  it('spareItPowerKw scales linearly with spareNodeCount', () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 100 });
    const one = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 1, gpuUnitPriceUsd: 35000 });
    const two = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    assert.ok(Math.abs(two.spareItPowerKw - (one.spareItPowerKw * 2)) < 1e-6);
  });
});

describe('4. Cost Integration', () => {
  const buildBaseline = () => {
    const infraResults = buildTrainingInfra({ tp: 8, pp: 1, dp: 100 });
    return { infraResults, costNo: calculateCost({ infraResults, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 }) };
  };

  it('with training redundancy disabled (defaults), calculateCost() is unaffected', () => {
    const { costNo } = buildBaseline();
    assert.equal(costNo.trainingRedundancyCapexUsd, 0);
  });

  it('training redundancy capex adds exactly to totalCapexUsd', () => {
    const { infraResults, costNo } = buildBaseline();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    const costWith = calculateCost({
      infraResults, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      trainingRedundancyComputeCapexUsd: r.spareComputeCapexUsd, trainingRedundancyItPowerKw: r.spareItPowerKw,
    });
    assert.ok(Math.abs((costWith.totalCapexUsd - costNo.totalCapexUsd) - r.spareComputeCapexUsd) < 1e-6);
    assert.equal(costWith.trainingRedundancyCapexUsd, r.spareComputeCapexUsd);
  });

  it('training redundancy IT power increases annual power cost', () => {
    const { infraResults, costNo } = buildBaseline();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    const costWith = calculateCost({
      infraResults, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      trainingRedundancyComputeCapexUsd: r.spareComputeCapexUsd, trainingRedundancyItPowerKw: r.spareItPowerKw,
    });
    assert.ok(costWith.annualPowerCostUsd > costNo.annualPowerCostUsd);
  });

  it('is additive alongside other Add-on Modules (RAG/guardrails/ingress/HA-DR/MLOps) without interaction', () => {
    const { infraResults, costNo } = buildBaseline();
    const r = calculateTrainingRedundancy({ enabled: true, infraResults, spareNodePct: 2, gpuUnitPriceUsd: 35000 });
    const costAll = calculateCost({
      infraResults, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: 50000, ragItPowerKw: 5,
      guardrailsComputeCapexUsd: 8500, guardrailsItPowerKw: 0.5,
      haDrComputeCapexUsd: 100000, haDrItPowerKw: 5,
      trainingRedundancyComputeCapexUsd: r.spareComputeCapexUsd, trainingRedundancyItPowerKw: r.spareItPowerKw,
    });
    const expectedTotal = costNo.totalCapexUsd + 50000 + 8500 + 100000 + r.spareComputeCapexUsd;
    assert.ok(Math.abs(costAll.totalCapexUsd - expectedTotal) < 1e-6);
  });
});
