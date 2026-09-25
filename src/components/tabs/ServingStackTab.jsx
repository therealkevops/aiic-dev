import React from 'react';
import { Activity, Layers, Network, Server, Workflow, Zap } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, ChoiceCard, Row, Rows, Tag } from '../ui';
import { GPU_CATALOG } from '../../data/hardware';
import { kvFabricName } from '../../utils/calculator';

export function ServingStackTab({ ctx }) {
  const {
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

            {/* Dual Node Allocation: Prefill Nodes & Decode Nodes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Prefill Workers
                  </span>
                  <span className="font-mono font-semibold text-sky-400">
                    {prefillNodes} Node{prefillNodes > 1 ? 's' : ''} ({prefillNodes * platform.gpusPerChassis}x GPUs)
                  </span>
                </div>
                <input
                  type="range" min="1" max="4" step="1" value={prefillNodes}
                  onChange={(e) => setPrefillNodes(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10.5px] text-zinc-400">
                  <span>Platform: {platform.shortName}</span>
                  <span className="text-sky-300 font-mono">0 KV Retained</span>
                </div>
              </div>

              <div className="bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Decode Workers
                  </span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {decodeNodes} Node{decodeNodes > 1 ? 's' : ''} ({decodeNodes * (llmdDisaggregationMode === 'heterogeneous' ? secondaryPlatform.gpusPerChassis : platform.gpusPerChassis)}x GPUs)
                  </span>
                </div>
                <input
                  type="range" min="1" max="8" step="1" value={decodeNodes}
                  onChange={(e) => setDecodeNodes(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10.5px] text-zinc-400">
                  <span>Platform: {llmdDisaggregationMode === 'heterogeneous' ? secondaryPlatform.shortName : platform.shortName}</span>
                  <span className="text-emerald-300 font-mono">KV Bound ({effectiveConcurrency} streams)</span>
                </div>
              </div>
            </div>

            {/* Disaggregation Ratio & Guidance */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 border border-zinc-800/70 rounded-lg text-[11px]">
              <div className="text-zinc-300">
                Prefill-to-Decode Ratio: <strong className="font-mono">{prefillNodes}P : {decodeNodes}D</strong> (1:{(decodeNodes / prefillNodes).toFixed(1)})
              </div>
              <span className="text-amber-400 font-medium">
                {decodeNodes >= prefillNodes * 2 ? 'High-throughput sizing' : 'Recommend 1:2–1:4 for long context'}
              </span>
            </div>

            {/* Heterogeneous Secondary Compute Platform Selector */}
            {llmdDisaggregationMode === 'heterogeneous' && (
              <div className="bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    Secondary Compute Platform (Decode Pool)
                  </span>
                  <span className="text-[10.5px] text-zinc-400">{selectedVendor === 'cisco' ? 'Cisco AI Factory' : 'NVIDIA DGX'}</span>
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
              <span className="font-medium text-zinc-200">Speculative Decoding (Draft Model Acceleration)</span>
              <span className="block text-[11px] text-zinc-400">Pairs a lightweight draft model (e.g. LLaMA 8B) with the target model (LLaMA 70B) to verify multiple candidate tokens per memory read pass.</span>
            </div>
          </label>
        </div>
      </Card>
    </>
  );
}
