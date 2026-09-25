/**
 * Cost & TCO Test Suite (Phase 1 of the architecture roadmap)
 * Validates capex/opex composition, heterogeneous LLM-D blended pricing, colo vs. owned-DC
 * power billing, and the build-vs-buy cloud comparison (including break-even edge cases).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateStorage, calculateCost, calculateTokenEconomics } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { STORAGE_TIERS } from '../src/data/storage.js';
import { GPU_PRICING, NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR } from '../src/data/pricing.js';

const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getTier = (id) => STORAGE_TIERS.find(t => t.id === id);

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

describe('1. Pricing Reference Data', () => {
  it('every GPU catalog entry has a pricing entry', () => {
    for (const gpu of GPU_CATALOG) {
      assert.ok(GPU_PRICING[gpu.id], `missing pricing for ${gpu.id}`);
      assert.ok(GPU_PRICING[gpu.id].estimatedUnitPriceUsd > 0);
      assert.ok(GPU_PRICING[gpu.id].estimatedCloudRateUsdPerHr > 0);
    }
  });

  it('every storage tier has a $/TB estimate', () => {
    for (const tier of STORAGE_TIERS) {
      assert.ok(tier.estimatedUsdPerTbRaw > 0, `missing pricing for ${tier.id}`);
    }
  });
});

describe('2. Capex & Opex Composition', () => {
  const model = getModel('llama33-70b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h200');
  const gpu = getGpu(platform.gpuId);

  const infraResults = calculateInfra({
    workloadType: 'inference', model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.4, promptTokenRatio: 0.8, contextLength: 8192,
    concurrency: 32, gpu, platform, tp: 8, pp: 1, dp: 1,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });
  const tier = getTier('vast-universal');
  const storageResults = calculateStorage({
    workloadType: 'inference', infraResults, storageTier: tier,
    modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, corpusSizeGb: 2000, enableKvOffload: false,
  });
  const gpuPricing = GPU_PRICING[gpu.id];

  const cost = calculateCost({
    infraResults, storageResults,
    gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
    cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
    networkHardwareAdderPct: 15,
    storageUsdPerTbRaw: tier.estimatedUsdPerTbRaw,
    powerUsdPerKwh: 0.12,
    useColo: false,
    enableNvidiaAiEnterprise: true,
    licensingUsdPerGpuPerYear: NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR,
    supportPctPerYear: 15,
    tcoYears: 3,
  });

  it('compute capex equals GPU count x unit price', () => {
    assert.equal(cost.computeCapexUsd, infraResults.totalGpus * gpuPricing.estimatedUnitPriceUsd);
  });

  it('network hardware capex is the configured % of compute capex', () => {
    assert.equal(cost.networkHardwareCapexUsd, cost.computeCapexUsd * 0.15);
  });

  it('storage capex equals achieved (provisioned) capacity x $/TB', () => {
    assert.equal(cost.storageCapexUsd, storageResults.achievedCapacityTb * tier.estimatedUsdPerTbRaw);
  });

  it('total capex is the sum of its three components', () => {
    assert.equal(cost.totalCapexUsd, cost.computeCapexUsd + cost.networkHardwareCapexUsd + cost.storageCapexUsd);
  });

  it('annual opex is the sum of power, licensing, and support', () => {
    assert.equal(cost.annualOpexUsd, cost.annualPowerCostUsd + cost.annualLicensingCostUsd + cost.annualSupportCostUsd);
  });

  it('licensing cost is zero when NVIDIA AI Enterprise is disabled', () => {
    const noLicense = calculateCost({
      infraResults, storageResults,
      gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
      storageUsdPerTbRaw: tier.estimatedUsdPerTbRaw,
      enableNvidiaAiEnterprise: false,
    });
    assert.equal(noLicense.annualLicensingCostUsd, 0);
  });

  it('TCO equals capex plus opex compounded over the configured horizon (simple, non-discounted)', () => {
    assert.equal(cost.tcoUsd, cost.totalCapexUsd + (cost.annualOpexUsd * cost.tcoYears));
  });

  it('effective $/GPU-hour is TCO divided by total GPU-hours over the horizon', () => {
    const totalGpuHours = infraResults.totalGpus * 24 * 365 * cost.tcoYears;
    assert.ok(Math.abs(cost.effectiveUsdPerGpuHour - (cost.tcoUsd / totalGpuHours)) < 1e-9);
  });
});

describe('3. Heterogeneous LLM-D Blended Pricing', () => {
  it('blends capex and cloud-equivalent rate across distinct prefill/decode GPU pools', () => {
    const model = getModel('llama3-405b');
    const precision = getPrecision('fp8');
    const prefillPlatform = getPlatform('nvidia-hgx-b200');
    const decodePlatform = getPlatform('nvidia-hgx-h200');
    const prefillGpu = getGpu(prefillPlatform.gpuId);
    const decodeGpu = getGpu(decodePlatform.gpuId);

    const infraResults = calculateInfra({
      workloadType: 'inference', model, precision, kvPrecision: 'fp8',
      prefixCacheRatio: 0.2, promptTokenRatio: 0.7, contextLength: 32768,
      concurrency: 1024, gpu: prefillGpu, platform: prefillPlatform, tp: 8, pp: 1, dp: 1,
      trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.2,
      servingConfig: {
        servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'llmd',
        enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
        llmdDisaggregationMode: 'heterogeneous', secondaryPlatform: decodePlatform, secondaryGpu: decodeGpu,
        prefillNodes: 2, decodeNodes: 8,
      },
    });

    const prefillPricing = GPU_PRICING[prefillGpu.id];
    const decodePricing = GPU_PRICING[decodeGpu.id];
    const cost = calculateCost({
      infraResults, storageResults: null,
      gpuUnitPriceUsd: prefillPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: prefillPricing.estimatedCloudRateUsdPerHr,
      decodeGpuUnitPriceUsd: decodePricing.estimatedUnitPriceUsd,
      decodeCloudRateUsdPerHr: decodePricing.estimatedCloudRateUsdPerHr,
    });

    const prefillGpuCount = infraResults.memory.llmd.prefill.gpus;
    const decodeGpuCount = infraResults.memory.llmd.decode.gpus;
    const expectedCapex = (prefillGpuCount * prefillPricing.estimatedUnitPriceUsd)
      + (decodeGpuCount * decodePricing.estimatedUnitPriceUsd);
    const expectedCloudRate = (prefillGpuCount * prefillPricing.estimatedCloudRateUsdPerHr)
      + (decodeGpuCount * decodePricing.estimatedCloudRateUsdPerHr);

    assert.equal(cost.computeCapexUsd, expectedCapex);
    assert.equal(cost.cloudEquivalentUsdPerHr, expectedCloudRate);
  });

  it('falls back to the primary pool price for decode when no decode override is given', () => {
    const model = getModel('llama3-405b');
    const precision = getPrecision('fp8');
    const platform = getPlatform('nvidia-hgx-b200');
    const gpu = getGpu(platform.gpuId);

    const infraResults = calculateInfra({
      workloadType: 'inference', model, precision, kvPrecision: 'fp8',
      prefixCacheRatio: 0.2, promptTokenRatio: 0.7, contextLength: 32768,
      concurrency: 1024, gpu, platform, tp: 8, pp: 1, dp: 1,
      trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.2,
      servingConfig: {
        servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'llmd',
        enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
        llmdDisaggregationMode: 'homogeneous', secondaryPlatform: platform, secondaryGpu: gpu,
        prefillNodes: 2, decodeNodes: 8,
      },
    });

    const pricing = GPU_PRICING[gpu.id];
    const cost = calculateCost({
      infraResults, storageResults: null,
      gpuUnitPriceUsd: pricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: pricing.estimatedCloudRateUsdPerHr,
    });
    const totalGpuCount = infraResults.memory.llmd.prefill.gpus + infraResults.memory.llmd.decode.gpus;
    assert.equal(cost.computeCapexUsd, totalGpuCount * pricing.estimatedUnitPriceUsd);
  });
});

describe('4. Power Billing: Colo vs. Owned Datacenter', () => {
  const model = getModel('llama33-70b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h200');
  const gpu = getGpu(platform.gpuId);
  const infraResults = calculateInfra({
    workloadType: 'inference', model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.4, promptTokenRatio: 0.8, contextLength: 8192,
    concurrency: 32, gpu, platform, tp: 8, pp: 1, dp: 1,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });
  const gpuPricing = GPU_PRICING[gpu.id];

  it('colo bills $/kW/month against IT load (not PUE-adjusted facility load)', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
      useColo: true, coloUsdPerKwPerMonth: 150,
    });
    assert.equal(cost.annualPowerCostUsd, infraResults.facility.totalItPowerKw * 150 * 12);
  });

  it('owned DC bills $/kWh against PUE-adjusted facility load, which exceeds IT load', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
      useColo: false, powerUsdPerKwh: 0.12,
    });
    const expected = infraResults.facility.totalFacilityPowerKw * 24 * 365 * 0.12;
    assert.ok(Math.abs(cost.annualPowerCostUsd - expected) < 1e-6);
    // PUE > 1 means facility load (and thus this billing basis) is strictly higher than IT load.
    assert.ok(infraResults.facility.totalFacilityPowerKw > infraResults.facility.totalItPowerKw);
  });
});

describe('5. Build-vs-Buy Cloud Comparison', () => {
  const model = getModel('llama33-70b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h200');
  const gpu = getGpu(platform.gpuId);
  const infraResults = calculateInfra({
    workloadType: 'inference', model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.4, promptTokenRatio: 0.8, contextLength: 8192,
    concurrency: 32, gpu, platform, tp: 8, pp: 1, dp: 1,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });
  const gpuPricing = GPU_PRICING[gpu.id];

  it('cloud-equivalent TCO equals cloud $/hr x hours in the horizon', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr, tcoYears: 3,
    });
    assert.equal(cost.cloudEquivalentTcoUsd, cost.cloudEquivalentUsdPerHr * 24 * 365 * 3);
  });

  it('buildVsBuySavings is cloud TCO minus on-prem TCO', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
    });
    assert.equal(cost.buildVsBuySavingsUsd, cost.cloudEquivalentTcoUsd - cost.tcoUsd);
  });

  it('break-even is null (not a misleading number) when on-prem never recoups its capex', () => {
    // An absurdly cheap cloud rate combined with expensive on-prem opex means renting is
    // always cheaper -- there is no month at which owning pays for itself.
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: 0.01,
      supportPctPerYear: 90, // deliberately punishing on-prem recurring cost
    });
    assert.equal(cost.breakEvenMonths, null);
  });

  it('break-even is a positive number of months when on-prem eventually recoups its capex', () => {
    const cost = calculateCost({
      infraResults, gpuUnitPriceUsd: gpuPricing.estimatedUnitPriceUsd,
      cloudRateUsdPerHr: gpuPricing.estimatedCloudRateUsdPerHr,
      supportPctPerYear: 15,
    });
    assert.ok(cost.breakEvenMonths > 0);
  });
});


it('token economics: cost per token falls with utilization; crossover is consistent', () => {
  const cost = { totalCapexUsd: 360000, annualOpexUsd: 60000, servingCapexUsd: 240000, servingAnnualOpexUsd: 36000, tcoYears: 3 };
  const throughput = { batchThroughputTps: 1000 };
  const args = { cost, throughput, promptTokensPerRequest: 2000, outputTokensPerRequest: 500, apiInputUsdPer1M: 0.6, apiOutputUsdPer1M: 8 };
  const half = calculateTokenEconomics({ ...args, dutyCyclePct: 50 });
  const full = calculateTokenEconomics({ ...args, dutyCyclePct: 100 });
  assert.ok(Math.abs(half.costPer1MOutputTokensUsd - 2 * full.costPer1MOutputTokensUsd) < 1e-9);
  // Serving-only monthly cost: 240k / 36 months + 36k / 12
  assert.ok(Math.abs(half.monthlyCostUsd - (240000 / 36 + 3000)) < 1e-6);
  // At the crossover utilization (reachable at these prices), owning and the API cost the same.
  assert.ok(half.crossoverReachable);
  const atCross = calculateTokenEconomics({ ...args, dutyCyclePct: half.crossoverDutyPct });
  assert.ok(Math.abs(atCross.monthlySavingsVsApiUsd) < 1e-6 * atCross.monthlyCostUsd);
  assert.equal(calculateTokenEconomics({ ...args, throughput: null }).eligible, false);
});
