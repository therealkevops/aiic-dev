/**
 * SLA / Tail-Latency Queueing Test Suite (Phase 4 of the architecture roadmap)
 * Validates the M/M/c (Erlang C) queueing model applied at the replica level:
 * eligibility gating, Erlang B/C math correctness, percentile monotonicity,
 * clamping near instability, and that TPOT stays unaffected while TTFT grows
 * with utilization.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra, calculateSla } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';

const getModel = (id) => MODEL_PRESETS.find(m => m.id === id);
const getPrecision = (id) => PRECISION_OPTIONS.find(p => p.id === id);
const getGpu = (id) => GPU_CATALOG.find(g => g.id === id);
const getPlatform = (id) => PLATFORM_SYSTEMS.find(p => p.id === id);

const baseServingConfig = (platform, gpu, servingArchitecture = 'colocated') => ({
  servingEngine: 'vllm',
  orchestrator: 'kserve',
  servingArchitecture,
  enableChunkedPrefill: true,
  enablePrefixCaching: true,
  enableSpeculativeDecoding: false,
  llmdDisaggregationMode: 'heterogeneous',
  secondaryPlatform: platform,
  secondaryGpu: gpu,
  prefillNodes: 1,
  decodeNodes: 2,
});

function buildInfra({
  workloadType = 'inference', modelId = 'llama3-8b', precisionId = 'fp8',
  platformId = 'cisco-c885a-h100', tp = 1, pp = 1, dp = 16, concurrency = 256,
  servingArchitecture = 'colocated',
}) {
  const model = getModel(modelId);
  const precision = getPrecision(precisionId);
  const platform = getPlatform(platformId);
  const gpu = getGpu(platform.gpuId);
  return calculateInfra({
    workloadType, model, precision, kvPrecision: 'fp8',
    prefixCacheRatio: 0.2, promptTokenRatio: 0.75, contextLength: 8192,
    concurrency, gpu, platform, tp, pp, dp,
    trainingType: 'pretrain_sft', zeroStage: 3, networkProtocol: 'rocev2', pue: 1.35,
    servingConfig: baseServingConfig(platform, gpu, servingArchitecture),
  });
}

describe('1. Eligibility Gating', () => {
  it('is ineligible for training workloads', () => {
    const infraResults = buildInfra({ workloadType: 'training' });
    const sla = calculateSla({ infraResults, targetUtilization: 0.7 });
    assert.equal(sla.eligible, false);
    assert.match(sla.reason, /training/i);
  });

  it('is ineligible for LLM-D disaggregated serving', () => {
    const infraResults = buildInfra({ servingArchitecture: 'llmd' });
    const sla = calculateSla({ infraResults, targetUtilization: 0.7 });
    assert.equal(sla.eligible, false);
    assert.match(sla.reason, /LLM-D/i);
  });

  it('is eligible for colocated inference', () => {
    const infraResults = buildInfra({});
    const sla = calculateSla({ infraResults, targetUtilization: 0.7 });
    assert.equal(sla.eligible, true);
    assert.equal(sla.reason, null);
  });
});

describe('2. Erlang Math Correctness', () => {
  it('matches the closed-form M/M/1 waiting-time formula at c=1', () => {
    // For c=1, Wq = rho / (mu * (1 - rho)) -- verify our Erlang-C-derived path
    // reduces to this exactly, via a workload sized down to a single concurrency slot.
    const infraResults = buildInfra({ concurrency: 1, dp: 1 });
    assert.equal(infraResults.throughput.C_rep, 1, 'test setup should yield C_rep=1');

    const mu = 1 / infraResults.throughput.ttftSec; // service time reduces to ~ttft at c=1 with negligible decode
    const rho = 0.5;
    const sla = calculateSla({ infraResults, targetUtilization: rho });

    const mu_actual = 1 / sla.meanServiceTimeSec;
    const expected = rho / (mu_actual * (1 - rho));
    assert.ok(Math.abs(sla.meanWaitSec - expected) < 1e-9, `expected ${expected}, got ${sla.meanWaitSec}`);
  });

  it('probability of queueing (Erlang C) is 0 at very low utilization and grows toward 1 near saturation', () => {
    const infraResults = buildInfra({});
    const low = calculateSla({ infraResults, targetUtilization: 0.05 });
    const high = calculateSla({ infraResults, targetUtilization: 0.95 });
    assert.ok(low.probabilityOfQueueing < 0.01);
    assert.ok(high.probabilityOfQueueing > low.probabilityOfQueueing);
    assert.ok(high.probabilityOfQueueing <= 1);
  });

  it('stays numerically finite at very high concurrency (no factorial overflow)', () => {
    const infraResults = buildInfra({ concurrency: 4000, dp: 32 });
    assert.ok(infraResults.throughput.C_rep > 100, 'test setup should yield high per-replica concurrency');
    const sla = calculateSla({ infraResults, targetUtilization: 0.8 });
    assert.ok(Number.isFinite(sla.meanWaitSec));
    assert.ok(Number.isFinite(sla.p99WaitSec));
  });
});

describe('3. Percentile Monotonicity', () => {
  it('P99 >= P95 >= P90 >= P50 >= 0 at moderate-to-high utilization', () => {
    const infraResults = buildInfra({});
    for (const rho of [0.3, 0.5, 0.7, 0.85, 0.95]) {
      const sla = calculateSla({ infraResults, targetUtilization: rho });
      assert.ok(sla.p99WaitSec >= sla.p95WaitSec, `rho=${rho}: p99 >= p95`);
      assert.ok(sla.p95WaitSec >= sla.p90WaitSec, `rho=${rho}: p95 >= p90`);
      assert.ok(sla.p90WaitSec >= sla.p50WaitSec, `rho=${rho}: p90 >= p50`);
      assert.ok(sla.p50WaitSec >= 0, `rho=${rho}: p50 >= 0`);
    }
  });

  it('wait times increase monotonically as target utilization increases', () => {
    const infraResults = buildInfra({});
    const rhos = [0.2, 0.4, 0.6, 0.8, 0.95];
    const means = rhos.map(rho => calculateSla({ infraResults, targetUtilization: rho }).meanWaitSec);
    for (let i = 1; i < means.length; i++) {
      assert.ok(means[i] >= means[i - 1], `mean wait should not decrease as rho increases: ${means}`);
    }
  });
});

describe('4. Edge Cases', () => {
  it('near-zero utilization yields near-zero queueing delay', () => {
    const infraResults = buildInfra({});
    const sla = calculateSla({ infraResults, targetUtilization: 0.01 });
    assert.ok(sla.meanWaitSec < 1e-6);
    assert.ok(sla.ttftP99Sec < sla.ttftBaselineSec + 1e-6);
  });

  it('clamps utilization away from 1.0 to avoid instability', () => {
    const infraResults = buildInfra({});
    const sla = calculateSla({ infraResults, targetUtilization: 1.0 });
    assert.ok(sla.targetUtilization < 1.0);
    assert.equal(sla.wasClamped, true);
    assert.ok(Number.isFinite(sla.meanWaitSec));
  });

  it('flags a high-utilization warning above rho=0.85 but not below', () => {
    const infraResults = buildInfra({});
    assert.equal(calculateSla({ infraResults, targetUtilization: 0.5 }).highUtilizationWarning, false);
    assert.equal(calculateSla({ infraResults, targetUtilization: 0.9 }).highUtilizationWarning, true);
  });
});

describe('5. TTFT vs TPOT Scope', () => {
  it('TPOT (decode) is unaffected by queueing utilization -- only TTFT grows', () => {
    const infraResults = buildInfra({});
    const low = calculateSla({ infraResults, targetUtilization: 0.2 });
    const high = calculateSla({ infraResults, targetUtilization: 0.9 });
    assert.equal(low.tpotSec, high.tpotSec, 'tpotSec should be identical regardless of utilization');
    assert.equal(low.tpotSec, infraResults.throughput.t_step);
    assert.ok(high.ttftP99Sec > low.ttftP99Sec, 'TTFT at P99 should grow with utilization');
  });

  it('TTFT at percentile equals baseline TTFT plus the percentile queueing wait', () => {
    const infraResults = buildInfra({});
    const sla = calculateSla({ infraResults, targetUtilization: 0.8 });
    assert.ok(Math.abs(sla.ttftP99Sec - (sla.ttftBaselineSec + sla.p99WaitSec)) < 1e-9);
    assert.ok(Math.abs(sla.ttftP50Sec - (sla.ttftBaselineSec + sla.p50WaitSec)) < 1e-9);
  });
});
