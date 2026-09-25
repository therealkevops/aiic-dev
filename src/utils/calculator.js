/**
 * Core Sizing & Network Topology Calculator for Private AI Infrastructure
 */
import { GPU_CATALOG } from '../data/hardware.js';
import { MIG_PROFILES, maxInstancesPerGpu } from '../data/mig.js';

// ─── Exported Configuration & Tunables ─────────────────────────────────────────
export const CONFIG = {
  B_act: 2,                     // BF16 activation bytes (G2)
  maxBatchedTokens: 8192,       // Default max batched tokens per step (C1)
  runtimeOverheadPerGpu: 0,     // Absorbed into 10% reserve via gpuMemUtil = 0.90 (S3)
  bwEfficiency: 0.75,           // Memory bandwidth efficiency (C2)
  mfuDecode: 0.4,               // Model FLOPs Utilization during decode (C2)
  allreduceLatency: 15e-6,      // Intra-node All-Reduce communication latency per layer in seconds (C2)
  switchPorts: 64,              // Standard 64-port leaf switch (C3)
  oversubscription: 1,          // 1:1 non-blocking leaf-spine fabric (C3)
  nvlinkBwUni: 450e9,           // Unidirectional NVLink bandwidth (450 GB/s for H100/H200, 900 GB/s for B200) (C4)
  pcieBw: 50e9,                 // PCIe Gen5 unidirectional bandwidth for non-NVLink platforms (C4, S7)
  ep: 1,                        // Expert Parallelism divisor for MoE routed weights (S1)
  ppImbalance: 1.1,             // Pipeline imbalance factor when PP > 1 (S2)
  gpuMemUtil: 0.90,             // Usable VRAM utilization factor (vLLM default 0.90) (S3)
  minKvStreams: 1,              // Minimum KV streams floor for TP/PP sizing (S5)
  maxPP: 8,                     // Maximum allowable pipeline parallelism before error (S5)
  recompute: 'selective',       // 'none' | 'selective' | 'full' activation recomputation (S6)
  loraRank: 16,                 // Default LoRA rank (S6)
  opticW: 15,                   // Optical transceiver power in Watts (M1)
  switchPowerW: 1800,           // Switch power in Watts // verify vs datasheet (M1)
  rackRU: 40,                   // Standard usable RU per rack (M2)
  rackKW: 28,                   // Default rack power limit in kW (M2)
  overlapKvTransfer: true,      // Disaggregated serving: overlap KV transfer with computation (M3)
  a2aLatency: 30e-6,            // Per-MoE-layer dispatch or combine latency across nodes (wide EP), seconds -- approximate
};

const VRAM_USABLE_FACTOR = CONFIG.gpuMemUtil;
/** Fraction of physical GPU memory the sizing may fill: the runtime reserve minus any extra headroom. */
function usableMemoryFactor(memoryHeadroomPct = 0) {
  return VRAM_USABLE_FACTOR * (1 - Math.min(50, Math.max(0, memoryHeadroomPct)) / 100);
}
const RACK_USABLE_RU = CONFIG.rackRU;
const DEFAULT_SWITCH_POWER_KW = 3.5;

// ─── Helper ───────────────────────────────────────────────────────────────────
/**
 * KV-cache bytes stored per token of one sequence, averaged over a sequence of `contextLength`
 * tokens.
 *  - MLA models (DeepSeek, Kimi K2) cache one compressed latent per layer: L × (512 + 64).
 *  - GQA/MHA models cache K and V per KV head: 2 × L × H_kv × D_head.
 *  - Hybrid-attention models (Gemma 3, gpt-oss, Llama 4) have `localLayers` layers that only
 *    attend within a `localWindow`-token window, so those layers never hold more than the
 *    window. Averaged over the sequence they count as min(1, window / context) of a layer.
 */
export function kvBytesPerToken(model, kvBytesPerElement, contextLength) {
  const layers = model.layers || 32;
  const localLayers = Math.min(layers, model.localLayers || 0);
  const window = model.localWindow || 0;
  const ctx = Math.max(1, contextLength || 1);
  const effectiveLayers = localLayers > 0 && window > 0
    ? (layers - localLayers) + localLayers * Math.min(1, window / ctx)
    : layers;
  if (model.isMla) return effectiveLayers * (512 + 64) * kvBytesPerElement;
  const kvHeads = model.kvHeads || 8;
  const headDim = model.headDim || 128;
  return 2 * effectiveLayers * kvHeads * headDim * kvBytesPerElement;
}

/**
 * Splits total weight memory into the routed-expert part and everything else (attention,
 * shared experts, dense layers, embeddings), in proportion to the model's parameter split.
 * Dense models are all "non-expert".
 */
export function splitExpertWeightsGb(model, weightTotalGb) {
  if (!model.isMoe || !model.P_routedExperts || !model.params) return { routedGb: 0, nonExpertGb: weightTotalGb };
  const routedGb = weightTotalGb * Math.min(1, model.P_routedExperts / model.params);
  return { routedGb, nonExpertGb: weightTotalGb - routedGb };
}

/**
 * Per-GPU weight memory for a replica: non-expert weights split by TP (and PP), routed experts
 * additionally spread over `epNodes` chassis under wide expert parallelism.
 */
function perGpuWeightGbFor(model, weightTotalGb, tp, pp, epNodes = 1) {
  const { routedGb, nonExpertGb } = splitExpertWeightsGb(model, weightTotalGb);
  return nonExpertGb / (tp * pp) + routedGb / (tp * pp * Math.max(1, epNodes));
}

/**
 * Peak dense tensor throughput (FLOP/s) a GPU delivers for a given weight precision.
 * FP8 uses FP8 Tensor Cores; NVFP4/MXFP4 use native FP4 units where the GPU has them
 * (Blackwell, MI355X) and otherwise fall back to 16-bit math on dequantized weights, the
 * same as weight-only INT4 (AWQ/GPTQ), which always computes in FP16/BF16.
 */
export function peakDenseFlops(gpu, precision) {
  const fp16 = (gpu.fp16Tflops || 989) * 1e12;
  if (precision.id === 'fp8') return (gpu.fp8Tflops || (gpu.fp16Tflops ? gpu.fp16Tflops * 2 : 1979)) * 1e12;
  if ((precision.id === 'nvfp4' || precision.id === 'mxfp4') && gpu.fp4Tflops) return gpu.fp4Tflops * 1e12;
  return fp16;
}

/**
 * Human-readable name of the fabric carrying disaggregated-serving KV transfers.
 * Only name Cisco Nexus when the platform is actually a Cisco one.
 */
export function kvFabricName(networkProtocol, platform) {
  if (networkProtocol === 'infiniband') return 'InfiniBand';
  return platform?.vendor === 'cisco' ? 'Cisco Nexus RoCEv2' : 'RoCEv2';
}

/**
 * Returns the hidden dimension (num_heads × head_dim) for activation memory sizing.
 * Falls back to a reasonable estimate if numHeads is not specified on the model.
 */
function getHiddenDim(model) {
  const numHeads = model.numHeads || 32;
  const headDim  = model.headDim  || 128;
  return numHeads * headDim;
}

/**
 * Computes weight bytes read during autoregressive decode (S1).
 * For dense models: returns P * B_param (in bytes).
 * For MoE models: incorporates routing activation probability:
 *   fracTouched = 1 - (1 - k/E)^(tokensPerStep)
 *   bytes = (P_nonExpert + (P_routedExperts / EP) * fracTouched) * B_param
 */
export function decodeWeightBytes(model, customParams, precision, ep = 1, tokensPerStep = 1) {
  const isMoe = !!model.isMoe;
  const totalParams = model.id === "custom" ? (Number(customParams) || 32) : model.params;
  const bParam = precision.bytesPerParam;

  if (!isMoe) {
    return totalParams * 1e9 * bParam;
  }

  const k = model.activeExperts || 8;
  const E = model.routedExperts || 256;
  const pNonExpert = (model.P_nonExpert != null ? model.P_nonExpert : (model.activeParams || totalParams * 0.1)) * 1e9;
  const pRouted = (model.P_routedExperts != null ? model.P_routedExperts : (totalParams - (pNonExpert / 1e9))) * 1e9;
  const fracTouched = 1 - Math.pow(1 - k / E, tokensPerStep);

  return (pNonExpert + (pRouted / (ep || 1)) * fracTouched) * bParam;
}

/**
 * Calculates total trainable parameters for a LoRA adapter (S6).
 * P_adapter = r × Σ(d_in + d_out) over target linear layers across all L layers.
 * Linear layers: Q, K, V, O projections (Attention) + Gate, Up, Down projections (MLP/SwiGLU).
 */
export function calculateLoraParams(model, rank = CONFIG.loraRank || 16) {
  const layers = model.layers || 32;
  const hidden = model.hidden || getHiddenDim(model);
  const headDim = model.headDim || 128;
  const kvHeads = model.kvHeads || model.numHeads || 32;
  const intermediate = model.intermediate || (hidden * 4);
  const d_k = kvHeads * headDim;

  // Q: hidden -> hidden
  // K: hidden -> d_k
  // V: hidden -> d_k
  // O: hidden -> hidden
  // Gate: hidden -> intermediate
  // Up: hidden -> intermediate
  // Down: intermediate -> hidden
  const sumLinearDimsPerLayer = (hidden + hidden)
    + (hidden + d_k)
    + (hidden + d_k)
    + (hidden + hidden)
    + (hidden + intermediate)
    + (hidden + intermediate)
    + (intermediate + hidden);

  const totalAdapterParams = layers * rank * sumLinearDimsPerLayer;
  return totalAdapterParams / 1e9; // in Billions
}

/**
 * Recommends mathematically optimal Tensor Parallelism (TP) and Pipeline Parallelism (PP)
 * based on preceding workload variables (Model, Precision, Context, Concurrency, GPU / Platform).
 */
export function recommendSharding(params) {
  const {
    workloadType,
    model,
    customParams,
    precision,
    kvPrecision = "fp16",
    prefixCacheRatio = 0,
    globalPrefixTokens = null,
    sessionReuseRatio = 0,
    promptTokenRatio = 0.8,
    contextLength,
    concurrency,
    gpu,
    platform,
    trainingType,
    zeroStage,
    // Extra % of usable memory to keep free (on top of the 10% runtime reserve), so a design
    // isn't sized to the last gigabyte.
    memoryHeadroomPct = 0,
    // Latency-driven sizing: use at least this TP (within the chassis) even if a smaller TP fits.
    minTp = 1,
    // Wide expert parallelism (MoE inference): spread each replica's routed experts across this
    // many chassis, with TP = the chassis size inside each one.
    expertParallelNodes = 1,
    // Mean tokens per stream when requests vary in length (null = every stream at contextLength).
    // contextLength stays the per-request maximum (single-stream fit, max-model-len).
    avgContextLength = null,
  } = params;
  const meanSeqTokens = avgContextLength ? Math.min(contextLength, Math.max(1, avgContextLength)) : contextLength;
  const epNodes = (workloadType === 'inference' && model.isMoe) ? Math.max(1, Math.floor(expertParallelNodes) || 1) : 1;

  const totalParams    = model.id === "custom" ? (Number(customParams) || 32) : model.params;
  const layers         = model.layers  || 32;
  const kvHeads        = model.kvHeads || 8;
  const headDim        = model.headDim || 128;
  const hiddenDim      = model.hidden || getHiddenDim(model);
  const intermediate   = model.intermediate || (hiddenDim * 4);
  const vocab          = model.vocab || 32000;
  const gpusPerChassis = platform ? platform.gpusPerChassis : (gpu.gpusPerChassis || 8);

  let totalReplicaMemoryGb = 0;
  let mActBytes = 0;

  if (workloadType === "inference") {
    // Model weights (at selected precision)
    // S4: When weights are quantised, add embedding and lm_head weights at BF16: 2 × vocab × hidden × 2 bytes
    const isQuantized = precision.isQuantized != null ? precision.isQuantized : (precision.bytesPerParam < 2.0);
    // S4 fix: the head params' bytes were being counted twice (once at the quantized
    // rate via totalParams, again at BF16 via unquantizedHeadBytes) -- subtract them
    // out of the quantized term before re-pricing them at BF16.
    const headParamsCount = isQuantized ? (2 * vocab * hiddenDim) : 0;
    const unquantizedHeadBytes = headParamsCount * 2;
    const weightGb = ((totalParams * 1e9 - headParamsCount) * precision.bytesPerParam + unquantizedHeadBytes) / 1e9;

    // KV Cache with configurable precision (FP16: 2B, FP8: 1B, INT4: 0.5B)
    let kvBytesPerElement = 2.0;
    if (kvPrecision === "fp8") {
      kvBytesPerElement = 1.0;
    } else if (kvPrecision === "int4") {
      kvBytesPerElement = 0.5;
    }

    const bytesPerTokenSeq = kvBytesPerToken(model, kvBytesPerElement, contextLength);

    const promptTokens = Math.round(contextLength * promptTokenRatio);
    // M4: Split prefixCacheRatio into globalPrefixTokens (stored 1x) and sessionReuseRatio (stored per stream)
    const effectiveGlobalPrefixTokens = globalPrefixTokens != null
      ? Math.min(promptTokens, Math.max(0, globalPrefixTokens))
      : Math.round(promptTokens * prefixCacheRatio);
    const privateTokensPerStream = contextLength - effectiveGlobalPrefixTokens;
    const effectiveTotalTokens = concurrency > 1
      ? (privateTokensPerStream * concurrency) + (effectiveGlobalPrefixTokens * 1)
      : contextLength;

    // S5: Size TP and PP for weights plus a KV floor of CONFIG.minKvStreams = 1 at context S
    const kvFloorGb = (bytesPerTokenSeq * contextLength * CONFIG.minKvStreams) / 1e9;

    // C1: Inference activation memory: tokensPerStep × (hidden + 2 × intermediate) × B_act × 1.2 + maxNumSeqs × vocab × 4
    const tokensPerStep = CONFIG.maxBatchedTokens;
    mActBytes = (tokensPerStep * (hiddenDim + 2 * intermediate) * CONFIG.B_act * 1.2) + (CONFIG.minKvStreams * vocab * 4);
    const actGb = (mActBytes / 1e9) + (CONFIG.runtimeOverheadPerGpu / 1e9);
    totalReplicaMemoryGb = weightGb + kvFloorGb + actGb;

  } else {
    // Training mode
    const isQuantized = precision.isQuantized != null ? precision.isQuantized : (precision.bytesPerParam < 2.0);
    // S4 fix: the head params' bytes were being counted twice (once at the quantized
    // rate via totalParams, again at BF16 via unquantizedHeadBytes) -- subtract them
    // out of the quantized term before re-pricing them at BF16.
    const headParamsCount = isQuantized ? (2 * vocab * hiddenDim) : 0;
    const unquantizedHeadBytes = headParamsCount * 2;
    const weightGb = ((totalParams * 1e9 - headParamsCount) * precision.bytesPerParam + unquantizedHeadBytes) / 1e9;

    // S6: FlashAttention activation memory per layer
    const s = contextLength;
    const b = concurrency;
    const h = hiddenDim;
    let actPerLayer = 0;
    if (CONFIG.recompute === 'full') {
      actPerLayer = 2 * s * b * h * CONFIG.B_act;
    } else if (CONFIG.recompute === 'selective') {
      actPerLayer = 34 * s * b * h * (CONFIG.B_act / 2);
    } else {
      actPerLayer = 34 * s * b * h * CONFIG.B_act;
    }
    const actGb = (layers * actPerLayer) / 1e9;

    if (trainingType === "lora") {
      const rank = params.loraRank || CONFIG.loraRank || 16;
      const adapterParams = calculateLoraParams(model, rank);
      const adapterGb = adapterParams * 14; // 2 bytes weights + 12 bytes Adam states
      totalReplicaMemoryGb = weightGb + adapterGb + actGb;
    } else {
      // Full SFT / Pre-training (mixed precision: fp16 weights + fp32 Adam states)
      const gradGb   = totalParams * 2;   // fp16 gradients
      const optGb    = totalParams * 12;  // fp32 Adam: params + m + v
      totalReplicaMemoryGb = weightGb + gradGb + optGb + actGb;
    }
  }

  // Safe usable VRAM per GPU (shared constant — same buffer used in OOM check)
  const usableGpuVramGb     = gpu.vramGb * usableMemoryFactor(memoryHeadroomPct);
  const singleNodeCapacityGb = gpusPerChassis * usableGpuVramGb;

  // Helper: S5 TP must divide H_q. If it doesn't, step down to the next divisor.
  const numHeads = model.numHeads || 32;
  function getValidTp(candidateTp, qHeads) {
    let t = Math.min(candidateTp, qHeads);
    while (t > 1) {
      if (qHeads % t === 0) return t;
      t--;
    }
    return 1;
  }

  let recommendedTp   = 1;
  let recommendedPp   = 1;
  let fitsInOneNode   = true;
  let rationale       = "";
  let error           = null;

  if (totalReplicaMemoryGb <= usableGpuVramGb) {
    recommendedTp = getValidTp(1, numHeads);
    recommendedPp = 1;
    fitsInOneNode = true;
    rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) fits easily on a single ${gpu.name}. No model parallelism is required (TP=1, PP=1).`;
  } else if (totalReplicaMemoryGb <= 2 * usableGpuVramGb) {
    recommendedTp = getValidTp(2, numHeads);
    recommendedPp = 1;
    fitsInOneNode = true;
    rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) fits across 2 GPUs inside 1 chassis. TP=${recommendedTp} splits matrix operations over NVLink. Pipeline Parallelism is unnecessary (PP=1).`;
  } else if (totalReplicaMemoryGb <= 4 * usableGpuVramGb) {
    recommendedTp = getValidTp(4, numHeads);
    recommendedPp = 1;
    fitsInOneNode = true;
    rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) fits across 4 GPUs inside 1 chassis. TP=${recommendedTp} balances matrix multiplications over NVLink. Pipeline Parallelism is unnecessary (PP=1).`;
  } else if (totalReplicaMemoryGb <= singleNodeCapacityGb) {
    const candidateTp = gpusPerChassis >= 8 ? 8 : gpusPerChassis;
    recommendedTp = getValidTp(candidateTp, numHeads);
    recommendedPp = 1;
    fitsInOneNode = true;
    rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) fits within a single ${gpusPerChassis}-GPU chassis (${singleNodeCapacityGb.toFixed(0)} GB usable). TP=${recommendedTp} maxes out the internal NVLink bus with zero inter-node network latency (PP=1).`;
  } else {
    // Exceeds a single chassis — need Pipeline Parallelism across nodes
    const candidateTp = gpusPerChassis >= 8 ? 8 : gpusPerChassis;
    recommendedTp = getValidTp(candidateTp, numHeads);
    const nodeCapacityWithTp = recommendedTp * usableGpuVramGb;
    const neededNodes = Math.ceil(totalReplicaMemoryGb / nodeCapacityWithTp);
    recommendedPp = neededNodes; // S5: Remove power-of-two rounding
    fitsInOneNode = false;

    // S5: If PP > CONFIG.maxPP, return error
    if (recommendedPp > CONFIG.maxPP) {
      error = "Model does not fit; increase GPU memory or quantise";
      rationale = error;
    } else {
      rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) exceeds a single ${gpusPerChassis}-GPU chassis (${singleNodeCapacityGb.toFixed(0)} GB usable). TP is locked to ${recommendedTp} to maximize NVLink speeds inside each node, and Pipeline Parallelism is enabled at PP=${recommendedPp} to partition layers across ${recommendedPp} separate server nodes.`;
    }
  }

  // Latency-driven override: a larger TP than memory alone requires (single-chassis only).
  if (!error && recommendedPp === 1 && minTp > recommendedTp) {
    const forcedTp = getValidTp(Math.min(minTp, gpusPerChassis), numHeads);
    if (forcedTp > recommendedTp) {
      rationale = `Workload base (~${totalReplicaMemoryGb.toFixed(1)} GB) would fit at TP=${recommendedTp}, but TP=${forcedTp} is used: splitting each replica across ${forcedTp} GPUs over NVLink needs fewer GPUs in total (the weights are stored once per replica) or is needed to meet the latency target. PP=1.`;
      recommendedTp = forcedTp;
    }
  }

  // Wide EP: the replica spans epNodes chassis at full in-chassis TP, with no pipeline stages.
  if (epNodes > 1) {
    const epTp = getValidTp(gpusPerChassis, numHeads);
    const { routedGb, nonExpertGb } = splitExpertWeightsGb(model, totalReplicaMemoryGb);
    const perGpuGb = nonExpertGb / epTp + routedGb / (epTp * epNodes);
    recommendedTp = epTp;
    recommendedPp = 1;
    fitsInOneNode = false;
    if (perGpuGb > usableGpuVramGb) {
      error = "Model does not fit; increase GPU memory or quantise";
      rationale = `Even spread across ${epNodes} chassis with expert parallelism, each GPU would need ~${perGpuGb.toFixed(0)} GB. Add chassis to the expert-parallel group, quantise, or pick higher-memory GPUs.`;
    } else {
      error = null;
      rationale = `Wide expert parallelism: each replica spans ${epNodes} chassis (${epTp * epNodes} GPUs). Attention and shared weights use TP=${epTp} inside each chassis; the ${model.routedExperts || ''} routed experts are spread across all ${epTp * epNodes} GPUs, so no pipeline stages are needed.`;
    }
  }

  // S5: Set DP = ceil(requiredKvForC / kvCapacityPerReplica). Concurrency scales DP, not TP.
  let recommendedDp = 1;
  if (workloadType === "inference") {
    let bytesPerTokenSeq;
    let kvBytesPerElement = 2.0;
    if (kvPrecision === "fp8") kvBytesPerElement = 1.0;
    else if (kvPrecision === "int4") kvBytesPerElement = 0.5;

    bytesPerTokenSeq = kvBytesPerToken(model, kvBytesPerElement, contextLength);

    const promptTokens = Math.round(contextLength * promptTokenRatio);
    const effectiveGlobalPrefixTokens = globalPrefixTokens != null
      ? Math.min(promptTokens, Math.max(0, globalPrefixTokens))
      : Math.round(promptTokens * prefixCacheRatio);
    const privateTokensPerStream = Math.max(1, meanSeqTokens - effectiveGlobalPrefixTokens);
    const effectiveTotalTokens = concurrency > 1
      ? (privateTokensPerStream * concurrency) + (effectiveGlobalPrefixTokens * 1)
      : contextLength;
    const requiredKvForC = (bytesPerTokenSeq * effectiveTotalTokens) / 1e9;

    const isQuantized = precision.isQuantized != null ? precision.isQuantized : (precision.bytesPerParam < 2.0);
    // S4 fix: the head params' bytes were being counted twice (once at the quantized
    // rate via totalParams, again at BF16 via unquantizedHeadBytes) -- subtract them
    // out of the quantized term before re-pricing them at BF16.
    const headParamsCount = isQuantized ? (2 * vocab * hiddenDim) : 0;
    const unquantizedHeadBytes = headParamsCount * 2;
    const weightGb = ((totalParams * 1e9 - headParamsCount) * precision.bytesPerParam + unquantizedHeadBytes) / 1e9;

    const ppImbalanceFactor = recommendedPp > 1 ? CONFIG.ppImbalance : 1.0;
    const perGpuWeightGb = perGpuWeightGbFor(model, weightGb, recommendedTp, recommendedPp, epNodes) * ppImbalanceFactor;
    const perGpuActGb = (mActBytes / 1e9) / (recommendedTp * recommendedPp);
    const perGpuAvailForKvGb = Math.max(0, usableGpuVramGb - perGpuWeightGb - perGpuActGb);

    let kvCapacityPerReplica = 0;
    if (model.isMla) {
      kvCapacityPerReplica = perGpuAvailForKvGb * recommendedPp * epNodes;
    } else {
      const tpEff = Math.min(recommendedTp, kvHeads);
      kvCapacityPerReplica = perGpuAvailForKvGb * (tpEff * recommendedPp) * epNodes;
    }

    // Each replica actually serves a WHOLE number of streams (ceil(concurrency / dp)), not
    // the fractional average requiredKvForC / kvCapacityPerReplica implies. Solve directly
    // for the largest whole-number stream count one replica can hold, then derive dp from
    // that — this must be closed-form, not an incremental "+1 and recheck" search: at high
    // replica counts, closing the rounding gap by one stream/replica can require adding
    // hundreds or thousands of replicas at once (the required dp step size grows with
    // concurrency / streamsPerReplica^2), so a bounded per-1 loop silently stops short and
    // under-provisions DP at exactly the scale this matters most.
    if (kvCapacityPerReplica > 0 && privateTokensPerStream > 0) {
      const maxStreamsPerReplica = Math.max(
        1,
        Math.floor(((kvCapacityPerReplica * 1e9) / bytesPerTokenSeq - effectiveGlobalPrefixTokens) / privateTokensPerStream)
      );
      recommendedDp = Math.max(1, Math.ceil(concurrency / maxStreamsPerReplica));
    } else {
      recommendedDp = kvCapacityPerReplica > 0 ? Math.max(1, Math.ceil(requiredKvForC / kvCapacityPerReplica)) : 1;
    }
  }

  return {
    tp: recommendedTp,
    pp: recommendedPp,
    dp: recommendedDp,
    epNodes,
    fitsInOneNode,
    totalReplicaMemoryGb,
    singleNodeCapacityGb,
    rationale,
    error
  };
}

export function calculateInfra(config) {
  const {
    workloadType,    // "inference" | "training"
    model,           // model object
    customParams,    // number if custom
    precision,       // precision object
    kvPrecision = "fp16", // "fp16" | "fp8" | "int4"
    prefixCacheRatio = 0, // 0 to 0.8 (fraction of prompt shared across streams via automatic prefix caching)
    globalPrefixTokens = null, // M4: Global prefix tokens stored once in VRAM across streams
    sessionReuseRatio = 0,     // M4: Fraction of session prompt tokens reused per stream (saves prefill compute only)
    promptTokenRatio = 0.8, // 0.1 to 0.9 (fraction of context that is input prompt)
    contextLength,   // tokens (e.g., 8192)
    concurrency,     // batch size / concurrent streams (e.g., 4)
    gpu,             // gpu object
    platform,        // platform object (Cisco / NVIDIA)
    tp,              // tensor parallelism (1, 2, 4, 8)
    pp,              // pipeline parallelism (1, 2, 4...)
    dp,              // data parallelism (1, 2, 4...)
    trainingType,    // "pretrain_sft" | "lora"
    zeroStage,       // 0, 1, 2, 3
    networkProtocol, // "rocev2" | "infiniband"
    oversubscriptionRatio = 1, // leaf-spine uplink oversubscription for the rail-optimized fabric
                               // (1 = non-blocking, 2 = 2:1, etc.) -- halves spine switch count and
                               // effective bisection bandwidth per step, trading cost for bandwidth.
                               // Only affects the rail-optimized 2-tier Clos branch below; PCIe/modular
                               // topologies use a fixed uplink design regardless of this setting.
    pue = 1.35,      // facility PUE factor (default 1.35)
    servingConfig = null, // { servingEngine, orchestrator, servingArchitecture, enableChunkedPrefill, enablePrefixCaching }
    memoryHeadroomPct = 0, // extra % of usable memory kept free (see recommendSharding)
    expertParallelNodes = 1, // wide expert parallelism span in chassis (MoE, colocated inference)
    avgContextLength = null, // mean tokens per stream for a mixed request-length workload (see recommendSharding)
  } = config;
  const meanSeqTokens = avgContextLength ? Math.min(contextLength, Math.max(1, avgContextLength)) : contextLength;

  const totalParams = model.id === "custom" ? (Number(customParams) || 32) : model.params;
  const layers      = model.layers  || 32;
  const kvHeads     = model.kvHeads || 8;
  const headDim     = model.headDim || 128;
  const hiddenDim   = model.hidden || getHiddenDim(model);
  const intermediate = model.intermediate || (hiddenDim * 4);
  const vocab       = model.vocab || 32000;
  const isMoe       = !!model.isMoe;
  // For MoE: all expert weights must be loaded into VRAM for low-latency inference.
  // activeParams reflects compute throughput, not VRAM sizing.
  const activeParams = isMoe && model.activeParams ? model.activeParams : totalParams;

  const gpusPerChassis = platform ? platform.gpusPerChassis : (gpu.gpusPerChassis || 8);
  const chassisTdpKw   = platform ? platform.chassisTdpKw   : gpu.chassisTdpKw;
  const chassisHeightRu = platform ? platform.chassisHeightRu : gpu.chassisHeightRu;
  // Pull NIC speed from platform (B200 platforms use 800G ConnectX-8, others use 400G)
  const nicSpeedGbps   = platform?.nicSpeedGbps || gpu.nicSpeedGbps || 400;
  // M1: Switch power: CONFIG.switchPowerW (default 1800W) // verify vs datasheet
  const switchPowerKw  = (CONFIG.switchPowerW != null ? CONFIG.switchPowerW : 1800) / 1000;

  // ── 1. Memory Math ──────────────────────────────────────────────────────────
  let weightMemoryTotalGb    = 0;
  let kvCacheTotalGb         = 0;
  let baselineKvGb           = 0;
  let kvSavingsGb            = 0;
  let optimizerMemoryTotalGb = 0;
  let gradientMemoryTotalGb  = 0;
  let activationOverheadGb   = 0;
  let mActGb                 = 0;
  let bytesPerTokenSeq       = 0;

  const isLlmd = workloadType === "inference" && servingConfig?.servingArchitecture === "llmd";
  const isHeterogeneousLlmd = isLlmd && servingConfig?.llmdDisaggregationMode === "heterogeneous" && !!servingConfig?.secondaryPlatform;

  // Resolve Prefill and Decode Platforms & GPUs
  const prefillPlatform = platform;
  const prefillGpu = gpu;
  const decodePlatform = (isLlmd && isHeterogeneousLlmd && servingConfig.secondaryPlatform)
    ? servingConfig.secondaryPlatform
    : platform;
  const decodeGpu = (isLlmd && isHeterogeneousLlmd && servingConfig.secondaryGpu)
    ? servingConfig.secondaryGpu
    : (isLlmd && isHeterogeneousLlmd && servingConfig.secondaryPlatform?.gpuId
        ? (GPU_CATALOG.find(g => g.id === servingConfig.secondaryPlatform.gpuId) || gpu)
        : gpu);

  const prefillNodes = isLlmd ? (Number(servingConfig.prefillNodes) || 1) : null;
  const decodeNodes  = isLlmd ? (Number(servingConfig.decodeNodes) || 2) : null;

  const prefillGpusPerChassis = prefillPlatform ? prefillPlatform.gpusPerChassis : 8;
  const decodeGpusPerChassis  = decodePlatform ? decodePlatform.gpusPerChassis : 8;

  const prefillGpus = isLlmd ? prefillNodes * prefillGpusPerChassis : 0;
  const decodeGpus  = isLlmd ? decodeNodes * decodeGpusPerChassis : 0;

  const prefillTp = isLlmd ? Math.min(8, prefillGpus) : tp;
  const prefillPp = isLlmd ? Math.max(1, Math.ceil(prefillGpus / 8)) : pp;
  const decodeTp  = isLlmd ? Math.min(8, decodeGpus) : tp;
  const decodePp  = isLlmd ? Math.max(1, Math.ceil(decodeGpus / 8)) : pp;

  // S7 (scale): `concurrency` is the TOTAL concurrent streams the whole deployment must
  // serve; Data Parallelism (`dp`, or the decode pool's implied replica count under LLM-D)
  // splits that load across independent model replicas. Each replica only needs to hold
  // KV cache / decode activations for its own share of the load, not the cluster total —
  // otherwise adding replicas (the mechanism for scaling to hundreds of GPUs) would never
  // relieve per-GPU memory pressure.
  const replicaDp = isLlmd ? Math.max(1, Math.floor(decodeGpus / (decodeTp || 1))) : Math.max(1, dp || 1);
  const concurrencyPerReplica = Math.max(1, Math.ceil(concurrency / replicaDp));
  const maxNumSeqs = concurrencyPerReplica;

  // Wide EP (MoE, colocated inference only): a replica spans epNodes chassis of tp GPUs each.
  const epNodes = (workloadType === 'inference' && model.isMoe && !isLlmd) ? Math.max(1, Math.floor(expertParallelNodes) || 1) : 1;
  const modelParallelSize = tp * pp * epNodes;
  const totalGpus         = isLlmd ? (prefillGpus + decodeGpus) : (modelParallelSize * dp);
  const nodes             = isLlmd ? (prefillNodes + decodeNodes) : Math.max(1, Math.ceil(totalGpus / gpusPerChassis));
  const gpusAllocated     = isLlmd ? totalGpus : (nodes * gpusPerChassis);

  const promptTokens = Math.round(contextLength * promptTokenRatio);
  // M4: Split prefixCacheRatio into globalPrefixTokens (stored 1x) and sessionReuseRatio (stored per stream)
  const effectiveGlobalPrefixTokens = globalPrefixTokens != null
    ? Math.min(promptTokens, Math.max(0, globalPrefixTokens))
    : Math.round(promptTokens * prefixCacheRatio);
  const sharedPromptTokens = effectiveGlobalPrefixTokens;

  if (workloadType === "inference") {
    // S4: When weights are quantised, add embedding and lm_head weights at BF16: 2 × vocab × hidden × 2 bytes
    const isQuantized = precision.isQuantized != null ? precision.isQuantized : (precision.bytesPerParam < 2.0);
    // S4 fix: the head params' bytes were being counted twice (once at the quantized
    // rate via totalParams, again at BF16 via unquantizedHeadBytes) -- subtract them
    // out of the quantized term before re-pricing them at BF16.
    const headParamsCount = isQuantized ? (2 * vocab * hiddenDim) : 0;
    const unquantizedHeadBytes = headParamsCount * 2;
    weightMemoryTotalGb = ((totalParams * 1e9 - headParamsCount) * precision.bytesPerParam + unquantizedHeadBytes) / 1e9;

    // KV Cache with configurable precision (FP16: 2B, FP8: 1B, INT4: 0.5B)
    let kvBytesPerElement = 2.0;
    if (kvPrecision === "fp8") {
      kvBytesPerElement = 1.0;
    } else if (kvPrecision === "int4") {
      kvBytesPerElement = 0.5;
    }

    bytesPerTokenSeq = kvBytesPerToken(model, kvBytesPerElement, contextLength);

    // Baseline unoptimized KV cache (standard FP16 with 0% prefix caching)
    const baselineBytesPerTokenSeq = kvBytesPerToken(model, 2.0, contextLength);
    baselineKvGb = (baselineBytesPerTokenSeq * meanSeqTokens * concurrencyPerReplica) / 1e9;

    // Prefix Caching: Shared prompt tokens stored ONCE in VRAM across streams;
    // unique tokens stored per stream (session reuse tokens are stored per stream).
    // Both counted per replica: prefix caching is a per-instance radix tree, not shared
    // cluster-wide across independent DP replicas.
    const privateTokensPerStream = Math.max(1, meanSeqTokens - effectiveGlobalPrefixTokens);
    const effectiveTotalTokens = concurrencyPerReplica > 1
      ? (privateTokensPerStream * concurrencyPerReplica) + (effectiveGlobalPrefixTokens * 1)
      : contextLength;

    kvCacheTotalGb = (bytesPerTokenSeq * effectiveTotalTokens) / 1e9;
    kvSavingsGb = Math.max(0, baselineKvGb - kvCacheTotalGb);

    // C1: Inference activation memory:
    // tokensPerStep = CONFIG.maxBatchedTokens (default 8192)
    // M_act = tokensPerStep × (hidden + 2 × intermediate) × B_act × 1.2 + maxNumSeqs × vocab × 4
    const tokensPerStep = CONFIG.maxBatchedTokens;
    const mActBytes = (tokensPerStep * (hiddenDim + 2 * intermediate) * CONFIG.B_act * 1.2) + (maxNumSeqs * vocab * 4);
    mActGb = mActBytes / 1e9;
    activationOverheadGb = mActGb + (totalGpus * (CONFIG.runtimeOverheadPerGpu / 1e9));

  } else {
    // Training mode
    const isQuantized = precision.isQuantized != null ? precision.isQuantized : (precision.bytesPerParam < 2.0);
    // S4 fix: the head params' bytes were being counted twice (once at the quantized
    // rate via totalParams, again at BF16 via unquantizedHeadBytes) -- subtract them
    // out of the quantized term before re-pricing them at BF16.
    const headParamsCount = isQuantized ? (2 * vocab * hiddenDim) : 0;
    const unquantizedHeadBytes = headParamsCount * 2;
    weightMemoryTotalGb = ((totalParams * 1e9 - headParamsCount) * precision.bytesPerParam + unquantizedHeadBytes) / 1e9;

    // S6: Activation memory for full SFT and LoRA, per layer (with FlashAttention)
    const s = contextLength;
    const b = concurrency;
    const h = hiddenDim;
    let actPerLayer = 0;
    if (CONFIG.recompute === 'full') {
      actPerLayer = 2 * s * b * h * CONFIG.B_act;
    } else if (CONFIG.recompute === 'selective') {
      actPerLayer = 34 * s * b * h * (CONFIG.B_act / 2);
    } else {
      actPerLayer = 34 * s * b * h * CONFIG.B_act;
    }
    activationOverheadGb = (layers * actPerLayer) / 1e9;

    if (trainingType === "lora") {
      // S6: Replace 1% with r × Σ(d_in + d_out)
      const rank = config.loraRank || CONFIG.loraRank || 16;
      const adapterParams = calculateLoraParams(model, rank);
      gradientMemoryTotalGb  = adapterParams * 2;  // fp16 gradients for adapter params only
      optimizerMemoryTotalGb = adapterParams * 12; // Adam states for adapter params only
    } else {
      // Full SFT / Pre-training — mixed precision (fp16 working weights + fp32 Adam states)
      gradientMemoryTotalGb  = totalParams * 2;                       // fp16 gradients (always 2 bytes)
      optimizerMemoryTotalGb = totalParams * 12;                      // Adam: 4B fp32 params + 4B m + 4B v
    }
  }

  // ── 2. Per-GPU Memory Distribution ─────────────────────────────────────────
  let perGpuWeightsGb  = 0;
  let perGpuKvOrOptGb  = 0;
  let perGpuGradGb     = 0;
  let perGpuActGb      = 0;
  let llmdData         = null;
  let prefillIsOOM     = false;
  let decodeIsOOM      = false;

  if (isLlmd) {
    // 1. Prefill Pool: Holds model weights + transient activations + transient KV budget during prompt execution
    // M3: Give the prefill pool a transient KV budget: kvBytesPerToken × maxBatchedTokens
    const prefillPpImbalance = prefillPp > 1 ? CONFIG.ppImbalance : 1.0;
    const prefillWeightsGb = (weightMemoryTotalGb / (prefillTp * prefillPp)) * prefillPpImbalance;
    const prefillActGb = (mActGb / prefillTp) + (CONFIG.runtimeOverheadPerGpu / 1e9);

    const prefillTransientKvTotalBytes = bytesPerTokenSeq * CONFIG.maxBatchedTokens;
    const prefillTransientKvTotalGb = prefillTransientKvTotalBytes / 1e9;
    let prefillKvGb = 0;
    if (model.isMla) {
      prefillKvGb = prefillTransientKvTotalGb / prefillPp;
    } else {
      const prefillTpEff = Math.min(prefillTp, kvHeads);
      prefillKvGb = prefillTransientKvTotalGb / (prefillTpEff * prefillPp);
    }

    const prefillTotalUsedGb = prefillWeightsGb + prefillActGb + prefillKvGb;
    const prefillUsableGb = prefillGpu.vramGb * usableMemoryFactor(memoryHeadroomPct);
    prefillIsOOM = prefillTotalUsedGb > prefillUsableGb;
    const prefillHeadroomGb = prefillUsableGb - prefillTotalUsedGb;
    const prefillUtilization = Math.min(100, Math.round((prefillTotalUsedGb / prefillGpu.vramGb) * 100));

    // 2. Decode Pool: Holds model weights + pooled KV caches for ALL concurrent users + 1-token decode activations
    const decodePpImbalance = decodePp > 1 ? CONFIG.ppImbalance : 1.0;
    const decodeWeightsGb = (weightMemoryTotalGb / (decodeTp * decodePp)) * decodePpImbalance;
    let decodeKvGb = 0;
    if (model.isMla) {
      decodeKvGb = kvCacheTotalGb / decodePp;
    } else {
      const decodeTpEff = Math.min(decodeTp, kvHeads);
      decodeKvGb = kvCacheTotalGb / (decodeTpEff * decodePp);
    }
    const decodeTokensPerStep = concurrencyPerReplica;
    const decodeActBytes = (decodeTokensPerStep * (hiddenDim + 2 * intermediate) * CONFIG.B_act * 1.2) + (maxNumSeqs * vocab * 4);
    const decodeActGb = (decodeActBytes / 1e9 / decodeTp) + (CONFIG.runtimeOverheadPerGpu / 1e9);
    const decodeTotalUsedGb = decodeWeightsGb + decodeKvGb + decodeActGb;
    const decodeUsableGb = decodeGpu.vramGb * usableMemoryFactor(memoryHeadroomPct);
    decodeIsOOM = decodeTotalUsedGb > decodeUsableGb;
    const decodeHeadroomGb = decodeUsableGb - decodeTotalUsedGb;
    const decodeUtilization = Math.min(100, Math.round((decodeTotalUsedGb / decodeGpu.vramGb) * 100));

    // 3. Lossless RoCEv2 KV Cache Network Transfer (M3)
    let transferBytesPerTokenSeq;
    const kvTransferBytes = kvPrecision === "fp8" ? 1.0 : (kvPrecision === "int4" ? 0.5 : 2.0);
    transferBytesPerTokenSeq = kvBytesPerToken(model, kvTransferBytes, promptTokens);
    const promptKvBytes = transferBytesPerTokenSeq * promptTokens;
    const promptKvChunkGb = Number((promptKvBytes / 1e9).toFixed(2));
    const nicsPerNode = prefillPlatform?.nicsPerNode || prefillPlatform?.gpusPerChassis || prefillGpu?.gpusPerChassis || 8;
    const fabricNicSpeed = Math.min(prefillPlatform.nicSpeedGbps || 400, decodePlatform.nicSpeedGbps || 400);
    const fabricBw = (fabricNicSpeed * 1e9 * 0.90) / 8; // ~45 GB/s for 400G, ~90 GB/s for 800G in bytes/s
    const parallelNics = Math.min(prefillTp, nicsPerNode);
    const t_transfer_full = promptKvBytes / (parallelNics * fabricBw); // seconds
    const t_kv_transfer_sec = (CONFIG.overlapKvTransfer && layers > 0) ? (t_transfer_full / layers) : t_transfer_full; // seconds
    const kvTransferLatencyMs = Number((t_kv_transfer_sec * 1000).toFixed(2));

    // Default top-level memory points to Decode pool (the critical memory-capacity bound phase)
    perGpuWeightsGb = decodeWeightsGb;
    perGpuKvOrOptGb = decodeKvGb;
    perGpuActGb     = decodeActGb;

    llmdData = {
      isDisaggregated: true,
      isHeterogeneous: isHeterogeneousLlmd,
      prefill: {
        platform: prefillPlatform,
        gpu: prefillGpu,
        nodes: prefillNodes,
        gpus: prefillGpus,
        tp: prefillTp,
        pp: prefillPp,
        weightsGb: prefillWeightsGb,
        actGb: prefillActGb,
        kvGb: prefillKvGb,
        transientKvGb: prefillTransientKvTotalGb,
        totalUsedGb: prefillTotalUsedGb,
        usableGb: prefillUsableGb,
        headroomGb: prefillHeadroomGb,
        isOOM: prefillIsOOM,
        utilization: prefillUtilization
      },
      decode: {
        platform: decodePlatform,
        gpu: decodeGpu,
        nodes: decodeNodes,
        gpus: decodeGpus,
        tp: decodeTp,
        pp: decodePp,
        weightsGb: decodeWeightsGb,
        actGb: decodeActGb,
        kvGb: decodeKvGb,
        totalUsedGb: decodeTotalUsedGb,
        usableGb: decodeUsableGb,
        headroomGb: decodeHeadroomGb,
        isOOM: decodeIsOOM,
        utilization: decodeUtilization
      },
      kvTransfer: {
        promptKvChunkGb,
        fabricNicSpeed,
        kvTransferLatencyMs,
        kvTransferSec: t_kv_transfer_sec,
        totalTransferMs: Number((t_transfer_full * 1000).toFixed(2)),
        parallelNics,
        isOverlapped: !!CONFIG.overlapKvTransfer
      }
    };
  } else if (workloadType === "inference") {
    const ppImbalanceFactor = pp > 1 ? CONFIG.ppImbalance : 1.0;
    perGpuWeightsGb = perGpuWeightGbFor(model, weightMemoryTotalGb, tp, pp, epNodes) * ppImbalanceFactor;
    // Under wide EP each chassis runs attention for its own share of the replica's streams.
    if (model.isMla) {
      perGpuKvOrOptGb = kvCacheTotalGb / (pp * epNodes);
    } else {
      const tpEff = Math.min(tp, kvHeads);
      perGpuKvOrOptGb = kvCacheTotalGb / (tpEff * pp * epNodes);
    }
    perGpuActGb     = (mActGb / (tp * pp)) + (CONFIG.runtimeOverheadPerGpu / 1e9);
  } else {
    perGpuActGb = activationOverheadGb / totalGpus;

    if (trainingType === "lora") {
      perGpuWeightsGb = weightMemoryTotalGb / (tp * pp);
      perGpuGradGb    = gradientMemoryTotalGb  / totalGpus;
      perGpuKvOrOptGb = optimizerMemoryTotalGb / totalGpus;
    } else {
      // ZeRO operates on the DP dimension; TP/PP already shard the model across their ranks.
      if (zeroStage === 0) {
        // No sharding: each DP rank holds full weights/gradients/optimizer for its TP/PP slice
        perGpuWeightsGb = weightMemoryTotalGb    / (tp * pp);
        perGpuGradGb    = gradientMemoryTotalGb  / (tp * pp);
        perGpuKvOrOptGb = optimizerMemoryTotalGb / (tp * pp);
      } else if (zeroStage === 1) {
        // ZeRO-1: optimizer states sharded across the DP group; weights+grads replicated per DP rank
        perGpuWeightsGb = weightMemoryTotalGb    / (tp * pp);
        perGpuGradGb    = gradientMemoryTotalGb  / (tp * pp);
        perGpuKvOrOptGb = optimizerMemoryTotalGb / totalGpus;
      } else if (zeroStage === 2) {
        // ZeRO-2: optimizer states + gradients sharded across the DP group; weights replicated per DP rank
        perGpuWeightsGb = weightMemoryTotalGb    / (tp * pp);
        perGpuGradGb    = gradientMemoryTotalGb  / totalGpus;
        perGpuKvOrOptGb = optimizerMemoryTotalGb / totalGpus;
      } else {
        // ZeRO-3 / FSDP: weights + gradients + optimizer states all sharded across the DP group
        perGpuWeightsGb = weightMemoryTotalGb    / totalGpus;
        perGpuGradGb    = gradientMemoryTotalGb  / totalGpus;
        perGpuKvOrOptGb = optimizerMemoryTotalGb / totalGpus;
      }
    }
  }

  const perGpuTotalUsedGb = isLlmd ? llmdData.decode.totalUsedGb : (perGpuWeightsGb + perGpuKvOrOptGb + perGpuGradGb + perGpuActGb);
  const gpuCapacityGb     = isLlmd ? decodeGpu.vramGb : gpu.vramGb;
  // FIX: Apply same VRAM_USABLE_FACTOR buffer here as in recommendSharding() for consistency
  const usableFactor             = usableMemoryFactor(memoryHeadroomPct);
  const usableGpuCapacityGb      = gpuCapacityGb * usableFactor;
  const memoryUtilizationPercent = Math.min(100, Math.round((perGpuTotalUsedGb / gpuCapacityGb) * 100));
  const isOOM     = isLlmd ? (prefillIsOOM || decodeIsOOM) : (perGpuTotalUsedGb > usableGpuCapacityGb);
  // Free memory is reported against the runtime limit (90% of physical), so the headroom margin
  // the sizing deliberately left shows up as free space rather than being hidden.
  const physicalUsableGb = gpuCapacityGb * VRAM_USABLE_FACTOR;
  const headroomGb = physicalUsableGb - perGpuTotalUsedGb;

  // ── 3. Validation Warnings & Architecture Checks ───────────────────────────
  const warnings        = [];
  const recommendations = [];

  if (tp > gpusPerChassis && !isLlmd) {
    warnings.push(`Tensor Parallelism (TP=${tp}) exceeds single-node capacity (${gpusPerChassis} GPUs). TP across network nodes induces severe latency drops.`);
  }

  if (gpu.interconnectType === "pcie" && tp > 2) {
    warnings.push(`Selected GPU uses PCIe bus (no NVLink). High Tensor Parallelism (TP=${tp}) will cause All-Reduce communication bottlenecks.`);
  }

  if (pp > 1 && tp < gpusPerChassis && !isLlmd) {
    warnings.push(`Sub-optimal sharding: You configured Pipeline Parallelism (PP=${pp}) across nodes while TP is only ${tp}. Maximize intra-node TP to ${gpusPerChassis} first over NVLink before splitting across nodes with PP.`);
  }

  // FIX: Pipeline bubble overhead warning
  if (pp > 2 && concurrency < pp * 4 && !isLlmd) {
    const bubblePct = Math.round(((pp - 1) / pp) * 100);
    warnings.push(`Pipeline bubble risk: PP=${pp} with only ${concurrency} concurrent requests can waste up to ${bubblePct}% of GPU compute in pipeline idle time (pipeline bubble). Increase concurrency to ≥${pp * 4} or reduce PP to minimize idle cycles.`);
  }

  // Warning when INT4 is used for full training (impossible combination)
  if (workloadType === 'training' && trainingType !== 'lora' && precision.id === 'int4') {
    warnings.push(`INT4 quantization is not compatible with full parameter training or SFT. Gradient computation and optimizer states operate at FP16/BF16 precision regardless of weight quantization. Switch to FP8 or FP16 for training, or use LoRA/QLoRA for INT4 fine-tuning.`);
  }

  // S6: Block ZeRO-2/3 with PP > 1
  if (workloadType === 'training' && pp > 1 && (zeroStage === 2 || zeroStage === 3)) {
    warnings.push(`ZeRO-${zeroStage} is incompatible with Pipeline Parallelism (PP=${pp} > 1). ZeRO gradient and parameter partitioning require synchronous Data Parallel groups without pipeline stage boundaries. Use ZeRO-1 with PP, or reduce PP to 1.`);
  }

  if (epNodes > 1 && oversubscriptionRatio > 1) {
    warnings.push(`Wide expert parallelism sends all-to-all traffic across chassis at every MoE layer, but the fabric is ${oversubscriptionRatio}:1 oversubscribed. Expect higher per-token latency than modeled; use a non-blocking (1:1) fabric for expert-parallel groups.`);
  }

  // TensorRT-LLM is NVIDIA-only; AMD Instinct serving runs vLLM or SGLang on ROCm.
  if (servingConfig?.servingEngine === 'trt-llm' && (gpu.vendor === 'AMD' || servingConfig?.secondaryGpu?.vendor === 'AMD')) {
    warnings.push('TensorRT-LLM runs only on NVIDIA GPUs. For AMD Instinct, use vLLM or SGLang on ROCm; the sizing is otherwise unchanged.');
  }

  // LLM-D Disaggregated Serving architectural advisory
  if (isLlmd) {
    const kvFabricLabel = kvFabricName(networkProtocol, prefillPlatform);
    if (prefillIsOOM) {
      warnings.push(`Out of Memory on Prefill Pool: Needs ${llmdData.prefill.totalUsedGb.toFixed(1)} GB per ${prefillGpu.name} (usable: ${llmdData.prefill.usableGb.toFixed(1)} GB). Increase Prefill nodes or select higher VRAM GPUs.`);
    }
    if (decodeIsOOM) {
      warnings.push(`Out of Memory on Decode Pool: Needs ${llmdData.decode.totalUsedGb.toFixed(1)} GB per ${decodeGpu.name} (usable: ${llmdData.decode.usableGb.toFixed(1)} GB) to store active KV caches. Increase Decode nodes, increase TP, or switch to FP8.`);
    }
    if (!prefillIsOOM && !decodeIsOOM) {
      if (isHeterogeneousLlmd) {
        warnings.push(`Heterogeneous LLM-D Active: Sized with ${prefillNodes}x ${prefillPlatform.shortName} (${prefillGpu.name} Prefill) + ${decodeNodes}x ${decodePlatform.shortName} (${decodeGpu.name} Decode). Prompt KV-cache (${llmdData.kvTransfer.promptKvChunkGb} GB) streams over the ${kvFabricLabel} fabric in ~${llmdData.kvTransfer.kvTransferLatencyMs} ms with zero decode jitter.`);
      } else {
        warnings.push(`Homogeneous LLM-D Active: Partitioned into ${prefillNodes} Prefill node(s) (TP=${prefillTp}) and ${decodeNodes} Decode node(s) (TP=${decodeTp}). The ${kvFabricLabel} fabric transfers KV-cache chunks in ~${llmdData.kvTransfer.kvTransferLatencyMs} ms.`);
      }
    }
  }

  // Near-limit notice: fits, but with almost nothing spare for longer-than-planned prompts.
  if (!isOOM && !isLlmd && workloadType === 'inference' && headroomGb < 0.03 * physicalUsableGb) {
    warnings.push(`Tight fit: only ${headroomGb.toFixed(1)} GB of ${physicalUsableGb.toFixed(0)} GB usable per GPU is left. Longer prompts or a traffic spike will cause preemptions; raise the memory headroom margin, add a replica, or use more TP.`);
  }

  if (isOOM && !isLlmd) {
    const deficitGb = (perGpuTotalUsedGb - usableGpuCapacityGb).toFixed(1);
    warnings.push(`Out of Memory! Each GPU needs ${perGpuTotalUsedGb.toFixed(1)} GB, exceeding ${gpu.name}'s usable ${usableGpuCapacityGb.toFixed(0)} GB limit (${gpuCapacityGb} GB × ${usableFactor.toFixed(3)}${memoryHeadroomPct > 0 ? `, incl. ${memoryHeadroomPct}% headroom` : ''}) by ${deficitGb} GB.`);

    if (workloadType === "inference") {
      recommendations.push("Increase Tensor Parallelism (TP), switch to FP8/INT4 quantization, increase Pipeline Parallelism (PP), or select higher VRAM GPUs (e.g. H200 141GB, B200 180GB or B300 288GB).");
    } else {
      recommendations.push("Enable ZeRO-3 / FSDP, switch to LoRA/QLoRA, or scale to more GPU nodes to shard optimizer states.");
    }
  }

  // ── 4. Lossless Network Sizing (C3) ─────────────────────────────────────────
  const totalComputeNics          = totalGpus;
  // True bisection bandwidth: splitting N nodes into two halves crosses N/2 links, each
  // counted full-duplex (×2) -> (N/2) × speed × 2 = N × speed. The previous formula used
  // N × speed × 2, which is the cluster's total aggregate full-duplex NIC bandwidth (a real
  // number, just not what "bisection bandwidth" means) -- exactly 2x the correct value for
  // this 1:1 non-blocking fabric. This is the fabric's ceiling; effectiveBisectionTbps below
  // derates it for the rail-optimized branch's actual spine oversubscription ratio.
  const totalClusterBisectionTbps = (totalComputeNics * nicSpeedGbps) / 1000;

  const isPcieOrModular = (platform && platform.isModular) || gpu.interconnectType === "pcie" || platform?.interconnectType === "pcie";

  let leafSwitches   = 0;
  let spineSwitches  = 0;
  let uplinkCables   = 0;
  let downlinkCables = totalGpus;
  let fabricCables   = 0;
  let transceivers   = 0;
  let effectiveOversubscriptionRatio = 1; // 1 = non-blocking; >1 means cross-leaf traffic is derated

  if (isPcieOrModular) {
    if (nodes === 1) {
      leafSwitches  = 1;
      spineSwitches = 0;
      uplinkCables  = 0;
    } else {
      const portsPerLeaf = 32;
      leafSwitches  = Math.max(1, Math.ceil(totalGpus / portsPerLeaf));
      spineSwitches = leafSwitches > 1 ? 2 : 0;
      uplinkCables  = leafSwitches * spineSwitches;
    }
    downlinkCables = totalComputeNics;
    fabricCables   = downlinkCables + uplinkCables;
    transceivers   = 2 * fabricCables;
  } else {
    // C3: Rail-optimised leaf-spine fabric
    const R = gpusPerChassis; // rails
    const D = Math.floor(CONFIG.switchPorts / 2); // downlink ports per leaf at 1:1 (32)
    const N_gpus = totalGpus;
    const N_chassis = nodes;

    if (N_gpus <= CONFIG.switchPorts) {
      leafSwitches  = 1;
      spineSwitches = 0;
      uplinkCables  = 0;
    } else {
      leafSwitches   = R * Math.ceil(N_chassis / D);
      const uplinksPerLeaf = Math.ceil(D / oversubscriptionRatio);
      spineSwitches  = Math.ceil((leafSwitches * uplinksPerLeaf) / CONFIG.switchPorts);
      uplinkCables   = leafSwitches * uplinksPerLeaf;
      // Oversubscription only bites once traffic actually crosses leaf switches -- a
      // single-leaf cluster (branch above) has no spine tier to oversubscribe at all.
      effectiveOversubscriptionRatio = oversubscriptionRatio;
    }
    downlinkCables = N_gpus;
    fabricCables   = downlinkCables + uplinkCables;
    transceivers   = 2 * (downlinkCables + uplinkCables);
  }

  const effectiveBisectionTbps = totalClusterBisectionTbps / effectiveOversubscriptionRatio;

  // ── 5. Power, Racks, and Facility ──────────────────────────────────────────
  const isModular = platform && platform.isModular;
  let computeChassisPowerKw = 0;
  let totalRuNeeded         = 0;
  let chassisFormFactorStr  = "";

  if (isLlmd) {
    computeChassisPowerKw = (prefillNodes * prefillPlatform.chassisTdpKw) + (decodeNodes * decodePlatform.chassisTdpKw);
    totalRuNeeded         = (prefillNodes * prefillPlatform.chassisHeightRu) + (decodeNodes * decodePlatform.chassisHeightRu) + ((leafSwitches + spineSwitches) * 1) + 4;
    chassisFormFactorStr  = isHeterogeneousLlmd
      ? `${prefillNodes}x ${prefillPlatform.shortName} (${prefillPlatform.chassisHeightRu}U) + ${decodeNodes}x ${decodePlatform.shortName} (${decodePlatform.chassisHeightRu}U)`
      : `${nodes}x ${platform.shortName} (${nodes * chassisHeightRu} RU Total)`;
  } else if (isModular) {
    // Cisco UCS X9508: 7U chassis housing up to 4x [X210c + X440p] blade pairs
    const bladePairs        = nodes;
    const modularEnclosures = Math.max(1, Math.ceil(bladePairs / (platform.pairsPerChassis || 4)));
    computeChassisPowerKw   = bladePairs * chassisTdpKw;
    // 7U per X9508 chassis + 2U for Dual UCS 6536 Fabric Interconnects
    const computeRu = (modularEnclosures * 7) + 2;
    totalRuNeeded   = computeRu + ((leafSwitches + spineSwitches) * 1) + 2;
    chassisFormFactorStr = `${modularEnclosures}x UCS X9508 (7U) Chassis with ${bladePairs}x [X210c + X440p] Pairs (${computeRu} RU Total)`;
  } else {
    // Standard standalone server chassis (e.g. 8U rack server)
    computeChassisPowerKw = nodes * chassisTdpKw;
    totalRuNeeded         = (nodes * chassisHeightRu) + ((leafSwitches + spineSwitches) * 1) + 4;
    chassisFormFactorStr  = `${chassisHeightRu}U Chassis (${nodes * chassisHeightRu} RU Total)`;
  }

  // M1: Power calculations
  // Optics power: transceivers × CONFIG.opticW (default 15W)
  const opticsPowerKw = (transceivers * CONFIG.opticW) / 1000;
  const switchPowerTotalKw = (leafSwitches + spineSwitches) * switchPowerKw;
  const networkPowerKw = switchPowerTotalKw + opticsPowerKw;
  const totalItPowerKw = computeChassisPowerKw + networkPowerKw;
  const facilityTotalPower = totalItPowerKw * pue;
  const coolingOverhead = totalItPowerKw * (pue - 1);
  const totalFacilityPowerKw = facilityTotalPower;

  // M2: Rack bin-packing
  const rackKw = config.rackKw || config.rackKW || CONFIG.rackKW || 28;
  const chassisRU = chassisHeightRu || 8;
  const chassisTDP_W = chassisTdpKw ? (chassisTdpKw * 1000) : 10200;
  const perRack = Math.max(1, Math.floor(Math.min(CONFIG.rackRU / chassisRU, (rackKw * 1000) / chassisTDP_W)));
  const computeRacks = Math.ceil(nodes / perRack);
  const networkRacks = Math.ceil(((leafSwitches + spineSwitches) * 1) / CONFIG.rackRU); // if switches are not placed in-row
  const totalRacks = computeRacks + networkRacks;

  // ── 6. Datacenter Bill of Materials (BOM) ──────────────────────────────────
  const bom = {
    platformVendor:    platform ? platform.vendor : "generic",
    platformName:      platform ? platform.name   : `${gpu.name} Generic Whitebox`,
    platformShortName: platform ? platform.shortName : gpu.name,
    chassisCount:      isModular ? Math.max(1, Math.ceil(nodes / (platform.pairsPerChassis || 4))) : nodes,
    bladePairsCount:   isModular ? nodes : null,
    isModular,
    fabricInterconnectModel: platform ? platform.fabricInterconnectModel : null,
    chassisFormFactor: chassisFormFactorStr,
    chassisTdpKw:      computeChassisPowerKw,
    hostCpu:           platform ? platform.hostCpu  : "Dual x86-64 Enterprise Server CPUs",
    systemRam:         platform ? platform.systemRam : "2.0 TB DDR5 System Memory",
    hostNicsDesc:      platform ? platform.hostNics  : `${totalComputeNics}x ${nicSpeedGbps}G OSFP Adapters`,

    // Accelerators
    totalGpus,
    gpusAllocated,
    gpuName:        gpu.name,
    vramPerGpu:     gpu.vramGb,
    aggregateVramTb: ((totalGpus * gpu.vramGb) / 1000).toFixed(2),       // workload-active
    physicalVramTb:  ((gpusAllocated * gpu.vramGb) / 1000).toFixed(2),   // physically installed
    interconnect:   gpu.interconnect,
    // For MoE: surface active params for context (VRAM still sized on totalParams)
    activeParamsNote: isMoe ? `MoE: ${activeParams}B active params per token (${totalParams}B total loaded in VRAM)` : null,

    // Network Switches
    leafSwitchCount:   leafSwitches,
    leafSwitchModel:   platform ? platform.leafSwitchModel : "64-port 400G Leaf Switch",
    spineSwitchCount:  spineSwitches,
    spineSwitchModel:  spineSwitches > 0 ? (platform ? platform.spineSwitchModel : "64-port 400G Spine Switch") : "None (Single Node)",
    storageSwitchCount: nodes > 1 ? Math.max(1, Math.ceil(nodes / 16)) : 1,
    storageSwitchModel: platform ? platform.storageSwitchModel : "36-port 100G GPUDirect Storage Switch",
    oobSwitchCount:    Math.max(1, Math.ceil((nodes + leafSwitches + spineSwitches) / 48)),
    oobSwitchModel:    platform ? platform.oobSwitchModel : "48-port 1G Management Switch",

    // Cabling
    fabricCablesCount: fabricCables,
    fabricCablesType:  platform ? platform.transceiverType : `${nicSpeedGbps}G OSFP/QSFP-DD Twinax DACs & AOCs`,
    storageCablesCount: nodes * 2 + 4,

    // Software & Management
    managementSuite: servingConfig
      ? `${platform?.managementSuite || (platform?.vendor === 'nvidia' ? 'NVIDIA Base Command Manager' : 'Cisco Intersight')} + ${
          servingConfig.servingEngine === 'vllm' ? 'vLLM (v1 Engine)' : servingConfig.servingEngine === 'trt-llm' ? 'NVIDIA TensorRT-LLM' : 'Hugging Face TGI'
        } on ${
          servingConfig.orchestrator === 'kserve' ? 'KServe (Kubernetes)' : servingConfig.orchestrator === 'ray' ? 'Ray Serve' : 'Container Engine'
        } ${servingConfig.servingArchitecture === 'llmd' ? '• LLM-D Disaggregated Serving' : '• Colocated Serving'}`
      : (platform?.managementSuite || (platform?.vendor === 'nvidia' ? 'NVIDIA Base Command Manager' : 'Cisco Intersight Cloud Orchestration')),
    servingEngine: servingConfig?.servingEngine || "vllm",
    orchestrator: servingConfig?.orchestrator || "kserve",
    servingArchitecture: servingConfig?.servingArchitecture || "colocated",

    // Disaggregated LLM-D specific BOM fields
    isDisaggregated: !!isLlmd,
    isHeterogeneous: !!isHeterogeneousLlmd,
    prefill: isLlmd ? {
      nodes: prefillNodes,
      platformName: prefillPlatform.name,
      shortName: prefillPlatform.shortName,
      gpuCount: prefillGpus,
      gpuName: prefillGpu.name,
      chassisTdpKw: prefillPlatform.chassisTdpKw,
      totalPowerKw: prefillNodes * prefillPlatform.chassisTdpKw,
      ru: prefillNodes * prefillPlatform.chassisHeightRu
    } : null,
    decode: isLlmd ? {
      nodes: decodeNodes,
      platformName: decodePlatform.name,
      shortName: decodePlatform.shortName,
      gpuCount: decodeGpus,
      gpuName: decodeGpu.name,
      chassisTdpKw: decodePlatform.chassisTdpKw,
      totalPowerKw: decodeNodes * decodePlatform.chassisTdpKw,
      ru: decodeNodes * decodePlatform.chassisHeightRu
    } : null,
    kvTransfer: isLlmd ? llmdData?.kvTransfer : null,

    // Facilities
    totalItPowerKw,
    totalFacilityPowerKw,
    totalRacks,
    totalRuNeeded
  };

  // ── 7. Inference Latency & Throughput Engine (Prefill & Decode) ─────────────
  let throughput = null;
  if (workloadType === "inference") {
    const effectiveParamsForThroughput = isMoe && model.activeParams ? model.activeParams : totalParams;

    // ── Phase 1: Prefill (Prompt Processing & Time to First Token) (C4, C5) ─
    const targetPrefillGpu = isLlmd ? prefillGpu : gpu;
    const prefillTpCount = isLlmd ? prefillTp : tp;

    // Dense peak table without sparsity; INT4 uses FP16 compute (C4)
    const prefillPeakDenseFlops = peakDenseFlops(targetPrefillGpu, precision);
    const gpuTflops = prefillPeakDenseFlops / 1e12;

    // Dynamic MFU by prompt length (C4)
    // M4: Prefill uncached tokens
    const remainingPromptTokens = Math.max(0, promptTokens - effectiveGlobalPrefixTokens);
    const sessionCachedTokens = Math.round(remainingPromptTokens * sessionReuseRatio);
    const totalCachedPromptTokens = effectiveGlobalPrefixTokens + sessionCachedTokens;
    const uncachedPromptTokens = Math.max(1, promptTokens - totalCachedPromptTokens);
    const mfuPrefill = uncachedPromptTokens < 512 ? 0.25 : (uncachedPromptTokens < 2048 ? 0.4 : 0.5);

    const fwdFlopsPerToken = 2 * effectiveParamsForThroughput * 1e9;
    const attnDim = (model.isMla) ? 576 : hiddenDim;
    const attnFlopsPerToken = 2 * layers * attnDim * contextLength;
    const totalFlopsPerToken = fwdFlopsPerToken + attnFlopsPerToken;
    const totalPromptFlops = totalFlopsPerToken * uncachedPromptTokens;

    // Compute rate uses ONLY replica tensor-parallel GPUs (C4)
    const effFlops = prefillTpCount * prefillPeakDenseFlops * mfuPrefill;
    const t_compute = totalPromptFlops / effFlops; // seconds

    // All-Reduce bandwidth & latency (C4)
    const isB200 = targetPrefillGpu.id?.includes("b200") || targetPrefillGpu.name?.includes("B200");
    const isNonNvlink = targetPrefillGpu.interconnectType === "pcie" || platform?.interconnectType === "pcie";
    const interconnectBwUni = isNonNvlink
      ? CONFIG.pcieBw
      : (targetPrefillGpu.linkBwUniGBs ? targetPrefillGpu.linkBwUniGBs * 1e9 : (isB200 ? 900e9 : CONFIG.nvlinkBwUni));

    const t_allreduce = prefillTpCount > 1
      ? layers * 2 * (2 * (prefillTpCount - 1) / prefillTpCount) * uncachedPromptTokens * hiddenDim * CONFIG.B_act / interconnectBwUni
      : 0; // seconds

    const t_pipeline = (!isLlmd && pp > 1) ? (pp - 1) * 0.008 : 0; // seconds
    const t_kv_transfer = isLlmd ? (llmdData?.kvTransfer?.kvTransferSec ?? ((llmdData?.kvTransfer?.kvTransferLatencyMs || 0) / 1000)) : 0; // seconds (C5)

    const ttftSec = t_compute + t_allreduce + t_pipeline + t_kv_transfer; // seconds
    const ttftMs = Number((ttftSec * 1000).toFixed(2));

    const promptTokensPerSecPerReplica = Math.round(promptTokens / ttftSec);
    const promptTokensPerSecPerGpu = Math.round(promptTokensPerSecPerReplica / prefillTpCount);
    const clusterBatchPromptTps = isLlmd ? promptTokensPerSecPerReplica : Math.round(promptTokensPerSecPerReplica * dp);

    // ── Phase 2: Decode (Autoregressive Token Generation) (C2) ──────────────
    const targetDecodeGpu = isLlmd ? decodeGpu : gpu;
    const decodeTpCount = isLlmd ? decodeTp : tp;
    const decodeDp = replicaDp;
    const C_rep = concurrencyPerReplica;
    const S_avg = meanSeqTokens;

    const BW_mem = (targetDecodeGpu.memBandwidthTbps || 4.8) * 1e12; // bytes/s
    const decodePeakDenseFlops = peakDenseFlops(targetDecodeGpu, precision);

    // Weight bytes each TP group reads per step: routed experts are spread over epNodes chassis,
    // and each chassis only reads the experts it hosts that the step's tokens touch.
    const weightBytesRead = decodeWeightBytes(model, customParams, precision, epNodes * (config.ep || CONFIG.ep || 1), C_rep);
    const kvBytesRead = bytesPerTokenSeq * S_avg * C_rep / epNodes;

    const t_mem  = (weightBytesRead + kvBytesRead) / (decodeTpCount * BW_mem * CONFIG.bwEfficiency);
    const pActiveParams = (isMoe && model.activeParams ? model.activeParams : totalParams) * 1e9;
    const t_comp = (2 * pActiveParams * C_rep) / (decodeTpCount * epNodes * decodePeakDenseFlops * CONFIG.mfuDecode);
    // Wide EP all-to-all: every token's hidden state goes to its k experts and back, mostly to
    // other chassis (FP8 dispatch + BF16 combine = 3 bytes/element), over the GPUs' NICs.
    const moeLayers = model.moeLayers || layers;
    const t_a2a = epNodes > 1
      ? (C_rep * moeLayers * (model.activeExperts || 8) * hiddenDim * 3 * (1 - 1 / epNodes)) / (tp * epNodes * (nicSpeedGbps * 1e9 * 0.9 / 8))
        + moeLayers * 2 * CONFIG.a2aLatency
      : 0;
    const t_comm = (decodeTpCount > 1 ? 2 * layers * CONFIG.allreduceLatency : 0) + t_a2a;
    const t_step = Math.max(t_mem, t_comp) + t_comm;
    const tpotMs = Number((t_step * 1000).toFixed(2));
    const replicaThroughput = C_rep / t_step;
    const clusterThroughput = replicaThroughput * decodeDp;

    const decodeNote = isLlmd
      ? (isHeterogeneousLlmd
          ? `Heterogeneous Decode: Running on ${decodeNodes}x ${decodePlatform.shortName} (${decodeGpus}x ${decodeGpu.name} @ ${decodeGpu.memBandwidthTbps || 4.8} TB/s HBM)`
          : `Disaggregated Decode: Running on ${decodeNodes} Decode nodes (${decodeGpus}x ${decodeGpu.name})`)
      : (isMoe
          ? `MoE: decode sized on ${effectiveParamsForThroughput}B active params (${totalParams}B total weights in VRAM)`
          : `Dense: all ${totalParams}B params read per output token`);

    const prefillNote = isLlmd
      ? (isHeterogeneousLlmd
          ? `Heterogeneous Prefill: Processed on ${prefillNodes}x ${prefillPlatform.shortName} (${prefillGpus}x ${prefillGpu.name} @ ${gpuTflops.toLocaleString()} TFLOPs) + ~${llmdData?.kvTransfer?.kvTransferLatencyMs}ms ${kvFabricName(networkProtocol, prefillPlatform)} transfer`
          : `Disaggregated Prefill: Processed on ${prefillNodes} Prefill node(s) (${prefillGpus}x ${prefillGpu.name}) + ~${llmdData?.kvTransfer?.kvTransferLatencyMs}ms ${kvFabricName(networkProtocol, prefillPlatform)} transfer`)
      : (totalCachedPromptTokens > 0
          ? `Prefill: ${promptTokens.toLocaleString()} prompt tokens with ${totalCachedPromptTokens.toLocaleString()} tokens cached (${((totalCachedPromptTokens / promptTokens) * 100).toFixed(0)}% cached) computing ${uncachedPromptTokens.toLocaleString()} uncached tokens @ ${gpuTflops.toLocaleString()} TFLOPs`
          : `Calculated on ${promptTokens.toLocaleString()} prompt tokens using ${gpuTflops.toLocaleString()} TFLOPs (${precision.name}) at ${(mfuPrefill * 100).toFixed(0)}% MFU`);

    throughput = {
      // Decode metrics (C2)
      t_mem,
      t_comp,
      t_comm,
      t_a2a,
      t_step,
      tpotMs,
      replicaThroughput:      Math.round(replicaThroughput),
      clusterThroughput:      Math.round(clusterThroughput),
      tokensPerSecPerReplica: Math.round(replicaThroughput),
      tokensPerSecPerGpu:     Math.round(replicaThroughput / decodeTpCount),
      batchThroughputTps:     Math.round(clusterThroughput),
      C_rep,
      decodeDp,
      contextLength,
      decodeNote,
      // Prefill metrics (C4, C5)
      t_compute,
      t_allreduce,
      t_pipeline,
      t_kv_transfer,
      ttftSec,
      ttftMs,
      promptTokensPerSecPerGpu,
      promptTokensPerSecPerReplica,
      clusterBatchPromptTps,
      promptPflops: (totalPromptFlops / 1e15).toFixed(2),
      gpuTflops: prefillPeakDenseFlops / 1e12,
      prefillNote,
      kvTransferLatencyMs: isLlmd ? llmdData?.kvTransfer?.kvTransferLatencyMs : null,
      note: decodeNote
    };
  }

  return {
    workloadType,
    totalParams,
    activeParams,
    isMoe,
    modelParallelSize,
    totalGpus,
    epNodes,
    gpusAllocated,
    nodes,
    // Memory
    memory: {
      weightTotalGb:      weightMemoryTotalGb,
      kvCacheTotalGb,
      bytesPerTokenSeq,
      baselineKvGb,
      kvSavingsGb,
      kvPrecision,
      prefixCacheRatio,
      globalPrefixTokens: effectiveGlobalPrefixTokens,
      sessionReuseRatio,
      promptTokenRatio,
      promptTokens,
      sharedPromptTokens: effectiveGlobalPrefixTokens,
      optimizerTotalGb:   optimizerMemoryTotalGb,
      gradientTotalGb:    gradientMemoryTotalGb,
      activationTotalGb:  activationOverheadGb,
      mActGb:             workloadType === "inference" ? mActGb : null,
      perGpuWeightsGb,
      perGpuKvOrOptGb,
      perGpuGradGb,
      perGpuActGb,
      perGpuTotalUsedGb,
      gpuCapacityGb,
      usableGpuCapacityGb,
      memoryUtilizationPercent,
      isOOM,
      headroomGb,
      llmd: llmdData
    },
    // Networking
    network: {
      protocol:                 networkProtocol,
      totalComputeNics,
      nicSpeedGbps,
      totalClusterBisectionTbps,
      oversubscriptionRatio,
      effectiveOversubscriptionRatio,
      effectiveBisectionTbps,
      leafSwitches,
      spineSwitches,
      fabricCables,
      downlinkCables,
      uplinkCables,
      transceivers,
      topology: spineSwitches === 0
        ? "Single-Tier Fabric (Intra-Chassis / Single Leaf)"
        : effectiveOversubscriptionRatio > 1
          ? `2-Tier Leaf-Spine ${effectiveOversubscriptionRatio.toFixed(0)}:1 Oversubscribed Clos (Rail-Optimized)`
          : "2-Tier Leaf-Spine Non-Blocking Clos (Rail-Optimized)"
    },
    // Facility
    facility: {
      chassisPowerKw:      computeChassisPowerKw,
      networkPowerKw,
      switchPowerKw:       switchPowerTotalKw,
      opticsPowerKw,
      totalItPowerKw,
      facilityTotalPower,
      facilityCoolingPower: facilityTotalPower, // M1: renamed to facilityTotalPower, kept for compat
      coolingOverhead,      // M1: cooling overhead IT * (PUE - 1)
      totalFacilityPowerKw,
      totalRuNeeded,
      totalRacks,
      computeRacks,
      networkRacks,
      perRack,
      rackKw
    },
    // Datacenter BOM
    bom,
    throughput,
    warnings,
    recommendations
  };
}

// ─── Storage Sizing (checkpoints, dataset streaming, model repository, KV offload) ────
/**
 * Sizes storage capacity and required sustained throughput for the current workload,
 * and picks how many RU of the selected storage tier are needed to satisfy both.
 * Deliberately independent of calculateInfra(): it consumes that function's memory/
 * throughput outputs as inputs rather than re-deriving model math, so storage sizing
 * can't drift out of sync with the compute sizing it's describing.
 */
export function calculateStorage(config) {
  const {
    workloadType,
    infraResults,          // the object returned by calculateInfra()
    storageTier,            // one entry from STORAGE_TIERS
    checkpointRetentionCount = 3,
    checkpointTargetWriteTimeSec = 60,
    datasetSizeTb = 50,
    modelRepoVersionCount = 2,
    modelRepoTargetLoadTimeSec = 120,
    corpusSizeGb = 0,
    enableKvOffload = false,
    kvOffloadActiveFraction = 1, // share of sessions whose KV stays in GPU memory; the rest wait offloaded
    durabilityScheme = null, // one entry from DURABILITY_SCHEMES; null = RF 1.0 (no redundancy modeled -- not recommended)
  } = config;

  const { memory, totalGpus, throughput } = infraResults;
  const breakdown = [];
  let requiredCapacityTb = 0;
  let requiredThroughputGBs = 0;

  if (workloadType === 'training') {
    // Checkpoint = master weights + optimizer states (Adam m/v + fp32 master copy).
    // Gradients are transient and never checkpointed.
    const checkpointSizeGb = (memory.weightTotalGb || 0) + (memory.optimizerTotalGb || 0);
    const checkpointCapacityTb = (checkpointSizeGb * checkpointRetentionCount) / 1000;
    const checkpointWriteThroughputGBs = checkpointTargetWriteTimeSec > 0
      ? checkpointSizeGb / checkpointTargetWriteTimeSec
      : 0;

    // Sustained dataset streaming target: ~200 MB/s per accelerator is a commonly cited
    // floor for keeping modern (H100-class+) training pipelines fed without I/O stalls.
    const perGpuStreamingMBs = 200;
    const datasetThroughputGBs = (totalGpus * perGpuStreamingMBs) / 1000;

    requiredCapacityTb = checkpointCapacityTb + datasetSizeTb + (corpusSizeGb / 1000);
    requiredThroughputGBs = Math.max(checkpointWriteThroughputGBs, datasetThroughputGBs);

    breakdown.push(
      { label: 'Checkpoint retention', capacityTb: checkpointCapacityTb, note: `${checkpointSizeGb.toFixed(1)} GB/checkpoint × ${checkpointRetentionCount} retained` },
      { label: 'Training dataset', capacityTb: datasetSizeTb, note: `${datasetThroughputGBs.toFixed(2)} GB/s sustained read target` },
    );
    if (corpusSizeGb > 0) {
      breakdown.push({ label: 'Auxiliary corpus / eval sets', capacityTb: corpusSizeGb / 1000, note: 'Capacity-only, not throughput-binding' });
    }
  } else {
    // Inference: model repository (weights on disk, N cached versions) + optional
    // KV-cache disk/CXL offload tier + optional document/vector corpus for RAG-shaped workloads.
    const modelRepoCapacityTb = ((memory.weightTotalGb || 0) * modelRepoVersionCount) / 1000;
    const modelRepoLoadThroughputGBs = modelRepoTargetLoadTimeSec > 0
      ? (memory.weightTotalGb || 0) / modelRepoTargetLoadTimeSec
      : 0;

    let kvOffloadCapacityTb = 0;
    let kvOffloadThroughputGBs = 0;
    if (enableKvOffload) {
      // Size the offload tier at 2x the modeled in-VRAM KV footprint to give room for
      // paging beyond what fits on-GPU, and require enough throughput to page at the
      // cluster's aggregate decode token rate.
      // kvCacheTotalGb is per replica; the offload tier serves the whole cluster. It holds every
      // session's KV (resident ones included, so they can be evicted) plus the same again as
      // paging room -- 2x the cluster's GPU-resident KV when every session is active.
      const replicas = Math.max(1, Math.round((totalGpus || 1) / (infraResults.modelParallelSize || 1)));
      const clusterResidentKvGb = (memory.kvCacheTotalGb || 0) * replicas;
      const activeFraction = Math.min(1, Math.max(0.01, kvOffloadActiveFraction));
      kvOffloadCapacityTb = (clusterResidentKvGb * (1 / activeFraction + 1)) / 1000;
      const clusterGenTokPerSec = throughput?.batchThroughputTps || throughput?.tokensPerSecPerReplica || 0;
      // bytesPerTokenSeq (K+V bytes for one token, one full sequence's worth of layers/heads)
      // is exported directly from calculateInfra -- use it as-is rather than reverse-deriving
      // a "bytes per token" figure from kvCacheTotalGb (an aggregate, multi-stream total) and
      // promptTokens (a single stream's prompt length), which don't share a denominator.
      kvOffloadThroughputGBs = (clusterGenTokPerSec * (memory.bytesPerTokenSeq || 0)) / 1e9;
    }

    requiredCapacityTb = modelRepoCapacityTb + kvOffloadCapacityTb + (corpusSizeGb / 1000);
    requiredThroughputGBs = Math.max(modelRepoLoadThroughputGBs, kvOffloadThroughputGBs);

    breakdown.push(
      { label: 'Model repository', capacityTb: modelRepoCapacityTb, note: `${(memory.weightTotalGb || 0).toFixed(1)} GB/version × ${modelRepoVersionCount} cached versions` },
    );
    if (enableKvOffload) {
      breakdown.push({ label: 'KV cache disk/CXL offload', capacityTb: kvOffloadCapacityTb, note: `${kvOffloadThroughputGBs.toFixed(2)} GB/s paging throughput target` });
    }
    if (corpusSizeGb > 0) {
      breakdown.push({ label: 'Document / vector corpus', capacityTb: corpusSizeGb / 1000, note: 'Capacity-only, not throughput-binding' });
    }
  }

  // requiredCapacityTb is the logical/usable data need; what must actually be PROVISIONED
  // (raw, what the vendor bills) is larger by the durability scheme's replication factor.
  const replicationFactor = durabilityScheme ? durabilityScheme.replicationFactor : 1.0;
  const requiredRawCapacityTb = requiredCapacityTb * replicationFactor;

  const ruForCapacity = Math.max(1, Math.ceil(requiredRawCapacityTb / storageTier.capacityPerRuTb));
  const ruForThroughput = Math.max(1, Math.ceil(requiredThroughputGBs / storageTier.throughputPerRuGBs));
  const provisionedRu = Math.max(ruForCapacity, ruForThroughput);
  const bindingConstraint = ruForThroughput > ruForCapacity ? 'throughput' : 'capacity';

  // achievedCapacityTb stays RAW (what's actually purchased -- Cost prices this figure);
  // achievedUsableCapacityTb is what's actually available to the workload after redundancy.
  const achievedCapacityTb = provisionedRu * storageTier.capacityPerRuTb;
  const achievedUsableCapacityTb = achievedCapacityTb / replicationFactor;
  const achievedThroughputGBs = provisionedRu * storageTier.throughputPerRuGBs;
  const fits = achievedUsableCapacityTb >= requiredCapacityTb && achievedThroughputGBs >= requiredThroughputGBs;

  return {
    workloadType,
    storageTier,
    durabilityScheme,
    replicationFactor,
    requiredCapacityTb,
    requiredRawCapacityTb,
    requiredThroughputGBs,
    provisionedRu,
    achievedCapacityTb,
    achievedUsableCapacityTb,
    achievedThroughputGBs,
    bindingConstraint,
    fits,
    breakdown,
  };
}

// ─── Cost & TCO (capex, opex, build-vs-buy cloud comparison) ──────────────────────────
/**
 * Composes capex + opex + a 3-year (configurable) TCO from calculateInfra()'s and
 * calculateStorage()'s own outputs -- it doesn't re-derive any hardware sizing, only prices
 * what's already been sized. Every dollar input is a caller-supplied, user-editable figure
 * (see src/data/pricing.js for illustrative defaults); this function does no data-file lookups
 * of its own so its test surface stays pure arithmetic over explicit inputs.
 */
export function calculateCost(config) {
  const {
    infraResults,                    // calculateInfra() output (required)
    storageResults = null,           // calculateStorage() output (optional)
    gpuUnitPriceUsd = 0,             // $/GPU capex, primary (or prefill, under LLM-D) pool
    cloudRateUsdPerHr = 0,           // $/GPU-hr dedicated-cloud rental, primary (or prefill) pool
    decodeGpuUnitPriceUsd = null,    // only used when infraResults is LLM-D heterogeneous
    decodeCloudRateUsdPerHr = null,
    networkHardwareAdderPct = 15,    // network + OOB hardware as % of compute capex
    storageUsdPerTbRaw = 0,           // $/TB (raw) for the achieved (provisioned) storage capacity
    powerUsdPerKwh = 0.12,
    useColo = false,                 // colo bills $/kW/month on IT load; owned DC bills $/kWh on facility (PUE-adjusted) load
    coloUsdPerKwPerMonth = 150,
    enableNvidiaAiEnterprise = false,
    licensingUsdPerGpuPerYear = 4500,
    supportPctPerYear = 15,          // hardware support/maintenance contract, % of total capex/year
    tcoYears = 3,
    // MIG consolidation overlay (see calculateMigConsolidation()): when provided, prices
    // capex/power against the physical GPU/IT-power footprint MIG consolidation achieves
    // instead of the naive one-GPU-per-replica count. The cloud-rental comparison deliberately
    // keeps using infraResults.totalGpus (unchanged) -- the cloud side doesn't get the same
    // consolidation benefit unless the provider itself offers fractional MIG billing, so this
    // is the fairer, more conservative build-vs-buy comparison.
    computeGpuCountOverride = null,
    itPowerKwOverride = null,
    // RAG pipeline overlay (see calculateRag()): embedding-compute + vector-DB capex and the IT
    // power they draw, folded into total capex/opex like storage -- unlike MIG/SLA, RAG adds
    // real standing infrastructure rather than just reshaping existing hardware.
    ragComputeCapexUsd = 0,
    ragItPowerKw = 0,
    // Guardrails overlay (see calculateGuardrails()): the same additive capex/power pattern as
    // RAG, applied to a second add-on module -- an input/output safety-classifier pool.
    guardrailsComputeCapexUsd = 0,
    guardrailsItPowerKw = 0,
    // Ingress/edge overlay (see calculateIngress()): the same additive capex/power pattern as
    // RAG and guardrails, plus a recurring annual opex term (egress bandwidth + managed-service
    // fees) that RAG/guardrails don't have -- ingress cost isn't purely hardware-driven.
    ingressComputeCapexUsd = 0,
    ingressItPowerKw = 0,
    ingressAnnualOpexUsd = 0,
    // HA/DR overlay (see calculateHaDr()): the incremental capex/power a multi-AZ or
    // cross-region DR tier adds on top of the primary site's compute+storage, same additive
    // capex/power pattern as RAG/guardrails/ingress.
    haDrComputeCapexUsd = 0,
    haDrItPowerKw = 0,
    // MLOps overlay (see calculateMlops()): the standing canary/shadow/blue-green validation
    // pool's capex/power, same additive pattern as RAG/guardrails/ingress/HA-DR.
    mlopsComputeCapexUsd = 0,
    mlopsItPowerKw = 0,
    // Training spare node capacity overlay (see calculateTrainingRedundancy()): standing
    // spare/hot-standby nodes for a training run, same additive pattern as the others.
    trainingRedundancyComputeCapexUsd = 0,
    trainingRedundancyItPowerKw = 0,
  } = config;

  const isLlmd = !!infraResults.memory.llmd;
  let computeCapexUsd;
  let cloudEquivalentUsdPerHr;

  if (isLlmd) {
    const prefillGpus = infraResults.memory.llmd.prefill.gpus;
    const decodeGpus = infraResults.memory.llmd.decode.gpus;
    const decPrice = decodeGpuUnitPriceUsd != null ? decodeGpuUnitPriceUsd : gpuUnitPriceUsd;
    const decCloud = decodeCloudRateUsdPerHr != null ? decodeCloudRateUsdPerHr : cloudRateUsdPerHr;
    computeCapexUsd = (prefillGpus * gpuUnitPriceUsd) + (decodeGpus * decPrice);
    cloudEquivalentUsdPerHr = (prefillGpus * cloudRateUsdPerHr) + (decodeGpus * decCloud);
  } else {
    const totalGpus = infraResults.totalGpus;
    const billedGpuCount = computeGpuCountOverride != null ? computeGpuCountOverride : totalGpus;
    computeCapexUsd = billedGpuCount * gpuUnitPriceUsd;
    cloudEquivalentUsdPerHr = totalGpus * cloudRateUsdPerHr;
  }

  const networkHardwareCapexUsd = computeCapexUsd * (networkHardwareAdderPct / 100);
  const storageCapexUsd = storageResults ? (storageResults.achievedCapacityTb * storageUsdPerTbRaw) : 0;
  const totalCapexUsd = computeCapexUsd + networkHardwareCapexUsd + storageCapexUsd + ragComputeCapexUsd + guardrailsComputeCapexUsd + ingressComputeCapexUsd + haDrComputeCapexUsd + mlopsComputeCapexUsd + trainingRedundancyComputeCapexUsd;

  const hoursPerYear = 24 * 365;
  const baseItPowerKw = itPowerKwOverride != null ? itPowerKwOverride : infraResults.facility.totalItPowerKw;
  const billedItPowerKw = baseItPowerKw + ragItPowerKw + guardrailsItPowerKw + ingressItPowerKw + haDrItPowerKw + mlopsItPowerKw + trainingRedundancyItPowerKw;
  // Colo bills $/kW/month on IT load (the colo provider's own facility overhead/cooling is
  // baked into their rate); an owned DC bills the utility $/kWh on the PUE-adjusted total load.
  // The MIG IT-power override has no PUE figure of its own, so the owned-DC branch applies the
  // same PUE multiplier the rest of this deployment already uses. Add-on modules' (RAG,
  // guardrails, ingress, HA/DR, MLOps) own IT power gets the same PUE treatment -- they're
  // colocated with the rest of the deployment, not a separate facility.
  const impliedPue = infraResults.facility.totalItPowerKw > 0
    ? infraResults.facility.totalFacilityPowerKw / infraResults.facility.totalItPowerKw
    : 1;
  const baseFacilityPowerKw = itPowerKwOverride != null ? baseItPowerKw * impliedPue : infraResults.facility.totalFacilityPowerKw;
  const billedFacilityPowerKw = baseFacilityPowerKw + ((ragItPowerKw + guardrailsItPowerKw + ingressItPowerKw + haDrItPowerKw + mlopsItPowerKw + trainingRedundancyItPowerKw) * impliedPue);
  const annualPowerCostUsd = useColo
    ? billedItPowerKw * coloUsdPerKwPerMonth * 12
    : billedFacilityPowerKw * hoursPerYear * powerUsdPerKwh;

  const annualLicensingCostUsd = enableNvidiaAiEnterprise
    ? infraResults.totalGpus * licensingUsdPerGpuPerYear
    : 0;
  // Support % applies to hardware capex only (ingressComputeCapexUsd is already folded into
  // totalCapexUsd above) -- ingressAnnualOpexUsd (egress bandwidth + managed-service fees) is a
  // recurring bill, not a supportable asset, so it's added on top rather than run through support %.
  const annualSupportCostUsd = totalCapexUsd * (supportPctPerYear / 100);
  const annualOpexUsd = annualPowerCostUsd + annualLicensingCostUsd + annualSupportCostUsd + ingressAnnualOpexUsd;

  // The model-serving cluster alone (GPUs, their fabric, power, support, licensing), without
  // storage and add-on pools -- the part a per-token API would replace.
  const servingCapexUsd = computeCapexUsd + networkHardwareCapexUsd;
  const servingAnnualPowerCostUsd = useColo
    ? baseItPowerKw * coloUsdPerKwPerMonth * 12
    : baseFacilityPowerKw * hoursPerYear * powerUsdPerKwh;
  const servingAnnualOpexUsd = servingAnnualPowerCostUsd + annualLicensingCostUsd + servingCapexUsd * (supportPctPerYear / 100);

  const tcoUsd = totalCapexUsd + (annualOpexUsd * tcoYears);
  const totalGpuHours = infraResults.totalGpus * hoursPerYear * tcoYears;
  const effectiveUsdPerGpuHour = totalGpuHours > 0 ? tcoUsd / totalGpuHours : 0;

  const cloudEquivalentTcoUsd = cloudEquivalentUsdPerHr * hoursPerYear * tcoYears;
  const buildVsBuySavingsUsd = cloudEquivalentTcoUsd - tcoUsd;

  // Break-even: months until cumulative on-prem spend (capex + opex-to-date) is overtaken by
  // cumulative cloud-rental spend. If on-prem's own recurring cost already exceeds cloud rental,
  // there's no break-even -- cloud is cheaper from month 1 (null, not a misleading number).
  const onPremMonthlyRecurringUsd = annualOpexUsd / 12;
  const cloudMonthlyUsd = cloudEquivalentUsdPerHr * 24 * 30.44; // average days/month
  const monthlySavingsUsd = cloudMonthlyUsd - onPremMonthlyRecurringUsd;
  const breakEvenMonths = monthlySavingsUsd > 0 ? (totalCapexUsd / monthlySavingsUsd) : null;

  return {
    computeCapexUsd,
    networkHardwareCapexUsd,
    storageCapexUsd,
    ragCapexUsd: ragComputeCapexUsd,
    guardrailsCapexUsd: guardrailsComputeCapexUsd,
    ingressCapexUsd: ingressComputeCapexUsd,
    haDrCapexUsd: haDrComputeCapexUsd,
    mlopsCapexUsd: mlopsComputeCapexUsd,
    trainingRedundancyCapexUsd: trainingRedundancyComputeCapexUsd,
    ingressAnnualOpexUsd,
    totalCapexUsd,
    annualPowerCostUsd,
    annualLicensingCostUsd,
    annualSupportCostUsd,
    annualOpexUsd,
    servingCapexUsd,
    servingAnnualOpexUsd,
    tcoYears,
    tcoUsd,
    effectiveUsdPerGpuHour,
    cloudEquivalentUsdPerHr,
    cloudEquivalentTcoUsd,
    buildVsBuySavingsUsd,
    breakEvenMonths,
    useColo,
  };
}

// ─── MIG (Multi-Instance GPU) Consolidation ────────────────────────────────────────────
/**
 * Evaluates whether the current single-GPU-per-replica inference deployment (TP=1, PP=1 --
 * MIG instances are isolated mini-GPUs with no NVLink between them, so a replica sharded
 * across TP/PP can't span MIG instances) could be consolidated onto fewer physical GPUs by
 * packing multiple replicas onto MIG partitions of one physical card, and if so, by how much.
 * Purely a "what if" overlay: it does not mutate calculateInfra()'s own BOM/topology/power --
 * those keep sizing for dedicated whole GPUs. Its physical GPU / IT power outputs are meant to
 * be fed into calculateCost()'s override params when the caller wants MIG reflected in cost.
 */
export function calculateMigConsolidation(config) {
  const {
    infraResults,
    gpu,
    gpusPerChassis = 8,
    chassisTdpKw = 0,
    enabled = false,
    migProfileId = null, // null = auto-select the smallest profile that fits
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "MIG partitioning is disabled." };
  }

  const availableProfiles = MIG_PROFILES[gpu.id];
  if (!availableProfiles) {
    return { enabled: true, eligible: false, reason: `${gpu.name} does not support MIG (Ampere/Hopper/Blackwell SXM/PCIe datacenter parts only).` };
  }

  if (infraResults.workloadType !== "inference") {
    return { enabled: true, eligible: false, reason: "MIG consolidation applies to inference workloads (training saturates the full GPU by design)." };
  }

  if (infraResults.memory.llmd) {
    return { enabled: true, eligible: false, reason: "MIG consolidation isn't modeled for LLM-D disaggregated serving -- combining both consolidation strategies is out of scope for this phase." };
  }

  // tp/pp aren't returned on infraResults directly (only their product, modelParallelSize),
  // but that product equals 1 only when both tp===1 and pp===1 -- exactly the condition that
  // makes MIG consolidation valid (a replica sharded across multiple GPUs can't span isolated
  // MIG instances, which have no NVLink between them).
  if (infraResults.modelParallelSize !== 1) {
    return { enabled: true, eligible: false, reason: "MIG consolidation requires TP=1 and PP=1 -- a replica sharded across multiple GPUs can't span isolated MIG instances." };
  }

  const perReplicaUsedGb = infraResults.memory.perGpuTotalUsedGb;
  const fittingProfiles = availableProfiles
    .filter(p => (p.vramGb * VRAM_USABLE_FACTOR) >= perReplicaUsedGb)
    .sort((a, b) => a.vramGb - b.vramGb);

  if (fittingProfiles.length === 0) {
    return {
      enabled: true, eligible: false,
      reason: `Replica footprint (${perReplicaUsedGb.toFixed(1)} GB) exceeds even the largest MIG profile's usable capacity on ${gpu.name} -- this workload needs the whole GPU.`,
      availableProfiles: [],
    };
  }

  const selectedProfile = migProfileId
    ? fittingProfiles.find(p => p.id === migProfileId) || fittingProfiles[0]
    : fittingProfiles[0];

  const instancesPerPhysicalGpu = maxInstancesPerGpu(selectedProfile);
  const naiveGpuCount = infraResults.totalGpus; // = dp when tp=pp=1
  const physicalGpusNeeded = Math.max(1, Math.ceil(naiveGpuCount / instancesPerPhysicalGpu));
  const physicalNodesNeeded = Math.max(1, Math.ceil(physicalGpusNeeded / gpusPerChassis));
  const gpuCountSavings = naiveGpuCount - physicalGpusNeeded;
  const savingsPct = naiveGpuCount > 0 ? (gpuCountSavings / naiveGpuCount) * 100 : 0;
  const itPowerKw = physicalNodesNeeded * chassisTdpKw;
  // First-order approximation: MIG allocates compute (SM) and memory-bandwidth slices
  // proportionally to slice count out of 7 -- a real, if simplified, throughput cost of
  // consolidation, not a free lunch.
  const throughputScaleFactor = selectedProfile.slices / 7;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    selectedProfile,
    availableProfiles: fittingProfiles,
    instancesPerPhysicalGpu,
    naiveGpuCount,
    physicalGpusNeeded,
    physicalNodesNeeded,
    gpuCountSavings,
    savingsPct,
    itPowerKw,
    throughputScaleFactor,
  };
}

/**
 * Applies MIG's throughputScaleFactor to calculateInfra()'s throughput block, so the TTFT/TPOT
 * (and everything derived from them -- SLA queueing, Guardrails/Ingress request-rate sizing, the
 * displayed Inference Performance panel) reflect what a replica confined to a MIG slice actually
 * delivers, instead of calculateInfra()'s own whole-dedicated-GPU numbers. MIG eligibility
 * guarantees TP=1, PP=1, and non-LLM-D, which collapses ttftSec to t_compute alone and t_step to
 * max(t_mem, t_comp) alone (every other latency term -- all-reduce, pipeline bubble, KV transfer
 * -- is architecturally zero in that regime), so every latency figure scales uniformly by
 * 1/scale and every rate (tok/s) figure scales uniformly by scale. Returns infraResults unchanged
 * (same reference) when MIG isn't active/eligible or the selected profile is the full 7-slice GPU
 * (scale === 1, no penalty to apply).
 */
export function applyMigThroughputScaling(infraResults, migResults) {
  const scale = migResults?.eligible ? migResults.throughputScaleFactor : 1;
  if (!migResults?.eligible || scale >= 1 || !infraResults.throughput) {
    return infraResults;
  }

  const t = infraResults.throughput;
  const t_step = t.t_step / scale;
  const t_compute = t.t_compute / scale;
  const ttftSec = t_compute + t.t_allreduce + t.t_pipeline + t.t_kv_transfer;
  const replicaThroughput = t.replicaThroughput * scale;
  const clusterThroughput = t.clusterThroughput * scale;
  const promptTokensPerSecPerReplica = Math.round(t.promptTokensPerSecPerReplica * scale);
  const promptTokensPerSecPerGpu = Math.round(t.promptTokensPerSecPerGpu * scale);
  const clusterBatchPromptTps = Math.round(t.clusterBatchPromptTps * scale);

  return {
    ...infraResults,
    throughput: {
      ...t,
      t_mem: t.t_mem / scale,
      t_comp: t.t_comp / scale,
      t_step,
      tpotMs: Number((t_step * 1000).toFixed(2)),
      replicaThroughput: Math.round(replicaThroughput),
      clusterThroughput: Math.round(clusterThroughput),
      tokensPerSecPerReplica: Math.round(replicaThroughput),
      tokensPerSecPerGpu: Math.round(replicaThroughput), // decodeTpCount is always 1 under MIG eligibility
      batchThroughputTps: Math.round(clusterThroughput),
      t_compute,
      ttftSec,
      ttftMs: Number((ttftSec * 1000).toFixed(2)),
      promptTokensPerSecPerGpu,
      promptTokensPerSecPerReplica,
      clusterBatchPromptTps,
    },
  };
}

// Numerically-stable Erlang B recursion (avoids factorial/exponential overflow
// at large c). B(0,a)=1; B(n,a) = (a*B(n-1,a)) / (n + a*B(n-1,a))
function erlangB(c, a) {
  let b = 1;
  for (let n = 1; n <= c; n++) {
    b = (a * b) / (n + a * b);
  }
  return b;
}

// Erlang C (probability an arriving request must queue) derived from Erlang B.
function erlangC(c, a) {
  const b = erlangB(c, a);
  const rho = a / c;
  return b / (1 - rho + rho * b);
}

// M/M/c waiting-time distribution is exponential for the fraction of requests
// that queue at all: Wq_p = 0 for p <= 1-C (never queues), else the tail formula.
function mmcWaitPercentile(c, a, mu, rho, C, p) {
  if (p <= 1 - C) return 0;
  return -Math.log((1 - p) / C) / (c * mu * (1 - rho));
}

export function calculateSla(config) {
  const {
    infraResults,
    targetUtilization = 0.7, // rho: user-set target replica utilization (0-1)
    // Deterministic (non-queueing) latency Add-on Modules attach in front of or behind the LLM
    // replica's own queueing model -- e.g. ingress TLS/routing and a guardrails input classifier
    // both run before the request reaches the batch, and a guardrails output classifier runs
    // after generation finishes, before the response is returned. These are fixed per-request
    // overheads, not stochastic queueing delay, so they shift every percentile by the same
    // constant rather than needing their own distribution.
    extraPreQueueLatencySec = 0,
    extraPostGenerationLatencySec = 0,
  } = config;

  if (infraResults.workloadType !== "inference") {
    return { eligible: false, reason: "SLA/tail-latency queueing applies to inference workloads (training has no request-serving concept)." };
  }

  if (infraResults.memory.llmd) {
    return { eligible: false, reason: "Queueing is modeled per-replica and isn't yet extended to LLM-D disaggregated serving, which uses separate prefill/decode pools." };
  }

  const t = infraResults.throughput;
  if (!t) {
    return { eligible: false, reason: "No throughput data available for this configuration." };
  }

  const c = Math.max(1, Math.round(t.C_rep));
  const ttftSec = t.ttftSec;
  const tpotSec = t.t_step;
  const contextLength = t.contextLength;
  const promptTokenRatio = infraResults.memory.promptTokenRatio;
  const avgOutputTokens = Math.max(1, contextLength * (1 - promptTokenRatio));

  // Full slot-occupancy time: how long a request holds its concurrency slot,
  // from admission (prefill) through the last decode step -- this, not just
  // TTFT, is what determines how fast slots free up for queued requests.
  const meanServiceTimeSec = ttftSec + avgOutputTokens * tpotSec;
  const mu = 1 / meanServiceTimeSec; // service rate per slot, requests/sec

  // Clamp rho away from 1.0 -- an M/M/c system is only stable for rho < 1,
  // and wait times diverge as rho -> 1.
  const rhoInput = targetUtilization;
  const rho = Math.min(0.98, Math.max(0.001, rhoInput));
  const wasClamped = rho !== rhoInput;
  const a = rho * c; // offered load, in Erlangs

  const C = erlangC(c, a);
  const meanWaitSec = C / (c * mu * (1 - rho));

  const p50WaitSec = mmcWaitPercentile(c, a, mu, rho, C, 0.50);
  const p90WaitSec = mmcWaitPercentile(c, a, mu, rho, C, 0.90);
  const p95WaitSec = mmcWaitPercentile(c, a, mu, rho, C, 0.95);
  const p99WaitSec = mmcWaitPercentile(c, a, mu, rho, C, 0.99);

  // Deterministic Add-on Module latency is a fixed per-request offset, not a stochastic queueing
  // delay -- it shifts every percentile by the same constant rather than needing its own
  // distribution. Pre-queue latency (ingress TLS/routing, a guardrails input classifier) delays
  // when the request effectively reaches the replica's queue, ahead of the LLM's own TTFT+wait;
  // post-generation latency (a guardrails output classifier) delays the response after decode
  // finishes and is only meaningful for total response time, not TTFT.
  const ttftBaselineSec = ttftSec + extraPreQueueLatencySec;
  const ttftP50Sec = ttftBaselineSec + p50WaitSec;
  const ttftP90Sec = ttftBaselineSec + p90WaitSec;
  const ttftP95Sec = ttftBaselineSec + p95WaitSec;
  const ttftP99Sec = ttftBaselineSec + p99WaitSec;
  const decodeDurationSec = avgOutputTokens * tpotSec;

  return {
    eligible: true,
    reason: null,
    concurrencyPerReplica: c,
    targetUtilization: rho,
    wasClamped,
    meanServiceTimeSec,
    avgOutputTokens: Math.round(avgOutputTokens),
    probabilityOfQueueing: C, // Erlang C: P(an arriving request must wait)
    meanWaitSec,
    p50WaitSec,
    p90WaitSec,
    p95WaitSec,
    p99WaitSec,
    extraPreQueueLatencySec,
    extraPostGenerationLatencySec,
    // Queueing delay affects TTFT only -- once admitted to the running batch,
    // TPOT/decode is the existing steady-state point estimate, unaffected.
    ttftBaselineSec,
    ttftP50Sec,
    ttftP90Sec,
    ttftP95Sec,
    ttftP99Sec,
    tpotSec, // unaffected by queueing, shown for reference
    // Total response time = TTFT (baseline + queueing) + decode duration + post-generation
    // latency. Decode/post-generation legs are both deterministic given TTFT, so they add
    // straight through to every percentile alongside it.
    totalResponseBaselineSec: ttftBaselineSec + decodeDurationSec + extraPostGenerationLatencySec,
    totalResponseP50Sec: ttftP50Sec + decodeDurationSec + extraPostGenerationLatencySec,
    totalResponseP90Sec: ttftP90Sec + decodeDurationSec + extraPostGenerationLatencySec,
    totalResponseP95Sec: ttftP95Sec + decodeDurationSec + extraPostGenerationLatencySec,
    totalResponseP99Sec: ttftP99Sec + decodeDurationSec + extraPostGenerationLatencySec,
    highUtilizationWarning: rho > 0.85,
  };
}

// ─── RAG (Retrieval-Augmented Generation) Pipeline Completeness ───────────────────────────────
/**
 * Sizes the two compute-contributing layers a RAG pipeline adds on top of the LLM serving
 * cluster that calculateInfra() already sizes: (1) an embedding-inference pool that turns the
 * document corpus (and each live query) into vectors, and (2) a vector database serving pool
 * that stores those vectors and answers similarity queries. Unlike MIG/SLA, this is not a
 * "what if" overlay on existing hardware -- it's genuinely new standing infrastructure, so its
 * capex/power feed into calculateCost() via ragComputeCapexUsd/ragItPowerKw.
 */
export function calculateRag(config) {
  const {
    enabled = false,
    corpusSizeGb = 0,
    textExtractionRatio = 0.2, // corpusSizeGb is raw document storage (PDFs, images, formatting);
                                // only this fraction survives text extraction into embeddable chunks
    avgChunkTokens = 512,
    embeddingModel,           // one of EMBEDDING_MODELS
    embeddingGpu,             // one of GPU_CATALOG -- typically a small/cheap card, not the LLM's serving GPU
    embeddingGpuUnitPriceUsd = 0,
    ingestionTargetHours = 24,
    queryQps = 1,
    vectorDbPlatform,         // one of VECTOR_DB_PLATFORMS
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "RAG pipeline sizing is disabled." };
  }

  if (corpusSizeGb <= 0) {
    return { enabled: true, eligible: false, reason: "Set a document corpus size greater than 0 GB to size the embedding and vector database pipeline." };
  }

  // ── Corpus chunking ──────────────────────────────────────────────────────────────────────
  const CHARS_PER_TOKEN = 4; // rough English-text average
  const extractableTextGb = corpusSizeGb * textExtractionRatio;
  const numChunks = Math.ceil((extractableTextGb * 1e9) / (avgChunkTokens * CHARS_PER_TOKEN));

  // ── Embedding compute: one-time (or periodic re-index) corpus ingestion ─────────────────────
  // Single forward pass per chunk (no autoregressive decode/KV cache, unlike LLM serving).
  const MFU_EMBEDDING = 0.4; // mid-tier MFU, consistent with calculateInfra()'s mfuPrefill band
  const embeddingFlopsPerChunk = 2 * embeddingModel.paramsMillion * 1e6 * avgChunkTokens;
  const totalIngestionFlops = embeddingFlopsPerChunk * numChunks;
  const gpuEffFlops = (embeddingGpu.fp16Tflops || 366) * 1e12 * MFU_EMBEDDING;
  const ingestionTimeSecSingleGpu = totalIngestionFlops / gpuEffFlops;
  const ingestionTargetSec = ingestionTargetHours * 3600;
  const ingestionGpusNeeded = Math.max(1, Math.ceil(ingestionTimeSecSingleGpu / ingestionTargetSec));
  const actualIngestionTimeHours = (ingestionTimeSecSingleGpu / ingestionGpusNeeded) / 3600;

  // ── Embedding compute: live query embedding (always-on serving load) ────────────────────────
  const AVG_QUERY_TOKENS = 32; // a short retrieval query, much smaller than a document chunk
  const queryEmbeddingFlopsPerSec = 2 * embeddingModel.paramsMillion * 1e6 * AVG_QUERY_TOKENS * queryQps;
  const queryEmbeddingGpusNeeded = Math.max(1, Math.ceil(queryEmbeddingFlopsPerSec / gpuEffFlops));

  // Provision for the larger of the two -- a serving-sized pool can usually absorb ingestion
  // in the background, and an ingestion-sized pool always covers live query embedding too.
  const embeddingGpusNeeded = Math.max(ingestionGpusNeeded, queryEmbeddingGpusNeeded);

  // ── Vector database: capacity (RAM to hold the index) vs. throughput (QPS) ──────────────────
  // fp32 vector storage plus ~15% HNSW graph overhead, consistent with published benchmarks
  // (e.g. ~60-70GB observed for 10M x 1536-dim fp32 vectors, vs. ~61.4GB of raw vector data).
  const HNSW_OVERHEAD_FACTOR = 1.15;
  const USABLE_RAM_FRACTION = 0.85; // headroom for OS/query cache, consistent with storage sizing
  const bytesPerVector = embeddingModel.dims * 4 * HNSW_OVERHEAD_FACTOR;
  const vectorsPerNode = Math.floor((vectorDbPlatform.ramGbPerNode * 1e9 * USABLE_RAM_FRACTION) / bytesPerVector);
  const nodesForCapacity = Math.max(1, Math.ceil(numChunks / vectorsPerNode));
  const nodesForThroughput = Math.max(1, Math.ceil(queryQps / vectorDbPlatform.estimatedQpsPerNode));
  const vectorDbNodesNeeded = Math.max(nodesForCapacity, nodesForThroughput);
  const bindingConstraint = nodesForCapacity >= nodesForThroughput ? "capacity" : "throughput";
  const vectorDbRamGb = vectorDbNodesNeeded * vectorDbPlatform.ramGbPerNode;

  // ── Cost & power (illustrative, feeds into calculateCost()) ─────────────────────────────────
  const embeddingComputeCapexUsd = embeddingGpusNeeded * embeddingGpuUnitPriceUsd;
  const vectorDbCapexUsd = vectorDbNodesNeeded * vectorDbPlatform.estimatedUsdPerNodeCapex;
  const ragComputeCapexUsd = embeddingComputeCapexUsd + vectorDbCapexUsd;

  const embeddingGpuPowerKw = ((embeddingGpu.chassisTdpKw || 3.8) / (embeddingGpu.gpusPerChassis || 8)) * embeddingGpusNeeded;
  const VECTOR_DB_NODE_POWER_KW = 0.6; // typical dual-socket CPU server, illustrative
  const vectorDbPowerKw = vectorDbNodesNeeded * VECTOR_DB_NODE_POWER_KW;
  const ragItPowerKw = embeddingGpuPowerKw + vectorDbPowerKw;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    extractableTextGb,
    numChunks,
    embeddingModel,
    ingestionTimeSecSingleGpu,
    ingestionGpusNeeded,
    actualIngestionTimeHours,
    queryEmbeddingGpusNeeded,
    embeddingGpusNeeded,
    embeddingComputeCapexUsd,
    embeddingGpuPowerKw,
    vectorDbPlatform,
    nodesForCapacity,
    nodesForThroughput,
    vectorDbNodesNeeded,
    bindingConstraint,
    vectorDbRamGb,
    vectorDbCapexUsd,
    vectorDbPowerKw,
    ragComputeCapexUsd,
    ragItPowerKw,
  };
}

// ─── Guardrails / Safety Classifier Layer ──────────────────────────────────────────────────────
/**
 * Sizes an input/output safety-classifier pool that screens every request: an input guard
 * (classifies the prompt before generation starts, gating TTFT) and/or an output guard
 * (classifies the full response before it's returned). Guard models are small(er) LLMs used in
 * a single-forward-pass classification role -- like calculateRag()'s embedding pool, this is
 * genuine new standing infrastructure (not a "what if" overlay), so its capex/power feed into
 * calculateCost() the same way RAG's do. The added per-request latency (addedTtftSec /
 * outputGuardLatencySec) is a fixed, deterministic offset -- calculateSla() folds it into the
 * TTFT/total-response-time percentiles it reports as extraPreQueueLatencySec /
 * extraPostGenerationLatencySec, since it doesn't itself queue on the LLM replica's own
 * concurrency and so needs no distribution of its own.
 */
export function calculateGuardrails(config) {
  const {
    enabled = false,
    infraResults,
    guardModel,              // one of GUARDRAIL_MODELS
    guardGpu,                // one of GPU_CATALOG -- typically a small/cheap card, like RAG's embedding GPU
    guardGpuUnitPriceUsd = 0,
    enableInputGuard = true,
    enableOutputGuard = true,
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "Guardrails sizing is disabled." };
  }

  if (infraResults.workloadType !== "inference") {
    return { enabled: true, eligible: false, reason: "Guardrails apply to inference workloads -- training has no request-serving path to screen." };
  }

  if (!enableInputGuard && !enableOutputGuard) {
    return { enabled: true, eligible: false, reason: "Enable at least one of the input guard or output guard to size the guardrail pool." };
  }

  const t = infraResults.throughput;
  if (!t) {
    return { enabled: true, eligible: false, reason: "No throughput data available for this configuration." };
  }

  // Every request that reaches the LLM passes through the guard(s) once -- request rate is
  // derived from the already-sized cluster decode throughput, not a separate user guess, since
  // guardrail load is 1:1 with LLM request volume (unlike RAG's retrieval QPS, which isn't).
  const promptTokens = infraResults.memory.promptTokens;
  const promptTokenRatio = infraResults.memory.promptTokenRatio;
  const avgOutputTokens = Math.max(1, t.contextLength * (1 - promptTokenRatio));
  const clusterThroughputTps = t.clusterThroughput;
  const requestRatePerSec = clusterThroughputTps / avgOutputTokens;

  // Single-forward-pass classification cost (the few output tokens a guard emits -- "safe" /
  // "unsafe" plus a category code -- are negligible next to prompt/response lengths, so this
  // mirrors calculateRag()'s embedding treatment rather than modeling autoregressive decode).
  const MFU_GUARDRAIL = 0.4; // mid-tier MFU, consistent with calculateRag()'s embedding MFU
  const gpuEffFlops = (guardGpu.fp16Tflops || 366) * 1e12 * MFU_GUARDRAIL;
  const flopsPerParamToken = 2 * guardModel.paramsBillion * 1e9;

  const inputGuardFlopsPerReq = enableInputGuard ? flopsPerParamToken * promptTokens : 0;
  const outputGuardFlopsPerReq = enableOutputGuard ? flopsPerParamToken * avgOutputTokens : 0;

  // Throughput sizing: enough GPUs to keep up with the cluster's steady-state request rate.
  const totalGuardFlopsPerSec = (inputGuardFlopsPerReq + outputGuardFlopsPerReq) * requestRatePerSec;
  const guardGpusNeeded = Math.max(1, Math.ceil(totalGuardFlopsPerSec / gpuEffFlops));

  // Latency sizing: a single request's own guard pass, on one GPU -- what it adds to that
  // request's end-to-end timeline, independent of how many GPUs are provisioned for throughput.
  const inputGuardLatencySec = inputGuardFlopsPerReq / gpuEffFlops;
  const outputGuardLatencySec = outputGuardFlopsPerReq / gpuEffFlops;
  const addedTtftSec = inputGuardLatencySec; // blocks generation from starting
  const addedTotalLatencySec = inputGuardLatencySec + outputGuardLatencySec; // full round-trip addition

  const guardrailsComputeCapexUsd = guardGpusNeeded * guardGpuUnitPriceUsd;
  const guardGpuPowerKw = ((guardGpu.chassisTdpKw || 3.8) / (guardGpu.gpusPerChassis || 8)) * guardGpusNeeded;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    guardModel,
    enableInputGuard,
    enableOutputGuard,
    requestRatePerSec,
    guardGpusNeeded,
    guardrailsComputeCapexUsd,
    guardrailsItPowerKw: guardGpuPowerKw,
    inputGuardLatencySec,
    outputGuardLatencySec,
    addedTtftSec,
    addedTotalLatencySec,
  };
}

// ─── Ingress / Edge Networking ─────────────────────────────────────────────────────────────────
/**
 * Sizes the load-balancing/TLS-termination/edge layer that sits in front of the LLM serving
 * cluster: enough nodes (appliances, software instances, or managed-service units) to carry the
 * cluster's outbound response bandwidth, plus the recurring egress bandwidth bill that traffic
 * generates -- every response byte that leaves the datacenter is billed per GB regardless of
 * which ingress tier fronts it. Like RAG and guardrails this is a real Add-on Module: self-hosted
 * tiers add capex/power, and ALL tiers add a recurring annual opex term (egress + managed-service
 * fees) that calculateCost() folds in directly, separate from the capex-driven support-cost base.
 */
export function calculateIngress(config) {
  const {
    enabled = false,
    infraResults,
    ingressTier,          // one of INGRESS_TIERS
    egressUsdPerGb = 0.09,
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "Ingress/edge sizing is disabled." };
  }

  if (infraResults.workloadType !== "inference") {
    return { enabled: true, eligible: false, reason: "Ingress/edge sizing applies to inference workloads -- training has no live request-serving traffic to front." };
  }

  const t = infraResults.throughput;
  if (!t) {
    return { enabled: true, eligible: false, reason: "No throughput data available for this configuration." };
  }

  // Same request-rate derivation as calculateGuardrails() -- every served request is one
  // response leaving through ingress, 1:1 with LLM request volume.
  const promptTokenRatio = infraResults.memory.promptTokenRatio;
  const avgOutputTokens = Math.max(1, t.contextLength * (1 - promptTokenRatio));
  const requestRatePerSec = t.clusterThroughput / avgOutputTokens;

  // Response payload size: output tokens as UTF-8 text, plus SSE/JSON streaming framing overhead
  // (event boundaries, field names) -- consistent with calculateRag()'s CHARS_PER_TOKEN estimate.
  const CHARS_PER_TOKEN = 4;
  const STREAMING_OVERHEAD_FACTOR = 1.15;
  const avgResponseBytes = avgOutputTokens * CHARS_PER_TOKEN * STREAMING_OVERHEAD_FACTOR;

  const totalEgressBitsPerSec = requestRatePerSec * avgResponseBytes * 8;
  const totalEgressGbps = totalEgressBitsPerSec / 1e9;
  const nodesNeeded = Math.max(1, Math.ceil(totalEgressGbps / ingressTier.throughputGbpsPerNode));

  const secondsPerYear = 365 * 24 * 3600;
  const annualEgressGb = (requestRatePerSec * avgResponseBytes * secondsPerYear) / 1e9;
  const annualEgressCostUsd = annualEgressGb * egressUsdPerGb;

  const ingressComputeCapexUsd = nodesNeeded * ingressTier.estimatedUsdPerNodeCapex;
  const annualManagedServiceCostUsd = nodesNeeded * ingressTier.estimatedUsdPerNodeMonthlyOpex * 12;
  const ingressAnnualOpexUsd = annualEgressCostUsd + annualManagedServiceCostUsd;

  // Only self-hosted appliances/servers draw IT power on-prem; managed services run off-site.
  const INGRESS_NODE_POWER_KW = 0.5; // typical 1U proxy/appliance server, illustrative
  const ingressItPowerKw = ingressTier.type === "self-hosted" ? nodesNeeded * INGRESS_NODE_POWER_KW : 0;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    ingressTier,
    requestRatePerSec,
    avgResponseBytes,
    totalEgressGbps,
    nodesNeeded,
    annualEgressGb,
    annualEgressCostUsd,
    annualManagedServiceCostUsd,
    ingressComputeCapexUsd,
    ingressAnnualOpexUsd,
    ingressItPowerKw,
    addedLatencyMs: ingressTier.latencyOverheadMs,
  };
}

// ─── High Availability / Disaster Recovery ─────────────────────────────────────────────────────
/**
 * Sizes the incremental compute+storage a multi-AZ or cross-region DR tier adds on top of the
 * primary site's already-sized deployment. Unlike RAG/guardrails/ingress (which add their own
 * small dedicated hardware pools), HA/DR multiplies EXISTING compute and storage -- a standby or
 * active-active copy uses identical GPU/storage hardware to the primary site, priced at the same
 * per-unit rates. Computed independently of calculateCost()'s own capex figures (rather than
 * consuming them) to avoid a circular dependency, since calculateCost() is also where this
 * overlay's own output gets fed back in.
 */
export function calculateHaDr(config) {
  const {
    enabled = false,
    infraResults,
    storageResults = null,
    haDrTier,              // one of HA_DR_TIERS
    gpuUnitPriceUsd = 0,
    decodeGpuUnitPriceUsd = null, // only used when infraResults is LLM-D heterogeneous, mirrors calculateCost()
    storageUsdPerTbRaw = 0,
    computeGpuCountOverride = null, // pass MIG's consolidated GPU count when eligible, for consistency with calculateCost()
    itPowerKwOverride = null,
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "HA/DR sizing is disabled." };
  }

  if (infraResults.workloadType !== "inference") {
    return { enabled: true, eligible: false, reason: "HA/DR replica sizing applies to inference workloads -- a training job's resilience is a checkpoint/resume concern (see Storage), not a live-replica one." };
  }

  // LLM-D heterogeneous deployments price prefill and decode GPUs separately (they're often
  // different GPU classes) -- mirror calculateCost()'s own isLlmd branch so a DR replica's base
  // compute capex matches the primary site's actual capex rather than a blended single-price
  // estimate, which understates or overstates depending on which pool is pricier.
  const isLlmd = !!infraResults.memory.llmd;
  let baseGpuCount;
  let baseComputeCapexUsd;
  if (isLlmd) {
    const prefillGpus = infraResults.memory.llmd.prefill.gpus;
    const decodeGpus = infraResults.memory.llmd.decode.gpus;
    const decPrice = decodeGpuUnitPriceUsd != null ? decodeGpuUnitPriceUsd : gpuUnitPriceUsd;
    baseGpuCount = prefillGpus + decodeGpus;
    baseComputeCapexUsd = (prefillGpus * gpuUnitPriceUsd) + (decodeGpus * decPrice);
  } else {
    baseGpuCount = computeGpuCountOverride != null ? computeGpuCountOverride : infraResults.totalGpus;
    baseComputeCapexUsd = baseGpuCount * gpuUnitPriceUsd;
  }
  const baseStorageCapexUsd = storageResults ? storageResults.achievedCapacityTb * storageUsdPerTbRaw : 0;
  const baseItPowerKw = itPowerKwOverride != null ? itPowerKwOverride : infraResults.facility.totalItPowerKw;

  // Only the INCREMENTAL multiplier (tier - 1x) is new spend -- the base 1x is already priced as
  // the primary site's own compute/storage capex elsewhere.
  const incrementalComputeCapexUsd = baseComputeCapexUsd * (haDrTier.computeMultiplier - 1);
  const incrementalStorageCapexUsd = baseStorageCapexUsd * (haDrTier.storageMultiplier - 1);
  const haDrComputeCapexUsd = incrementalComputeCapexUsd + incrementalStorageCapexUsd;
  const haDrItPowerKw = baseItPowerKw * (haDrTier.computeMultiplier - 1);

  return {
    enabled: true,
    eligible: true,
    reason: null,
    haDrTier,
    baseGpuCount,
    baseComputeCapexUsd,
    baseStorageCapexUsd,
    incrementalComputeCapexUsd,
    incrementalStorageCapexUsd,
    haDrComputeCapexUsd,
    haDrItPowerKw,
  };
}

// ─── Training Spare Node Capacity ───────────────────────────────────────────────────────────────
/**
 * Sizes standing spare/hot-standby compute nodes for a training run -- the compute-level
 * redundancy that actually matters for training, as distinct from HA/DR's live-replica
 * redundancy (which applies only to inference; see calculateHaDr()). At hyperscale (hundreds to
 * thousands of GPUs, weeks-to-months-long jobs), hardware failures are frequent enough and
 * procurement lead times long enough that keeping a small buffer of already-racked, powered
 * spare nodes on the floor -- ready to swap in for a failed node without stalling the run -- is
 * standard practice; at small scale it isn't (a support contract's RMA turnaround is fine when a
 * job is hours-to-days long). Training's other resilience mechanism, checkpoint/resume, is
 * already modeled in calculateStorage() and is unaffected by this overlay. Same additive capex/
 * power pattern as HA/DR/RAG/guardrails/ingress/MLOps, feeding into calculateCost().
 */
export function calculateTrainingRedundancy(config) {
  const {
    enabled = false,
    infraResults,
    spareNodePct = 0, // 0-10%: spare/hot-standby nodes as a percentage of the training cluster's own node count
    gpuUnitPriceUsd = 0,
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "Training spare node capacity is disabled." };
  }

  if (infraResults.workloadType !== "training") {
    return { enabled: true, eligible: false, reason: "Spare node capacity applies to training workloads -- inference resilience is a live-replica concern (see HA/DR)." };
  }

  const baseNodes = infraResults.nodes;
  const gpusPerNode = baseNodes > 0 ? infraResults.gpusAllocated / baseNodes : 0;
  const baseItPowerKwPerNode = baseNodes > 0 ? infraResults.facility.chassisPowerKw / baseNodes : 0;

  const spareNodeCount = Math.round(baseNodes * (Math.max(0, spareNodePct) / 100));
  const spareGpuCount = spareNodeCount * gpusPerNode;
  const spareComputeCapexUsd = spareGpuCount * gpuUnitPriceUsd;
  const spareItPowerKw = spareNodeCount * baseItPowerKwPerNode;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    baseNodes,
    gpusPerNode,
    spareNodePct: Math.max(0, spareNodePct),
    spareNodeCount,
    spareGpuCount,
    spareComputeCapexUsd,
    spareItPowerKw,
  };
}

// ─── MLOps Lifecycle: Canary / Shadow / Blue-Green Validation Pool ─────────────────────────────
/**
 * Sizes the standing compute pool a safe model-rollout strategy needs alongside the primary
 * serving cluster: a canary pool sized to its own slice of live traffic, or a full-scale shadow/
 * blue-green pool that mirrors or matches 100% of primary capacity during validation. Unlike
 * HA/DR's tier multipliers (which describe TOTAL redundant capacity including the primary, hence
 * `multiplier - 1` for the incremental spend), a validation pool is purely additive -- there's no
 * "base 1x already counted" to subtract, so its capacityMultiplier is applied directly. Mirrors
 * calculateHaDr()'s LLM-D split-pricing and MIG-override treatment for consistency, and is
 * computed independently of calculateCost()'s own capex figures to avoid the same circular
 * dependency HA/DR avoids (this overlay's output also feeds back into that same call).
 */
export function calculateMlops(config) {
  const {
    enabled = false,
    infraResults,
    mlopsStrategy,           // one of MLOPS_STRATEGIES
    canaryTrafficPct = 10,   // only meaningful when mlopsStrategy.id === 'canary-release'
    gpuUnitPriceUsd = 0,
    decodeGpuUnitPriceUsd = null, // only used when infraResults is LLM-D heterogeneous
    computeGpuCountOverride = null, // pass MIG's consolidated GPU count when eligible, for consistency with calculateCost()
    itPowerKwOverride = null,
  } = config;

  if (!enabled) {
    return { enabled: false, eligible: false, reason: "MLOps validation-pool sizing is disabled." };
  }

  if (infraResults.workloadType !== "inference") {
    return { enabled: true, eligible: false, reason: "Canary/shadow/blue-green rollout sizing applies to inference workloads -- training has no live-traffic rollout concept." };
  }

  const isLlmd = !!infraResults.memory.llmd;
  let baseGpuCount;
  let baseComputeCapexUsd;
  if (isLlmd) {
    const prefillGpus = infraResults.memory.llmd.prefill.gpus;
    const decodeGpus = infraResults.memory.llmd.decode.gpus;
    const decPrice = decodeGpuUnitPriceUsd != null ? decodeGpuUnitPriceUsd : gpuUnitPriceUsd;
    baseGpuCount = prefillGpus + decodeGpus;
    baseComputeCapexUsd = (prefillGpus * gpuUnitPriceUsd) + (decodeGpus * decPrice);
  } else {
    baseGpuCount = computeGpuCountOverride != null ? computeGpuCountOverride : infraResults.totalGpus;
    baseComputeCapexUsd = baseGpuCount * gpuUnitPriceUsd;
  }
  const baseItPowerKw = itPowerKwOverride != null ? itPowerKwOverride : infraResults.facility.totalItPowerKw;

  const capacityMultiplier = mlopsStrategy.id === "canary-release"
    ? Math.max(0, canaryTrafficPct) / 100
    : mlopsStrategy.capacityMultiplier;

  const validationGpuCount = Math.max(1, Math.ceil(baseGpuCount * capacityMultiplier));
  const mlopsComputeCapexUsd = baseComputeCapexUsd * capacityMultiplier;
  const mlopsItPowerKw = baseItPowerKw * capacityMultiplier;

  return {
    enabled: true,
    eligible: true,
    reason: null,
    mlopsStrategy,
    capacityMultiplier,
    baseGpuCount,
    validationGpuCount,
    mlopsComputeCapexUsd,
    mlopsItPowerKw,
  };
}

/**
 * Unit economics of a sized inference deployment versus a per-token API.
 * The cluster is sized for its peak concurrency; `dutyCyclePct` is the share of hours it
 * actually runs at that load, averaged over the month. Hardware is amortized straight-line
 * over the TCO period. Reasoning tokens count as output tokens, as API providers bill them.
 */
export function calculateTokenEconomics({
  cost,                        // calculateCost() output
  throughput,                  // calculateInfra() throughput (inference only)
  promptTokensPerRequest,
  outputTokensPerRequest,      // visible answer + reasoning tokens
  dutyCyclePct = 50,
  apiInputUsdPer1M = 0,
  apiOutputUsdPer1M = 0,
}) {
  if (!throughput || !cost || !(throughput.batchThroughputTps > 0) || !(outputTokensPerRequest > 0)) {
    return { eligible: false };
  }
  const hoursPerMonth = 730;
  // Fully loaded: everything in Cost & TCO. Serving only: the GPU cluster an API would replace
  // (RAG, guardrails, storage, HA/DR etc. are usually still needed with an API).
  const fullyLoadedMonthlyCostUsd = cost.totalCapexUsd / (cost.tcoYears * 12) + cost.annualOpexUsd / 12;
  const monthlyCostUsd = (cost.servingCapexUsd ?? cost.totalCapexUsd) / (cost.tcoYears * 12)
    + (cost.servingAnnualOpexUsd ?? cost.annualOpexUsd) / 12;
  const requestsPerSecAtPeak = throughput.batchThroughputTps / outputTokensPerRequest;
  const duty = Math.min(1, Math.max(0.01, dutyCyclePct / 100));
  const requestsPerMonthAtFull = requestsPerSecAtPeak * 3600 * hoursPerMonth;
  const requestsPerMonth = requestsPerMonthAtFull * duty;
  const outputTokensPerMonth = requestsPerMonth * outputTokensPerRequest;
  const inputTokensPerMonth = requestsPerMonth * promptTokensPerRequest;
  const totalTokensPerMonth = outputTokensPerMonth + inputTokensPerMonth;

  const apiCostPerRequestUsd = (promptTokensPerRequest * apiInputUsdPer1M + outputTokensPerRequest * apiOutputUsdPer1M) / 1e6;
  const apiMonthlyCostUsd = apiCostPerRequestUsd * requestsPerMonth;
  // Utilization at which owning costs the same as paying the API for the same requests.
  const crossoverDutyPct = apiCostPerRequestUsd > 0
    ? (monthlyCostUsd / (apiCostPerRequestUsd * requestsPerMonthAtFull)) * 100
    : null;

  return {
    eligible: true,
    dutyCyclePct: duty * 100,
    monthlyCostUsd,
    fullyLoadedMonthlyCostUsd,
    fullyLoadedCostPer1MOutputTokensUsd: (fullyLoadedMonthlyCostUsd / outputTokensPerMonth) * 1e6,
    requestsPerMonth,
    inputTokensPerMonth,
    outputTokensPerMonth,
    costPerRequestUsd: monthlyCostUsd / requestsPerMonth,
    costPer1MOutputTokensUsd: (monthlyCostUsd / outputTokensPerMonth) * 1e6,
    costPer1MTotalTokensUsd: (monthlyCostUsd / totalTokensPerMonth) * 1e6,
    apiCostPerRequestUsd,
    apiMonthlyCostUsd,
    monthlySavingsVsApiUsd: apiMonthlyCostUsd - monthlyCostUsd,
    crossoverDutyPct,
    crossoverReachable: crossoverDutyPct != null && crossoverDutyPct <= 100,
  };
}
