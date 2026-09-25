import React from 'react';
import { Activity, Database } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, ChoiceCard, Field, ScaleField, SegmentedToggle, SliderField, Tag, ToggleRow } from '../ui';
import { MODEL_PRESETS, PRECISION_OPTIONS } from '../../data/models';

export function WorkloadTab({ ctx }) {
  const {
    trainingTokensB, setTrainingTokensB, trainingMfuPct, setTrainingMfuPct,
    sizingInputMode, setSizingInputMode, trafficInputType, setTrafficInputType, peakActiveUsers, setPeakActiveUsers,
    requestsPerUserPerHour, setRequestsPerUserPerHour, peakRequestsPerSec, setPeakRequestsPerSec, traffic,
    concurrency, contextLength, customKvHeads, customLayers, customNumHeads, customParams,
    kvPrecision, maxContextLength, microBatchSize, model, prefixCacheRatio, promptTokenRatio,
    results, selectedModelId, selectedPrecisionId, setConcurrency, setContextLength, setCustomKvHeads,
    setCustomLayers, setCustomNumHeads, setCustomParams, setKvPrecision, setMicroBatchSize, setPrefixCacheRatio,
    setPromptTokenRatio, setSelectedModelId, setSelectedPrecisionId, setTrainingType, setWorkloadType, setZeroStage,
    trainingType, workloadType, zeroStage,
    reasoningTokensPerOutputToken, setReasoningTokensPerOutputToken, workloadShape,
    requestMixEnabled, setRequestMixEnabled, shortRequestPct, setShortRequestPct, shortRequestTokens, setShortRequestTokens,
  } = ctx;
  return (
    <>
      <Card
        icon={Activity}
        title="1. Workload & Model Selection"
        right={
          <SegmentedToggle
            value={workloadType}
            onChange={setWorkloadType}
            options={[
              { value: 'inference', label: 'Inference' },
              { value: 'training', label: 'Training / SFT' },
            ]}
          />
        }
        className="space-y-4"
      >
        {/* Model Preset Dropdown */}
        <Field label="Base AI Model Architecture" helper={
          <InfoHelper
            title="Model Parameter Count"
            text="The number of neural network weights in billions. Dense models compute all parameters on every token. Mixture-of-Experts (MoE) models only activate a small subset per token, but still require aggregate VRAM to store all experts in memory."
            whyItMatters="Model size determines the baseline VRAM floor. A 70B model requires 70 GB in FP8 or 140 GB in FP16 before any user tokens are even processed."
          />
        }>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            {MODEL_PRESETS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.params}B params{m.isMoe ? ` (MoE, ${m.activeParams}B active)` : ''}
              </option>
            ))}
          </select>
          {model.license && (
            <div className={`text-[11px] mt-1.5 ${model.license.commercial === 'non-commercial' ? 'text-amber-400' : 'text-zinc-400'}`}>
              License: {model.license.name}
              {model.license.commercial === 'non-commercial' ? ' (non-commercial)' : ''}
              {model.license.note ? ` — ${model.license.note}` : ''}
            </div>
          )}
        </Field>

        {/* Custom Param input if custom */}
        {selectedModelId === 'custom' && (
          <div className="space-y-3 bg-zinc-950/70 p-3 rounded-lg border border-zinc-800/80">
            <Field label="Custom Total Parameters (in Billions)">
              <input
                type="number"
                value={customParams}
                onChange={(e) => setCustomParams(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                min="1"
                max="2000"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Layers">
                <input
                  type="number"
                  value={customLayers}
                  onChange={(e) => setCustomLayers(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  min="1" max="200"
                />
              </Field>
              <Field label="Query Heads">
                <input
                  type="number"
                  value={customNumHeads}
                  onChange={(e) => setCustomNumHeads(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  min="1" max="256"
                />
              </Field>
              <Field label="KV Heads (GQA)">
                <input
                  type="number"
                  value={customKvHeads}
                  onChange={(e) => setCustomKvHeads(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  min="1" max="128"
                />
              </Field>
            </div>
          </div>
        )}

        {/* Precision / Quantization */}
        <Field label="Weight Precision & Quantization" helper={
          <InfoHelper
            title="Quantization Precision"
            text="How many bytes each weight occupies in GPU RAM. FP16/BF16 is full 16-bit precision (2 bytes). FP8 (1 byte) halves weight memory with virtually zero reasoning loss on modern Hopper/Blackwell cards. INT4 (0.5 bytes) shrinks memory by 75%."
            whyItMatters="Dropping from FP16 to FP8 cuts your required GPU count in half for model weights, drastically reducing private cluster cost."
          />
        }>
          <select
            value={selectedPrecisionId}
            onChange={(e) => setSelectedPrecisionId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            {PRECISION_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.bytesPerParam} byte{p.bytesPerParam > 1 ? 's' : ''}/param)
              </option>
            ))}
          </select>
        </Field>

        {/* Context Length Slider */}
        <SliderField
          label="Context Window Length:"
          valueLabel={`${contextLength.toLocaleString()} tokens`}
          min="2048" max={maxContextLength} step="2048"
          value={Math.min(contextLength, maxContextLength)}
          onChange={(e) => setContextLength(Number(e.target.value))}
          marks={['2k (Prompt)', '32k (Docs)', `${(maxContextLength / 1024).toFixed(0)}k (Max)`]}
          helper={
            <>
              {maxContextLength < 131072 && (
                <div className="text-[10.5px] text-amber-400 mt-1.5 font-medium">
                  {model.name} natively supports up to {(maxContextLength / 1024).toFixed(0)}k tokens maximum.
                </div>
              )}
              <InfoHelper
                title="Context Window & KV Cache"
                text="The total token span (input prompt + output generation) processed in a single prompt. For every token processed, the attention mechanism must store Key and Value vectors in GPU VRAM (the KV Cache) to avoid recalculating past context."
                whyItMatters="At 128k tokens, the KV Cache often consumes MORE VRAM than the model weights themselves! High context mandates GPUs with large VRAM (e.g. H200 141GB)."
              />
            </>
          }
        />

        {/* Concurrency / Batch Size */}
        {workloadType === 'inference' ? (
          <>
            <Field label="Size by">
              <SegmentedToggle
                value={sizingInputMode}
                onChange={setSizingInputMode}
                options={[{ value: 'concurrency', label: 'Concurrent streams' }, { value: 'traffic', label: 'Peak traffic' }]}
              />
            </Field>
            {sizingInputMode === 'traffic' ? (
              <div className="space-y-3">
                <SegmentedToggle
                  value={trafficInputType}
                  onChange={setTrafficInputType}
                  options={[{ value: 'users', label: 'Users × requests/hour' }, { value: 'rps', label: 'Requests / second' }]}
                />
                {trafficInputType === 'users' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Active users in the peak hour">
                      <input type="number" min="1" step="10" value={peakActiveUsers}
                        onChange={(e) => setPeakActiveUsers(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
                    </Field>
                    <Field label="Requests per user per hour">
                      <input type="number" min="0.1" step="1" value={requestsPerUserPerHour}
                        onChange={(e) => setRequestsPerUserPerHour(Math.max(0.1, Number(e.target.value) || 0.1))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
                    </Field>
                  </div>
                ) : (
                  <Field label="Peak requests per second">
                    <input type="number" min="0.01" step="0.5" value={peakRequestsPerSec}
                      onChange={(e) => setPeakRequestsPerSec(Math.max(0.01, Number(e.target.value) || 0.01))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
                  </Field>
                )}
                {traffic && (
                  <div className="text-[11px] text-zinc-400 leading-relaxed" data-testid="traffic-summary">
                    {traffic.requestsPerSec.toFixed(2)} requests/s × {traffic.serviceTimeSec.toFixed(1)} s per request (prefill + full answer) ÷ {Math.round(traffic.targetUtilization * 100)}% target utilization ≈ <strong className="text-sky-400">{traffic.concurrency.toLocaleString()} concurrent requests</strong> to size for; they run at {Math.round(traffic.utilization * 100)}% utilization.
                  </div>
                )}
                <InfoHelper
                  title="Sizing from Traffic"
                  text="A request here is one full use of the context window below: its prompt plus its whole answer (for an agent, one task or session). By Little's law, the requests in flight equal the arrival rate times how long each takes to serve; dividing by the target utilization (SLA tab) leaves headroom so requests rarely wait for a slot."
                  whyItMatters="Most teams know users and request rates, not concurrent streams. Long answers and reasoning tokens stretch service time, so the same traffic can need many more concurrent slots, and GPUs, than it first appears."
                />
              </div>
            ) : (
              <ScaleField
                label="Concurrent User Requests (Total Cluster-Wide):"
                value={concurrency}
                onChange={setConcurrency}
                presets={[1, 8, 32, 128, 512, 2048, 8192]}
                min={1}
                max={16384}
                suffix=" streams"
                helper={
                  <InfoHelper
                    title="Concurrency & KV Cache Multiplying"
                    text="How many separate users or agent tasks are generating answers at the exact same millisecond, across the whole deployment (not per replica). Each concurrent stream maintains its own independent KV Cache in GPU memory."
                    whyItMatters="At large scale, this is what Data Parallelism (DP) auto-scales against on the Sharding tab: more replicas means each one only has to hold KV cache for its own share of these streams."
                  />
                }
              />
            )}

            {/* Advanced KV Cache Optimization Sub-panel */}
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/70">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>KV Cache Architecture &amp; Optimization</span>
                </div>
                {results?.memory?.kvSavingsGb > 0 && (
                  <Tag tone="good">-{results.memory.kvSavingsGb.toFixed(1)} GB saved</Tag>
                )}
              </div>

              {/* KV Cache Precision Selector */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                  KV Cache Precision (<code className="text-sky-400 font-mono">--kv-cache-dtype</code>)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <ChoiceCard selected={kvPrecision === 'fp16'} onClick={() => setKvPrecision('fp16')}
                    title={<span className="block text-center w-full">FP16 / BF16</span>}
                    desc={<span className="block text-center">2.0 B (Default)</span>} />
                  <ChoiceCard selected={kvPrecision === 'fp8'} onClick={() => setKvPrecision('fp8')}
                    title={<span className="flex items-center justify-center gap-1 w-full">FP8 E4M3 <span className="text-emerald-400 font-mono text-[10px]">-50%</span></span>}
                    desc={<span className="block text-center">1.0 B (vLLM / SGLang)</span>} />
                  <ChoiceCard selected={kvPrecision === 'int4'} onClick={() => setKvPrecision('int4')}
                    title={<span className="flex items-center justify-center gap-1 w-full">INT4 / FP4 <span className="text-emerald-400 font-mono text-[10px]">-75%</span></span>}
                    desc={<span className="block text-center">0.5 B (engine-dependent)</span>} />
                </div>
                <InfoHelper
                  title="KV Cache Precision (FP16 vs FP8)"
                  text="Modern inference engines allow quantizing the KV cache independently from model weights. Running --kv-cache-dtype fp8 cuts KV memory in half, doubling the concurrent sessions supported on the same GPU cluster with virtually imperceptible perplexity loss."
                  whyItMatters="At long context lengths (32k–128k), FP8 KV cache often prevents needing extra server nodes just to hold conversation memory."
                />
              </div>

              {/* Automatic Prefix Caching */}
              <SliderField
                label="Automatic Prefix Caching Hit Rate:"
                valueLabel={`${(prefixCacheRatio * 100).toFixed(0)}%`}
                min="0" max="0.80" step="0.05"
                value={prefixCacheRatio}
                onChange={(e) => setPrefixCacheRatio(Number(e.target.value))}
                marks={['0% (Unique Queries)', '40% (Shared RAG / System Prompt)', '80% (Multi-turn Chat)']}
                helper={
                  <>
                    {prefixCacheRatio > 0 && concurrency > 1 && (
                      <div className="text-[10.5px] text-emerald-400 mt-1.5 font-mono">
                        Deduplicating ~{Math.round(contextLength * promptTokenRatio * prefixCacheRatio).toLocaleString()} shared tokens across {concurrency} streams
                      </div>
                    )}
                    <InfoHelper
                      title="Automatic Prefix Caching"
                      text="In vLLM and SGLang, shared prompt tokens (such as a 4k system prompt or document corpus) are stored once in GPU VRAM and referenced across all concurrent streams rather than copied per user."
                      whyItMatters="High prefix hit rates drastically reduce KV cache memory pressure and accelerate Time-to-First-Token (TTFT) by bypassing prefill computation on repeated prefixes."
                    />
                  </>
                }
              />

              {/* Prompt vs Output Generation Ratio */}
              <SliderField
                label="Workload Profile (Prompt vs. Output Split):"
                valueLabel={`${(promptTokenRatio * 100).toFixed(0)}% / ${((1 - promptTokenRatio) * 100).toFixed(0)}%`}
                min="0.1" max="0.99" step="0.01"
                value={promptTokenRatio}
                onChange={(e) => setPromptTokenRatio(Number(e.target.value))}
                marks={['10% (Agentic / Code & Reasoning)', '50% (Chat)', '99% (Long documents)']}
                helper={
                  <InfoHelper
                    title="Workload Profile (Prompt vs. Output Split)"
                    text="Sets what share of each request's context window is input (prompt) tokens versus generated (output) tokens. RAG/document workloads skew high (mostly prompt, little generation); agentic and reasoning workloads skew low (a small prompt drives a long chain of generated tool calls and reasoning tokens)."
                    whyItMatters="Prefill (prompt) and decode (output) are sized differently: prefill is compute-bound and scales with prompt tokens, while decode is bandwidth-bound and scales with output tokens. Shifting this ratio shifts where the bottleneck falls and changes both throughput and KV cache growth per stream."
                  />
                }
              />

              {/* Reasoning (thinking) tokens */}
              <SliderField
                label="Reasoning tokens per visible output token:"
                valueLabel={reasoningTokensPerOutputToken === 0 ? 'None' : `${reasoningTokensPerOutputToken}×`}
                min="0" max="20" step="1"
                value={reasoningTokensPerOutputToken}
                onChange={(e) => setReasoningTokensPerOutputToken(Number(e.target.value))}
                marks={['0 (standard)', '5×', '10×', '20× (long thinking)']}
                helper={
                  <>
                    {workloadShape.thinkingTokens > 0 && (
                      <div className="text-[11px] text-zinc-400 mt-1.5">
                        Each request: {workloadShape.promptTokens.toLocaleString()} prompt + {workloadShape.visibleOutputTokens.toLocaleString()} answer + {workloadShape.thinkingTokens.toLocaleString()} thinking = {workloadShape.sequenceTokens.toLocaleString()} tokens held in KV cache{workloadShape.clamped ? ' (capped at the model window)' : ''}.
                      </div>
                    )}
                    <InfoHelper
                      title="Reasoning Tokens"
                      text="Reasoning models (DeepSeek R1, gpt-oss, Qwen3 in thinking mode) generate hidden chain-of-thought before the visible answer. Those tokens are decoded like any other and stay in the KV cache for the rest of the response."
                      whyItMatters="Thinking typically adds 3-20x the visible output. That multiplies decode time per answer, lengthens every sequence in the KV cache, and lowers how many answers each GPU completes per second."
                    />
                  </>
                }
              />

              {/* Request length mix */}
              <div className="space-y-2.5 pt-1">
                <ToggleRow
                  label="Mixed request lengths"
                  description="Size the KV cache for a mix of short and full-length requests instead of every stream at the full window."
                  checked={requestMixEnabled}
                  onChange={setRequestMixEnabled}
                />
                {requestMixEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Short requests: ${shortRequestPct}%`}>
                      <input
                        type="range" min="0" max="95" step="5"
                        value={shortRequestPct}
                        onChange={(e) => setShortRequestPct(Number(e.target.value))}
                        className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                      />
                    </Field>
                    <Field label="Short request length (tokens)">
                      <input
                        type="number" min="128" max={contextLength} step="256"
                        value={shortRequestTokens}
                        onChange={(e) => setShortRequestTokens(Math.max(128, Math.min(contextLength, Number(e.target.value) || 128)))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                      />
                    </Field>
                    <div className="col-span-2 text-[11px] text-zinc-400">
                      Mean sequence: {workloadShape.avgSequenceTokens?.toLocaleString()} tokens vs {workloadShape.sequenceTokens.toLocaleString()} maximum. The longest request still sets the single-stream fit and time to first token.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Training Options */
          <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-3.5">
            <SliderField
              label="Micro-Batch Size per GPU:"
              valueLabel={`${microBatchSize} sequences`}
              min="1" max="8" step="1"
              value={microBatchSize}
              onChange={(e) => setMicroBatchSize(Number(e.target.value))}
              marks={['1 (safest, gradient checkpointing)', '8 (faster, more activation VRAM)']}
              helper={
                <InfoHelper
                  title="Micro-Batch Size (Training)"
                  text="The number of training sequences processed simultaneously per GPU before a gradient update. Larger micro-batches increase GPU utilization but require more activation memory."
                  whyItMatters="With gradient checkpointing, micro-batch=1 minimizes memory use. Increase it if you have VRAM headroom to improve GPU compute utilization."
                />
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Training tokens (billions)">
                <input type="number" min="0.001" step="1" value={trainingTokensB}
                  onChange={(e) => setTrainingTokensB(Math.max(0.001, Number(e.target.value) || 0.001))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
              </Field>
              <Field label={`Sustained MFU: ${trainingMfuPct}%`}>
                <input type="range" min="10" max="60" step="1" value={trainingMfuPct}
                  onChange={(e) => setTrainingMfuPct(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer" />
              </Field>
            </div>
            <div className="text-[10.5px] text-zinc-500">Tokens = dataset tokens × epochs. MFU: 35-45% is typical for well-tuned large dense runs, lower for small models, LoRA and MoE.</div>

            <Field label="Training Strategy">
              <select
                value={trainingType}
                onChange={(e) => setTrainingType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="pretrain_sft">Full Parameter Training / SFT (16 bytes/param base)</option>
                <option value="lora">LoRA / QLoRA Adapter Fine-Tuning (~1% trainable)</option>
              </select>
            </Field>

            {trainingType === 'pretrain_sft' && (
              <Field label="ZeRO / FSDP Sharding Stage" helper={
                <InfoHelper
                  title="ZeRO Memory Sharding Stages"
                  text="In AdamW training, optimizer states take 12 bytes per parameter (3x the model size!). ZeRO-3 / PyTorch FSDP slices weights, gradients, and optimizer states across all GPUs in the cluster."
                  whyItMatters="Full training without ZeRO-3 requires massive clusters. ZeRO-3 allows a 70B model to be trained across 8x H100s instead of 32+ GPUs."
                />
              }>
                <select
                  value={zeroStage}
                  onChange={(e) => setZeroStage(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value={0}>ZeRO-0: No Sharding (Full model replicated on every GPU)</option>
                  <option value={1}>ZeRO-1: Optimizer States Sharded across GPUs</option>
                  <option value={2}>ZeRO-2: Optimizer + Gradients Sharded</option>
                  <option value={3}>ZeRO-3 / FSDP: Full Sharding (Weights + Gradients + Optimizer)</option>
                </select>
              </Field>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
