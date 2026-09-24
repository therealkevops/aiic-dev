/**
 * MIG (Multi-Instance GPU) Consolidation Test Suite (Phase 2 of the architecture roadmap)
 * Validates eligibility gating (workload type, TP/PP, hardware support), profile selection,
 * physical GPU/node consolidation math, and the calculateCost() override integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateMigConsolidation, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { MIG_PROFILES, maxInstancesPerGpu } from '../src/data/mig.js';
import { GPU_PRICING } from '../src/data/pricing.js';

const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);

const baseServingConfig = (platform, gpu) => ({
  servingEngine: 'vllm',
  orchestrator: 'kserve',
  servingArchitecture: 'colocated',
  enableChunkedPrefill: true,
  enablePrefixCaching: true,
  enableSpeculativeDecoding: false,
  llmdDisaggregationMode: 'heterogeneous',
  secondaryPlatform: platform,
  secondaryGpu: gpu,
  prefillNodes: 1,
  decodeNodes: 2,
});

function buildInfra({ modelId = 'llama3-8b', precisionId = 'fp8', platformId, tp, pp, dp, concurrency = 64 }) {
  const model = getModel(modelId);
  const precision = getPrecision(precisionId);
  const platform = getPlatform(platformId);
  const gpu = getGpu(platform.gpuId);
  return calculateInfra({
    workloadType: 'inference', model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.2, promptTokenRatio: 0.7, contextLength: 4096,
    concurrency, gpu, platform, tp, pp, dp,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });
}

describe('1. MIG Profile Catalog', () => {
  it('every profile list is ordered by ascending memory and covers 1g through 7g', () => {
    for (const [gpuId, profiles] of Object.entries(MIG_PROFILES)) {
      assert.equal(profiles.length, 5, `${gpuId} should have the standard 5-tier profile set`);
      const memories = profiles.map(p => p.vramGb);
      assert.deepEqual(memories, [...memories].sort((a, b) => a - b), `${gpuId} profiles should be memory-ascending`);
      assert.equal(profiles[profiles.length - 1].slices, 7, `${gpuId}'s largest profile should be the full 7-slice GPU`);
    }
  });

  it('maxInstancesPerGpu is floor(7 / slices), at least 1', () => {
    assert.equal(maxInstancesPerGpu({ slices: 1 }), 7);
    assert.equal(maxInstancesPerGpu({ slices: 2 }), 3);
    assert.equal(maxInstancesPerGpu({ slices: 3 }), 2);
    assert.equal(maxInstancesPerGpu({ slices: 4 }), 1);
    assert.equal(maxInstancesPerGpu({ slices: 7 }), 1);
  });

  it('L40S and H100 NVL are not MIG-capable (excluded from the catalog)', () => {
    assert.equal(MIG_PROFILES['l40s-pcie'], undefined);
    assert.equal(MIG_PROFILES['h100-nvl'], undefined);
  });

  it('A100/H100/H200/B200 largest profile memory matches each GPU\'s total VRAM', () => {
    assert.equal(MIG_PROFILES['a100-sxm-80gb'].at(-1).vramGb, getGpu('a100-sxm-80gb').vramGb);
    assert.equal(MIG_PROFILES['h100-sxm'].at(-1).vramGb, getGpu('h100-sxm').vramGb);
    assert.equal(MIG_PROFILES['h200-sxm'].at(-1).vramGb, getGpu('h200-sxm').vramGb);
    assert.equal(MIG_PROFILES['b200-sxm'].at(-1).vramGb, getGpu('b200-sxm').vramGb);
  });
});

describe('2. Eligibility Gating', () => {
  it('is disabled when not enabled', () => {
    const infraResults = buildInfra({ platformId: 'cisco-c885a-h100', tp: 1, pp: 1, dp: 16 });
    const gpu = getGpu('h100-sxm');
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: false });
    assert.equal(mig.enabled, false);
    assert.equal(mig.eligible, false);
  });

  it('is ineligible on a non-MIG-capable GPU (L40S)', () => {
    const infraResults = buildInfra({ platformId: 'cisco-c245-l40s', tp: 1, pp: 1, dp: 4, concurrency: 16 });
    const gpu = getGpu('l40s-pcie');
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
    assert.match(mig.reason, /does not support MIG/);
  });

  it('is ineligible when TP > 1 (replica spans multiple GPUs)', () => {
    const infraResults = buildInfra({ platformId: 'cisco-c885a-h100', tp: 2, pp: 1, dp: 8 });
    const gpu = getGpu('h100-sxm');
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
    assert.match(mig.reason, /TP=1 and PP=1/);
  });

  it('is ineligible when PP > 1', () => {
    const infraResults = buildInfra({ platformId: 'cisco-c885a-h100', tp: 1, pp: 2, dp: 4 });
    const gpu = getGpu('h100-sxm');
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
  });

  it('is ineligible for training workloads', () => {
    const model = getModel('llama33-70b');
    const precision = getPrecision('fp16');
    const platform = getPlatform('cisco-c885a-h100');
    const gpu = getGpu(platform.gpuId);
    const infraResults = calculateInfra({
      workloadType: 'training', model, precision, kvPrecision: 'fp16',
      prefixCacheRatio: 0, promptTokenRatio: 0.8, contextLength: 4096,
      concurrency: 4, gpu, platform, tp: 1, pp: 1, dp: 1,
      trainingType: 'lora', zeroStage: 1, networkProtocol: 'rocev2', pue: 1.35,
      servingConfig: baseServingConfig(platform, gpu),
    });
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
    assert.match(mig.reason, /inference workloads/);
  });

  it('is ineligible for LLM-D disaggregated serving', () => {
    const model = getModel('llama3-8b');
    const precision = getPrecision('fp8');
    const platform = getPlatform('cisco-c885a-h100');
    const gpu = getGpu(platform.gpuId);
    const infraResults = calculateInfra({
      workloadType: 'inference', model, precision, kvPrecision: 'fp8',
      prefixCacheRatio: 0.2, promptTokenRatio: 0.7, contextLength: 4096,
      concurrency: 32, gpu, platform, tp: 1, pp: 1, dp: 1,
      trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
      servingConfig: {
        servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'llmd',
        enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
        llmdDisaggregationMode: 'homogeneous', secondaryPlatform: platform, secondaryGpu: gpu,
        prefillNodes: 1, decodeNodes: 1,
      },
    });
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
    assert.match(mig.reason, /LLM-D/);
  });

  it('is ineligible when the replica footprint exceeds even the largest MIG profile', () => {
    // A 70B model at FP16 needs ~140GB+ per replica -- larger than any H100 80GB MIG profile.
    const infraResults = buildInfra({ modelId: 'llama33-70b', precisionId: 'fp16', platformId: 'cisco-c885a-h100', tp: 1, pp: 1, dp: 1, concurrency: 4 });
    const gpu = getGpu('h100-sxm');
    const mig = calculateMigConsolidation({ infraResults, gpu, enabled: true });
    assert.equal(mig.eligible, false);
    assert.match(mig.reason, /needs the whole GPU/);
  });
});

describe('3. Profile Selection & Consolidation Math', () => {
  const infraResults = buildInfra({ platformId: 'cisco-c885a-h100', tp: 1, pp: 1, dp: 16, concurrency: 64 });
  const gpu = getGpu('h100-sxm');
  const platform = getPlatform('cisco-c885a-h100');

  it('auto-selects the smallest fitting profile', () => {
    const mig = calculateMigConsolidation({ infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw, enabled: true });
    assert.equal(mig.eligible, true);
    const usableFactor = 0.90; // VRAM_USABLE_FACTOR, matches CONFIG.gpuMemUtil
    assert.ok(mig.selectedProfile.vramGb * usableFactor >= infraResults.memory.perGpuTotalUsedGb);
    // It should be the smallest such profile, not an oversized one.
    const smallerProfiles = MIG_PROFILES['h100-sxm'].filter(p => p.vramGb < mig.selectedProfile.vramGb);
    for (const p of smallerProfiles) {
      assert.ok(p.vramGb * usableFactor < infraResults.memory.perGpuTotalUsedGb, `${p.id} should NOT have been skipped over ${mig.selectedProfile.id}`);
    }
  });

  it('physicalGpusNeeded = ceil(naiveGpuCount / instancesPerPhysicalGpu)', () => {
    const mig = calculateMigConsolidation({ infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw, enabled: true });
    assert.equal(mig.naiveGpuCount, infraResults.totalGpus);
    assert.equal(mig.physicalGpusNeeded, Math.ceil(mig.naiveGpuCount / mig.instancesPerPhysicalGpu));
    assert.ok(mig.physicalGpusNeeded <= mig.naiveGpuCount);
  });

  it('gpuCountSavings and savingsPct are consistent with the naive vs. consolidated counts', () => {
    const mig = calculateMigConsolidation({ infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw, enabled: true });
    assert.equal(mig.gpuCountSavings, mig.naiveGpuCount - mig.physicalGpusNeeded);
    assert.ok(Math.abs(mig.savingsPct - (mig.gpuCountSavings / mig.naiveGpuCount) * 100) < 1e-9);
  });

  it('respects an explicit profile choice over auto-selection, when it still fits', () => {
    const mig = calculateMigConsolidation({
      infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw,
      enabled: true, migProfileId: '7g.80gb',
    });
    assert.equal(mig.selectedProfile.id, '7g.80gb');
    assert.equal(mig.instancesPerPhysicalGpu, 1); // full GPU -- no consolidation benefit
    assert.equal(mig.physicalGpusNeeded, mig.naiveGpuCount);
  });

  it('throughput scale factor equals slices / 7', () => {
    const mig = calculateMigConsolidation({ infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw, enabled: true });
    assert.ok(Math.abs(mig.throughputScaleFactor - (mig.selectedProfile.slices / 7)) < 1e-9);
  });
});

describe('4. calculateCost() MIG Override Integration', () => {
  const infraResults = buildInfra({ platformId: 'cisco-c885a-h100', tp: 1, pp: 1, dp: 16, concurrency: 64 });
  const gpu = getGpu('h100-sxm');
  const platform = getPlatform('cisco-c885a-h100');
  const pricing = GPU_PRICING[gpu.id];
  const mig = calculateMigConsolidation({ infraResults, gpu, gpusPerChassis: platform.gpusPerChassis, chassisTdpKw: platform.chassisTdpKw, enabled: true });

  it('without the override, cost prices the naive (non-consolidated) GPU count', () => {
    const cost = calculateCost({ infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr });
    assert.equal(cost.computeCapexUsd, infraResults.totalGpus * pricing.estimatedUnitPriceUsd);
  });

  it('with the override, capex reflects the MIG-consolidated physical GPU count', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr,
      computeGpuCountOverride: mig.physicalGpusNeeded, itPowerKwOverride: mig.itPowerKw,
    });
    assert.equal(cost.computeCapexUsd, mig.physicalGpusNeeded * pricing.estimatedUnitPriceUsd);
    assert.ok(cost.computeCapexUsd < infraResults.totalGpus * pricing.estimatedUnitPriceUsd);
  });

  it('the cloud-equivalent comparison rate is unaffected by the MIG override (conservative build-vs-buy)', () => {
    const costNoMig = calculateCost({ infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr });
    const costWithMig = calculateCost({
      infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr,
      computeGpuCountOverride: mig.physicalGpusNeeded, itPowerKwOverride: mig.itPowerKw,
    });
    assert.equal(costNoMig.cloudEquivalentUsdPerHr, costWithMig.cloudEquivalentUsdPerHr);
  });

  it('the IT power override scales annual power cost down accordingly (owned-DC billing)', () => {
    const costNoMig = calculateCost({ infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr, useColo: false });
    const costWithMig = calculateCost({
      infraResults, gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd, cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr,
      computeGpuCountOverride: mig.physicalGpusNeeded, itPowerKwOverride: mig.itPowerKw, useColo: false,
    });
    assert.ok(costWithMig.annualPowerCostUsd < costNoMig.annualPowerCostUsd);
  });
});
