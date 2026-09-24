/**
 * RAG (Retrieval-Augmented Generation) Pipeline Completeness Test Suite
 * (Phase 5 of the architecture roadmap)
 * Validates corpus chunking, embedding-compute sizing (ingestion + live query embedding),
 * vector database sizing (capacity vs. throughput binding), and the calculateCost() capex/
 * power integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateRag, calculateCost } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { GPU_PRICING } from '../src/data/pricing.js';
import { EMBEDDING_MODELS, VECTOR_DB_PLATFORMS } from '../src/data/rag.js';

const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getEmbeddingModel = (id) => EMBEDDING_MODELS.find(m => m.id === id);
const getVectorDb = (id) => VECTOR_DB_PLATFORMS.find(v => v.id === id);

const bge = getEmbeddingModel('bge-large-en-v1.5');
const nvEmbed = getEmbeddingModel('nv-embed-v2');
const milvus = getVectorDb('milvus');
const l40s = getGpu('l40s-pcie');

const baseRagConfig = (overrides = {}) => ({
  enabled: true,
  corpusSizeGb: 2000,
  textExtractionRatio: 0.2,
  avgChunkTokens: 512,
  embeddingModel: bge,
  embeddingGpu: l40s,
  embeddingGpuUnitPriceUsd: GPU_PRICING['l40s-pcie'].estimatedUnitPriceUsd,
  ingestionTargetHours: 24,
  queryQps: 5,
  vectorDbPlatform: milvus,
  ...overrides,
});

describe('1. Eligibility Gating', () => {
  it('is ineligible when disabled', () => {
    const rag = calculateRag({ enabled: false });
    assert.equal(rag.enabled, false);
    assert.equal(rag.eligible, false);
  });

  it('is ineligible with a zero-size corpus', () => {
    const rag = calculateRag({ enabled: true, corpusSizeGb: 0 });
    assert.equal(rag.enabled, true);
    assert.equal(rag.eligible, false);
    assert.match(rag.reason, /corpus size/i);
  });

  it('is eligible with a positive corpus and enabled', () => {
    const rag = calculateRag(baseRagConfig());
    assert.equal(rag.eligible, true);
    assert.equal(rag.reason, null);
  });
});

describe('2. Corpus Chunking', () => {
  it('applies the text extraction ratio before chunking (raw document storage != extractable text)', () => {
    const full = calculateRag(baseRagConfig({ textExtractionRatio: 1.0 }));
    const partial = calculateRag(baseRagConfig({ textExtractionRatio: 0.2 }));
    assert.ok(Math.abs(partial.extractableTextGb - full.extractableTextGb * 0.2) < 1e-6);
    assert.ok(Math.abs(partial.numChunks - Math.round(full.numChunks * 0.2)) <= 1);
  });

  it('numChunks scales inversely with chunk size', () => {
    const small = calculateRag(baseRagConfig({ avgChunkTokens: 256 }));
    const large = calculateRag(baseRagConfig({ avgChunkTokens: 1024 }));
    assert.ok(small.numChunks > large.numChunks);
    assert.ok(Math.abs(small.numChunks - large.numChunks * 4) / small.numChunks < 0.01);
  });
});

describe('3. Embedding Compute Sizing', () => {
  it('a larger embedding model needs more ingestion GPUs for the same corpus/target', () => {
    const withBge = calculateRag(baseRagConfig({ embeddingModel: bge }));
    const withNvEmbed = calculateRag(baseRagConfig({ embeddingModel: nvEmbed }));
    assert.ok(withNvEmbed.ingestionGpusNeeded > withBge.ingestionGpusNeeded);
  });

  it('a tighter ingestion time target needs more GPUs', () => {
    const relaxed = calculateRag(baseRagConfig({ ingestionTargetHours: 48 }));
    const tight = calculateRag(baseRagConfig({ ingestionTargetHours: 4 }));
    assert.ok(tight.ingestionGpusNeeded >= relaxed.ingestionGpusNeeded);
  });

  it('actual ingestion time stays at or under the target once GPU count is provisioned', () => {
    const rag = calculateRag(baseRagConfig({ ingestionTargetHours: 12 }));
    assert.ok(rag.actualIngestionTimeHours <= 12 + 1e-6);
  });

  it('embeddingGpusNeeded is provisioned for the larger of ingestion vs. live query embedding load', () => {
    const highQps = calculateRag(baseRagConfig({ queryQps: 100000, ingestionTargetHours: 24 }));
    assert.equal(highQps.embeddingGpusNeeded, Math.max(highQps.ingestionGpusNeeded, highQps.queryEmbeddingGpusNeeded));
    assert.ok(highQps.queryEmbeddingGpusNeeded > 1, 'very high QPS should require more than 1 GPU for live query embedding');
  });
});

describe('4. Vector Database Sizing', () => {
  it('is capacity-bound for a large corpus with low query rate', () => {
    const rag = calculateRag(baseRagConfig({ corpusSizeGb: 5000, queryQps: 1 }));
    assert.equal(rag.bindingConstraint, 'capacity');
    assert.ok(rag.nodesForCapacity >= rag.nodesForThroughput);
  });

  it('is throughput-bound for a tiny corpus with very high query rate', () => {
    const rag = calculateRag(baseRagConfig({ corpusSizeGb: 1, queryQps: 50000 }));
    assert.equal(rag.bindingConstraint, 'throughput');
    assert.ok(rag.nodesForThroughput > rag.nodesForCapacity);
  });

  it('vectorDbNodesNeeded is the max of the two binding constraints', () => {
    const rag = calculateRag(baseRagConfig());
    assert.equal(rag.vectorDbNodesNeeded, Math.max(rag.nodesForCapacity, rag.nodesForThroughput));
  });

  it('a higher-dimensional embedding model needs more vector DB nodes for the same corpus (larger vectors)', () => {
    const withBge = calculateRag(baseRagConfig({ embeddingModel: bge })); // 1024 dims
    const withNvEmbed = calculateRag(baseRagConfig({ embeddingModel: nvEmbed })); // 4096 dims
    assert.ok(withNvEmbed.nodesForCapacity >= withBge.nodesForCapacity);
  });

  it('vectorDbRamGb equals nodes needed times per-node RAM', () => {
    const rag = calculateRag(baseRagConfig());
    assert.equal(rag.vectorDbRamGb, rag.vectorDbNodesNeeded * milvus.ramGbPerNode);
  });
});

describe('5. Cost & Power Integration', () => {
  const buildInfra = () => {
    const model = getModel('llama3-8b');
    const precision = getPrecision('fp8');
    const platform = getPlatform('cisco-c885a-h100');
    const gpu = getGpu(platform.gpuId);
    return calculateInfra({
      workloadType: 'inference', model, precision, kvPrecision: 'fp8',
      prefixCacheRatio: 0.2, promptTokenRatio: 0.7, contextLength: 4096,
      concurrency: 64, gpu, platform, tp: 1, pp: 1, dp: 16,
      trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
      servingConfig: {
        servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'colocated',
        enableChunkedPrefill: true, enablePrefixCaching: true, enableSpeculativeDecoding: false,
        llmdDisaggregationMode: 'heterogeneous', secondaryPlatform: platform, secondaryGpu: gpu,
        prefillNodes: 1, decodeNodes: 2,
      },
    });
  };

  it('with RAG disabled (defaults), calculateCost() is unaffected (ragCapexUsd=0)', () => {
    const infra = buildInfra();
    const cost = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    assert.equal(cost.ragCapexUsd, 0);
  });

  it('RAG capex adds exactly to totalCapexUsd, nothing else changes', () => {
    const infra = buildInfra();
    const rag = calculateRag(baseRagConfig());
    const costNoRag = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    const costWithRag = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: rag.ragComputeCapexUsd, ragItPowerKw: rag.ragItPowerKw,
    });
    assert.equal(costWithRag.computeCapexUsd, costNoRag.computeCapexUsd);
    assert.equal(costWithRag.networkHardwareCapexUsd, costNoRag.networkHardwareCapexUsd);
    assert.equal(costWithRag.storageCapexUsd, costNoRag.storageCapexUsd);
    assert.ok(Math.abs((costWithRag.totalCapexUsd - costNoRag.totalCapexUsd) - rag.ragComputeCapexUsd) < 1e-6);
    assert.equal(costWithRag.ragCapexUsd, rag.ragComputeCapexUsd);
  });

  it('RAG IT power increases annual power cost (PUE-adjusted)', () => {
    const infra = buildInfra();
    const rag = calculateRag(baseRagConfig());
    const costNoRag = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0 });
    const costWithRag = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      ragComputeCapexUsd: rag.ragComputeCapexUsd, ragItPowerKw: rag.ragItPowerKw,
    });
    assert.ok(costWithRag.annualPowerCostUsd > costNoRag.annualPowerCostUsd);
  });

  it('RAG power gets the same PUE multiplier as the rest of the deployment', () => {
    const infra = buildInfra();
    const impliedPue = infra.facility.totalFacilityPowerKw / infra.facility.totalItPowerKw;
    const rag = calculateRag(baseRagConfig());
    const costNoRag = calculateCost({ infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0, powerUsdPerKwh: 0.12 });
    const costWithRag = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0, powerUsdPerKwh: 0.12,
      ragComputeCapexUsd: rag.ragComputeCapexUsd, ragItPowerKw: rag.ragItPowerKw,
    });
    const expectedDeltaUsd = rag.ragItPowerKw * impliedPue * 24 * 365 * 0.12;
    const actualDeltaUsd = costWithRag.annualPowerCostUsd - costNoRag.annualPowerCostUsd;
    assert.ok(Math.abs(actualDeltaUsd - expectedDeltaUsd) / expectedDeltaUsd < 0.01);
  });

  it('MIG cost override and RAG capex are independent and additive', () => {
    const infra = buildInfra();
    const rag = calculateRag(baseRagConfig());
    const cost = calculateCost({
      infraResults: infra, gpuUnitPriceUsd: 35000, cloudRateUsdPerHr: 3.75, storageUsdPerTbRaw: 0,
      computeGpuCountOverride: 8, itPowerKwOverride: 80,
      ragComputeCapexUsd: rag.ragComputeCapexUsd, ragItPowerKw: rag.ragItPowerKw,
    });
    assert.equal(cost.computeCapexUsd, 8 * 35000);
    assert.ok(Math.abs((cost.totalCapexUsd - (8 * 35000 + cost.networkHardwareCapexUsd)) - rag.ragComputeCapexUsd) < 1e-6);
  });
});

describe('6. Data Catalog Sanity', () => {
  it('every embedding model has verified real-world params/dims/maxTokens (no zero/undefined)', () => {
    for (const m of EMBEDDING_MODELS) {
      assert.ok(m.paramsMillion > 0, `${m.id} paramsMillion`);
      assert.ok(m.dims > 0, `${m.id} dims`);
      assert.ok(m.maxTokens > 0, `${m.id} maxTokens`);
    }
  });

  it('every vector DB platform has positive RAM/QPS/capex defaults', () => {
    for (const v of VECTOR_DB_PLATFORMS) {
      assert.ok(v.ramGbPerNode > 0, `${v.id} ramGbPerNode`);
      assert.ok(v.estimatedQpsPerNode > 0, `${v.id} estimatedQpsPerNode`);
      assert.ok(v.estimatedUsdPerNodeCapex > 0, `${v.id} estimatedUsdPerNodeCapex`);
    }
  });
});
