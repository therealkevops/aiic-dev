// Lesson content for Learning mode. Each lesson is data: a starting design (a validated preset
// with the lesson's own variables reset), the few controls the learner may change, the metrics
// to watch, "show the math" panels and a list of steps. A task step completes when its check(c,
// s) returns true for the lesson's live config `c` and computed scenario `s`.
import { DEFAULT_CONFIG, applyPresetConfig } from '../state/config.js';
import { USE_CASE_PRESETS } from '../data/presets.js';

const gb = (v, d = 1) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })} GB`;

/** A preset with everything outside the lesson switched off, so only the lesson's variables move. */
function lessonBase(presetId, overrides) {
  const preset = USE_CASE_PRESETS.find(p => p.id === presetId);
  return {
    ...applyPresetConfig(DEFAULT_CONFIG, preset.config),
    sizingInputMode: 'concurrency',
    latencyTargetsEnabled: false,
    enableSpeculativeDecoding: false,
    requestMixEnabled: false,
    reasoningTokensPerOutputToken: 0,
    enableKvOffload: false,
    prefixCacheRatio: 0,
    enableRag: false,
    enableGuardrails: false,
    enableIngress: false,
    enableHaDr: false,
    enableMlops: false,
    enableMig: false,
    isAutoSharding: true,
    isAutoDp: true,
    ...overrides,
  };
}

// Metrics a lesson can show. value(s, c) returns a number; format turns it into text.
export const METRICS = {
  weightsTotal: { label: 'Model weights', value: (s) => s.memory.weightTotalGb, format: (v) => gb(v) },
  usablePerGpu: { label: 'Usable memory per GPU', value: (s) => s.memory.usableGpuCapacityGb, format: (v) => gb(v) },
  gpus: { label: 'GPUs needed', value: (s) => s.results.totalGpus, format: (v) => v.toLocaleString() },
  sharding: { label: 'Layout', value: (s) => s.tp * 1000 + s.dp, format: (_v, s) => `TP=${s.tp} × DP=${s.dp}` },
  usedPerGpu: { label: 'Memory used per GPU', value: (s) => s.memory.perGpuTotalUsedGb, format: (v, s) => `${gb(v)} of ${s.gpu.vramGb} GB` },
  kvPerToken: { label: 'KV cache per token', value: (s) => s.memory.bytesPerTokenSeq, format: (v) => `${(v / 1e6).toFixed(2)} MB` },
  kvPerStream: { label: 'KV cache per stream', value: (s, c) => (s.memory.bytesPerTokenSeq * c.contextLength) / 1e9, format: (v) => gb(v) },
  kvAllStreams: { label: 'KV cache, all streams', value: (s, c) => (s.memory.bytesPerTokenSeq * c.contextLength * c.concurrency) / 1e9, format: (v) => gb(v) },
};

// Controls a lesson can expose, bound to config fields shared with Advanced mode.
export const CONTROLS = {
  selectedModelId: {
    label: 'Model',
    options: [
      { value: 'llama3-8b', label: 'Llama 3.1 8B' },
      { value: 'llama33-70b', label: 'Llama 3.3 70B' },
      { value: 'llama3-405b', label: 'Llama 3.1 405B' },
    ],
  },
  selectedPrecisionId: {
    label: 'Weight precision',
    options: [
      { value: 'fp16', label: 'FP16 · 2 bytes' },
      { value: 'fp8', label: 'FP8 · 1 byte' },
      { value: 'int4', label: 'INT4 · ~0.5 byte' },
    ],
  },
  kvPrecision: {
    label: 'KV cache precision',
    options: [
      { value: 'fp16', label: 'FP16 · 2 bytes' },
      { value: 'fp8', label: 'FP8 · 1 byte' },
    ],
  },
  contextLength: {
    label: 'Context length (tokens per conversation)',
    options: [4096, 8192, 16384, 32768, 65536].map(v => ({ value: v, label: `${v / 1024}k` })),
  },
  concurrency: {
    label: 'Concurrent streams (users generating at once)',
    options: [1, 8, 16, 32, 64, 128].map(v => ({ value: v, label: String(v) })),
  },
};

export const LESSONS = {
  memory: {
    id: 'memory',
    objective: 'Estimate how much GPU memory a model\'s weights need, and see how precision decides how many GPUs a model must be split across.',
    design: 'Cisco UCS C885A M8 with eight NVIDIA H200 GPUs (141 GB each), the 8-GPU building block used in Cisco\'s validated AI infrastructure designs.',
    start: () => lessonBase('ent-rag-assistant', { selectedModelId: 'llama33-70b', selectedPrecisionId: 'fp16', kvPrecision: 'fp16', concurrency: 1, contextLength: 4096 }),
    controls: ['selectedModelId', 'selectedPrecisionId'],
    metrics: ['weightsTotal', 'usablePerGpu', 'gpus', 'sharding'],
    math: (s, c) => {
      const bytes = s.precision.bytesPerParam;
      const core = s.model.params * bytes;
      const extra = s.memory.weightTotalGb - core;
      return [
        { label: 'Weights', expr: `${s.model.params}B parameters × ${bytes} bytes`, value: gb(core) },
        ...(extra > 0.05 ? [{ label: '+ 16-bit layers', expr: 'embedding and output layers stay at 16-bit', value: gb(extra) }] : []),
        { label: '= Model weights', expr: '', value: gb(s.memory.weightTotalGb), strong: true },
        { label: 'Usable per GPU', expr: `${s.gpu.vramGb} GB × 90% runtime reserve × ${100 - c.memoryHeadroomPct}% headroom margin`, value: gb(s.memory.usableGpuCapacityGb) },
        { label: 'Minimum GPUs', expr: `${gb(s.memory.weightTotalGb)} ÷ ${gb(s.memory.usableGpuCapacityGb)}, rounded up to a valid split`, value: `${s.results.totalGpus}`, strong: true },
      ];
    },
    steps: [
      {
        kind: 'read',
        title: 'What a GPU has to hold',
        body: 'To serve a model, every GPU in the design must hold its share of the model\'s weights in high-bandwidth memory (HBM), plus working memory for the conversations it is serving. Weights come first: they are the fixed cost of running the model at all, before a single user connects.\n\nThe design you are working on is a single Cisco UCS C885A M8 node with eight NVIDIA H200 GPUs. Each H200 has 141 GB of HBM3e.',
        highlight: ['weightsTotal'],
      },
      {
        kind: 'predict',
        title: 'Predict: weights at FP16',
        body: 'Llama 3.3 70B has 70.6 billion parameters. At FP16 (also written BF16), each parameter takes 2 bytes.',
        question: 'About how much memory do the weights need?',
        options: ['~35 GB', '~71 GB', '~141 GB', '~280 GB'],
        answer: 2,
        explain: '70.6 billion × 2 bytes = 141.2 GB. The rule of thumb for any dense model: billions of parameters × bytes per parameter = GB of weights.',
        highlight: ['weightsTotal'],
      },
      {
        kind: 'read',
        title: 'One 141 GB GPU is not enough for 141 GB of weights',
        body: 'Not all of a GPU\'s memory is usable. Serving engines such as vLLM reserve about 10% for the CUDA runtime and fragmentation, and the calculator keeps a further 5% margin, leaving about 120 GB on an H200.\n\n141 GB of weights will not fit in 120 GB, so the calculator splits the model across two GPUs with tensor parallelism (TP=2). Lesson 3 covers how that split works.',
        highlight: ['usablePerGpu', 'gpus'],
      },
      {
        kind: 'task',
        title: 'Halve the weights with FP8',
        body: 'H200 GPUs have native FP8 Tensor Cores, and FP8 is the usual choice for serving on Hopper: accuracy stays close to FP16 for most models.',
        task: 'Change the weight precision to FP8.',
        check: (c) => c.selectedModelId === 'llama33-70b' && c.selectedPrecisionId === 'fp8',
        hint: 'Use the Weight precision control and keep the model on Llama 3.3 70B.',
        done: 'The weights drop to about 72.7 GB and the model now fits on one GPU. It is slightly more than 70.6 GB because the embedding and output layers stay at 16-bit.',
        highlight: ['weightsTotal', 'gpus'],
      },
      {
        kind: 'predict',
        title: 'Predict: a 405B model at FP8',
        body: 'Llama 3.1 405B has 405 billion parameters.',
        question: 'At FP8, about how much memory do its weights need?',
        options: ['~200 GB', '~405 GB', '~810 GB', '~1.6 TB'],
        answer: 1,
        explain: '405 billion × 1 byte ≈ 405 GB, plus about 4 GB for the 16-bit embedding and output layers.',
      },
      {
        kind: 'task',
        title: 'Size the 405B model',
        body: 'Now see how many GPUs that takes.',
        task: 'Select Llama 3.1 405B and keep FP8.',
        check: (c) => c.selectedModelId === 'llama3-405b' && c.selectedPrecisionId === 'fp8',
        hint: 'Use the Model control; precision should still read FP8.',
        done: 'About 409 GB of weights need four H200s (TP=4). At FP16 the same model needs all eight GPUs in the node, so precision alone decides whether a 405B model fits in half a node or a whole one.',
        highlight: ['weightsTotal', 'gpus', 'sharding'],
      },
      {
        kind: 'task',
        title: 'Go further with 4-bit',
        body: 'Weight-only 4-bit formats (AWQ, GPTQ) shrink weights to about half a byte per parameter. They trade some accuracy for memory, and on Hopper the math still runs at 16-bit. Blackwell GPUs add native FP4 (NVFP4) Tensor Cores.',
        task: 'Select Llama 3.3 70B at INT4.',
        check: (c) => c.selectedModelId === 'llama33-70b' && c.selectedPrecisionId === 'int4',
        hint: 'Set the Model back to Llama 3.3 70B and choose INT4.',
        done: 'About 40 GB: the same 70B model in under a third of one H200. The memory left over is what serves users, which is the subject of the next lesson.',
        highlight: ['weightsTotal'],
      },
      {
        kind: 'recap',
        title: 'Recap',
        points: [
          'Weights (GB) ≈ billions of parameters × bytes per parameter.',
          'Only about 85-90% of GPU memory is usable once runtime reserves are counted.',
          'FP8 halves weight memory versus FP16 and is the usual choice on H200; 4-bit halves it again at some accuracy cost.',
          'Precision decides how many GPUs a model must be split across before any user is served.',
        ],
      },
    ],
  },

  'kv-cache': {
    id: 'kv-cache',
    objective: 'Calculate the KV cache per token and per conversation, and see why context length and concurrency, not the model, usually decide the GPU count.',
    design: 'Llama 3.3 70B at FP8 on a Cisco UCS C885A M8 with eight NVIDIA H200 GPUs, the starting point of the Departmental RAG Assistant validated preset.',
    start: () => lessonBase('ent-rag-assistant', { selectedModelId: 'llama33-70b', selectedPrecisionId: 'fp8', kvPrecision: 'fp16', concurrency: 1, contextLength: 8192 }),
    controls: ['contextLength', 'concurrency', 'kvPrecision'],
    metrics: ['kvPerToken', 'kvPerStream', 'kvAllStreams', 'weightsTotal', 'gpus', 'sharding', 'usedPerGpu'],
    math: (s, c) => {
      const m = s.model;
      const kvBytes = c.kvPrecision === 'fp8' ? 1 : 2;
      const perToken = s.memory.bytesPerTokenSeq;
      return [
        { label: 'Per token', expr: `2 (K and V) × ${m.layers} layers × ${m.kvHeads} KV heads × ${m.headDim} dims × ${kvBytes} bytes`, value: `${perToken.toLocaleString()} bytes` },
        { label: 'Per stream', expr: `${perToken.toLocaleString()} bytes × ${c.contextLength.toLocaleString()} tokens`, value: gb(perToken * c.contextLength / 1e9) },
        { label: 'All streams', expr: `× ${c.concurrency} concurrent streams`, value: gb(perToken * c.contextLength * c.concurrency / 1e9), strong: true },
        { label: 'Weights', expr: 'from lesson 1 (held once per replica)', value: gb(s.memory.weightTotalGb) },
      ];
    },
    steps: [
      {
        kind: 'read',
        title: 'Memory that grows with every user',
        body: 'As a model reads a prompt and writes an answer, it keeps a key and a value vector for every token, in every layer, so it never recomputes them. This is the KV cache. Unlike the weights, which are held once, the KV cache grows with the length of each conversation and with the number of conversations running at once.',
        highlight: ['kvPerToken'],
      },
      {
        kind: 'read',
        title: 'KV cache per token',
        body: 'For Llama 3.3 70B: 2 (a key and a value) × 80 layers × 8 KV heads × 128 dimensions × 2 bytes at FP16 = 327,680 bytes, about 0.33 MB per token.\n\nThe model has 64 attention heads but only 8 KV heads: grouped-query attention (GQA) lets 8 query heads share each KV head, which makes the cache 8× smaller than it would otherwise be. Open "Show the math" to follow the calculation live.',
        highlight: ['kvPerToken'],
      },
      {
        kind: 'predict',
        title: 'Predict: one conversation',
        body: 'One user has an 8,192-token conversation (prompt plus answer).',
        question: 'How much KV cache does that one conversation hold?',
        options: ['~0.3 GB', '~2.7 GB', '~27 GB', '~270 GB'],
        answer: 1,
        explain: '327,680 bytes × 8,192 tokens ≈ 2.7 GB for a single conversation.',
        highlight: ['kvPerStream'],
      },
      {
        kind: 'task',
        title: 'Add users',
        body: 'Every concurrent stream holds its own cache.',
        task: 'Raise concurrent streams to 8.',
        check: (c) => c.concurrency >= 8,
        hint: 'Use the Concurrent streams control.',
        done: 'Eight conversations hold about 21.5 GB of KV. With 72.7 GB of weights, the design still fits on one H200.',
        highlight: ['kvAllStreams', 'usedPerGpu', 'gpus'],
      },
      {
        kind: 'task',
        title: 'Lengthen the conversations',
        body: 'Document assistants and coding tools routinely use 32k-token contexts or more.',
        task: 'With 8 streams, raise the context length to 32k.',
        check: (c) => c.concurrency >= 8 && c.contextLength >= 32768,
        hint: 'Keep 8 streams and set Context length to 32k.',
        done: 'KV cache quadruples to about 86 GB, more than the weights. The design now needs two GPUs: the calculator adds a second replica (DP=2) because the extra memory is needed for conversations, not the model.',
        highlight: ['kvAllStreams', 'weightsTotal', 'gpus'],
      },
      {
        kind: 'predict',
        title: 'Predict: 64 users at 32k',
        body: 'Each 32k conversation holds about 10.7 GB of KV.',
        question: 'Roughly how many H200s do 64 concurrent 32k conversations need?',
        options: ['2', 'About 4', 'About 8', 'It cannot be served'],
        answer: 2,
        explain: '64 × 10.7 GB ≈ 687 GB of KV, about ten times the weights. At about 120 GB usable per GPU that is at least six GPUs before counting weights; the calculator lands on eight.',
      },
      {
        kind: 'task',
        title: 'Scale to 64 users',
        body: 'Check the prediction against the calculator.',
        task: 'Raise concurrent streams to 64 (context still 32k).',
        check: (c) => c.concurrency >= 64 && c.contextLength >= 32768 && c.kvPrecision === 'fp16',
        hint: 'Set Concurrent streams to 64 and keep KV cache precision at FP16.',
        done: 'A full node: eight GPUs, almost all of it KV cache. For long-context, multi-user services the KV cache, not the model, sets the GPU count.',
        highlight: ['kvAllStreams', 'gpus', 'sharding'],
      },
      {
        kind: 'task',
        title: 'Halve the cache with FP8 KV',
        body: 'Serving engines can store the KV cache in FP8 (vLLM: --kv-cache-dtype fp8) with little quality loss on most models.',
        task: 'Switch the KV cache precision to FP8.',
        check: (c) => c.concurrency >= 64 && c.contextLength >= 32768 && c.kvPrecision === 'fp8',
        hint: 'Use the KV cache precision control; keep 64 streams at 32k.',
        done: 'The per-token cache halves to about 0.16 MB and the design drops from eight GPUs to four: the same service on half the hardware.',
        highlight: ['kvPerToken', 'gpus'],
      },
      {
        kind: 'recap',
        title: 'Recap',
        points: [
          'KV per token = 2 × layers × KV heads × head dimension × bytes; grouped-query attention keeps it small.',
          'KV cache = per token × context length × concurrent streams, so it grows with both.',
          'For long-context, multi-user services the KV cache usually outweighs the model and sets the GPU count.',
          'FP8 KV halves the cache; prefix caching (shared prompts held once) is the other big lever, available in Advanced mode.',
          'This is why validated designs for document and coding assistants favour high-memory GPUs such as the 141 GB H200 and 180 GB B200.',
        ],
      },
    ],
  },
};

