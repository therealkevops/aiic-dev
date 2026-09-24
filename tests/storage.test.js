/**
 * Storage Sizing Test Suite
 * Validates checkpoint/dataset/model-repo/KV-offload capacity & throughput sizing,
 * and the RU provisioning logic (capacity vs. throughput binding constraint).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateStorage } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { STORAGE_TIERS } from '../src/data/storage.js';

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

describe('1. Storage Tier Catalog', () => {
  it('every tier has positive capacity and throughput per RU', () => {
    for (const tier of STORAGE_TIERS) {
      assert.ok(tier.capacityPerRuTb > 0, `${tier.id} capacityPerRuTb must be > 0`);
      assert.ok(tier.throughputPerRuGBs > 0, `${tier.id} throughputPerRuGBs must be > 0`);
    }
  });

  it('WekaFS is the highest-throughput-per-RU tier (training checkpoint/dataset use case)', () => {
    const weka = getTier('weka-nvme');
    const maxOther = Math.max(...STORAGE_TIERS.filter(t => t.id !== 'weka-nvme').map(t => t.throughputPerRuGBs));
    assert.ok(weka.throughputPerRuGBs > maxOther);
  });

  it('Ceph bulk object is the cheapest capacity-per-RU tier (air-gapped/archive use case)', () => {
    const ceph = getTier('ceph-bulk');
    const maxOther = Math.max(...STORAGE_TIERS.filter(t => t.id !== 'ceph-bulk').map(t => t.capacityPerRuTb));
    assert.ok(ceph.capacityPerRuTb > maxOther);
  });
});

describe('2. Training Storage Sizing', () => {
  const model = getModel('llama33-70b');
  const precision = getPrecision('fp16');
  const platform = getPlatform('cisco-c885a-h100');
  const gpu = getGpu(platform.gpuId);

  const infraResults = calculateInfra({
    workloadType: 'training',
    model, precision, kvPrecision: 'fp16',
    prefixCacheRatio: 0, promptTokenRatio: 0.8, contextLength: 4096,
    concurrency: 4, gpu, platform,
    tp: 8, pp: 1, dp: 4,
    trainingType: 'pretrain_sft', zeroStage: 3,
    networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });

  it('checkpoint capacity reflects weights + optimizer states, not gradients', () => {
    const tier = getTier('weka-nvme');
    const storage = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 3, checkpointTargetWriteTimeSec: 60, datasetSizeTb: 50,
    });
    const expectedCheckpointSizeGb = infraResults.memory.weightTotalGb + infraResults.memory.optimizerTotalGb;
    const checkpointEntry = storage.breakdown.find(b => b.label === 'Checkpoint retention');
    assert.ok(checkpointEntry, 'checkpoint breakdown entry must exist');
    assert.equal(
      Math.round(checkpointEntry.capacityTb * 1000),
      Math.round((expectedCheckpointSizeGb * 3 / 1000) * 1000)
    );
  });

  it('checkpoint write throughput scales inversely with the write-time budget', () => {
    const tier = getTier('weka-nvme');
    const tight = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 3, checkpointTargetWriteTimeSec: 30, datasetSizeTb: 50,
    });
    const relaxed = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 3, checkpointTargetWriteTimeSec: 120, datasetSizeTb: 50,
    });
    // Tighter budget -> higher required throughput, given the same checkpoint size.
    assert.ok(tight.requiredThroughputGBs > relaxed.requiredThroughputGBs);
  });

  it('required capacity grows with dataset size and checkpoint retention count', () => {
    const tier = getTier('weka-nvme');
    const small = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 1, checkpointTargetWriteTimeSec: 60, datasetSizeTb: 10,
    });
    const large = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 5, checkpointTargetWriteTimeSec: 60, datasetSizeTb: 200,
    });
    assert.ok(large.requiredCapacityTb > small.requiredCapacityTb);
  });
});

describe('3. Inference Storage Sizing', () => {
  const model = getModel('llama33-70b');
  const precision = getPrecision('fp8');
  const platform = getPlatform('cisco-c885a-h200');
  const gpu = getGpu(platform.gpuId);

  const infraResults = calculateInfra({
    workloadType: 'inference',
    model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.4, promptTokenRatio: 0.8, contextLength: 8192,
    concurrency: 32, gpu, platform,
    tp: 8, pp: 1, dp: 1,
    trainingType: 'pretrain_sft', zeroStage: 3,
    networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu),
  });

  it('model repository capacity scales with cached version count', () => {
    const tier = getTier('vast-universal');
    const oneVersion = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 1, modelRepoTargetLoadTimeSec: 120, enableKvOffload: false,
    });
    const threeVersions = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 3, modelRepoTargetLoadTimeSec: 120, enableKvOffload: false,
    });
    assert.ok(threeVersions.requiredCapacityTb > oneVersion.requiredCapacityTb);
    // Exactly 3x the single-version model repo capacity (no other capacity fields set).
    const ratio = threeVersions.requiredCapacityTb / oneVersion.requiredCapacityTb;
    assert.ok(Math.abs(ratio - 3) < 0.01);
  });

  it('enabling KV cache offload adds capacity and throughput requirements', () => {
    const tier = getTier('vast-universal');
    const withoutOffload = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, enableKvOffload: false,
    });
    const withOffload = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, enableKvOffload: true,
    });
    assert.ok(withOffload.requiredCapacityTb > withoutOffload.requiredCapacityTb);
    assert.ok(withOffload.requiredThroughputGBs >= withoutOffload.requiredThroughputGBs);
  });

  it('document/vector corpus is capacity-only and does not affect required throughput', () => {
    const tier = getTier('vast-universal');
    const noCorpus = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, enableKvOffload: false, corpusSizeGb: 0,
    });
    const withCorpus = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, enableKvOffload: false, corpusSizeGb: 5000,
    });
    assert.ok(withCorpus.requiredCapacityTb > noCorpus.requiredCapacityTb);
    assert.equal(withCorpus.requiredThroughputGBs, noCorpus.requiredThroughputGBs);
  });

  it('KV offload throughput equals cluster gen tok/s x real per-token KV bytes (dimensionally correct)', () => {
    // Regression test: an earlier version reverse-derived "bytes per token" from
    // kvCacheTotalGb (an aggregate, multi-stream total) divided by promptTokens (a single
    // stream's prompt length) -- two numbers that don't share a denominator. It must use
    // calculateInfra's own bytesPerTokenSeq (K+V bytes for one token) directly instead.
    const tier = getTier('vast-universal');
    const storage = calculateStorage({
      workloadType: 'inference', infraResults, storageTier: tier,
      modelRepoVersionCount: 2, modelRepoTargetLoadTimeSec: 120, enableKvOffload: true,
    });
    const clusterGenTokPerSec = infraResults.throughput.batchThroughputTps;
    const expectedThroughputGBs = (clusterGenTokPerSec * infraResults.memory.bytesPerTokenSeq) / 1e9;
    const kvEntry = storage.breakdown.find(b => b.label === 'KV cache disk/CXL offload');
    assert.ok(kvEntry, 'KV offload breakdown entry must exist');
    assert.ok(kvEntry.note.includes(expectedThroughputGBs.toFixed(2)));
  });
});

describe('4. RU Provisioning & Fit Warnings', () => {
  const model = getModel('llama3-405b');
  const precision = getPrecision('fp16');
  const platform = getPlatform('nvidia-hgx-b200');
  const gpu = getGpu(platform.gpuId);

  const infraResults = calculateInfra({
    workloadType: 'training',
    model, precision, kvPrecision: 'fp16',
    prefixCacheRatio: 0, promptTokenRatio: 0.8, contextLength: 8192,
    concurrency: 8, gpu, platform,
    tp: 8, pp: 1, dp: 128,
    trainingType: 'pretrain_sft', zeroStage: 3,
    networkProtocol: 'infiniband', pue: 1.15,
    servingConfig: baseServingConfig(platform, gpu),
  });

  it('binding constraint is whichever of capacity/throughput needs more RU', () => {
    const tier = getTier('ceph-bulk'); // low throughput-per-RU, high capacity-per-RU
    const storage = calculateStorage({
      workloadType: 'training', infraResults, storageTier: tier,
      checkpointRetentionCount: 3, checkpointTargetWriteTimeSec: 30, datasetSizeTb: 100,
    });
    const expectedRuForCapacity = Math.ceil(storage.requiredCapacityTb / tier.capacityPerRuTb);
    const expectedRuForThroughput = Math.ceil(storage.requiredThroughputGBs / tier.throughputPerRuGBs);
    assert.equal(storage.provisionedRu, Math.max(1, expectedRuForCapacity, expectedRuForThroughput));
    assert.equal(storage.bindingConstraint, expectedRuForThroughput > expectedRuForCapacity ? 'throughput' : 'capacity');
  });

  it('provisioned RU always satisfies both requirements (fits === true)', () => {
    for (const tier of STORAGE_TIERS) {
      const storage = calculateStorage({
        workloadType: 'training', infraResults, storageTier: tier,
        checkpointRetentionCount: 3, checkpointTargetWriteTimeSec: 60, datasetSizeTb: 500,
      });
      assert.ok(storage.fits, `${tier.id} should always be sized to fit — RU count grows until it does`);
      assert.ok(storage.achievedCapacityTb >= storage.requiredCapacityTb);
      assert.ok(storage.achievedThroughputGBs >= storage.requiredThroughputGBs);
    }
  });
});
