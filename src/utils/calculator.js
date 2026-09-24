/**
 * Core Sizing & Network Topology Calculator for Private AI Infrastructure
 */
import { GPU_CATALOG } from '../data/hardware.js';

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
};

const VRAM_USABLE_FACTOR = CONFIG.gpuMemUtil;
const RACK_USABLE_RU = CONFIG.rackRU;
const DEFAULT_SWITCH_POWER_KW = 3.5;

// ─── Helper ───────────────────────────────────────────────────────────────────
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
    zeroStage
  } = params;

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

    let bytesPerTokenSeq;
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      bytesPerTokenSeq = layers * (512 + 64) * kvBytesPerElement;
    } else {
      bytesPerTokenSeq = 2 * layers * kvHeads * headDim * kvBytesPerElement;
    }

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
  const usableGpuVramGb     = gpu.vramGb * VRAM_USABLE_FACTOR;
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

  // S5: Set DP = ceil(requiredKvForC / kvCapacityPerReplica). Concurrency scales DP, not TP.
  let recommendedDp = 1;
  if (workloadType === "inference") {
    let bytesPerTokenSeq;
    let kvBytesPerElement = 2.0;
    if (kvPrecision === "fp8") kvBytesPerElement = 1.0;
    else if (kvPrecision === "int4") kvBytesPerElement = 0.5;

    if (model.id === "deepseek-r1-671b" || model.isMla) {
      bytesPerTokenSeq = layers * (512 + 64) * kvBytesPerElement;
    } else {
      bytesPerTokenSeq = 2 * layers * kvHeads * headDim * kvBytesPerElement;
    }

    const promptTokens = Math.round(contextLength * promptTokenRatio);
    const effectiveGlobalPrefixTokens = globalPrefixTokens != null
      ? Math.min(promptTokens, Math.max(0, globalPrefixTokens))
      : Math.round(promptTokens * prefixCacheRatio);
    const privateTokensPerStream = contextLength - effectiveGlobalPrefixTokens;
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
    const perGpuWeightGb = (weightGb / (recommendedTp * recommendedPp)) * ppImbalanceFactor;
    const perGpuActGb = (mActBytes / 1e9) / (recommendedTp * recommendedPp);
    const perGpuAvailForKvGb = Math.max(0, usableGpuVramGb - perGpuWeightGb - perGpuActGb);

    let kvCapacityPerReplica = 0;
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      kvCapacityPerReplica = perGpuAvailForKvGb * recommendedPp;
    } else {
      const tpEff = Math.min(recommendedTp, kvHeads);
      kvCapacityPerReplica = perGpuAvailForKvGb * (tpEff * recommendedPp);
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
    pue = 1.35,      // facility PUE factor (default 1.35)
    servingConfig = null, // { servingEngine, orchestrator, servingArchitecture, enableChunkedPrefill, enablePrefixCaching }
  } = config;

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

  const modelParallelSize = tp * pp;
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

    if (model.id === "deepseek-r1-671b" || model.isMla) {
      bytesPerTokenSeq = layers * (512 + 64) * kvBytesPerElement;
    } else {
      bytesPerTokenSeq = 2 * layers * kvHeads * headDim * kvBytesPerElement;
    }

    // Baseline unoptimized KV cache (standard FP16 with 0% prefix caching)
    const baselineBytesPerTokenSeq = (model.id === "deepseek-r1-671b" || model.isMla)
      ? layers * (512 + 64) * 2.0
      : 2 * layers * kvHeads * headDim * 2.0;
    baselineKvGb = (baselineBytesPerTokenSeq * contextLength * concurrencyPerReplica) / 1e9;

    // Prefix Caching: Shared prompt tokens stored ONCE in VRAM across streams;
    // unique tokens stored per stream (session reuse tokens are stored per stream).
    // Both counted per replica: prefix caching is a per-instance radix tree, not shared
    // cluster-wide across independent DP replicas.
    const privateTokensPerStream = contextLength - effectiveGlobalPrefixTokens;
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
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      prefillKvGb = prefillTransientKvTotalGb / prefillPp;
    } else {
      const prefillTpEff = Math.min(prefillTp, kvHeads);
      prefillKvGb = prefillTransientKvTotalGb / (prefillTpEff * prefillPp);
    }

    const prefillTotalUsedGb = prefillWeightsGb + prefillActGb + prefillKvGb;
    const prefillUsableGb = prefillGpu.vramGb * CONFIG.gpuMemUtil;
    prefillIsOOM = prefillTotalUsedGb > prefillUsableGb;
    const prefillHeadroomGb = prefillUsableGb - prefillTotalUsedGb;
    const prefillUtilization = Math.min(100, Math.round((prefillTotalUsedGb / prefillGpu.vramGb) * 100));

    // 2. Decode Pool: Holds model weights + pooled KV caches for ALL concurrent users + 1-token decode activations
    const decodePpImbalance = decodePp > 1 ? CONFIG.ppImbalance : 1.0;
    const decodeWeightsGb = (weightMemoryTotalGb / (decodeTp * decodePp)) * decodePpImbalance;
    let decodeKvGb = 0;
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      decodeKvGb = kvCacheTotalGb / decodePp;
    } else {
      const decodeTpEff = Math.min(decodeTp, kvHeads);
      decodeKvGb = kvCacheTotalGb / (decodeTpEff * decodePp);
    }
    const decodeTokensPerStep = concurrencyPerReplica;
    const decodeActBytes = (decodeTokensPerStep * (hiddenDim + 2 * intermediate) * CONFIG.B_act * 1.2) + (maxNumSeqs * vocab * 4);
    const decodeActGb = (decodeActBytes / 1e9 / decodeTp) + (CONFIG.runtimeOverheadPerGpu / 1e9);
    const decodeTotalUsedGb = decodeWeightsGb + decodeKvGb + decodeActGb;
    const decodeUsableGb = decodeGpu.vramGb * CONFIG.gpuMemUtil;
    decodeIsOOM = decodeTotalUsedGb > decodeUsableGb;
    const decodeHeadroomGb = decodeUsableGb - decodeTotalUsedGb;
    const decodeUtilization = Math.min(100, Math.round((decodeTotalUsedGb / decodeGpu.vramGb) * 100));

    // 3. Lossless RoCEv2 KV Cache Network Transfer (M3)
    let transferBytesPerTokenSeq;
    const kvTransferBytes = kvPrecision === "fp8" ? 1.0 : (kvPrecision === "int4" ? 0.5 : 2.0);
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      transferBytesPerTokenSeq = layers * (512 + 64) * kvTransferBytes;
    } else {
      transferBytesPerTokenSeq = 2 * layers * kvHeads * headDim * kvTransferBytes;
    }
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
    perGpuWeightsGb = (weightMemoryTotalGb / (tp * pp)) * ppImbalanceFactor;
    if (model.id === "deepseek-r1-671b" || model.isMla) {
      perGpuKvOrOptGb = kvCacheTotalGb / pp;
    } else {
      const tpEff = Math.min(tp, kvHeads);
      perGpuKvOrOptGb = kvCacheTotalGb / (tpEff * pp);
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
  const usableGpuCapacityGb      = gpuCapacityGb * VRAM_USABLE_FACTOR;
  const memoryUtilizationPercent = Math.min(100, Math.round((perGpuTotalUsedGb / gpuCapacityGb) * 100));
  const isOOM     = isLlmd ? (prefillIsOOM || decodeIsOOM) : (perGpuTotalUsedGb > usableGpuCapacityGb);
  const headroomGb = usableGpuCapacityGb - perGpuTotalUsedGb;

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

  // LLM-D Disaggregated Serving architectural advisory
  if (isLlmd) {
    if (prefillIsOOM) {
      warnings.push(`Out of Memory on Prefill Pool: Needs ${llmdData.prefill.totalUsedGb.toFixed(1)} GB per ${prefillGpu.name} (usable: ${llmdData.prefill.usableGb.toFixed(1)} GB). Increase Prefill nodes or select higher VRAM GPUs.`);
    }
    if (decodeIsOOM) {
      warnings.push(`Out of Memory on Decode Pool: Needs ${llmdData.decode.totalUsedGb.toFixed(1)} GB per ${decodeGpu.name} (usable: ${llmdData.decode.usableGb.toFixed(1)} GB) to store active KV caches. Increase Decode nodes, increase TP, or switch to FP8.`);
    }
    if (!prefillIsOOM && !decodeIsOOM) {
      if (isHeterogeneousLlmd) {
        warnings.push(`Heterogeneous LLM-D Active: Sized with ${prefillNodes}x ${prefillPlatform.shortName} (${prefillGpu.name} Prefill) + ${decodeNodes}x ${decodePlatform.shortName} (${decodeGpu.name} Decode). Prompt KV-cache (${llmdData.kvTransfer.promptKvChunkGb} GB) streams over Cisco Nexus RoCEv2 in ~${llmdData.kvTransfer.kvTransferLatencyMs} ms with zero decode jitter.`);
      } else {
        warnings.push(`Homogeneous LLM-D Active: Partitioned into ${prefillNodes} Prefill node(s) (TP=${prefillTp}) and ${decodeNodes} Decode node(s) (TP=${decodeTp}). The Cisco Nexus RoCEv2 fabric transfers KV-cache chunks in ~${llmdData.kvTransfer.kvTransferLatencyMs} ms.`);
      }
    }
  }

  if (isOOM && !isLlmd) {
    const deficitGb = (perGpuTotalUsedGb - usableGpuCapacityGb).toFixed(1);
    warnings.push(`Out of Memory! Each GPU needs ${perGpuTotalUsedGb.toFixed(1)} GB, exceeding ${gpu.name}'s usable ${usableGpuCapacityGb.toFixed(0)} GB limit (${gpuCapacityGb} GB × ${VRAM_USABLE_FACTOR}) by ${deficitGb} GB.`);

    if (workloadType === "inference") {
      recommendations.push("Increase Tensor Parallelism (TP), switch to FP8/INT4 quantization, increase Pipeline Parallelism (PP), or select higher VRAM GPUs (e.g. H200 141GB or B200 192GB).");
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
  // this 1:1 non-blocking fabric.
  const totalClusterBisectionTbps = (totalComputeNics * nicSpeedGbps) / 1000;

  const isPcieOrModular = (platform && platform.isModular) || gpu.interconnectType === "pcie" || platform?.interconnectType === "pcie";

  let leafSwitches   = 0;
  let spineSwitches  = 0;
  let uplinkCables   = 0;
  let downlinkCables = totalGpus;
  let fabricCables   = 0;
  let transceivers   = 0;

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
      const uplinksPerLeaf = Math.ceil(D / CONFIG.oversubscription);
      spineSwitches  = Math.ceil((leafSwitches * uplinksPerLeaf) / CONFIG.switchPorts);
      uplinkCables   = leafSwitches * uplinksPerLeaf;
    }
    downlinkCables = N_gpus;
    fabricCables   = downlinkCables + uplinkCables;
    transceivers   = 2 * (downlinkCables + uplinkCables);
  }

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
    let prefillPeakDenseFlops = (targetPrefillGpu.fp16Tflops || 989) * 1e12;
    if (precision.id === "fp8") {
      prefillPeakDenseFlops = (targetPrefillGpu.fp8Tflops || (targetPrefillGpu.fp16Tflops ? targetPrefillGpu.fp16Tflops * 2 : 1979)) * 1e12;
    }
    const gpuTflops = prefillPeakDenseFlops / 1e12;

    // Dynamic MFU by prompt length (C4)
    // M4: Prefill uncached tokens
    const remainingPromptTokens = Math.max(0, promptTokens - effectiveGlobalPrefixTokens);
    const sessionCachedTokens = Math.round(remainingPromptTokens * sessionReuseRatio);
    const totalCachedPromptTokens = effectiveGlobalPrefixTokens + sessionCachedTokens;
    const uncachedPromptTokens = Math.max(1, promptTokens - totalCachedPromptTokens);
    const mfuPrefill = uncachedPromptTokens < 512 ? 0.25 : (uncachedPromptTokens < 2048 ? 0.4 : 0.5);

    const fwdFlopsPerToken = 2 * effectiveParamsForThroughput * 1e9;
    const attnDim = (model.id === "deepseek-r1-671b" || model.isMla) ? 576 : hiddenDim;
    const attnFlopsPerToken = 2 * layers * attnDim * contextLength;
    const totalFlopsPerToken = fwdFlopsPerToken + attnFlopsPerToken;
    const totalPromptFlops = totalFlopsPerToken * uncachedPromptTokens;

    // Compute rate uses ONLY replica tensor-parallel GPUs (C4)
    const effFlops = prefillTpCount * prefillPeakDenseFlops * mfuPrefill;
    const t_compute = totalPromptFlops / effFlops; // seconds

    // All-Reduce bandwidth & latency (C4)
    const isB200 = targetPrefillGpu.id?.includes("b200") || targetPrefillGpu.name?.includes("B200");
    const isNonNvlink = targetPrefillGpu.interconnectType === "pcie" || platform?.interconnectType === "pcie";
    const interconnectBwUni = isNonNvlink ? CONFIG.pcieBw : (isB200 ? 900e9 : CONFIG.nvlinkBwUni);

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
    const S_avg = model.avgContextLength || contextLength;

    const BW_mem = (targetDecodeGpu.memBandwidthTbps || 4.8) * 1e12; // bytes/s
    let decodePeakDenseFlops = (targetDecodeGpu.fp16Tflops || 989) * 1e12;
    if (precision.id === "fp8") {
      decodePeakDenseFlops = (targetDecodeGpu.fp8Tflops || (targetDecodeGpu.fp16Tflops ? targetDecodeGpu.fp16Tflops * 2 : 1979)) * 1e12;
    }

    const weightBytesRead = decodeWeightBytes(model, customParams, precision, config.ep || CONFIG.ep || 1, C_rep);
    const kvBytesRead = bytesPerTokenSeq * S_avg * C_rep;

    const t_mem  = (weightBytesRead + kvBytesRead) / (decodeTpCount * BW_mem * CONFIG.bwEfficiency);
    const pActiveParams = (isMoe && model.activeParams ? model.activeParams : totalParams) * 1e9;
    const t_comp = (2 * pActiveParams * C_rep) / (decodeTpCount * decodePeakDenseFlops * CONFIG.mfuDecode);
    const t_comm = decodeTpCount > 1 ? 2 * layers * CONFIG.allreduceLatency : 0;
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
          ? `Heterogeneous Prefill: Processed on ${prefillNodes}x ${prefillPlatform.shortName} (${prefillGpus}x ${prefillGpu.name} @ ${gpuTflops.toLocaleString()} TFLOPs) + ~${llmdData?.kvTransfer?.kvTransferLatencyMs}ms Cisco RoCEv2 transfer`
          : `Disaggregated Prefill: Processed on ${prefillNodes} Prefill node(s) (${prefillGpus}x ${prefillGpu.name}) + ~${llmdData?.kvTransfer?.kvTransferLatencyMs}ms RoCEv2 transfer`)
      : (totalCachedPromptTokens > 0
          ? `Prefill: ${promptTokens.toLocaleString()} prompt tokens with ${totalCachedPromptTokens.toLocaleString()} tokens cached (${((totalCachedPromptTokens / promptTokens) * 100).toFixed(0)}% cached) computing ${uncachedPromptTokens.toLocaleString()} uncached tokens @ ${gpuTflops.toLocaleString()} TFLOPs`
          : `Calculated on ${promptTokens.toLocaleString()} prompt tokens using ${gpuTflops.toLocaleString()} TFLOPs (${precision.name}) at ${(mfuPrefill * 100).toFixed(0)}% MFU`);

    throughput = {
      // Decode metrics (C2)
      t_mem,
      t_comp,
      t_comm,
      t_step,
      tpotMs,
      replicaThroughput:      Math.round(replicaThroughput),
      clusterThroughput:      Math.round(clusterThroughput),
      tokensPerSecPerReplica: Math.round(replicaThroughput),
      tokensPerSecPerGpu:     Math.round(replicaThroughput / decodeTpCount),
      batchThroughputTps:     Math.round(clusterThroughput),
      C_rep,
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
      leafSwitches,
      spineSwitches,
      fabricCables,
      downlinkCables,
      uplinkCables,
      transceivers,
      topology: spineSwitches === 0 ? "Single-Tier Fabric (Intra-Chassis / Single Leaf)" : "2-Tier Leaf-Spine Non-Blocking Clos (Rail-Optimized)"
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
      kvOffloadCapacityTb = ((memory.kvCacheTotalGb || 0) * 2) / 1000;
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

  const ruForCapacity = Math.max(1, Math.ceil(requiredCapacityTb / storageTier.capacityPerRuTb));
  const ruForThroughput = Math.max(1, Math.ceil(requiredThroughputGBs / storageTier.throughputPerRuGBs));
  const provisionedRu = Math.max(ruForCapacity, ruForThroughput);
  const bindingConstraint = ruForThroughput > ruForCapacity ? 'throughput' : 'capacity';

  const achievedCapacityTb = provisionedRu * storageTier.capacityPerRuTb;
  const achievedThroughputGBs = provisionedRu * storageTier.throughputPerRuGBs;
  const fits = achievedCapacityTb >= requiredCapacityTb && achievedThroughputGBs >= requiredThroughputGBs;

  return {
    workloadType,
    storageTier,
    requiredCapacityTb,
    requiredThroughputGBs,
    provisionedRu,
    achievedCapacityTb,
    achievedThroughputGBs,
    bindingConstraint,
    fits,
    breakdown,
  };
}
