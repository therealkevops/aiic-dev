import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, withPlatform } from '../src/state/config.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';
import { GPU_PRICING } from '../src/data/pricing.js';
import { computeScenario } from '../src/utils/scenario.js';
import { configFromAnswers, recommendFromAnswers, DOC_LENGTHS } from '../src/utils/guidedSetup.js';

test('withPlatform: switching to a different GPU loads its catalog price; same GPU keeps the typed price', () => {
  const custom = { ...DEFAULT_CONFIG, gpuUnitPriceUsd: 12345 };
  const b200 = withPlatform(custom, 'cisco-c885a-b200', PLATFORM_SYSTEMS);
  assert.equal(b200.selectedPlatformId, 'cisco-c885a-b200');
  assert.equal(b200.gpuUnitPriceUsd, GPU_PRICING['b200-sxm'].estimatedUnitPriceUsd);
  assert.equal(b200.cloudRateUsdPerHr, GPU_PRICING['b200-sxm'].estimatedCloudRateUsdPerHr);
  const sameGpu = withPlatform(custom, 'nvidia-dgx-h200', PLATFORM_SYSTEMS);
  assert.equal(sameGpu.gpuUnitPriceUsd, 12345);
});

test('configFromAnswers: traffic sizing, document length and a fixed answer length', () => {
  const short = configFromAnswers({ useCase: 'rag', peakUsers: 800, docLength: 'short' });
  const long = configFromAnswers({ useCase: 'rag', peakUsers: 800, docLength: 'long' });
  assert.equal(short.sizingInputMode, 'traffic');
  assert.equal(short.peakActiveUsers, 800);
  assert.equal(long.contextLength, DOC_LENGTHS.find(d => d.id === 'long').tokens);
  const answer = (c) => c.contextLength * (1 - c.promptTokenRatio);
  assert.ok(Math.abs(answer(short) - answer(long)) / answer(short) < 0.02, 'longer documents lengthen the prompt, not the answer');
  assert.ok(long.latencyTargetsEnabled && long.targetTpotMs === 50);
  assert.equal(configFromAnswers({ useCase: 'chat' }).enableRag, false);
  assert.equal(configFromAnswers({ useCase: 'rag' }).enableRag, true);
  const gapped = configFromAnswers({ useCase: 'chat', airGapped: true });
  assert.equal(gapped.selectedIngressTierId, 'software-lb');
  assert.equal(gapped.egressUsdPerGb, 0);
});

test('recommendFromAnswers: ranks fitting platforms and prefers those meeting latency targets', () => {
  const r = recommendFromAnswers({ useCase: 'chat', peakUsers: 500, vendor: 'cisco' });
  assert.ok(r.candidates.length > 3);
  assert.ok(r.candidates.every(c => c.platformId.startsWith('cisco-')));
  const firstMiss = r.candidates.findIndex(c => !c.meetsLatency);
  if (firstMiss >= 0) assert.ok(r.candidates.slice(firstMiss).every(c => !c.meetsLatency));
  const s = computeScenario(r.recommended.config);
  assert.equal(s.platform.id, r.recommended.platformId);
  assert.equal(s.memory.isOOM, false);
  assert.equal(Math.round(s.cost.tcoUsd), Math.round(r.recommended.tcoUsd));
  // The applied config is priced for the recommended GPU.
  assert.equal(r.recommended.config.gpuUnitPriceUsd, GPU_PRICING[s.gpu.id].estimatedUnitPriceUsd);
});

test('recommendFromAnswers: budget and AMD licensing', () => {
  const tight = recommendFromAnswers({ useCase: 'coding', peakUsers: 2000, budgetUsd: 1000 });
  assert.equal(tight.overBudget, true);
  const cheapestCapex = Math.min(...tight.candidates.map(c => c.capexUsd));
  assert.equal(tight.recommended.capexUsd, cheapestCapex);
  const amd = recommendFromAnswers({ useCase: 'chat', vendor: 'amd' });
  assert.ok(amd.candidates.every(c => c.config.enableNvidiaAiEnterprise === false));
});

test('recommendFromAnswers: training meets the deadline', () => {
  const r = recommendFromAnswers({ useCase: 'finetune', trainingTokensB: 1, deadlineDays: 5 });
  assert.ok(r.recommended);
  assert.ok(r.recommended.trainingDays <= 5);
  assert.equal(r.recommended.config.trainingTokensB, 1);
});
