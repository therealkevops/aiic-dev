// computeScenario(config) is the whole calculator pipeline as one pure function: it resolves
// catalog lookups, runs the auto-sharding solver, sizes compute/network/facility, then layers
// on storage, MIG, RAG, guardrails, ingress, SLA, HA/DR, training redundancy, MLOps and cost.
// App.jsx memoizes a single call per config; scenario comparison, reports and tests call it
// directly, so every consumer sees exactly the numbers the UI shows.
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../data/models.js';
import { GPU_CATALOG, NETWORK_PROTOCOLS } from '../data/hardware.js';
import { PLATFORM_SYSTEMS } from '../data/platforms.js';
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

export function computeScenario(config) {
  const c = config;

  // ── Catalog lookups ──────────────────────────────────────────────────────────
  const availablePlatforms = PLATFORM_SYSTEMS.filter(p => p.vendor === c.selectedVendor);
  const platform = PLATFORM_SYSTEMS.find(p => p.id === c.selectedPlatformId) || availablePlatforms[0];
  const gpu = GPU_CATALOG.find(g => g.id === platform.gpuId) || GPU_CATALOG[0];
  // Cisco = RoCEv2 only, NVIDIA = RoCEv2 + InfiniBand
  const availableProtocols = NETWORK_PROTOCOLS.filter(p => (c.selectedVendor === 'cisco' ? p.id === 'rocev2' : true));
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
  });
  const tp = c.isAutoSharding ? autoRecommendation.tp : c.manualTp;
  const pp = c.isAutoSharding ? autoRecommendation.pp : c.manualPp;
  // DP is only auto-derived for inference, and only while TP/PP are also auto-solved (the
  // auto-DP formula is computed against the solver's own TP/PP, not a manual override).
  const canAutoDp = c.workloadType === 'inference' && c.isAutoSharding;
  const dp = (canAutoDp && c.isAutoDp) ? autoRecommendation.dp : c.manualDp;

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

  return {
    availablePlatforms, platform, gpu, availableProtocols, secondaryPlatform, secondaryGpu,
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
