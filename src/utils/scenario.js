// computeScenario(config) is the whole calculator pipeline as one pure function: it resolves
// catalog lookups, runs the auto-sharding solver, sizes compute/network/facility, then layers
// on storage, MIG, RAG, guardrails, ingress, SLA, HA/DR, training redundancy, MLOps and cost.
// App.jsx memoizes a single call per config; scenario comparison, reports and tests call it
// directly, so every consumer sees exactly the numbers the UI shows.
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../data/models.js';
import { GPU_CATALOG, NETWORK_PROTOCOLS } from '../data/hardware.js';
import { PLATFORM_SYSTEMS, PLATFORM_VENDORS } from '../data/platforms.js';
import { STORAGE_TIERS, DURABILITY_SCHEMES } from '../data/storage.js';
import { GPU_PRICING, NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR } from '../data/pricing.js';
import { EMBEDDING_MODELS, VECTOR_DB_PLATFORMS } from '../data/rag.js';
import { GUARDRAIL_MODELS } from '../data/guardrails.js';
import { INGRESS_TIERS } from '../data/ingress.js';
import { HA_DR_TIERS } from '../data/hadr.js';
import { MLOPS_STRATEGIES } from '../data/mlops.js';
import {
  calculateInfra, calculateStorage, calculateCost, calculateMigConsolidation, applyMigThroughputScaling,
  calculateSla, calculateRag, calculateGuardrails, calculateIngress, calculateHaDr,
  calculateTrainingRedundancy, calculateMlops, recommendSharding,
} from './calculator.js';

/** Resolves the model object, applying custom-model overrides. */
export function resolveModel(config) {
  const base = MODEL_PRESETS.find(m => m.id === config.selectedModelId) || MODEL_PRESETS[1];
  if (config.selectedModelId !== 'custom') return base;
  return {
    ...base,
    params: Number(config.customParams) || 32,
    numHeads: Number(config.customNumHeads) || 32,
    kvHeads: Number(config.customKvHeads) || 8,
    layers: Number(config.customLayers) || 48,
  };
}

/**
 * Runs the full pipeline for one configuration. `_solverTp` / `_solverDp` are internal fields
 * the latency solver sets to evaluate a specific TP / DP candidate.
 */
function computeScenarioCore(config) {
  const c = config;

  // ── Catalog lookups ──────────────────────────────────────────────────────────
  const availablePlatforms = PLATFORM_SYSTEMS.filter(p => p.vendor === c.selectedVendor);
  const platform = PLATFORM_SYSTEMS.find(p => p.id === c.selectedPlatformId) || availablePlatforms[0];
  const gpu = GPU_CATALOG.find(g => g.id === platform.gpuId) || GPU_CATALOG[0];
  // Each vendor lists the scale-out fabrics it supports (Cisco and AMD: RoCEv2; NVIDIA: + InfiniBand)
  const vendor = PLATFORM_VENDORS.find(v => v.id === c.selectedVendor) || PLATFORM_VENDORS[0];
  const availableProtocols = NETWORK_PROTOCOLS.filter(p => vendor.supportedProtocols.includes(p.id));
  const secondaryPlatform = availablePlatforms.find(p => p.id === c.secondaryPlatformId) || availablePlatforms[0];
  const secondaryGpu = GPU_CATALOG.find(g => g.id === secondaryPlatform.gpuId) || GPU_CATALOG[0];
  const model = resolveModel(c);
  const maxContextLength = model.maxContextLength || 131072;
  // App.jsx also clamps the stored value; clamping here keeps the pure pipeline self-consistent.
  const contextLength = Math.min(c.contextLength, maxContextLength);
  const precision = PRECISION_OPTIONS.find(p => p.id === c.selectedPrecisionId) || PRECISION_OPTIONS[1];
  const protocol = NETWORK_PROTOCOLS.find(p => p.id === c.selectedProtocolId) || NETWORK_PROTOCOLS[0];
  const effectiveConcurrency = c.workloadType === 'inference' ? c.concurrency : c.microBatchSize;

  // ── 1. Auto-sharding solver ──────────────────────────────────────────────────
  const autoRecommendation = recommendSharding({
    workloadType: c.workloadType,
    model,
    customParams: c.customParams,
    precision,
    kvPrecision: c.kvPrecision,
    prefixCacheRatio: c.prefixCacheRatio,
    promptTokenRatio: c.promptTokenRatio,
    contextLength,
    concurrency: effectiveConcurrency,
    gpu,
    platform,
    trainingType: c.trainingType,
    zeroStage: c.zeroStage,
    memoryHeadroomPct: c.memoryHeadroomPct,
    minTp: c._solverTp || 1,
    expertParallelNodes: c.expertParallelNodes,
  });
  const tp = c.isAutoSharding ? autoRecommendation.tp : c.manualTp;
  const pp = c.isAutoSharding ? autoRecommendation.pp : c.manualPp;
  // DP is only auto-derived for inference, and only while TP/PP are also auto-solved (the
  // auto-DP formula is computed against the solver's own TP/PP, not a manual override).
  const canAutoDp = c.workloadType === 'inference' && c.isAutoSharding;
  const dp = (canAutoDp && c.isAutoDp) ? Math.max(autoRecommendation.dp, c._solverDp || 0) : c.manualDp;

  // ── 2. Compute, network & facility sizing ────────────────────────────────────
  const results = calculateInfra({
    workloadType: c.workloadType,
    model,
    customParams: c.customParams,
    precision,
    kvPrecision: c.kvPrecision,
    prefixCacheRatio: c.prefixCacheRatio,
    promptTokenRatio: c.promptTokenRatio,
    contextLength,
    concurrency: effectiveConcurrency,
    gpu,
    platform,
    tp,
    pp,
    dp,
    trainingType: c.trainingType,
    zeroStage: c.zeroStage,
    networkProtocol: c.selectedProtocolId,
    oversubscriptionRatio: c.oversubscriptionRatio,
    pue: c.pue,
    memoryHeadroomPct: c.memoryHeadroomPct,
    expertParallelNodes: c.expertParallelNodes,
    servingConfig: {
      servingEngine: c.servingEngine,
      orchestrator: c.orchestrator,
      servingArchitecture: c.servingArchitecture,
      enableChunkedPrefill: c.enableChunkedPrefill,
      enablePrefixCaching: c.enablePrefixCaching,
      enableSpeculativeDecoding: c.enableSpeculativeDecoding,
      llmdDisaggregationMode: c.llmdDisaggregationMode,
      secondaryPlatform,
      secondaryGpu,
      prefillNodes: c.prefillNodes,
      decodeNodes: c.decodeNodes,
    },
  });
  const { memory, facility, network, bom } = results;
  const isLlmd = !!memory.llmd;

  // ── 3. Storage (capacity + throughput) ───────────────────────────────────────
  const storageTier = STORAGE_TIERS.find(t => t.id === c.selectedStorageTierId) || STORAGE_TIERS[0];
  const durabilityScheme = DURABILITY_SCHEMES.find(d => d.id === c.selectedDurabilitySchemeId) || DURABILITY_SCHEMES[0];
  const storage = calculateStorage({
    workloadType: c.workloadType,
    infraResults: results,
    storageTier,
    checkpointRetentionCount: c.checkpointRetentionCount,
    checkpointTargetWriteTimeSec: c.checkpointTargetWriteTimeSec,
    datasetSizeTb: c.datasetSizeTb,
    modelRepoVersionCount: c.modelRepoVersionCount,
    modelRepoTargetLoadTimeSec: c.modelRepoTargetLoadTimeSec,
    corpusSizeGb: c.corpusSizeGb,
    enableKvOffload: c.enableKvOffload,
    durabilityScheme,
  });

  // ── 4. MIG partitioning overlay ──────────────────────────────────────────────
  // Only meaningful for TP=1, PP=1 colocated inference on MIG-capable hardware; feeds an
  // optional GPU-count/power override into Cost rather than changing the main sizing.
  const mig = calculateMigConsolidation({
    infraResults: results,
    gpu,
    gpusPerChassis: platform.gpusPerChassis,
    chassisTdpKw: platform.chassisTdpKw,
    enabled: c.enableMig,
    migProfileId: c.selectedMigProfileId,
  });
  // calculateInfra() sizes throughput for a whole GPU; apply MIG's throughput penalty to what
  // is displayed and consumed downstream (SLA, guardrails, ingress). A no-op without MIG.
  const effectiveResults = applyMigThroughputScaling(results, mig);
  const throughput = effectiveResults.throughput;

  // ── 5. RAG pipeline (standing infrastructure; feeds Cost) ────────────────────
  const embeddingModel = EMBEDDING_MODELS.find(m => m.id === c.selectedEmbeddingModelId) || EMBEDDING_MODELS[0];
  const embeddingGpu = GPU_CATALOG.find(g => g.id === c.embeddingGpuId) || GPU_CATALOG[0];
  const vectorDbPlatform = VECTOR_DB_PLATFORMS.find(v => v.id === c.selectedVectorDbId) || VECTOR_DB_PLATFORMS[0];
  const rag = calculateRag({
    enabled: c.enableRag,
    corpusSizeGb: c.corpusSizeGb,
    textExtractionRatio: c.textExtractionRatio,
    avgChunkTokens: c.avgChunkTokens,
    embeddingModel,
    embeddingGpu,
    embeddingGpuUnitPriceUsd: c.embeddingGpuUnitPriceUsd,
    ingestionTargetHours: c.ingestionTargetHours,
    queryQps: c.ragQueryQps,
    vectorDbPlatform,
  });

  // ── 6. Guardrails (input/output safety classifier pool) ──────────────────────
  const guardModel = GUARDRAIL_MODELS.find(m => m.id === c.selectedGuardModelId) || GUARDRAIL_MODELS[0];
  const guardGpu = GPU_CATALOG.find(g => g.id === c.guardGpuId) || GPU_CATALOG[0];
  const guardrails = calculateGuardrails({
    enabled: c.enableGuardrails,
    infraResults: effectiveResults,
    guardModel,
    guardGpu,
    guardGpuUnitPriceUsd: c.guardGpuUnitPriceUsd,
    enableInputGuard: c.enableInputGuard,
    enableOutputGuard: c.enableOutputGuard,
  });

  // ── 7. Ingress / edge ────────────────────────────────────────────────────────
  const ingressTier = INGRESS_TIERS.find(t => t.id === c.selectedIngressTierId) || INGRESS_TIERS[0];
  const ingress = calculateIngress({
    enabled: c.enableIngress,
    infraResults: effectiveResults,
    ingressTier,
    egressUsdPerGb: c.egressUsdPerGb,
  });

  // ── 8. SLA / tail latency (M/M/c) ────────────────────────────────────────────
  // Ingress and the input guard run before the replica queue, the output guard after decode;
  // all are fixed per-request latency, folded in as flat additions.
  const sla = calculateSla({
    infraResults: effectiveResults,
    targetUtilization: c.targetUtilization,
    extraPreQueueLatencySec: (ingress.eligible ? ingress.addedLatencyMs / 1000 : 0)
      + (guardrails.eligible ? guardrails.addedTtftSec : 0),
    extraPostGenerationLatencySec: guardrails.eligible ? guardrails.outputGuardLatencySec : 0,
  });

  // ── 9. HA/DR, training redundancy, MLOps ─────────────────────────────────────
  const haDrTier = HA_DR_TIERS.find(t => t.id === c.selectedHaDrTierId) || HA_DR_TIERS[0];
  const migConsolidates = mig.eligible && mig.physicalGpusNeeded < mig.naiveGpuCount;
  const migComputeGpuCountOverride = migConsolidates ? mig.physicalGpusNeeded : null;
  const migItPowerKwOverride = migConsolidates ? mig.itPowerKw : null;
  const decodeGpuId = memory.llmd?.decode?.gpu?.id;
  const decodeGpuPricing = decodeGpuId ? GPU_PRICING[decodeGpuId] : null;
  const haDr = calculateHaDr({
    enabled: c.enableHaDr,
    infraResults: results,
    storageResults: storage,
    haDrTier,
    gpuUnitPriceUsd: c.gpuUnitPriceUsd,
    // LLM-D heterogeneous deployments price prefill/decode pools separately.
    decodeGpuUnitPriceUsd: decodeGpuPricing?.estimatedUnitPriceUsd ?? null,
    storageUsdPerTbRaw: storageTier.estimatedUsdPerTbRaw,
    computeGpuCountOverride: migComputeGpuCountOverride,
    itPowerKwOverride: migItPowerKwOverride,
  });
  const trainingRedundancy = calculateTrainingRedundancy({
    enabled: c.enableTrainingRedundancy,
    infraResults: results,
    spareNodePct: c.spareNodePct,
    gpuUnitPriceUsd: c.gpuUnitPriceUsd,
  });
  const mlopsStrategy = MLOPS_STRATEGIES.find(s => s.id === c.selectedMlopsStrategyId) || MLOPS_STRATEGIES[0];
  const mlops = calculateMlops({
    enabled: c.enableMlops,
    infraResults: results,
    mlopsStrategy,
    canaryTrafficPct: c.canaryTrafficPct,
    gpuUnitPriceUsd: c.gpuUnitPriceUsd,
    decodeGpuUnitPriceUsd: decodeGpuPricing?.estimatedUnitPriceUsd ?? null,
    computeGpuCountOverride: migComputeGpuCountOverride,
    itPowerKwOverride: migItPowerKwOverride,
  });

  // ── 10. Cost & TCO ───────────────────────────────────────────────────────────
  const cost = calculateCost({
    infraResults: results,
    storageResults: storage,
    gpuUnitPriceUsd: c.gpuUnitPriceUsd,
    cloudRateUsdPerHr: c.cloudRateUsdPerHr,
    decodeGpuUnitPriceUsd: decodeGpuPricing?.estimatedUnitPriceUsd ?? null,
    decodeCloudRateUsdPerHr: decodeGpuPricing?.estimatedCloudRateUsdPerHr ?? null,
    networkHardwareAdderPct: c.networkHardwareAdderPct,
    storageUsdPerTbRaw: storageTier.estimatedUsdPerTbRaw,
    powerUsdPerKwh: c.powerUsdPerKwh,
    useColo: c.useColo,
    coloUsdPerKwPerMonth: c.coloUsdPerKwPerMonth,
    enableNvidiaAiEnterprise: c.enableNvidiaAiEnterprise,
    licensingUsdPerGpuPerYear: NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR,
    supportPctPerYear: c.supportPctPerYear,
    tcoYears: c.tcoYears,
    // Only override when MIG actually reduces the physical GPU count.
    computeGpuCountOverride: migComputeGpuCountOverride,
    itPowerKwOverride: migItPowerKwOverride,
    ragComputeCapexUsd: rag.eligible ? rag.ragComputeCapexUsd : 0,
    ragItPowerKw: rag.eligible ? rag.ragItPowerKw : 0,
    guardrailsComputeCapexUsd: guardrails.eligible ? guardrails.guardrailsComputeCapexUsd : 0,
    guardrailsItPowerKw: guardrails.eligible ? guardrails.guardrailsItPowerKw : 0,
    ingressComputeCapexUsd: ingress.eligible ? ingress.ingressComputeCapexUsd : 0,
    ingressItPowerKw: ingress.eligible ? ingress.ingressItPowerKw : 0,
    ingressAnnualOpexUsd: ingress.eligible ? ingress.ingressAnnualOpexUsd : 0,
    haDrComputeCapexUsd: haDr.eligible ? haDr.haDrComputeCapexUsd : 0,
    haDrItPowerKw: haDr.eligible ? haDr.haDrItPowerKw : 0,
    mlopsComputeCapexUsd: mlops.eligible ? mlops.mlopsComputeCapexUsd : 0,
    mlopsItPowerKw: mlops.eligible ? mlops.mlopsItPowerKw : 0,
    trainingRedundancyComputeCapexUsd: trainingRedundancy.eligible ? trainingRedundancy.spareComputeCapexUsd : 0,
    trainingRedundancyItPowerKw: trainingRedundancy.eligible ? trainingRedundancy.spareItPowerKw : 0,
  });

  // ── 11. Advisories beyond the engine's own warnings ─────────────────────────
  const advisories = [];
  if (model.license?.commercial === 'non-commercial') {
    advisories.push(`License: ${model.name} is released under the ${model.license.name}. ${model.license.note || 'Commercial use is not permitted without a separate license.'}`);
  }
  if (rag.eligible && embeddingModel.license?.commercial === 'non-commercial') {
    advisories.push(`License: the ${embeddingModel.name} embedding model is ${embeddingModel.license.name}. ${embeddingModel.license.note || ''}`.trim());
  }
  if (c.enableNvidiaAiEnterprise && gpu.vendor !== 'NVIDIA') {
    advisories.push('NVIDIA AI Enterprise is licensed for NVIDIA GPUs only; its per-GPU cost is still included in Cost & TCO. Turn it off for an AMD Instinct deployment.');
  }
  const warnings = [...(results.warnings || []), ...advisories];

  return {
    warnings,
    vendor, availablePlatforms, platform, gpu, availableProtocols, secondaryPlatform, secondaryGpu,
    model, maxContextLength, precision, protocol, effectiveConcurrency,
    autoRecommendation, tp, pp, dp, canAutoDp,
    results, memory, facility, network, bom, isLlmd,
    storageTier, durabilityScheme, storage,
    mig, effectiveResults, throughput,
    embeddingModel, embeddingGpu, vectorDbPlatform, rag,
    guardModel, guardGpu, guardrails,
    ingressTier, ingress,
    sla,
    haDrTier, migComputeGpuCountOverride, migItPowerKwOverride, decodeGpuId, decodeGpuPricing, haDr,
    trainingRedundancy, mlopsStrategy, mlops,
    cost,
  };
}

// ── Latency-target solver ─────────────────────────────────────────────────────
// The memory solver above picks the fewest GPUs that hold the model and its KV cache. When
// latency targets are on, this searches larger TP (faster per-token work inside a replica) and
// more DP (fewer streams per replica, so smaller decode batches and less queueing) for the
// cheapest layout that meets both targets.

// TTFT is measured unloaded (prefill + guardrail/ingress latency, before queueing): queueing at
// a fixed target utilization is set on the SLA tab and isn't something extra GPUs remove here.
function latencyOf(s) {
  return {
    ttftSec: s.sla.eligible ? s.sla.ttftBaselineSec : (s.throughput?.ttftSec ?? Infinity),
    tpotMs: Number(s.throughput?.tpotMs ?? Infinity),
  };
}

function summarize(s) {
  return { tp: s.tp, pp: s.pp, dp: s.dp, totalGpus: s.results.totalGpus, ...latencyOf(s) };
}

export function solveForLatency(config, memorySized) {
  const targetTtft = Math.max(0.01, Number(config.targetTtftSec) || 0);
  const targetTpot = Math.max(1, Number(config.targetTpotMs) || 0);
  const meets = (s) => {
    const l = latencyOf(s);
    return !s.memory.isOOM && l.ttftSec <= targetTtft && l.tpotMs <= targetTpot;
  };
  // How far a layout misses its targets (0 = meets both); used to pick the closest if none do.
  const shortfall = (s) => {
    const l = latencyOf(s);
    return Math.max(0, l.ttftSec / targetTtft - 1) + Math.max(0, l.tpotMs / targetTpot - 1) + (s.memory.isOOM ? 10 : 0);
  };

  let evaluated = 0;
  let best = null;
  let closest = memorySized;
  const tpCandidates = tpCandidatesFor(memorySized, memorySized.tp);
  const dpSearchable = config.isAutoDp;

  for (const tpCandidate of tpCandidates) {
    const atTp = computeScenarioCore({ ...config, _solverTp: tpCandidate });
    evaluated++;
    if (atTp.pp > 1 && tpCandidate !== memorySized.tp) continue;
    const dpStart = atTp.dp;
    const dpLimit = dpSearchable ? Math.max(dpStart * 8, dpStart + 32) : dpStart;
    for (let dp = dpStart; dp <= dpLimit; dp += Math.max(1, Math.ceil(dp * 0.1))) {
      const s = dp === dpStart ? atTp : computeScenarioCore({ ...config, _solverTp: tpCandidate, _solverDp: dp });
      if (dp !== dpStart) evaluated++;
      if (shortfall(s) < shortfall(closest)) closest = s;
      if (meets(s)) {
        if (!best || s.results.totalGpus < best.results.totalGpus
          || (s.results.totalGpus === best.results.totalGpus && latencyOf(s).tpotMs < latencyOf(best).tpotMs)) {
          best = s;
        }
        break; // more DP at this TP only adds GPUs
      }
      // Stop once this TP already needs more GPUs than the best layout found so far.
      if (best && s.results.totalGpus >= best.results.totalGpus) break;
    }
  }

  const chosen = best || closest;
  // Fixed latency (guardrails, ingress) that no amount of GPU capacity removes.
  const fixedLatencySec = (chosen.ingress.eligible ? chosen.ingress.addedLatencyMs / 1000 : 0)
    + (chosen.guardrails.eligible ? chosen.guardrails.addedTtftSec : 0);
  return {
    ...chosen,
    latencySolve: {
      met: !!best,
      targetTtftSec: targetTtft,
      targetTpotMs: targetTpot,
      memoryOnly: summarize(memorySized),
      chosen: summarize(chosen),
      fixedLatencySec,
      evaluated,
    },
  };
}

/** TP values worth trying for a replica on this platform, from `fromTp` up to the chassis size. */
function tpCandidatesFor(scenario, fromTp) {
  const gpusPerChassis = scenario.platform.gpusPerChassis || 8;
  return [1, 2, 4, 8, 16].filter(t => t >= fromTp && t <= gpusPerChassis);
}

/**
 * Memory sizing: the smallest TP that fits is not always the fewest GPUs. Each TP=1 replica
 * holds a full copy of the weights, while a TP=4 replica shares one copy across four GPUs and
 * gives the rest to KV cache -- so for KV-heavy workloads a larger TP can need fewer GPUs in
 * total. Try each in-chassis TP and keep the layout with the fewest GPUs (ties: smaller TP).
 */
function computeMemorySized(config) {
  const minimal = computeScenarioCore(config);
  const applies = config.workloadType === 'inference' && config.isAutoSharding && config.isAutoDp
    && config.servingArchitecture !== 'llmd' && minimal.pp === 1 && !minimal.autoRecommendation.error
    // Without NVLink every TP all-reduce crosses PCIe; don't trade that for a few GPUs.
    && minimal.gpu.interconnectType !== 'pcie';
  if (!applies) return minimal;
  let best = minimal;
  for (const tp of tpCandidatesFor(minimal, minimal.tp + 1)) {
    const s = computeScenarioCore({ ...config, _solverTp: tp });
    if (s.pp === 1 && !s.memory.isOOM && s.results.totalGpus < best.results.totalGpus) best = s;
  }
  if (best === minimal) return minimal;
  return {
    ...best,
    memorySizing: { minimalTp: minimal.tp, minimalDp: minimal.dp, minimalGpus: minimal.results.totalGpus },
  };
}

export function computeScenario(config) {
  const memorySized = computeMemorySized(config);
  const solverApplies = config.latencyTargetsEnabled
    && config.workloadType === 'inference'
    && config.isAutoSharding
    && config.servingArchitecture !== 'llmd'
    && !memorySized.autoRecommendation.error;
  if (!solverApplies) return { memorySizing: null, ...memorySized, latencySolve: null };
  return { memorySizing: null, ...solveForLatency(config, memorySized) };
}
