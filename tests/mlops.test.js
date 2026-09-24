/**
 * MLOps Lifecycle Test Suite (Phase 9 of the architecture roadmap)
 * Validates eligibility gating, canary-traffic-driven vs. fixed capacity multipliers,
 * LLM-D split-pricing consistency, MIG-override consistency, and the calculateCost()
 * capex/power integration alongside the other Add-on Modules.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateMlops, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { MLOPS_STRATEGIES } from '../src/data/mlops.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getStrategy = (id) => MLOPS_STRATEGIES.find(s => s.id === id);

const canary = getStrategy('canary-release');
const shadow = getStrategy('shadow-deployment');
const blueGreen = getStrategy('blue-green-cutover');

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

function buildLlmdInfra() {
  const model = getModel('llama3-8b');
  const precision = getPrecision('fp8');
  const prefillPlatform = getPlatform('cisco-c885a-b200');
  const decodePlatform = getPlatform('cisco-c885a-h200');
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

const baseMlopsConfig = (infra, overrides = {}) => ({
  enabled: true,
  infraResults: infra,
  mlopsStrategy: canary,
  canaryTrafficPct: 10,
  gpuUnitPriceUsd: 35000,
  ...overrides,
});

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const m = calculateMlops({ enabled: false });
    assert.equal(m.enabled, false);
    assert.equal(m.eligible, false);
  });

  it('is ineligible for training workloads', () => {
    const infra = buildInfra({ workloadType: 'training' });
    const m = calculateMlops(baseMlopsConfig(infra));
    assert.equal(m.eligible, false);
    assert.match(m.reason, /training/i);
  });

  it('is eligible for colocated inference', () => {
    const infra = buildInfra();
    const m = calculateMlops(baseMlopsConfig(infra));
    assert.equal(m.eligible, true);
    assert.equal(m.reason, null);
  });
});

describe('2. Canary Traffic-Driven Capacity', () => {
  it('capacityMultiplier equals canaryTrafficPct / 100 for canary-release', () => {
    const infra = buildInfra();
    const m = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 25 }));
    assert.equal(m.capacityMultiplier, 0.25);
  });

  it('validationGpuCount rounds up from a fractional GPU need, minimum 1', () => {
    const infra = buildInfra({ dp: 16 }); // 16 GPUs
    const m = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 10 })); // 1.6 -> 2
    assert.equal(m.validationGpuCount, 2);

    const mTiny = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 1 })); // 0.16 -> ceil to 1
    assert.equal(mTiny.validationGpuCount, 1);
  });

  it('a higher canary traffic percentage costs strictly more', () => {
    const infra = buildInfra();
    const low = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 5 }));
    const high = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 50 }));
    assert.ok(high.mlopsComputeCapexUsd > low.mlopsComputeCapexUsd);
    assert.ok(high.mlopsItPowerKw > low.mlopsItPowerKw);
  });

  it('capex is exactly baseComputeCapexUsd * capacityMultiplier (fully additive, no -1 subtraction)', () => {
    const infra = buildInfra({ dp: 16 });
    const m = calculateMlops(baseMlopsConfig(infra, { canaryTrafficPct: 10 }));
    assert.equal(m.mlopsComputeCapexUsd, 16 * 35000 * 0.1);
  });
});

describe('3. Shadow Deployment & Blue/Green Cutover (Fixed Full-Scale Multiplier)', () => {
  it('shadow deployment sizes a full duplicate pool (multiplier = 1.0)', () => {
    const infra = buildInfra({ dp: 16 });
    const m = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: shadow }));
    assert.equal(m.capacityMultiplier, 1.0);
    assert.equal(m.validationGpuCount, 16);
    assert.equal(m.mlopsComputeCapexUsd, 16 * 35000);
  });

  it('blue/green cutover costs the same as shadow deployment (both full-scale)', () => {
    const infra = buildInfra();
    const mShadow = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: shadow }));
    const mBlueGreen = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: blueGreen }));
    assert.equal(mShadow.mlopsComputeCapexUsd, mBlueGreen.mlopsComputeCapexUsd);
    assert.equal(mShadow.validationGpuCount, mBlueGreen.validationGpuCount);
  });

  it('a full-scale strategy costs more than a modest canary percentage', () => {
    const infra = buildInfra();
    const mCanary = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: canary, canaryTrafficPct: 10 }));
    const mShadow = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: shadow }));
    assert.ok(mShadow.mlopsComputeCapexUsd > mCanary.mlopsComputeCapexUsd);
  });
});

describe('4. LLM-D Heterogeneous Pricing', () => {
  it('baseComputeCapexUsd matches calculateCost()\'s split prefill/decode pricing, not a blended single price', () => {
    const infra = buildLlmdInfra();
    assert.ok(infra.memory.llmd, 'test setup should produce an LLM-D deployment');
    const prefillPrice = 40000;
    const decodePrice = 35000;

    const cost = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: prefillPrice, cloudRateUsdPerHr: 5,
      decodeGpuUnitPriceUsd: decodePrice, decodeCloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
    });
    const m = calculateMlops({
      enabled: true, infraResults: infra, mlopsStrategy: shadow,
      gpuUnitPriceUsd: prefillPrice, decodeGpuUnitPriceUsd: decodePrice,
    });

    // Shadow is a 1.0x multiplier, so mlops capex should equal cost.computeCapexUsd exactly.
    assert.equal(m.mlopsComputeCapexUsd, cost.computeCapexUsd);
  });

  it('baseGpuCount equals prefill + decode GPUs for an LLM-D deployment', () => {
    const infra = buildLlmdInfra();
    const m = calculateMlops({ enabled: true, infraResults: infra, mlopsStrategy: shadow, gpuUnitPriceUsd: 40000, decodeGpuUnitPriceUsd: 35000 });
    assert.equal(m.baseGpuCount, infra.memory.llmd.prefill.gpus + infra.memory.llmd.decode.gpus);
  });
});

describe('5. MIG Override Consistency', () => {
  it('baseGpuCount uses computeGpuCountOverride when provided', () => {
    const infra = buildInfra();
    const m = calculateMlops(baseMlopsConfig(infra, { computeGpuCountOverride: 4 }));
    assert.equal(m.baseGpuCount, 4);
    assert.equal(m.mlopsComputeCapexUsd, 4 * 35000 * 0.1);
  });
});

describe('6. Cost Integration', () => {
  const buildBaseline = () => {
    const infra = buildInfra();
    return { infra, costNo: calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 }) };
  };

  it('with MLOps disabled (defaults), calculateCost() is unaffected', () => {
    const { costNo } = buildBaseline();
    assert.equal(costNo.mlopsCapexUsd, 0);
  });

  it('MLOps capex adds exactly to totalCapexUsd', () => {
    const { infra, costNo } = buildBaseline();
    const m = calculateMlops(baseMlopsConfig(infra));
    const costWith = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      mlopsComputeCapexUsd: m.mlopsComputeCapexUsd, mlopsItPowerKw: m.mlopsItPowerKw,
    });
    assert.ok(Math.abs((costWith.totalCapexUsd - costNo.totalCapexUsd) - m.mlopsComputeCapexUsd) < 1e-6);
    assert.equal(costWith.mlopsCapexUsd, m.mlopsComputeCapexUsd);
  });

  it('MLOps IT power increases annual power cost', () => {
    const { infra, costNo } = buildBaseline();
    const m = calculateMlops(baseMlopsConfig(infra, { mlopsStrategy: shadow }));
    const costWith = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      mlopsComputeCapexUsd: m.mlopsComputeCapexUsd, mlopsItPowerKw: m.mlopsItPowerKw,
    });
    assert.ok(costWith.annualPowerCostUsd > costNo.annualPowerCostUsd);
  });

  it('RAG, guardrails, ingress, HA/DR, and MLOps capex are all independent and additive together', () => {
    const { infra, costNo } = buildBaseline();
    const m = calculateMlops(baseMlopsConfig(infra));
    const costAll = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: 50000, ragItPowerKw: 5,
      guardrailsComputeCapexUsd: 8500, guardrailsItPowerKw: 0.5,
      ingressComputeCapexUsd: 8000, ingressItPowerKw: 0.5, ingressAnnualOpexUsd: 2000,
      haDrComputeCapexUsd: 100000, haDrItPowerKw: 5,
      mlopsComputeCapexUsd: m.mlopsComputeCapexUsd, mlopsItPowerKw: m.mlopsItPowerKw,
    });
    const expectedTotal = costNo.totalCapexUsd + 50000 + 8500 + 8000 + 100000 + m.mlopsComputeCapexUsd;
    assert.ok(Math.abs(costAll.totalCapexUsd - expectedTotal) < 1e-6);
  });
});

describe('7. Data Catalog Sanity', () => {
  it('every strategy has a valid scope, rollback description, and consistent multiplier semantics', () => {
    for (const s of MLOPS_STRATEGIES) {
      assert.ok(s.scope && s.rollbackSpeed, `${s.id} scope/rollbackSpeed`);
      if (s.id === 'canary-release') {
        assert.equal(s.capacityMultiplier, null, 'canary multiplier is derived, not fixed');
      } else {
        assert.equal(s.capacityMultiplier, 1.0, `${s.id} should be a fixed full-scale multiplier`);
      }
    }
  });
});
