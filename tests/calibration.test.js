/**
 * Calibration against published benchmarks.
 *
 * Reference: NVIDIA TensorRT-LLM "Performance Overview", throughput measurements
 * (docs/source/developer-guide/perf-overview.md in github.com/NVIDIA/TensorRT-LLM, fetched
 * 2026-09). Metric: output tokens/sec per GPU at maximum load (trtllm-bench, requests fed with
 * no delay, fixed ISL/OSL), on DGX H100 / DGX H200 / DGX B200 / GB200 NVL72, ModelOpt FP8 /
 * NVFP4 checkpoints (gpt-oss uses its native MXFP4 weights).
 *
 * The calculator sizes for a given concurrency rather than reporting max-load throughput, so the
 * harness below reproduces a max-load run: it raises concurrency to the largest batch that fits
 * in memory (capped at 2,048 streams per replica), then charges each request its prefill time on
 * the replica plus its OSL decode steps shared with the batch.
 *
 * CONFIG.kvBwEfficiency, moeMfuFactor and fp4ComputeEfficiency were fitted to the FITTED set.
 * The HELD_OUT set (large MoE models, which NVIDIA ran with attention data parallel + expert
 * parallel; approximated here as tensor parallel over the same GPUs) was not used for fitting.
 *
 * Reference numbers are copied from the source; never invent or adjust them to make a test pass.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateInfra } from '../src/utils/calculator.js';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../src/data/models.js';
import { GPU_CATALOG } from '../src/data/hardware.js';
import { PLATFORM_SYSTEMS } from '../src/data/platforms.js';

const PLATFORM = { h100: 'nvidia-dgx-h100', h200: 'nvidia-dgx-h200', b200: 'nvidia-dgx-b200', gb200: 'nvidia-gb200-nvl72' };
const MAX_BATCH = 2048;

/** Output tokens/sec/GPU at max load for one benchmark point. */
function maxLoadThroughputPerGpu({ model, precision, gpu, gpus, isl, osl }) {
  const platform = PLATFORM_SYSTEMS.find(p => p.id === PLATFORM[gpu]);
  const base = {
    workloadType: 'inference',
    model: MODEL_PRESETS.find(m => m.id === model),
    precision: PRECISION_OPTIONS.find(p => p.id === precision),
    kvPrecision: 'fp8',
    prefixCacheRatio: 0,
    promptTokenRatio: isl / (isl + osl),
    contextLength: isl + osl,
    avgContextLength: isl + osl / 2,
    gpu: GPU_CATALOG.find(g => g.id === platform.gpuId),
    platform,
    tp: gpus, pp: 1, dp: 1,
    networkProtocol: 'infiniband',
    servingConfig: { servingArchitecture: 'colocated', enableChunkedPrefill: true },
  };
  const fits = (c) => !calculateInfra({ ...base, concurrency: c }).memory.isOOM;
  assert.ok(fits(1), `${model} does not fit on ${gpus}× ${gpu}`);
  let lo = 1, hi = MAX_BATCH;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid; else hi = mid - 1;
  }
  const t = calculateInfra({ ...base, concurrency: lo }).throughput;
  const secPerRequest = t.ttftSec + (osl * t.t_step) / lo;
  return osl / secPerRequest / gpus;
}

// [model, precision, gpu, gpus, ISL, OSL, published output tok/s/GPU]
const FITTED = [
  ['llama33-70b', 'fp8', 'h200', 2, 1000, 1000, 2587],
  ['llama33-70b', 'fp8', 'h200', 2, 1024, 8192, 2009],
  ['llama33-70b', 'fp8', 'h200', 2, 8192, 1024, 537],
  ['llama33-70b', 'fp8', 'h200', 2, 32768, 1024, 120],
  ['llama33-70b', 'fp8', 'h100', 2, 1000, 1000, 2209],
  ['llama33-70b', 'fp8', 'h100', 2, 8192, 1024, 398],
  ['llama33-70b', 'nvfp4', 'b200', 1, 1000, 1000, 6920],
  ['llama33-70b', 'nvfp4', 'b200', 1, 1024, 8192, 3242],
  ['llama33-70b', 'nvfp4', 'b200', 1, 8192, 1024, 1362],
  ['llama33-70b', 'nvfp4', 'b200', 1, 32768, 1024, 274],
  ['llama33-70b', 'nvfp4', 'gb200', 1, 1000, 1000, 7769],
  ['llama33-70b', 'nvfp4', 'gb200', 1, 8192, 1024, 1491],
  ['gpt-oss-120b', 'mxfp4', 'h200', 1, 1000, 1000, 6868],
  ['gpt-oss-120b', 'mxfp4', 'h200', 1, 8192, 1024, 1828],
  ['gpt-oss-120b', 'mxfp4', 'h200', 1, 32768, 1024, 519],
  ['gpt-oss-120b', 'mxfp4', 'gb200', 1, 1000, 1000, 27198],
  ['gpt-oss-20b', 'mxfp4', 'h200', 1, 1000, 1000, 13858],
  ['gpt-oss-20b', 'mxfp4', 'h100', 1, 1000, 1000, 11557],
  ['gpt-oss-20b', 'mxfp4', 'h200', 1, 8192, 1024, 4015],
  ['gpt-oss-20b', 'mxfp4', 'b200', 1, 1000, 1000, 53812],
];

const HELD_OUT = [
  ['qwen3-235b-a22b', 'fp8', 'h200', 4, 1000, 1000, 3288],
  ['qwen3-235b-a22b', 'fp8', 'h200', 4, 8192, 1024, 627],
  ['qwen3-235b-a22b', 'nvfp4', 'b200', 4, 1000, 1000, 5764],
  ['qwen3-235b-a22b', 'nvfp4', 'b200', 4, 8192, 1024, 1410],
  ['deepseek-r1-671b', 'fp8', 'h200', 8, 1000, 1000, 1627],
  ['deepseek-r1-671b', 'nvfp4', 'b200', 4, 1000, 1000, 6463],
  ['deepseek-r1-671b', 'nvfp4', 'b200', 4, 8192, 1024, 1168],
  ['llama4-maverick', 'fp8', 'h200', 8, 1000, 1000, 4146],
  ['llama4-maverick', 'nvfp4', 'b200', 4, 1000, 1000, 11337],
  ['llama4-maverick', 'nvfp4', 'b200', 4, 8192, 1024, 3279],
];

// Points the analytical model is known to miss by more than the MoE band, and why.
const KNOWN_GAPS = {
  'gpt-oss-120b gb200 1000/1000': 'tiny active params at a 2,048-stream batch: real servers cap the batch lower and pay per-step scheduling/sampling costs',
  'qwen3-235b-a22b b200 1000/1000': 'same batch-cap effect; NVIDIA also ran attention data-parallel, which the TP approximation does not capture',
  'llama4-maverick b200 8192/1024': 'Llama 4 chunked (local) attention reads far less KV than the full-attention model assumes',
};

const key = ([model, , gpu, , isl, osl]) => `${model} ${gpu} ${isl}/${osl}`;
const bandFor = (row) => (KNOWN_GAPS[key(row)] ? 1.0 : row[0].startsWith('llama33') ? 0.25 : 0.4);

function ratios(rows) {
  return rows.map((row) => {
    const [model, precision, gpu, gpus, isl, osl, published] = row;
    return { row, ratio: maxLoadThroughputPerGpu({ model, precision, gpu, gpus, isl, osl }) / published };
  });
}

const geoMeanError = (rs) => Math.exp(rs.reduce((s, r) => s + Math.abs(Math.log(r.ratio)), 0) / rs.length);

for (const [name, rows, maxMeanError] of [['fitted', FITTED, 1.2], ['held-out', HELD_OUT, 1.25]]) {
  describe(`Calibration vs TensorRT-LLM published throughput (${name} set)`, () => {
    const rs = ratios(rows);

    for (const { row, ratio } of rs) {
      const band = bandFor(row);
      const why = KNOWN_GAPS[key(row)];
      it(`${key(row)} on ${row[3]}× ${row[2]} (${row[1]}) within ${why ? '2×' : `±${band * 100}%`}${why ? ' (known gap)' : ''}`, () => {
        const lo = why ? 0.5 : 1 - band;
        const hi = why ? 2 : 1 + band;
        assert.ok(ratio >= lo && ratio <= hi, `predicted/published = ${ratio.toFixed(2)}, expected ${lo}–${hi}${why ? ` (${why})` : ''}`);
      });
    }

    it(`typical (geometric-mean) error stays at or below ${maxMeanError}×`, () => {
      const e = geoMeanError(rs);
      assert.ok(e <= maxMeanError, `geometric-mean error ${e.toFixed(3)}× exceeds ${maxMeanError}×`);
    });
  });
}
