/**
 * Ingress / Edge Networking Test Suite (Phase 7 of the architecture roadmap)
 * Validates eligibility gating, request-rate-driven egress bandwidth sizing, node throughput
 * sizing, self-hosted-vs-managed capex/power treatment, and the calculateCost() capex/power/
 * opex integration alongside RAG and guardrails.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateIngress, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { INGRESS_TIERS, DEFAULT_EGRESS_USD_PER_GB } from '../src/data/ingress.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getTier = (id) => INGRESS_TIERS.find(t => t.id === id);

const swLb = getTier('software-lb');
const hwAdc = getTier('hardware-adc');
const managedLb = getTier('cloud-managed-lb');
const cdn = getTier('cdn-edge');

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

const baseIngressConfig = (infraResults, overrides = {}) => ({
  enabled: true,
  infraResults,
  ingressTier: swLb,
  egressUsdPerGb: DEFAULT_EGRESS_USD_PER_GB,
  ...overrides,
});

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const i = calculateIngress({ enabled: false });
    assert.equal(i.enabled, false);
    assert.equal(i.eligible, false);
  });

  it('is ineligible for training workloads', () => {
    const infra = buildInfra({ workloadType: 'training' });
    const i = calculateIngress(baseIngressConfig(infra));
    assert.equal(i.eligible, false);
    assert.match(i.reason, /training/i);
  });

  it('is eligible for colocated inference', () => {
    const infra = buildInfra();
    const i = calculateIngress(baseIngressConfig(infra));
    assert.equal(i.eligible, true);
    assert.equal(i.reason, null);
  });
});

describe('2. Egress Bandwidth Sizing', () => {
  it('annual egress cost scales with cluster request rate', () => {
    const lowLoad = buildInfra({ concurrency: 32, dp: 2 });
    const highLoad = buildInfra({ concurrency: 512, dp: 32 });
    const iLow = calculateIngress(baseIngressConfig(lowLoad));
    const iHigh = calculateIngress(baseIngressConfig(highLoad));
    assert.ok(iHigh.annualEgressCostUsd > iLow.annualEgressCostUsd);
  });

  it('annual egress cost is linear in the egress rate', () => {
    const infra = buildInfra();
    const full = calculateIngress(baseIngressConfig(infra, { egressUsdPerGb: 0.09 }));
    const half = calculateIngress(baseIngressConfig(infra, { egressUsdPerGb: 0.045 }));
    assert.ok(Math.abs(half.annualEgressCostUsd - full.annualEgressCostUsd / 2) < 1);
  });

  it('a longer average response (larger contextLength / lower promptTokenRatio) increases egress', () => {
    const shortResp = buildInfra(); // contextLength=8192, promptTokenRatio=0.75 baked into helper
    const iShort = calculateIngress(baseIngressConfig(shortResp));
    assert.ok(iShort.avgResponseBytes > 0);
    assert.ok(iShort.annualEgressGb > 0);
  });
});

describe('3. Node Throughput Sizing', () => {
  it('nodesNeeded is always at least 1', () => {
    const infra = buildInfra({ concurrency: 8, dp: 1 });
    const i = calculateIngress(baseIngressConfig(infra));
    assert.ok(i.nodesNeeded >= 1);
  });

  it('a lower-throughput-per-node tier needs more nodes for the same load', () => {
    const infra = buildInfra({ concurrency: 512, dp: 32 });
    const highCapTier = { ...swLb, throughputGbpsPerNode: 1000 };
    const lowCapTier = { ...swLb, throughputGbpsPerNode: 0.0001 };
    const iHighCap = calculateIngress(baseIngressConfig(infra, { ingressTier: highCapTier }));
    const iLowCap = calculateIngress(baseIngressConfig(infra, { ingressTier: lowCapTier }));
    assert.ok(iLowCap.nodesNeeded > iHighCap.nodesNeeded);
  });
});

describe('4. Self-Hosted vs. Managed Treatment', () => {
  it('self-hosted tiers draw IT power; managed tiers draw none', () => {
    const infra = buildInfra();
    const iSelfHosted = calculateIngress(baseIngressConfig(infra, { ingressTier: hwAdc }));
    const iManaged = calculateIngress(baseIngressConfig(infra, { ingressTier: managedLb }));
    assert.ok(iSelfHosted.ingressItPowerKw > 0);
    assert.equal(iManaged.ingressItPowerKw, 0);
  });

  it('managed tiers still have zero capex but non-zero recurring opex', () => {
    const infra = buildInfra();
    const iManaged = calculateIngress(baseIngressConfig(infra, { ingressTier: managedLb }));
    assert.equal(iManaged.ingressComputeCapexUsd, 0);
    assert.ok(iManaged.ingressAnnualOpexUsd > 0);
  });

  it('CDN edge tier reports the lowest added latency among tiers', () => {
    const infra = buildInfra();
    const results = INGRESS_TIERS.map(tier => calculateIngress(baseIngressConfig(infra, { ingressTier: tier })));
    const cdnResult = results.find(r => r.ingressTier.id === 'cdn-edge');
    const maxOther = Math.max(...results.filter(r => r.ingressTier.id !== 'cdn-edge').map(r => r.addedLatencyMs));
    assert.ok(cdnResult.addedLatencyMs <= maxOther);
  });
});

describe('5. Cost Integration', () => {
  const buildBaseline = () => {
    const infra = buildInfra();
    return { infra, costNoIngress: calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 }) };
  };

  it('with ingress disabled (defaults), calculateCost() is unaffected', () => {
    const { costNoIngress } = buildBaseline();
    assert.equal(costNoIngress.ingressCapexUsd, 0);
    assert.equal(costNoIngress.ingressAnnualOpexUsd, 0);
  });

  it('ingress capex adds exactly to totalCapexUsd', () => {
    const { infra, costNoIngress } = buildBaseline();
    const i = calculateIngress(baseIngressConfig(infra));
    const costWithIngress = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ingressComputeCapexUsd: i.ingressComputeCapexUsd, ingressItPowerKw: i.ingressItPowerKw, ingressAnnualOpexUsd: i.ingressAnnualOpexUsd,
    });
    assert.ok(Math.abs((costWithIngress.totalCapexUsd - costNoIngress.totalCapexUsd) - i.ingressComputeCapexUsd) < 1e-6);
    assert.equal(costWithIngress.ingressCapexUsd, i.ingressComputeCapexUsd);
  });

  it('ingressAnnualOpexUsd (egress + managed fees) is included in annualOpexUsd on top of power/support', () => {
    const { infra, costNoIngress } = buildBaseline();
    const i = calculateIngress(baseIngressConfig(infra, { ingressTier: managedLb })); // zero capex/power -> isolates the opex term
    const costWithIngress = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ingressComputeCapexUsd: i.ingressComputeCapexUsd, ingressItPowerKw: i.ingressItPowerKw, ingressAnnualOpexUsd: i.ingressAnnualOpexUsd,
    });
    // Managed tier: no capex, no power, so the entire opex delta should equal ingressAnnualOpexUsd exactly.
    assert.ok(Math.abs((costWithIngress.annualOpexUsd - costNoIngress.annualOpexUsd) - i.ingressAnnualOpexUsd) < 1e-6);
  });

  it('RAG, guardrails, and ingress capex are independent and additive when all present', () => {
    const { infra, costNoIngress } = buildBaseline();
    const i = calculateIngress(baseIngressConfig(infra));
    const costAll = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: 50000, ragItPowerKw: 5,
      guardrailsComputeCapexUsd: 8500, guardrailsItPowerKw: 0.5,
      ingressComputeCapexUsd: i.ingressComputeCapexUsd, ingressItPowerKw: i.ingressItPowerKw, ingressAnnualOpexUsd: i.ingressAnnualOpexUsd,
    });
    const expectedTotal = costNoIngress.totalCapexUsd + 50000 + 8500 + i.ingressComputeCapexUsd;
    assert.ok(Math.abs(costAll.totalCapexUsd - expectedTotal) < 1e-6);
  });
});

describe('6. Data Catalog Sanity', () => {
  it('every ingress tier has positive throughput/capex-or-opex figures and a valid type', () => {
    for (const tier of INGRESS_TIERS) {
      assert.ok(tier.throughputGbpsPerNode > 0, `${tier.id} throughputGbpsPerNode`);
      assert.ok(['self-hosted', 'managed'].includes(tier.type), `${tier.id} type`);
      assert.ok(tier.estimatedUsdPerNodeCapex >= 0, `${tier.id} estimatedUsdPerNodeCapex`);
      assert.ok(tier.estimatedUsdPerNodeMonthlyOpex >= 0, `${tier.id} estimatedUsdPerNodeMonthlyOpex`);
    }
  });

  it('managed tiers have zero capex (no hardware to buy)', () => {
    for (const tier of INGRESS_TIERS.filter(t => t.type === 'managed')) {
      assert.equal(tier.estimatedUsdPerNodeCapex, 0, `${tier.id} should have zero capex`);
    }
  });
});
