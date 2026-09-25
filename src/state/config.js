// Every user-editable calculator input lives in one flat config object. App.jsx holds it in
// a single piece of state; computeScenario() (src/utils/scenario.js) turns it into results.
// Keeping it one plain object is what lets presets, scenario comparison and tests all feed
// the same pipeline.
import { DEFAULT_GPU_PRICING, GPU_PRICING, DEFAULT_NETWORK_HARDWARE_ADDER_PCT, DEFAULT_SUPPORT_PCT_PER_YEAR, DEFAULT_POWER_USD_PER_KWH, DEFAULT_COLO_USD_PER_KW_PER_MONTH, DEFAULT_TCO_YEARS } from '../data/pricing.js';
import { DEFAULT_EMBEDDING_MODEL_ID, DEFAULT_VECTOR_DB_ID } from '../data/rag.js';
import { DEFAULT_GUARDRAIL_MODEL_ID } from '../data/guardrails.js';
import { DEFAULT_INGRESS_TIER_ID, DEFAULT_EGRESS_USD_PER_GB } from '../data/ingress.js';
import { DEFAULT_HA_DR_TIER_ID } from '../data/hadr.js';
import { DEFAULT_MLOPS_STRATEGY_ID, DEFAULT_CANARY_TRAFFIC_PCT } from '../data/mlops.js';

export const DEFAULT_CONFIG = {
  workloadType: 'inference', // 'inference' | 'training'
  selectedModelId: 'llama3-70b',
  customParams: 70,
  customNumHeads: 32,
  customKvHeads: 8,
  customLayers: 48,
  selectedPrecisionId: 'fp8',
  kvPrecision: 'fp16', // 'fp16' | 'fp8' | 'int4'
  prefixCacheRatio: 0, // 0 to 0.8
  promptTokenRatio: 0.8, // 0.8 = 80% prompt / 20% gen
  contextLength: 16384,
  concurrency: 8,
  microBatchSize: 2, // training micro-batch
  pue: 1.35,
  trainingType: 'pretrain_sft', // 'pretrain_sft' | 'lora'
  zeroStage: 3, // 0, 1, 2, 3
  selectedVendor: 'cisco', // 'cisco' | 'nvidia'
  selectedPlatformId: 'cisco-c885a-h200',
  isAutoSharding: true,
  manualTp: 8,
  manualPp: 1,
  manualDp: 1,
  isAutoDp: true,
  memoryHeadroomPct: 5, // extra % of usable GPU memory kept free when sizing
  latencyTargetsEnabled: false, // size for latency targets, not just memory
  targetTtftSec: 2, // time-to-first-token target (unloaded: prefill + guardrail/ingress latency)
  targetTpotMs: 50, // time-per-output-token target
  selectedProtocolId: 'rocev2',
  oversubscriptionRatio: 1,
  servingEngine: 'vllm', // 'vllm' | 'trt-llm' | 'tgi'
  orchestrator: 'kserve', // 'kserve' | 'ray' | 'docker'
  servingArchitecture: 'colocated', // 'colocated' | 'llmd'
  enableChunkedPrefill: true,
  enablePrefixCaching: true,
  enableSpeculativeDecoding: false,
  llmdDisaggregationMode: 'heterogeneous', // 'heterogeneous' | 'homogeneous'
  secondaryPlatformId: 'cisco-c885a-h200',
  prefillNodes: 1,
  decodeNodes: 2,
  selectedStorageTierId: 'vast-universal',
  checkpointRetentionCount: 3,
  checkpointTargetWriteTimeSec: 60,
  datasetSizeTb: 50,
  modelRepoVersionCount: 2,
  modelRepoTargetLoadTimeSec: 120,
  corpusSizeGb: 0,
  enableKvOffload: false,
  selectedDurabilitySchemeId: 'erasure-coded-8-3',
  gpuUnitPriceUsd: DEFAULT_GPU_PRICING.estimatedUnitPriceUsd,
  cloudRateUsdPerHr: DEFAULT_GPU_PRICING.estimatedCloudRateUsdPerHr,
  networkHardwareAdderPct: DEFAULT_NETWORK_HARDWARE_ADDER_PCT,
  powerUsdPerKwh: DEFAULT_POWER_USD_PER_KWH,
  useColo: false,
  coloUsdPerKwPerMonth: DEFAULT_COLO_USD_PER_KW_PER_MONTH,
  enableNvidiaAiEnterprise: false,
  supportPctPerYear: DEFAULT_SUPPORT_PCT_PER_YEAR,
  tcoYears: DEFAULT_TCO_YEARS,
  enableMig: false,
  selectedMigProfileId: null, // null = auto-select smallest fitting profile
  targetUtilization: 0.7, // rho: target replica utilization (0-1)
  enableRag: false,
  textExtractionRatio: 0.2, // corpusSizeGb is raw doc storage; fraction that survives text extraction
  avgChunkTokens: 512,
  selectedEmbeddingModelId: DEFAULT_EMBEDDING_MODEL_ID,
  embeddingGpuId: 'l40s-pcie',
  embeddingGpuUnitPriceUsd: GPU_PRICING['l40s-pcie'].estimatedUnitPriceUsd,
  ingestionTargetHours: 24,
  ragQueryQps: 5,
  selectedVectorDbId: DEFAULT_VECTOR_DB_ID,
  enableGuardrails: false,
  selectedGuardModelId: DEFAULT_GUARDRAIL_MODEL_ID,
  guardGpuId: 'l40s-pcie',
  guardGpuUnitPriceUsd: GPU_PRICING['l40s-pcie'].estimatedUnitPriceUsd,
  enableInputGuard: true,
  enableOutputGuard: true,
  enableIngress: false,
  selectedIngressTierId: DEFAULT_INGRESS_TIER_ID,
  egressUsdPerGb: DEFAULT_EGRESS_USD_PER_GB,
  enableHaDr: false,
  selectedHaDrTierId: DEFAULT_HA_DR_TIER_ID,
  enableTrainingRedundancy: false,
  spareNodePct: 2,
  enableMlops: false,
  selectedMlopsStrategyId: DEFAULT_MLOPS_STRATEGY_ID,
  canaryTrafficPct: DEFAULT_CANARY_TRAFFIC_PCT,
};

// Fields a preset may omit (added after the original presets were written) fall back to
// these rather than keeping whatever the previous configuration had.
const PRESET_FALLBACKS = {
  oversubscriptionRatio: 1,
  memoryHeadroomPct: 5,
  latencyTargetsEnabled: false,
  targetTtftSec: 2,
  targetTpotMs: 50,
  enableTrainingRedundancy: false,
  spareNodePct: 2,
  enableMlops: false,
  selectedMlopsStrategyId: DEFAULT_MLOPS_STRATEGY_ID,
  canaryTrafficPct: DEFAULT_CANARY_TRAFFIC_PCT,
};

/** Returns the config that results from applying a preset on top of the current config. */
export function applyPresetConfig(current, presetConfig) {
  const next = { ...current };
  for (const [k, fallback] of Object.entries(PRESET_FALLBACKS)) next[k] = presetConfig[k] ?? fallback;
  for (const [k, v] of Object.entries(presetConfig)) {
    if (k in DEFAULT_CONFIG && v !== undefined && !(k in PRESET_FALLBACKS)) next[k] = v;
  }
  return next;
}
