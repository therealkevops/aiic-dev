/**
 * Robust Testing Suite for AI Infrastructure Sizing Calculator
 * Validates memory formulas, KV cache mechanics, sharding logic, LLM-D disaggregation,
 * performance modeling, and datacenter BOM against documented sources.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { recommendSharding, calculateInfra, calculateLoraParams, CONFIG } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';

// Helper fixtures
const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);

describe('1. Model Weight Memory Calculations', () => {
  it('correctly calculates dense model weights across FP16, FP8, and INT4', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // FP16: 70.6B params * 2 bytes = 141.2 GB
    const resFp16 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 2048,
      concurrency: 1,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resFp16.memory.weightTotalGb * 10) / 10, 141.2);
    // Across TP=8, per GPU weights = 141.2 / 8 = 17.65 GB
    assert.equal(Math.round(resFp16.memory.perGpuWeightsGb * 10) / 10, 17.7);

    // FP8: the ~2.10B embedding+lm_head params are re-priced at BF16 (4.20 GB), and removed
    // from the quantized bucket first so they aren't billed at both rates:
    // (70.6B - 2.10B) * 1 byte + 2.10B * 2 bytes = 72.7 GB
    const resFp8 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 2048,
      concurrency: 1,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resFp8.memory.weightTotalGb * 10) / 10, 72.7);

    // INT4 AWQ/GPTQ: (70.6B - 2.10B) * 0.53 bytes + 2.10B * 2 bytes = 40.5 GB
    const resInt4 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('int4'),
      contextLength: 2048,
      concurrency: 1,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resInt4.memory.weightTotalGb * 10) / 10, 40.5);

    // NVFP4: (70.6B - 2.10B) * 0.5625 bytes + 2.10B * 2 bytes = 42.7 GB
    const resNvfp4 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('nvfp4'),
      contextLength: 2048,
      concurrency: 1,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resNvfp4.memory.weightTotalGb * 10) / 10, 42.7);
  });

  it('correctly loads ALL expert weights for MoE models into VRAM (not just active params)', () => {
    // DeepSeek R1 671B MoE has 671B total params and 37B active params
    const deepseek = getModel('deepseek-r1-671b');
    const h200 = getGpu('h200-sxm');
    const platform = getPlatform('cisco-c885a-h200');

    const res = calculateInfra({
      workloadType: 'inference',
      model: deepseek,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 1,
      gpu: h200,
      platform,
      tp: 8, pp: 2, dp: 1,
      networkProtocol: 'rocev2'
    });

    // In FP8: (671B - 1.85B head params) * 1 byte + 1.85B * 2 bytes (BF16 heads) = 672.9 GB in VRAM!
    assert.equal(Math.round(res.memory.weightTotalGb * 10) / 10, 672.9);
    assert.equal(res.isMoe, true);
    assert.equal(res.activeParams, 37.0);
  });

  it('C1: calculates inference activation memory without layer multiplier (M_act < 5 GB)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Llama 70B FP16 with C=32 and S=32768
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 32768,
      concurrency: 32,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // M_act excluding runtime overhead must be < 5 GB (~1.305 GB)
    assert.ok(res.memory.mActGb < 5.0, `Expected mActGb < 5 GB, got ${res.memory.mActGb}`);
  });
});

describe('2. KV Cache Memory Architecture & Formulas', () => {
  it('calculates standard GQA KV cache with mathematical precision', () => {
    // Meta Llama 3 70B: 80 layers, 8 KV heads, 128 headDim
    // Formula: 2 (K+V) * layers * kvHeads * headDim * bytesPerElement
    // Elements per token sequence = 2 * 80 * 8 * 128 = 163,840 elements
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Case A: FP16 KV Cache (2 bytes/element)
    // 163,840 * 2 = 327,680 bytes/token
    // For 8,192 tokens * 4 concurrency = 32,768 total tokens
    // 327,680 * 32,768 / 1e9 = 10.74 GB // updated: G1
    const resFp16 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      kvPrecision: 'fp16',
      prefixCacheRatio: 0,
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resFp16.memory.kvCacheTotalGb * 100) / 100, 10.74); // updated: G1

    // Case B: FP8 KV Cache (1 byte/element)
    // Halves the KV cache memory to exactly 5.37 GB // updated: G1
    const resFp8 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resFp8.memory.kvCacheTotalGb * 100) / 100, 5.37); // updated: G1
    assert.equal(Math.round(resFp8.memory.kvSavingsGb * 100) / 100, 5.37); // updated: G1

    // Case C: INT4 KV Cache (0.5 bytes/element)
    // Quarters the KV cache memory to exactly 2.68 GB // updated: G1
    const resInt4 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      kvPrecision: 'int4',
      prefixCacheRatio: 0,
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.equal(Math.round(resInt4.memory.kvCacheTotalGb * 100) / 100, 2.68); // updated: G1
    assert.equal(Math.round(resInt4.memory.kvSavingsGb * 100) / 100, 8.05); // updated: G1
  });

  it('correctly models DeepSeek Multi-Head Latent Attention (MLA) low-rank compression', () => {
    // DeepSeek R1 / V3: 61 layers, 512 latent dim + 64 RoPE dim = 576 elements per token per layer
    // Elements per token sequence = 61 * 576 = 35,136 elements
    // Contrast with standard GQA which would be 2 * 61 * 8 * 128 = 124,928 elements (~3.5x larger!)
    const deepseek = getModel('deepseek-r1-671b');
    const h200 = getGpu('h200-sxm');
    const platform = getPlatform('cisco-c885a-h200');

    // Context = 16,384 tokens, Concurrency = 8, FP8 KV cache (1 byte/element)
    // Total tokens = 131,072
    // Bytes = 35,136 * 1 byte * 131,072 = 4,605,345,792 bytes = 4.605 GB // updated: G1
    const res = calculateInfra({
      workloadType: 'inference',
      model: deepseek,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      contextLength: 16384,
      concurrency: 8,
      gpu: h200,
      platform,
      tp: 8, pp: 2, dp: 1,
      networkProtocol: 'rocev2'
    });

    const expectedGb = (61 * (512 + 64) * 1.0 * 16384 * 8) / 1e9; // updated: G1
    assert.equal(Math.round(res.memory.kvCacheTotalGb * 1000) / 1000, Math.round(expectedGb * 1000) / 1000);
  });

  it('S2: DeepSeek at TP=8 has per-GPU KV at least Llama 70B TP=8 for same C and S', () => {
    const deepseek = getModel('deepseek-r1-671b');
    const llama70b = getModel('llama3-70b');
    const h200 = getGpu('h200-sxm');
    const platform = getPlatform('cisco-c885a-h200');

    const C = 8;
    const S = 16384;

    const resLlama = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      contextLength: S,
      concurrency: C,
      gpu: h200,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    const resDeepSeek = calculateInfra({
      workloadType: 'inference',
      model: deepseek,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      contextLength: S,
      concurrency: C,
      gpu: h200,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // Llama 70B: kvTotal = 21.475 GB, tpEff = min(8, 8) = 8 -> perGpuKv = 2.684 GB
    // DeepSeek R1: kvTotal = 4.605 GB, MLA latent replicated across TP -> perGpuKv = 4.605 GB
    assert.ok(
      resDeepSeek.memory.perGpuKvOrOptGb >= resLlama.memory.perGpuKvOrOptGb,
      `DeepSeek per-GPU KV (${resDeepSeek.memory.perGpuKvOrOptGb}) should be >= Llama 70B per-GPU KV (${resLlama.memory.perGpuKvOrOptGb})`
    );
  });

  it('correctly models Automatic prefix caching deduplication across streams', () => { // updated: M4
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Context = 8192, Concurrency = 8, PromptRatio = 0.8 (6554 prompt tokens), PrefixCacheRatio = 0.5
    // Shared prompt tokens = 6554 * 0.5 = 3277 tokens (stored 1x)
    // Private tokens per stream = 8192 - 3277 = 4915 tokens (stored 8x)
    // Total tokens stored in VRAM = 4915 * 8 + 3277 * 1 = 39,320 + 3,277 = 42,597 tokens
    // Compare to unshared: 8192 * 8 = 65,536 tokens!
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0.5,
      promptTokenRatio: 0.8,
      contextLength: 8192,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    assert.ok(res.memory.kvSavingsGb > 0);
    assert.ok(res.memory.kvCacheTotalGb < res.memory.baselineKvGb);
  });

  it('M4: globalPrefixTokens is stored once in VRAM; sessionReuseRatio gives no cross-user memory savings but saves prefill compute', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Baseline: no prefix caching
    const resBaseline = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      contextLength: 8192,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // Test A: globalPrefixTokens = 2048 stored 1x in VRAM across 8 streams
    const resGlobal = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      globalPrefixTokens: 2048,
      contextLength: 8192,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // Memory savings should equal: bytesPerTokenSeq * 2048 * (8 - 1) / 1e9
    assert.ok(resGlobal.memory.kvCacheTotalGb < resBaseline.memory.kvCacheTotalGb);
    assert.ok(resGlobal.memory.kvSavingsGb > 0);

    // Test B: sessionReuseRatio = 0.5 stored per stream: no cross-user memory savings
    const resSession = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      sessionReuseRatio: 0.5,
      contextLength: 8192,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // sessionReuseRatio does NOT save cross-user KV memory
    assert.equal(resSession.memory.kvCacheTotalGb, resBaseline.memory.kvCacheTotalGb);
    assert.equal(resSession.memory.kvSavingsGb, resBaseline.memory.kvSavingsGb);

    // But sessionReuseRatio DOES reduce TTFT by avoiding prefill on reused prompt tokens
    assert.ok(
      resSession.throughput.ttftMs < resBaseline.throughput.ttftMs,
      `Expected sessionReuse TTFT (${resSession.throughput.ttftMs}ms) to be < baseline TTFT (${resBaseline.throughput.ttftMs}ms)`
    );
  });
});

describe('3. Training Memory, Gradient Checkpointing & ZeRO Sharding', () => {
  it('S6: sizes LoRA adapter params as r × Σ(d_in + d_out) (~0.207B for Llama 70B r=16)', () => { // updated: S6
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const loraParams = calculateLoraParams(llama70b, 16);
    // Expected ~0.207B adapter params within ±5%
    assert.ok(
      Math.abs(loraParams - 0.207) / 0.207 <= 0.05,
      `Expected LoRA params ~0.207B ±5%, got ${loraParams.toFixed(4)}B`
    );

    const res = calculateInfra({
      workloadType: 'training',
      trainingType: 'lora',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 4096,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      zeroStage: 0,
      networkProtocol: 'rocev2'
    });

    // Base weights: 70.6B * 2 = 141.2 GB
    assert.equal(Math.round(res.memory.weightTotalGb * 10) / 10, 141.2);
    // Adapter params = ~0.207B -> Adam states (12B) = ~2.48 GB // updated: S6
    const expectedOptGb = loraParams * 12;
    assert.equal(Math.round(res.memory.optimizerTotalGb * 100) / 100, Math.round(expectedOptGb * 100) / 100);
  });

  it('LoRA per-GPU weights shard across both TP and PP (regression: previously only divided by TP)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'training',
      trainingType: 'lora',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 4096,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 4, pp: 2, dp: 1,
      zeroStage: 0,
      networkProtocol: 'rocev2'
    });

    const expectedPerGpuWeightsGb = res.memory.weightTotalGb / (4 * 2);
    assert.equal(
      Math.round(res.memory.perGpuWeightsGb * 100) / 100,
      Math.round(expectedPerGpuWeightsGb * 100) / 100,
      `Expected LoRA base weights to shard across TP*PP=8 (${expectedPerGpuWeightsGb.toFixed(2)} GB/GPU), got ${res.memory.perGpuWeightsGb.toFixed(2)} GB/GPU`
    );
  });

  it('S6: blocks combination of ZeRO-2/3 with PP > 1 and displays warning', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const resZeRO2 = calculateInfra({
      workloadType: 'training',
      trainingType: 'pretrain_sft',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 2048,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 8, pp: 2, dp: 2,
      zeroStage: 2,
      networkProtocol: 'rocev2'
    });

    assert.ok(resZeRO2.warnings.some(w => w.includes('ZeRO-2 is incompatible with Pipeline Parallelism')));

    const resZeRO3 = calculateInfra({
      workloadType: 'training',
      trainingType: 'pretrain_sft',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 2048,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 8, pp: 2, dp: 2,
      zeroStage: 3,
      networkProtocol: 'rocev2'
    });

    assert.ok(resZeRO3.warnings.some(w => w.includes('ZeRO-3 is incompatible with Pipeline Parallelism')));
  });

  it('sizes Full SFT / Pre-training with FP32 Adam optimizer states and ZeRO-3 sharding', () => {
    const llama8b = getModel('llama3-8b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // 8.03B params * 12 bytes/param for FP32 Adam = 96.36 GB optimizer memory
    // 8.03B params * 2 bytes/param for FP16 Gradients = 16.06 GB
    // 8.03B params * 2 bytes/param for FP16 Weights = 16.06 GB
    const resZeRO3 = calculateInfra({
      workloadType: 'training',
      trainingType: 'pretrain_sft',
      model: llama8b,
      precision: getPrecision('fp16'),
      contextLength: 2048,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 1, pp: 1, dp: 8, // 8 GPUs total
      zeroStage: 3,
      networkProtocol: 'rocev2'
    });

    assert.equal(resZeRO3.totalGpus, 8);
    assert.equal(Math.round(resZeRO3.memory.optimizerTotalGb * 10) / 10, 96.4);
    assert.equal(Math.round(resZeRO3.memory.gradientTotalGb * 10) / 10, 16.1);
    // In ZeRO-3, optimizer, gradients, and weights are all sharded across all 8 GPUs
    assert.equal(Math.round(resZeRO3.memory.perGpuKvOrOptGb * 10) / 10, Math.round((96.36 / 8) * 10) / 10);
    assert.equal(Math.round(resZeRO3.memory.perGpuGradGb * 10) / 10, Math.round((16.06 / 8) * 10) / 10);
    assert.equal(Math.round(resZeRO3.memory.perGpuWeightsGb * 10) / 10, Math.round((16.06 / 8) * 10) / 10);
  });
});

describe('4. Auto-Sharding Solver (recommendSharding)', () => {
  it('recommends single-GPU (TP=1, PP=1) for small models like LLaMA 8B FP8', () => {
    const llama8b = getModel('llama3-8b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const rec = recommendSharding({
      workloadType: 'inference',
      model: llama8b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 4,
      gpu: h100,
      platform
    });

    assert.equal(rec.tp, 1);
    assert.equal(rec.pp, 1);
    assert.equal(rec.fitsInOneNode, true);
  });

  it('recommends sharding based on mathematical VRAM thresholds (TP=2 for FP8, TP=8 for 128k context FP16)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // FP8 8k context fits on 2 GPUs (~85 GB replica <= 140.8 GB usable on 2x H100)
    const recFp8 = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 8192,
      concurrency: 8,
      gpu: h100,
      platform
    });
    assert.equal(recFp8.tp, 2);
    assert.equal(recFp8.pp, 1);
    assert.equal(recFp8.fitsInOneNode, true);

    // FP16 32k context fits in 4 GPUs with realistic activation memory (TP=4, PP=1)
    const recFp16 = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 32768,
      concurrency: 4,
      gpu: h100,
      platform
    });
    assert.equal(recFp16.tp, 4); // updated: C1
    assert.equal(recFp16.pp, 1);
    assert.equal(recFp16.fitsInOneNode, true);
  });

  it('recommends multi-node pipeline parallelism (PP >= 2) for frontier models exceeding 1 node', () => {
    const llama405b = getModel('llama3-405b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // 405B in FP16 requires ~810 GB weights alone. Single 8x H100 80GB node has 8 * 80 * 0.88 = 563 GB usable.
    // It cannot fit on 1 node!
    const rec = recommendSharding({
      workloadType: 'inference',
      model: llama405b,
      precision: getPrecision('fp16'),
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform
    });

    assert.equal(rec.tp, 8);
    assert.ok(rec.pp >= 2);
    assert.equal(rec.fitsInOneNode, false);
  });

  it('S5: returns error when model requires PP > CONFIG.maxPP', () => {
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');
    // Massive custom model: 6000B params in FP16 requires 12,000 GB weights
    // Usable per node = 8 * 72 = 576 GB. Needed nodes = ceil(12000 / 576) = 21 > maxPP (8)
    const customHuge = {
      id: 'custom-huge',
      params: 6000,
      layers: 160,
      numHeads: 128,
      kvHeads: 16,
      headDim: 128,
      hidden: 16384,
      intermediate: 65536,
      vocab: 128256
    };

    const rec = recommendSharding({
      workloadType: 'inference',
      model: customHuge,
      precision: getPrecision('fp16'),
      contextLength: 4096,
      concurrency: 1,
      gpu: h100,
      platform
    });

    assert.equal(rec.error, 'Model does not fit; increase GPU memory or quantise');
    assert.ok(rec.pp > 8);
  });

  it('S5: steps down TP to divide H_q when candidate TP does not divide H_q', () => {
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');
    // Model with 6 query heads. Candidate TP for 8-GPU chassis is 8, but 8 does not divide 6.
    // Divisors of 6 <= 8 are 6, 3, 2, 1. Next divisor is 6.
    const custom6Heads = {
      id: 'custom-6h',
      params: 200, // ~400 GB in FP16, fits in 1 node (576 GB usable), candidate TP=8
      layers: 32,
      numHeads: 6,
      kvHeads: 2,
      headDim: 128,
      hidden: 768,
      intermediate: 3072,
      vocab: 32000
    };

    const rec = recommendSharding({
      workloadType: 'inference',
      model: custom6Heads,
      precision: getPrecision('fp16'),
      contextLength: 4096,
      concurrency: 1,
      gpu: h100,
      platform
    });

    // 6 divides H_q=6, candidate 8 stepped down to 6
    assert.equal(rec.tp, 6);
    assert.equal(custom6Heads.numHeads % rec.tp, 0);
  });

  it('S5: concurrency scales DP, not TP', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Concurrency C=1: DP=1, TP=2
    const rec1 = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 8192,
      concurrency: 1,
      gpu: h100,
      platform
    });
    assert.equal(rec1.tp, 2);
    assert.equal(rec1.dp, 1);

    // Concurrency C=64: DP scales up, TP remains 2
    const rec64 = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 8192,
      concurrency: 64,
      gpu: h100,
      platform
    });
    assert.equal(rec64.tp, 2); // TP does NOT scale with concurrency
    assert.ok(rec64.dp >= 2, `Expected DP >= 2 for C=64, got ${rec64.dp}`);
  });
});

describe('5. Inference Latency & Throughput Engine', () => {
  it('models decode throughput based on HBM memory bandwidth (bandwidth-bound)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm'); // 3.35 TB/s HBM3 bandwidth
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    assert.ok(res.throughput !== null);
    assert.ok(res.throughput.tokensPerSecPerGpu > 0);
    assert.ok(res.throughput.tpotMs > 0);
    assert.ok(res.throughput.batchThroughputTps > 0);
  });

  it('C2: models decode latency TPOT > 15ms for C_rep=32 and 6-12ms for C_rep=1 (Llama 70B FP16, TP=8, H100)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // Case 1: C_rep = 32, S = 32768 -> TPOT > 15 ms
    const res32 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 32768,
      concurrency: 32,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.ok(res32.throughput.tpotMs > 15, `Expected TPOT > 15 ms, got ${res32.throughput.tpotMs} ms`);

    // Case 2: C_rep = 1, S = 32768 -> TPOT between 6 and 12 ms
    const res1 = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 32768,
      concurrency: 1,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });
    assert.ok(
      res1.throughput.tpotMs >= 6 && res1.throughput.tpotMs <= 12,
      `Expected TPOT between 6 and 12 ms, got ${res1.throughput.tpotMs} ms`
    );
  });

  it('Prompt Ingestion Speed is measured against prompt tokens, not full context length (regression)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp16'),
      promptTokenRatio: 0.8,
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    const expectedTps = Math.round(res.memory.promptTokens / res.throughput.ttftSec);
    assert.equal(
      res.throughput.promptTokensPerSecPerReplica,
      expectedTps,
      `Expected promptTokensPerSecPerReplica to be promptTokens/ttftSec (${expectedTps}), got ${res.throughput.promptTokensPerSecPerReplica}`
    );
    // Guard against regressing back to dividing by the full context length (prompt + output tokens)
    assert.notEqual(
      res.throughput.promptTokensPerSecPerReplica,
      Math.round(8192 / res.throughput.ttftSec)
    );
  });

  it('models prefill compute and shows TTFT reduction with prefix caching', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const resUncached = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 16384,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    const resCached = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      prefixCacheRatio: 0.5, // 50% cached
      promptTokenRatio: 0.8,
      contextLength: 16384,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2'
    });

    // Cached prefill must have lower Time to First Token (TTFT)
    assert.ok(resCached.throughput.ttftMs < resUncached.throughput.ttftMs);
  });

  it('C5: TTFT equals the sum of its time components within 1e-9 (seconds)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 8192,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 2, dp: 1,
      networkProtocol: 'rocev2'
    });

    const sumComponents = res.throughput.t_compute + res.throughput.t_allreduce + res.throughput.t_pipeline + res.throughput.t_kv_transfer;
    assert.ok(
      Math.abs(res.throughput.ttftSec - sumComponents) < 1e-9,
      `Expected ttftSec (${res.throughput.ttftSec}) to equal sum of components (${sumComponents}) within 1e-9`
    );
  });
});

describe('6. Disaggregated Serving (LLM-D) & Cisco RoCEv2 Transfer', () => {
  it('correctly partitions Prefill pool (0 KV) and Decode pool (KV capacity bound)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      contextLength: 16384,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2',
      servingConfig: {
        servingEngine: 'vllm',
        orchestrator: 'kserve',
        servingArchitecture: 'llmd',
        llmdDisaggregationMode: 'homogeneous',
        prefillNodes: 1,
        decodeNodes: 2
      }
    });

    const llmd = res.memory.llmd;
    assert.ok(llmd !== null);
    assert.equal(llmd.isDisaggregated, true);
    // Prefill pool holds transient KV budget: kvBytesPerToken × maxBatchedTokens (0.168 GB per GPU)
    assert.equal(Math.round(llmd.prefill.kvGb * 1000) / 1000, 0.168); // updated: M3
    // Decode pool holds the active KV cache
    assert.ok(llmd.decode.kvGb > 0);
    // Lossless RoCEv2 transfer metrics are computed
    assert.ok(llmd.kvTransfer.promptKvChunkGb > 0);
    assert.ok(llmd.kvTransfer.kvTransferLatencyMs > 0);
  });

  it('M3: calculates transient KV budget for prefill pool and parallel NIC KV transfer with overlap', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      contextLength: 16384,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2',
      servingConfig: {
        servingEngine: 'vllm',
        orchestrator: 'kserve',
        servingArchitecture: 'llmd',
        llmdDisaggregationMode: 'homogeneous',
        prefillNodes: 1,
        decodeNodes: 2
      }
    });

    const llmd = res.memory.llmd;
    // Llama 70B FP8 KV cache: 2 * 80 layers * 8 kvHeads * 128 headDim * 1.0 = 163,840 bytes/token
    // Transient budget = 163,840 * 8192 (maxBatchedTokens) = 1,342,177,280 bytes = 1.34217728 GB
    const expectedTransientGb = (163840 * CONFIG.maxBatchedTokens) / 1e9;
    assert.equal(Math.round(llmd.prefill.transientKvGb * 1000) / 1000, Math.round(expectedTransientGb * 1000) / 1000);
    // Per-GPU: divided by (min(TP=8, H_kv=8) * PP=1) = 8 -> ~0.168 GB
    assert.equal(Math.round(llmd.prefill.kvGb * 1000) / 1000, Math.round((expectedTransientGb / 8) * 1000) / 1000);

    // KV transfer over parallel NICs (min(TP=8, nicsPerNode=8) = 8 NICs)
    assert.equal(llmd.kvTransfer.parallelNics, 8);
    // Overlapped transfer adds only 1 / layers of full transfer
    const layers = llama70b.layers; // 80
    assert.equal(llmd.kvTransfer.isOverlapped, true);
    assert.ok(
      Math.abs(llmd.kvTransfer.kvTransferSec - (llmd.kvTransfer.totalTransferMs / 1000 / layers)) < 1e-4,
      `Expected kvTransferSec to equal totalTransfer / L`
    );
  });
});

describe('7. Datacenter BOM, Facilities & Rail-Optimized Network', () => {
  it('sizes modular Cisco UCS X9508 enclosures and fabric interconnects', () => {
    const llama70b = getModel('llama3-70b');
    const l40s = getGpu('l40s-pcie');
    const modularPlatform = getPlatform('cisco-x-series-l40s'); // 4 pairs per 7U chassis

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 4,
      gpu: l40s,
      platform: modularPlatform,
      tp: 4, pp: 1, dp: 2, // 8 GPUs total = 2 blade pairs
      networkProtocol: 'rocev2',
      pue: 1.35
    });

    assert.equal(res.bom.isModular, true);
    assert.equal(res.bom.platformVendor, 'cisco');
    assert.ok(res.bom.fabricInterconnectModel.includes('6536'));
    assert.ok(res.facility.totalFacilityPowerKw > res.facility.totalItPowerKw);
  });

  it('sizes rail-optimized leaf-spine network switch counts and 1:1 non-blocking bisection', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // 4 nodes = 32 GPUs
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 4, dp: 1, // 32 GPUs = 4 chassis
      networkProtocol: 'rocev2',
      pue: 1.35
    });

    assert.equal(res.nodes, 4);
    assert.equal(res.totalGpus, 32);
    // Single tier when N_gpus <= CONFIG.switchPorts (64)
    assert.equal(res.network.leafSwitches, 1); // updated: C3
    assert.equal(res.network.spineSwitches, 0); // updated: C3
    assert.equal(res.network.uplinkCables, 0); // updated: C3
    assert.equal(res.network.downlinkCables, 32); // updated: C3
    assert.ok(res.facility.totalRacks >= 1);
  });

  it('bisection bandwidth equals N x per-NIC speed for a 1:1 non-blocking fabric (not 2x)', () => {
    // True bisection bandwidth splits N nodes into two halves of N/2; only N/2 links cross
    // the cut, each counted full-duplex (x2), giving (N/2) * speed * 2 = N * speed. It must
    // NOT equal the cluster's total aggregate full-duplex NIC bandwidth (N * speed * 2),
    // which is a different (larger) number entirely.
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 4, dp: 1, // 32 GPUs
      networkProtocol: 'rocev2',
      pue: 1.35
    });

    const expectedTbps = (res.network.totalComputeNics * res.network.nicSpeedGbps) / 1000;
    assert.equal(res.network.totalClusterBisectionTbps, expectedTbps);
    assert.equal(res.network.totalComputeNics, 32);
    assert.equal(res.network.nicSpeedGbps, 400);
    assert.equal(res.network.totalClusterBisectionTbps, 12.8); // 32 * 400 / 1000, NOT 25.6
  });

  it('C3: sizes 32 nodes (256 GPUs) to 8 leaves, 4 spines, 256 uplink cables', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    // 32 nodes * 8 GPUs = 256 GPUs (e.g. TP=8, PP=4, DP=8)
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 4, dp: 8,
      networkProtocol: 'rocev2',
      pue: 1.35
    });

    assert.equal(res.nodes, 32);
    assert.equal(res.totalGpus, 256);
    assert.equal(res.network.leafSwitches, 8);
    assert.equal(res.network.spineSwitches, 4);
    assert.equal(res.network.uplinkCables, 256);
    assert.equal(res.network.downlinkCables, 256);
    assert.equal(res.network.transceivers, 1024);
  });

  it('M2: packs 5 x (8U, 10.2 kW) chassis into 3 compute racks', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm'); // 8U, 10.2 kW
    const platform = getPlatform('cisco-c885a-h100');

    // 5 nodes = 40 GPUs (TP=8, PP=5, DP=1)
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 4,
      gpu: h100,
      platform,
      tp: 8, pp: 5, dp: 1,
      networkProtocol: 'rocev2',
      rackKw: 28
    });

    assert.equal(res.nodes, 5);
    // perRack = floor(min(40 / 8, 28000 / 10200)) = floor(min(5, 2.745)) = 2
    assert.equal(res.facility.perRack, 2);
    // 5 chassis / 2 per rack = 3 compute racks
    assert.equal(res.facility.computeRacks, 3);
  });

  it('M1: verifies facility total power, cooling overhead, optics power and switch power', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const pue = 1.35;
    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      contextLength: 4096,
      concurrency: 8,
      gpu: h100,
      platform,
      tp: 8, pp: 4, dp: 8, // 32 nodes
      networkProtocol: 'rocev2',
      pue
    });

    // facilityTotalPower = IT * PUE
    assert.equal(
      Math.round(res.facility.facilityTotalPower * 1000) / 1000,
      Math.round(res.facility.totalItPowerKw * pue * 1000) / 1000
    );
    // coolingOverhead = IT * (PUE - 1)
    assert.equal(
      Math.round(res.facility.coolingOverhead * 1000) / 1000,
      Math.round(res.facility.totalItPowerKw * (pue - 1) * 1000) / 1000
    );
    // optics power = transceivers * 15W
    const expectedOpticsKw = (res.network.transceivers * 15) / 1000;
    assert.equal(res.facility.opticsPowerKw, expectedOpticsKw);
    // switch power total = (leaves + spines) * 1.8 kW
    const expectedSwitchKw = (res.network.leafSwitches + res.network.spineSwitches) * 1.8;
    assert.equal(res.facility.switchPowerKw, expectedSwitchKw);
  });
});

describe('8. Massive-Scale Data Parallel Replica Sizing (S7)', () => {
  it('DP replicas split concurrency for per-GPU KV/activation sizing (regression: DP previously did not relieve memory pressure)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const base = {
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      contextLength: 8192,
      gpu: h100,
      platform,
      tp: 2, pp: 1,
      networkProtocol: 'rocev2'
    };

    // 40 replicas serving 2000 total concurrent streams == 50 streams/replica.
    const resScaled = calculateInfra({ ...base, concurrency: 2000, dp: 40 });
    // A single replica serving 50 concurrent streams directly.
    const resSingle = calculateInfra({ ...base, concurrency: 50, dp: 1 });

    assert.equal(resScaled.totalGpus, 80);
    assert.equal(
      Math.round(resScaled.memory.perGpuKvOrOptGb * 100) / 100,
      Math.round(resSingle.memory.perGpuKvOrOptGb * 100) / 100,
      `Expected per-GPU KV cache to match a single replica at the per-replica concurrency (50 streams): got ${resScaled.memory.perGpuKvOrOptGb} vs ${resSingle.memory.perGpuKvOrOptGb}`
    );
    assert.equal(resScaled.memory.isOOM, false, 'A properly-scaled DP fleet should not report OOM');
  });

  it('recommendSharding\'s auto-computed DP, fed back into calculateInfra, fits without OOM at high concurrency (~4000 streams)', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const rec = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 8192,
      concurrency: 4000,
      gpu: h100,
      platform
    });

    assert.ok(rec.dp > 1, `Expected recommendSharding to scale DP above 1 for 4000 concurrent streams, got DP=${rec.dp}`);

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 8192,
      concurrency: 4000,
      gpu: h100,
      platform,
      tp: rec.tp, pp: rec.pp, dp: rec.dp,
      networkProtocol: 'rocev2'
    });

    assert.equal(
      res.memory.isOOM, false,
      `Expected the auto-sharding solver's own DP recommendation to fit without OOM, but each GPU needs ${res.memory.perGpuTotalUsedGb.toFixed(1)} GB of ${res.memory.usableGpuCapacityGb.toFixed(1)} GB usable`
    );
  });

  it('rounds DP up to cover a whole number of streams per replica (regression: fractional-average DP estimate under-provisioned by ~2.9 GB/GPU)', () => {
    const llama70b = getModel('llama3-70b');
    const h200 = getGpu('h200-sxm');
    const platform = getPlatform('cisco-c885a-h200');

    const rec = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp16', // deliberately not fp8: this is what exposed the rounding gap
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 16384,
      concurrency: 4096,
      gpu: h200,
      platform
    });

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp16',
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 16384,
      concurrency: 4096,
      gpu: h200,
      platform,
      tp: rec.tp, pp: rec.pp, dp: rec.dp,
      networkProtocol: 'rocev2'
    });

    assert.equal(
      res.memory.isOOM, false,
      `Expected recommendSharding's DP=${rec.dp} to fit each replica's whole-number stream share without OOM, but each GPU needs ${res.memory.perGpuTotalUsedGb.toFixed(1)} GB of ${res.memory.usableGpuCapacityGb.toFixed(1)} GB usable`
    );
  });

  it('closes a large rounding gap at extreme concurrency (regression: a bounded +1-per-iteration DP correction silently under-provisioned by thousands of GPUs)', () => {
    // At high replica counts, closing the whole-number-streams-per-replica rounding gap by
    // one stream can require adding hundreds or thousands of replicas at once (the needed DP
    // step size grows with concurrency / streamsPerReplica^2). A correction that only nudges
    // DP up by 1 at a time, bounded to a small number of iterations, silently stops short at
    // exactly this scale. 16,384 concurrent streams against a 32k context is large enough to
    // require a four-figure correction, not a handful of replicas.
    const llama70b = getModel('llama3-70b');
    const h200 = getGpu('h200-sxm');
    const platform = getPlatform('cisco-c885a-h200');

    const rec = recommendSharding({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 32768,
      concurrency: 16384,
      gpu: h200,
      platform
    });

    const res = calculateInfra({
      workloadType: 'inference',
      model: llama70b,
      precision: getPrecision('fp8'),
      kvPrecision: 'fp8',
      prefixCacheRatio: 0,
      promptTokenRatio: 0.8,
      contextLength: 32768,
      concurrency: 16384,
      gpu: h200,
      platform,
      tp: rec.tp, pp: rec.pp, dp: rec.dp,
      networkProtocol: 'rocev2'
    });

    assert.equal(
      res.memory.isOOM, false,
      `Expected recommendSharding's DP=${rec.dp} to fit 16,384 concurrent streams without OOM, but each GPU needs ${res.memory.perGpuTotalUsedGb.toFixed(1)} GB of ${res.memory.usableGpuCapacityGb.toFixed(1)} GB usable`
    );
  });

  it('sizes a 2,048-GPU training run (TP=8, PP=4, DP=64) without breaking network/facility math', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const res = calculateInfra({
      workloadType: 'training',
      trainingType: 'pretrain_sft',
      model: llama70b,
      precision: getPrecision('fp16'),
      contextLength: 4096,
      concurrency: 2,
      gpu: h100,
      platform,
      tp: 8, pp: 4, dp: 64,
      zeroStage: 3,
      networkProtocol: 'rocev2',
      pue: 1.35
    });

    assert.equal(res.totalGpus, 2048);
    assert.equal(res.nodes, 256);
    assert.ok(res.network.leafSwitches > 0);
    assert.ok(res.facility.totalRacks > 0);
    assert.ok(Number.isFinite(res.facility.totalItPowerKw) && res.facility.totalItPowerKw > 0);
    assert.ok(Number.isFinite(res.memory.perGpuTotalUsedGb));
  });

  it('LLM-D decode pool KV cache scales down as more decode replicas are added', () => {
    const llama70b = getModel('llama3-70b');
    const h100 = getGpu('h100-sxm');
    const platform = getPlatform('cisco-c885a-h100');

    const servingConfigFor = (decodeNodes) => ({
      servingEngine: 'vllm', orchestrator: 'kserve', servingArchitecture: 'llmd',
      llmdDisaggregationMode: 'homogeneous', prefillNodes: 1, decodeNodes
    });

    const small = calculateInfra({
      workloadType: 'inference', model: llama70b, precision: getPrecision('fp8'), kvPrecision: 'fp8',
      contextLength: 8192, concurrency: 1600, gpu: h100, platform, tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2', servingConfig: servingConfigFor(2)
    });
    const large = calculateInfra({
      workloadType: 'inference', model: llama70b, precision: getPrecision('fp8'), kvPrecision: 'fp8',
      contextLength: 8192, concurrency: 1600, gpu: h100, platform, tp: 8, pp: 1, dp: 1,
      networkProtocol: 'rocev2', servingConfig: servingConfigFor(20)
    });

    assert.ok(
      large.memory.llmd.decode.kvGb < small.memory.llmd.decode.kvGb,
      `Expected per-GPU decode KV cache to shrink as decode replicas grow (2 nodes: ${small.memory.llmd.decode.kvGb.toFixed(2)} GB vs 20 nodes: ${large.memory.llmd.decode.kvGb.toFixed(2)} GB)`
    );
  });
});
