// Guided setup: a handful of plain answers turn into a starting configuration. The answers pick
// a preset as the base, set demand and document length, then every platform from the chosen
// vendor is sized and the lowest-TCO one that fits the budget is recommended.
import { DEFAULT_CONFIG, applyPresetConfig, withPlatform } from '../state/config.js';
import { USE_CASE_PRESETS } from '../data/presets.js';
import { PLATFORM_SYSTEMS } from '../data/platforms.js';
import { MODEL_PRESETS } from '../data/models.js';
import { computeScenario } from './scenario.js';

export const USE_CASES = [
  { id: 'chat', label: 'Chat assistant', desc: 'General questions and answers for staff or customers', preset: 'ent-rag-assistant', overrides: { enableRag: false }, requestsPerUserPerHour: 10 },
  { id: 'rag', label: 'Answers from our documents', desc: 'Retrieval over internal documents (RAG)', preset: 'ent-rag-assistant', requestsPerUserPerHour: 10 },
  { id: 'coding', label: 'Coding assistant', desc: 'Code completion and chat in the IDE', preset: 'ent-coding-copilot', requestsPerUserPerHour: 30 },
  { id: 'agents', label: 'AI agents', desc: 'Multi-step tool use and automation', preset: 'ent-agent-tool-use', requestsPerUserPerHour: 20 },
  { id: 'finetune', label: 'Fine-tune a model', desc: 'Adapt an open model to our data (LoRA)', preset: 'ent-lora-finetune', training: true },
  { id: 'pretrain', label: 'Train a model from scratch', desc: 'Large-scale pretraining', preset: 'neo-frontier-pretrain', training: true },
];

export const DOC_LENGTHS = [
  { id: 'short', label: 'Short', desc: 'Chat messages, a page or two', tokens: 4096, ttftSec: 2 },
  { id: 'medium', label: 'Medium', desc: 'Reports, ~20 pages', tokens: 16384, ttftSec: 3 },
  { id: 'long', label: 'Long', desc: 'Contracts, codebases, ~80 pages', tokens: 65536, ttftSec: 10 },
  { id: 'very-long', label: 'Very long', desc: 'Whole books or large repositories', tokens: 131072, ttftSec: 20 },
];

export const DEFAULT_ANSWERS = {
  useCase: 'chat',
  peakUsers: 500,
  requestsPerUserPerHour: null, // null = the use case's typical rate
  docLength: 'medium',
  trainingTokensB: null, // null = the preset's
  deadlineDays: 30,
  airGapped: false,
  vendor: 'cisco',
  budgetUsd: 0, // 0 = no budget limit
};

/** Base configuration from the answers, before a platform is chosen. */
export function configFromAnswers(answers, current = DEFAULT_CONFIG) {
  const a = { ...DEFAULT_ANSWERS, ...answers };
  const useCase = USE_CASES.find(u => u.id === a.useCase) || USE_CASES[0];
  const preset = USE_CASE_PRESETS.find(p => p.id === useCase.preset);
  let c = applyPresetConfig(current, { ...preset.config, ...(useCase.overrides || {}) });
  c.selectedVendor = a.vendor;
  if (useCase.training) {
    if (a.trainingTokensB > 0) c.trainingTokensB = a.trainingTokensB;
  } else {
    c.sizingInputMode = 'traffic';
    c.trafficInputType = 'users';
    c.peakActiveUsers = Math.max(1, Math.round(a.peakUsers));
    c.requestsPerUserPerHour = a.requestsPerUserPerHour > 0 ? a.requestsPerUserPerHour : useCase.requestsPerUserPerHour;
    // Longer documents lengthen the prompt, not the answer: keep the preset's answer length.
    const answerTokens = preset.config.contextLength * (1 - preset.config.promptTokenRatio);
    const doc = DOC_LENGTHS.find(d => d.id === a.docLength) || DOC_LENGTHS[1];
    const modelMax = MODEL_PRESETS.find(m => m.id === c.selectedModelId)?.maxContextLength || doc.tokens;
    c.contextLength = Math.min(doc.tokens, modelMax);
    c.promptTokenRatio = Math.min(0.99, Math.max(0.5, Number((1 - answerTokens / c.contextLength).toFixed(3))));
    // Size for a responsive service: ~20 words/s per user, and a first token within a time
    // that grows with how much has to be read.
    c.latencyTargetsEnabled = true;
    c.targetTpotMs = 50;
    c.targetTtftSec = doc.ttftSec;
  }
  if (a.airGapped) {
    // No public edge or egress; everything is served from on-premises load balancers.
    c.selectedIngressTierId = 'software-lb';
    c.egressUsdPerGb = 0;
  }
  return c;
}

/** Smallest data-parallel width that finishes training within the deadline (or the widest tried). */
function sizeTrainingForDeadline(config, deadlineDays) {
  const days = (dp) => computeScenario({ ...config, manualDp: dp }).trainingTime?.wallClockDays ?? Infinity;
  let hi = 1;
  while (hi < 4096 && days(hi) > deadlineDays) hi *= 2;
  let lo = Math.max(1, hi / 2);
  if (days(lo) <= deadlineDays) return lo;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (days(mid) <= deadlineDays) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Sizes the answers on every platform from the chosen vendor and ranks them. Platforms that run
 * out of memory are dropped; the recommendation is the lowest-TCO design within the budget, or
 * the lowest-capex one when nothing fits.
 */
export function recommendFromAnswers(answers, current = DEFAULT_CONFIG) {
  const a = { ...DEFAULT_ANSWERS, ...answers };
  const base = configFromAnswers(a, current);
  const useCase = USE_CASES.find(u => u.id === a.useCase) || USE_CASES[0];
  const platforms = PLATFORM_SYSTEMS.filter(p => p.vendor === a.vendor && !p.isModular);
  const candidates = [];
  for (const platform of platforms) {
    let cfg = withPlatform({ ...base, selectedPlatformId: '' }, platform.id, PLATFORM_SYSTEMS);
    cfg.selectedPlatformId = platform.id;
    if (platform.requiresLiquidCooling) cfg = { ...cfg, coolingType: 'liquid', pue: 1.15, rackPowerKw: 80 };
    if (useCase.training) cfg = { ...cfg, manualDp: sizeTrainingForDeadline(cfg, a.deadlineDays) };
    let s = computeScenario(cfg);
    if (s.gpu.vendor !== 'NVIDIA' && cfg.enableNvidiaAiEnterprise) {
      cfg = { ...cfg, enableNvidiaAiEnterprise: false }; // licensed for NVIDIA GPUs only
      s = computeScenario(cfg);
    }
    if (s.memory.isOOM) continue;
    if (useCase.training && !(s.trainingTime?.wallClockDays <= a.deadlineDays)) continue;
    candidates.push({
      config: cfg,
      platformId: platform.id,
      platformName: platform.name,
      gpuName: s.gpu.name,
      gpus: s.results.totalGpus,
      capexUsd: s.cost.totalCapexUsd,
      tcoUsd: s.cost.tcoUsd,
      facilityKw: s.cost.billedFacilityPowerKw,
      trainingDays: s.trainingTime?.eligible ? s.trainingTime.wallClockDays : null,
      concurrency: s.traffic ? s.traffic.concurrency : cfg.concurrency,
      ttftSec: s.throughput?.ttftSec ?? null,
      tpotMs: s.throughput ? Number(s.throughput.tpotMs) : null,
      meetsLatency: s.latencySolve ? s.latencySolve.met : true,
      withinBudget: !(a.budgetUsd > 0) || s.cost.totalCapexUsd <= a.budgetUsd,
    });
  }
  // Designs that meet the latency targets first, then by total cost of ownership.
  candidates.sort((x, y) => (y.meetsLatency - x.meetsLatency) || (x.tcoUsd - y.tcoUsd));
  const inBudget = candidates.filter(c => c.withinBudget);
  const recommended = inBudget[0] || [...candidates].sort((x, y) => x.capexUsd - y.capexUsd)[0] || null;
  return { base, candidates, recommended, overBudget: !!recommended && !recommended.withinBudget };
}
