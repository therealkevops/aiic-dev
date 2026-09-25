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
  sizingInputMode: 'concurrency', // 'concurrency' (streams held at once) | 'traffic' (peak request rate)
  trafficInputType: 'users', // traffic mode: 'users' (active users x requests/hour) | 'rps'
  peakActiveUsers: 500, // traffic mode: users active in the peak hour
  requestsPerUserPerHour: 20, // traffic mode: requests each active user sends per hour
  peakRequestsPerSec: 5, // traffic mode: peak request rate when entered directly
  reasoningTokensPerOutputToken: 0, // hidden thinking tokens per visible output token (reasoning models)
  requestMixEnabled: false, // size KV for a mix of short and full-length requests
  shortRequestPct: 70, // share of requests that are short
  shortRequestTokens: 2048, // length of a short request (prompt + visible output)
  kvActiveSessionPct: 100, // with KV offload on: share of sessions actively generating (rest offloaded)
  microBatchSize: 2, // training micro-batch
  pue: 1.35,
  coolingType: 'air', // 'air' | 'liquid'
  rackPowerKw: 28, // power each rack can deliver and cool
  facilityPowerBudgetKw: 0, // facility power available (0 = no limit)
  gridCarbonKgPerKwh: 0.37, // grid carbon intensity (US average ~0.37 kg CO2/kWh, EPA eGRID 2022)
  trainingType: 'pretrain_sft', // 'pretrain_sft' | 'lora'
  zeroStage: 3,
  trainingTokensB: 10, // training tokens (billions): dataset tokens x epochs
  trainingMfuPct: 40, // Model FLOPs Utilization the run sustains
  gpuMtbfHours: 50000, // mean GPU-hours between job-interrupting failures (per GPU)
  checkpointIntervalMin: 0, // 0 = optimal (Young/Daly) interval
  restartMin: 20, // detect + replace + reload time after a failure
  nodeRepairHours: 48, // time a failed node is out of service // 0, 1, 2, 3
  selectedVendor: 'cisco', // 'cisco' | 'nvidia'
  selectedPlatformId: 'cisco-c885a-h200',
  isAutoSharding: true,
  manualTp: 8,
  manualPp: 1,
  manualDp: 1,
  isAutoDp: true,
  memoryHeadroomPct: 5, // extra % of usable GPU memory kept free when sizing
  expertParallelNodes: 1, // MoE: chassis each replica's experts are spread across (wide EP)
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
  specMethod: 'draft-model', // 'draft-model' (separate small model) | 'draft-head' (EAGLE / MTP head)
  specDraftParamsB: 1, // draft model size in billions of parameters
  specNumTokens: 4, // draft tokens proposed per verification step
  specAcceptanceRate: 0.6, // chance each draft token is accepted
  llmdDisaggregationMode: 'heterogeneous', // 'heterogeneous' | 'homogeneous'
  secondaryPlatformId: 'cisco-c885a-h200',
  llmdAutoSize: true, // size LLM-D prefill/decode pools from the workload (false = manual node counts)
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
  cloudReservedDiscountPct: 35, // reserved / committed-use discount off the on-demand cloud rate
  enableGrowthPlan: false, // plan capacity year by year as demand grows
  demandGrowthPctPerYear: 50, // yearly growth in traffic or concurrent streams
  gpuPriceChangePctPerYear: 0, // yearly change in GPU price (negative = cheaper later)
  refreshYear: 0, // year the hardware is replaced (0 = no refresh within the horizon)
  dutyCyclePct: 50, // share of hours the cluster runs at its sized load (monthly average)
  apiInputUsdPer1M: 0.6, // comparison API price per 1M input tokens (illustrative, editable)
  apiOutputUsdPer1M: 0.8, // comparison API price per 1M output tokens (illustrative, editable)
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
  expertParallelNodes: 1,
  trainingTokensB: 10,
  trainingMfuPct: 40,
  gpuMtbfHours: 50000,
  checkpointIntervalMin: 0,
  restartMin: 20,
  nodeRepairHours: 48,
  sizingInputMode: 'concurrency',
  coolingType: 'air',
  rackPowerKw: 28,
  facilityPowerBudgetKw: 0,
  enableGrowthPlan: false,
  llmdAutoSize: true,
  specMethod: 'draft-model',
  specDraftParamsB: 1,
  specNumTokens: 4,
  specAcceptanceRate: 0.6,
  reasoningTokensPerOutputToken: 0,
  requestMixEnabled: false,
  shortRequestPct: 70,
  shortRequestTokens: 2048,
  kvActiveSessionPct: 100,
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
