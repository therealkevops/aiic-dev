/**
 * High Availability / Disaster Recovery Test Suite (Phase 8 of the architecture roadmap)
 * Validates eligibility gating, incremental (not absolute) compute/storage multiplier math,
 * MIG-override consistency, and the calculateCost() capex/power integration alongside the
 * other Add-on Modules.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateStorage, calculateHaDr, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { STORAGE_TIERS } from '../src/data/storage.js';
import { HA_DR_TIERS } from '../src/data/hadr.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getStorageTier = (id) => STORAGE_TIERS.find(t => t.id === id);
const getHaDrTier = (id) => HA_DR_TIERS.find(t => t.id === id);

const multiAz = getHaDrTier('multi-az');
const backupRestore = getHaDrTier('backup-restore');
const pilotLight = getHaDrTier('pilot-light');
const warmStandby = getHaDrTier('warm-standby');
const activeActive = getHaDrTier('multi-site-active-active');

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

function buildStorage(infra) {
  return calculateStorage({
    workloadType: 'inference', infraResults: infra,
    storageTier: getStorageTier('vast-universal'), corpusSizeGb: 500,
  });
}

const baseHaDrConfig = (infra, storage, overrides = {}) => ({
  enabled: true,
  infraResults: infra,
  storageResults: storage,
  haDrTier: multiAz,
  gpuUnitPriceUsd: 35000,
  storageUsdPerTbRaw: 20000,
  ...overrides,
});

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const h = calculateHaDr({ enabled: false });
    assert.equal(h.enabled, false);
    assert.equal(h.eligible, false);
  });

  it('is ineligible for training workloads', () => {
    const infra = buildInfra({ workloadType: 'training' });
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage));
    assert.equal(h.eligible, false);
    assert.match(h.reason, /training/i);
  });

  it('is eligible for colocated inference', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage));
    assert.equal(h.eligible, true);
    assert.equal(h.reason, null);
  });
});

describe('2. Incremental (Not Absolute) Multiplier Math', () => {
  it('a tier with computeMultiplier=1.0 has zero incremental compute capex/power', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: backupRestore }));
    assert.equal(backupRestore.computeMultiplier, 1.0);
    assert.equal(h.incrementalComputeCapexUsd, 0);
    assert.equal(h.haDrItPowerKw, 0);
  });

  it('a tier with storageMultiplier=1.0 has zero incremental storage capex', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: multiAz }));
    assert.equal(multiAz.storageMultiplier, 1.0);
    assert.equal(h.incrementalStorageCapexUsd, 0);
  });

  it('a 2x multiplier tier adds exactly 1x the base capex as incremental (2x - 1x = 1x)', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: activeActive }));
    assert.ok(Math.abs(h.incrementalComputeCapexUsd - h.baseComputeCapexUsd) < 1e-6);
    assert.ok(Math.abs(h.incrementalStorageCapexUsd - h.baseStorageCapexUsd) < 1e-6);
  });

  it('multi-site active-active (2x/2x) costs at least as much as every other tier', () => {
    // Active-active has the highest compute AND storage multiplier of the catalog, so its cost
    // must dominate every other tier regardless of the base compute/storage split -- unlike
    // comparisons between two arbitrary tiers (e.g. backup-restore vs. multi-az), whose relative
    // cost depends on how compute-heavy vs. storage-heavy the deployment is.
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const tiers = [backupRestore, multiAz, pilotLight, warmStandby, activeActive];
    const costs = tiers.map(tier => calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: tier })).haDrComputeCapexUsd);
    const maxCost = Math.max(...costs);
    assert.equal(maxCost, costs[4], 'multi-site active-active should be the most expensive tier');
  });

  it('warm-standby costs more than pilot-light (same storage multiplier, higher compute multiplier)', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const hPilot = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: pilotLight }));
    const hWarm = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: warmStandby }));
    assert.equal(pilotLight.storageMultiplier, warmStandby.storageMultiplier);
    assert.ok(warmStandby.computeMultiplier > pilotLight.computeMultiplier);
    assert.ok(hWarm.haDrComputeCapexUsd > hPilot.haDrComputeCapexUsd);
  });
});

describe('3. MIG Override Consistency', () => {
  it('baseGpuCount uses computeGpuCountOverride when provided, matching calculateCost()\'s MIG treatment', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { computeGpuCountOverride: 4 }));
    assert.equal(h.baseGpuCount, 4);
    assert.equal(h.baseComputeCapexUsd, 4 * 35000);
  });

  it('baseGpuCount falls back to infraResults.totalGpus when no override is given', () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const h = calculateHaDr(baseHaDrConfig(infra, storage));
    assert.equal(h.baseGpuCount, infra.totalGpus);
  });
});

describe('4. Cost Integration', () => {
  const buildBaseline = () => {
    const infra = buildInfra();
    const storage = buildStorage(infra);
    const costNoHaDr = calculateCost({ infraResults: infra, storageResults: storage, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 20000 });
    return { infra, storage, costNoHaDr };
  };

  it('with HA/DR disabled (defaults), calculateCost() is unaffected', () => {
    const { costNoHaDr } = buildBaseline();
    assert.equal(costNoHaDr.haDrCapexUsd, 0);
  });

  it('HA/DR capex adds exactly to totalCapexUsd', () => {
    const { infra, storage, costNoHaDr } = buildBaseline();
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: activeActive }));
    const costWithHaDr = calculateCost({
      infraResults: infra, storageResults: storage, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 20000,
      haDrComputeCapexUsd: h.haDrComputeCapexUsd, haDrItPowerKw: h.haDrItPowerKw,
    });
    assert.ok(Math.abs((costWithHaDr.totalCapexUsd - costNoHaDr.totalCapexUsd) - h.haDrComputeCapexUsd) < 1e-6);
    assert.equal(costWithHaDr.haDrCapexUsd, h.haDrComputeCapexUsd);
  });

  it('HA/DR IT power increases annual power cost', () => {
    const { infra, storage, costNoHaDr } = buildBaseline();
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: activeActive }));
    const costWithHaDr = calculateCost({
      infraResults: infra, storageResults: storage, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 20000,
      haDrComputeCapexUsd: h.haDrComputeCapexUsd, haDrItPowerKw: h.haDrItPowerKw,
    });
    assert.ok(costWithHaDr.annualPowerCostUsd > costNoHaDr.annualPowerCostUsd);
  });

  it('RAG, guardrails, ingress, and HA/DR capex are all independent and additive when present together', () => {
    const { infra, storage, costNoHaDr } = buildBaseline();
    const h = calculateHaDr(baseHaDrConfig(infra, storage, { haDrTier: activeActive }));
    const costAll = calculateCost({
      infraResults: infra, storageResults: storage, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 20000,
      ragComputeCapexUsd: 50000, ragItPowerKw: 5,
      guardrailsComputeCapexUsd: 8500, guardrailsItPowerKw: 0.5,
      ingressComputeCapexUsd: 8000, ingressItPowerKw: 0.5, ingressAnnualOpexUsd: 2000,
      haDrComputeCapexUsd: h.haDrComputeCapexUsd, haDrItPowerKw: h.haDrItPowerKw,
    });
    const expectedTotal = costNoHaDr.totalCapexUsd + 50000 + 8500 + 8000 + h.haDrComputeCapexUsd;
    assert.ok(Math.abs(costAll.totalCapexUsd - expectedTotal) < 1e-6);
  });
});

describe('5. Data Catalog Sanity', () => {
  it('every HA/DR tier has valid multipliers >= 1.0 and RTO/RPO descriptions', () => {
    for (const tier of HA_DR_TIERS) {
      assert.ok(tier.computeMultiplier >= 1.0, `${tier.id} computeMultiplier`);
      assert.ok(tier.storageMultiplier >= 1.0, `${tier.id} storageMultiplier`);
      assert.ok(tier.rtoDescription && tier.rpoDescription, `${tier.id} RTO/RPO descriptions`);
    }
  });
});

describe('6. LLM-D Heterogeneous Pricing (regression)', () => {
  // Regression test for a bug found during the Phase 1-8 accuracy audit: calculateHaDr() was
  // pricing ALL GPUs (prefill + decode) at a single blended gpuUnitPriceUsd, even when the
  // deployment is LLM-D heterogeneous (different GPU classes/prices for prefill vs. decode).
  // This understated or overstated the DR replica's base compute capex depending on which pool
  // was pricier, and desynced it from calculateCost()'s own (correctly split-priced) figure.
  function buildLlmdInfra() {
    const model = getModel('llama3-8b');
    const precision = getPrecision('fp8');
    const prefillPlatform = getPlatform('cisco-c885a-b200'); // pricier prefill pool
    const decodePlatform = getPlatform('cisco-c885a-h200');  // cheaper decode pool
    const prefillGpu = getGpu(prefillPlatform.gpuId);
    const decodeGpu = getGpu(decodePlatform.gpuId);
    return calculateInfra({
      workloadType: 'inference', model, precision, kvPrecision: 'fp8',
      prefixCacheRatio: 0.2, promptTokenRatio: 0.5, contextLength: 8192,
      concurrency: 64, gpu: prefillGpu, platform: prefillPlatform, tp: 1, pp: 1, dp: 1,
      trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
      servingConfig: {
        servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'llmd',
        enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
        llmdDisaggregationMode: 'heterogeneous', secondaryPlatform: decodePlatform, secondaryGpu: decodeGpu,
        prefillNodes: 1, decodeNodes: 2,
      },
    });
  }

  it('baseComputeCapexUsd matches calculateCost()\'s split prefill/decode pricing, not a blended single price', () => {
    const infra = buildLlmdInfra();
    assert.ok(infra.memory.llmd, 'test setup should produce an LLM-D deployment');
    const prefillPrice = 40000;
    const decodePrice = 35000;

    const cost = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: prefillPrice, cloudRateUsdPerHr: 5,
      decodeGpuUnitPriceUsd: decodePrice, decodeCloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
    });
    const h = calculateHaDr({
      enabled: true, infraResults: infra, haDrTier: multiAz,
      gpuUnitPriceUsd: prefillPrice, decodeGpuUnitPriceUsd: decodePrice, storageUsdPerTbRaw: 0,
    });

    assert.equal(h.baseComputeCapexUsd, cost.computeCapexUsd);
  });

  it('falls back to gpuUnitPriceUsd for the decode pool when decodeGpuUnitPriceUsd is not given', () => {
    const infra = buildLlmdInfra();
    const h = calculateHaDr({
      enabled: true, infraResults: infra, haDrTier: multiAz,
      gpuUnitPriceUsd: 40000, storageUsdPerTbRaw: 0,
    });
    const expected = infra.totalGpus * 40000;
    assert.equal(h.baseComputeCapexUsd, expected);
  });

  it('baseGpuCount equals prefill + decode GPUs for an LLM-D deployment', () => {
    const infra = buildLlmdInfra();
    const h = calculateHaDr({
      enabled: true, infraResults: infra, haDrTier: multiAz,
      gpuUnitPriceUsd: 40000, decodeGpuUnitPriceUsd: 35000, storageUsdPerTbRaw: 0,
    });
    assert.equal(h.baseGpuCount, infra.memory.llmd.prefill.gpus + infra.memory.llmd.decode.gpus);
    assert.equal(h.baseGpuCount, infra.totalGpus);
  });
});
