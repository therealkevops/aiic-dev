import React from 'react';
import { Activity, Layers, Network, Server, Workflow, Zap } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, ChoiceCard, Field, Row, Rows, Tag, ToggleRow } from '../ui';
import { GPU_CATALOG } from '../../data/hardware';
import { kvFabricName } from '../../utils/calculator';

export function ServingStackTab({ ctx }) {
  const {
    llmdAutoSize, setLlmdAutoSize, llmdSizing, memory,
    specMethod, setSpecMethod, specDraftParamsB, setSpecDraftParamsB, specNumTokens, setSpecNumTokens,
    specAcceptanceRate, setSpecAcceptanceRate, throughput, workloadType,
    availablePlatforms, decodeNodes, effectiveConcurrency, enableChunkedPrefill, enablePrefixCaching, enableSpeculativeDecoding,
    llmdDisaggregationMode, orchestrator, platform, prefillNodes, results, secondaryGpu,
    secondaryPlatform, secondaryPlatformId, selectedProtocolId, selectedVendor, servingArchitecture, servingEngine,
    setDecodeNodes, setEnableChunkedPrefill, setEnablePrefixCaching, setEnableSpeculativeDecoding, setLlmdDisaggregationMode, setOrchestrator,
    setPrefillNodes, setSecondaryPlatformId, setServingArchitecture, setServingEngine,
  } = ctx;
  return (
    <>
      <Card
        icon={Workflow}
        title="8. Serving Engine, Orchestration & LLM-D"
        right={<Tag tone={servingArchitecture === 'llmd' ? 'warn' : 'neutral'}>{servingArchitecture === 'llmd' ? 'LLM-D Disaggregated' : 'Colocated'}</Tag>}
        className="space-y-4"
      >
        {/* Inference Engine Selection */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">High-Throughput Inference Runtime</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'vllm', name: 'vLLM (v1)', desc: 'PagedAttention + Chunked Prefill' },
              { id: 'trt-llm', name: 'TensorRT-LLM', desc: 'NVIDIA Graph Compiler' },
              { id: 'tgi', name: 'HuggingFace TGI', desc: 'Text Generation Inference' }
            ].map((engine) => (
              <ChoiceCard key={engine.id} selected={servingEngine === engine.id} onClick={() => setServingEngine(engine.id)}
                title={engine.name} desc={engine.desc} />
            ))}
          </div>
          <InfoHelper
            title="Inference Engine Selection (vLLM vs TensorRT-LLM)"
            text="vLLM is the open-source production standard, featuring PagedAttention (virtual memory management for KV caches) to eliminate memory fragmentation. TensorRT-LLM compiles custom CUDA kernels for extreme throughput."
            whyItMatters="vLLM's memory efficiency allows higher concurrency without OOM. On Cisco UCS and Supermicro nodes, vLLM integrates natively with Kubernetes and KServe."
          />
        </div>

        {/* Kubernetes / Cloud-Native Orchestrator */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Cluster Orchestration &amp; Model Lifecycle</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'kserve', name: 'KServe (K8s)', desc: 'Cisco IKS / OpenShift' },
              { id: 'ray', name: 'Ray Serve', desc: 'Distributed Pythonic' },
              { id: 'docker', name: 'Docker / Compose', desc: 'Bare-Metal Container' }
            ].map((orch) => (
              <ChoiceCard key={orch.id} selected={orchestrator === orch.id} onClick={() => setOrchestrator(orch.id)}
                title={orch.name} desc={orch.desc} />
            ))}
          </div>
          <InfoHelper
            title="KServe on Enterprise Kubernetes"
            text="KServe provides cloud-native model serving with declarative Custom Resource Definitions (InferenceService). It automates canary deployments, autoscaling (including scale-from-zero via Knative), dynamic ingress routing, and multi-model management."
            whyItMatters="Supported directly on Cisco Intersight Kubernetes Service (IKS) and Red Hat OpenShift, ensuring enterprise governance and multi-tenant security."
          />
        </div>

        {/* Serving Architecture: Colocated vs LLM-D (Disaggregated Prefill-Decode) */}
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Serving Topology: Colocated vs. LLM-D Disaggregation</label>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceCard
              selected={servingArchitecture === 'colocated'}
              onClick={() => setServingArchitecture('colocated')}
              title="Unified (Colocated)"
              badge={<Tag>Standard</Tag>}
              desc="Every GPU handles both Prefill (prompt) and Decode (generation) in the same process."
            />
            <ChoiceCard
              selected={servingArchitecture === 'llmd'}
              onClick={() => setServingArchitecture('llmd')}
              title="LLM-D Disaggregated"
              titleColor="text-sky-400"
              badge={<Tag tone="accent">Next-Gen</Tag>}
              desc={`Decouples Prefill nodes from Decode nodes. Streams KV caches over ${kvFabricName(selectedProtocolId, platform)}.`}
            />
          </div>
          <InfoHelper
            title="What is LLM-D (Disaggregated Prefill & Decode)?"
            text="Prefill and Decode have fundamentally opposing hardware bottlenecks: Prefill is compute-bound (Tensor Core TFLOPs), while Decode is memory-bandwidth bound (HBM TB/s). In traditional colocated serving, an incoming 32k prompt stalls ongoing token generation for all active users (causing severe latency spikes)."
            whyItMatters="LLM-D separates the cluster into dedicated Prefill Workers (e.g. B200 / H200 nodes) and Decode Workers. Once the prompt is processed, the KV cache chunk is transferred via RDMA over the lossless GPU fabric (RoCEv2 or InfiniBand) to decode workers, eliminating jitter and maximizing overall GPU utilization."
          />
        </div>

        {/* LLM-D Disaggregation Configuration Panel */}
        {servingArchitecture === 'llmd' && (
          <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/70">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="font-semibold text-xs text-zinc-200">LLM-D Disaggregation Configuration</span>
              </div>
              <span className="text-[10.5px] font-mono text-zinc-400">vLLM / KServe</span>
            </div>

            {/* Strategy Toggle: Heterogeneous vs Homogeneous */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Hardware Compute Disaggregation Strategy</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ChoiceCard
                  selected={llmdDisaggregationMode === 'heterogeneous'}
                  onClick={() => setLlmdDisaggregationMode('heterogeneous')}
                  title="Heterogeneous Split" titleColor="text-sky-400"
                  badge={<Tag tone="accent">Optimal TCO</Tag>}
                  desc="Asymmetric: Compute-dense GPUs for Prefill (B200/H100) + Memory-dense GPUs for Decode (H200 141GB)."
                />
                <ChoiceCard
                  selected={llmdDisaggregationMode === 'homogeneous'}
                  onClick={() => setLlmdDisaggregationMode('homogeneous')}
                  title="Homogeneous Split"
                  badge={<Tag>Uniform Fleet</Tag>}
                  desc="Symmetric: Both Prefill and Decode pools deploy identical server chassis from the primary platform."
                />
              </div>
            </div>

            {/* Pool sizing: automatic from the workload, or manual node counts */}
            <ToggleRow
              label="Size pools automatically"
              description="Decode: fewest nodes that hold every stream's KV cache. Prefill: enough instances for the prompt arrival rate at the target utilization."
              checked={llmdAutoSize}
              onChange={(v) => {
                if (!v && memory.llmd) { setPrefillNodes(memory.llmd.prefill.nodes); setDecodeNodes(memory.llmd.decode.nodes); }
                setLlmdAutoSize(v);
              }}
            />
            {memory.llmd && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {[
                  { key: 'prefill', label: 'Prefill Workers', icon: Zap, tone: 'text-sky-400', accent: 'accent-sky-500', pool: memory.llmd.prefill, set: setPrefillNodes, value: prefillNodes, note: 'Transient KV only' },
                  { key: 'decode', label: 'Decode Workers', icon: Activity, tone: 'text-emerald-400', accent: 'accent-emerald-500', pool: memory.llmd.decode, set: setDecodeNodes, value: decodeNodes, note: `KV for ${effectiveConcurrency.toLocaleString()} streams` },
                ].map(({ key, label, icon: Icon, tone, accent, pool, set, value, note }) => (
                  <div key={key} className="bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-semibold ${tone} flex items-center gap-1.5`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </span>
                      <span className={`font-mono font-semibold ${tone}`}>
                        {pool.nodes} node{pool.nodes > 1 ? 's' : ''} ({pool.gpus} GPUs)
                      </span>
                    </div>
                    {!llmdAutoSize && (
                      <input
                        type="range" min="1" max={key === 'prefill' ? 32 : 64} step="1" value={value}
                        onChange={(e) => set(Number(e.target.value))}
                        className={`w-full ${accent} bg-zinc-800 h-1.5 rounded-lg cursor-pointer`}
                      />
                    )}
                    <div className="flex justify-between items-center text-[10.5px] text-zinc-400">
                      <span>{pool.instances} instance{pool.instances > 1 ? 's' : ''} × TP={pool.tp}{pool.pp > 1 ? ` PP=${pool.pp}` : ''} on {pool.gpu.name.replace(/^NVIDIA |^AMD /, '')}</span>
                      <span className={pool.isOOM ? 'text-amber-400 font-mono' : 'text-zinc-400 font-mono'}>{pool.isOOM ? 'Out of memory' : note}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {llmdAutoSize && llmdSizing && (
              <div className="px-3 py-2 bg-zinc-900/50 border border-zinc-800/70 rounded-lg text-[11px] text-zinc-400 leading-relaxed">
                Requests arrive at ~{llmdSizing.requestsPerSec.toFixed(2)}/s and each prompt takes ~{llmdSizing.prefillSecPerPrompt.toFixed(2)} s to prefill on one instance, so {llmdSizing.prefillInstancesNeeded} prefill instance{llmdSizing.prefillInstancesNeeded > 1 ? 's are' : ' is'} needed at the target utilization. Prefill : decode nodes = {llmdSizing.prefillNodes} : {llmdSizing.decodeNodes}.
              </div>
            )}

            {/* Heterogeneous Secondary Compute Platform Selector */}
            {llmdDisaggregationMode === 'heterogeneous' && (
              <div className="bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    Secondary Compute Platform (Decode Pool)
                  </span>
                  <span className="text-[10.5px] text-zinc-400">{selectedVendor === 'cisco' ? 'Cisco AI Factory' : selectedVendor === 'amd' ? 'AMD Instinct' : 'NVIDIA DGX'}</span>
                </div>

                <select
                  value={secondaryPlatformId}
                  onChange={(e) => setSecondaryPlatformId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {availablePlatforms.map((p) => {
                    const pGpu = GPU_CATALOG.find(g => g.id === p.gpuId) || GPU_CATALOG[0];
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} — {pGpu.vramGb}GB HBM ({pGpu.memBandwidthTbps || 4.8} TB/s HBM Bandwidth)
                      </option>
                    );
                  })}
                </select>

                <Rows>
                  <Row k="Decode GPU" v={secondaryGpu.name} mono={false} />
                  <Row k="HBM Capacity" v={`${secondaryGpu.vramGb} GB`} tone="good" />
                  <Row k="HBM Bandwidth" v={`${secondaryGpu.memBandwidthTbps || 4.8} TB/s`} tone="good" />
                  <Row k="Chassis Form Factor" v={secondaryPlatform.formFactor} mono={false} />
                </Rows>
              </div>
            )}

            {/* Lossless RoCEv2 KV Cache Network Streaming */}
            {results.bom.kvTransfer && (
              <div className="p-3 bg-zinc-900/60 border border-zinc-800/70 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5" />
                    Lossless RoCEv2 KV Cache Streaming (GPUDirect RDMA)
                  </span>
                  <Tag>{results.bom.kvTransfer.fabricNicSpeed}G Fabric</Tag>
                </div>
                <Rows>
                  <Row k="Prompt KV chunk size" v={`~${results.bom.kvTransfer.promptKvChunkGb} GB`} />
                  <Row k="RoCEv2 line rate" v={results.bom.kvTransfer.fabricNicSpeed === 800 ? '~90 GB/s' : '~45 GB/s'} tone="accent" />
                  <Row k="Network handoff latency" v={`~${results.bom.kvTransfer.kvTransferLatencyMs} ms`} tone="good" />
                </Rows>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Once Prefill finishes processing the prompt, the generated KV tensor chunk streams across the lossless {kvFabricName(selectedProtocolId, platform)} fabric into the Decode worker's VRAM in ~{results.bom.kvTransfer.kvTransferLatencyMs}ms. The Prefill GPU immediately frees all activation memory to accept the next prompt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Advanced Serving Optimizations Checkboxes */}
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-2.5 text-xs">
          <span className="font-semibold text-zinc-200 block">Engine Optimization Flags</span>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={enableChunkedPrefill} onChange={(e) => setEnableChunkedPrefill(e.target.checked)}
              className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded" />
            <div>
              <span className="font-medium text-zinc-200">Chunked Prefill (vLLM / TRT-LLM)</span>
              <span className="block text-[11px] text-zinc-400">Splits large prompts into chunks and batches them alongside ongoing decode steps to prevent generation starvation.</span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={enablePrefixCaching} onChange={(e) => setEnablePrefixCaching(e.target.checked)}
              className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded" />
            <div>
              <span className="font-medium text-zinc-200">Automatic prefix caching</span>
              <span className="block text-[11px] text-zinc-400">Retains common system prompts and RAG contexts in VRAM across queries, bypassing prefill computation for repeated prefixes.</span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={enableSpeculativeDecoding} onChange={(e) => setEnableSpeculativeDecoding(e.target.checked)}
              className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded" />
            <div>
              <span className="font-medium text-zinc-200">Speculative decoding</span>
              <span className="block text-[11px] text-zinc-400">A small drafter proposes several tokens; the target model checks them all in one pass. Helps most at low batch sizes.</span>
            </div>
          </label>
          {enableSpeculativeDecoding && workloadType === 'inference' && (
            <div className="ml-6 space-y-2.5 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Drafter">
                  <select
                    value={specMethod}
                    onChange={(e) => setSpecMethod(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="draft-model">Separate draft model</option>
                    <option value="draft-head">Draft head (EAGLE / MTP)</option>
                  </select>
                </Field>
                {specMethod === 'draft-model' ? (
                  <Field label="Draft model size (B params)">
                    <input
                      type="number" min="0.1" max="16" step="0.1"
                      value={specDraftParamsB}
                      onChange={(e) => setSpecDraftParamsB(Math.max(0.1, Number(e.target.value) || 0.1))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </Field>
                ) : (
                  <div className="text-[10.5px] text-zinc-500 self-end pb-1.5">Head is ~1 decoder layer of the target model; must be trained for that model.</div>
                )}
                <Field label={`Draft tokens per step: ${specNumTokens}`}>
                  <input type="range" min="1" max="8" step="1" value={specNumTokens}
                    onChange={(e) => setSpecNumTokens(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer" />
                </Field>
                <Field label={`Acceptance rate: ${Math.round(specAcceptanceRate * 100)}%`}>
                  <input type="range" min="0.3" max="0.95" step="0.05" value={specAcceptanceRate}
                    onChange={(e) => setSpecAcceptanceRate(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer" />
                </Field>
              </div>
              {throughput?.speculative && (
                <div className={`text-[11px] ${throughput.speculative.helps ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {throughput.speculative.helps
                    ? `~${throughput.speculative.expectedTokensPerStep.toFixed(1)} tokens accepted per step: time per output token ${throughput.speculative.tpotWithoutMs} → ${throughput.tpotMs} ms (${throughput.speculative.speedup.toFixed(2)}x).`
                    : `No gain at this batch size (${throughput.speculative.speedup.toFixed(2)}x): decode is compute-bound, so verifying extra tokens costs more than it saves. Engines turn speculation off here, and the sizing ignores it.`}
                </div>
              )}
              <div className="text-[10.5px] text-zinc-500">
                Acceptance depends on how well the drafter matches the target and on the content: 0.5-0.7 is typical for a separate small model, 0.7-0.85 for a trained draft head, higher on repetitive code or JSON.
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
