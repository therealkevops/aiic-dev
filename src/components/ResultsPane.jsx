import React from 'react';
import { Activity, AlertTriangle, BookOpen, Boxes, Check, CheckCircle2, Copy, Database, DollarSign, Gauge, GitBranch, Globe, Grid2x2, HardDrive, LifeBuoy, Network, Search, Server, Shield, Timer, Zap } from 'lucide-react';
import { TopologyDiagram } from './TopologyDiagram';
import { Banner, Card, Disclosure, Kpi, KpiRow, Meter, Row, Rows, SectionLabel, Tag } from './ui';

export function ResultsPane({ ctx }) {
  const {
    warnings, tokenEconomics,
    bom, concurrency, contextLength, copiedBOM, cost, dp,
    embeddingGpu, facility, gpu, guardGpu, guardModel, guardrails,
    haDr, haDrTier, handleCopyBOM, ingress, ingressTier, isLlmd,
    kvPrecision, memory, mig, mlops, mlopsStrategy, network,
    orchestrator, platform, prefixCacheRatio, promptTokenRatio, protocol, pue,
    rag, results, servingArchitecture, servingEngine, setPage, sla,
    storage, throughput, trainingRedundancy, workloadType,
  } = ctx;
  return (
    <aside data-testid="results-pane" className="w-[44%] xl:w-[42%] min-w-[420px] max-w-[760px] shrink-0 overflow-y-auto p-4 md:p-6 bg-zinc-900/30 space-y-4">

      {/* Status Banner */}
      {isLlmd ? (
        <Banner
          tone={memory.isOOM ? 'warn' : ((memory.llmd.prefill.headroomGb < 10 || memory.llmd.decode.headroomGb < 10) ? 'warn' : 'good')}
          icon={memory.isOOM ? AlertTriangle : CheckCircle2}
          title={
            memory.isOOM
              ? (memory.llmd.prefill.isOOM && memory.llmd.decode.isOOM
                  ? 'Out of memory: both Prefill & Decode pools exceed GPU VRAM'
                  : memory.llmd.prefill.isOOM
                  ? `Out of memory: Prefill pool exceeds VRAM on ${memory.llmd.prefill.gpu.name}`
                  : `Out of memory: Decode pool exceeds VRAM on ${memory.llmd.decode.gpu.name}`)
              : 'LLM-D disaggregated architecture verified (dual-pool sizing)'
          }
        >
          {memory.isOOM ? (
            <div className="space-y-1">
              {results.recommendations.map((rec, i) => <div key={i}>Fix: {rec}</div>)}
            </div>
          ) : (
            <Rows>
              <Row k={`Prefill pool (${memory.llmd.prefill.nodes}x ${memory.llmd.prefill.platform.shortName})`}
                v={`${memory.llmd.prefill.totalUsedGb.toFixed(1)} / ${memory.llmd.prefill.gpu.vramGb} GB (${memory.llmd.prefill.utilization}%) · ${memory.llmd.prefill.headroomGb.toFixed(1)} GB free`} />
              <Row k={`Decode pool (${memory.llmd.decode.nodes}x ${memory.llmd.decode.platform.shortName})`}
                v={`${memory.llmd.decode.totalUsedGb.toFixed(1)} / ${memory.llmd.decode.gpu.vramGb} GB (${memory.llmd.decode.utilization}%) · ${memory.llmd.decode.headroomGb.toFixed(1)} GB free`} />
              <Row k="Lossless RoCEv2 KV streaming" v={`~${memory.llmd.kvTransfer.promptKvChunkGb} GB in ~${memory.llmd.kvTransfer.kvTransferLatencyMs} ms`} />
            </Rows>
          )}
        </Banner>
      ) : (
        <Banner
          tone={memory.isOOM ? 'warn' : (memory.headroomGb < 10 ? 'warn' : 'good')}
          icon={memory.isOOM ? AlertTriangle : CheckCircle2}
          title={
            memory.isOOM
              ? `Out of memory: workload exceeds usable VRAM by ${(memory.perGpuTotalUsedGb - memory.usableGpuCapacityGb).toFixed(1)} GB per GPU`
              : `Hardware verified: fits with ${memory.headroomGb.toFixed(1)} GB headroom per GPU`
          }
        >
          {memory.isOOM ? (
            <div className="space-y-1">
              {results.recommendations.map((rec, i) => <div key={i}>Fix: {rec}</div>)}
            </div>
          ) : (
            <span>
              Each GPU uses <strong>{memory.perGpuTotalUsedGb.toFixed(1)} GB</strong> ({memory.memoryUtilizationPercent}%) of <strong>{gpu.vramGb} GB</strong> on <strong>{platform.name}</strong>.
            </span>
          )}
        </Banner>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 && !memory.isOOM && (
        <Banner tone="warn" icon={AlertTriangle} title="Architecture sizing notice">
          <ul className="list-disc list-inside space-y-1">
            {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
          </ul>
        </Banner>
      )}

      {/* VRAM Allocation */}
      {isLlmd ? (
        <Card icon={HardDrive} title="Disaggregated VRAM breakdown"
          right={<Tag tone={memory.llmd.isHeterogeneous ? 'warn' : 'neutral'}>{memory.llmd.isHeterogeneous ? 'Heterogeneous' : 'Homogeneous'}</Tag>}
          className="space-y-4">
          <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/70">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Decode pool</span>
              <span className="font-mono text-zinc-400">{memory.llmd.decode.gpu.name} ({memory.llmd.decode.gpu.vramGb} GB)</span>
            </div>
            <Meter capacity={memory.llmd.decode.gpu.vramGb} segments={[
              { label: 'Weights', value: memory.llmd.decode.weightsGb, display: `${memory.llmd.decode.weightsGb.toFixed(1)} GB`, color: 'bg-sky-500' },
              { label: 'KV Cache', value: memory.llmd.decode.kvGb, display: `${memory.llmd.decode.kvGb.toFixed(1)} GB`, color: 'bg-sky-700' },
              { label: 'Activations', value: memory.llmd.decode.actGb, display: `${memory.llmd.decode.actGb.toFixed(1)} GB`, color: 'bg-zinc-600' },
              { label: 'Free', value: Math.max(0, memory.llmd.decode.headroomGb), display: `${Math.max(0, memory.llmd.decode.headroomGb).toFixed(1)} GB`, color: 'bg-zinc-800' },
            ]} />
          </div>
          <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/70">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />Prefill pool</span>
              <span className="font-mono text-zinc-400">{memory.llmd.prefill.gpu.name} ({memory.llmd.prefill.gpu.vramGb} GB)</span>
            </div>
            <Meter capacity={memory.llmd.prefill.gpu.vramGb} segments={[
              { label: 'Weights', value: memory.llmd.prefill.weightsGb, display: `${memory.llmd.prefill.weightsGb.toFixed(1)} GB`, color: 'bg-sky-500' },
              { label: 'Prompt activations', value: memory.llmd.prefill.actGb, display: `${memory.llmd.prefill.actGb.toFixed(1)} GB`, color: 'bg-zinc-600' },
              { label: 'Free', value: Math.max(0, memory.llmd.prefill.headroomGb), display: `${Math.max(0, memory.llmd.prefill.headroomGb).toFixed(1)} GB`, color: 'bg-zinc-800' },
            ]} />
            <div className="text-[11px] text-sky-400 mt-1.5">KV cache: 0 GB retained — streamed to Decode via RDMA</div>
          </div>
        </Card>
      ) : (
        <Card icon={HardDrive} title="VRAM allocation · per GPU" right={<span className="text-zinc-400 font-mono">{gpu.name} ({gpu.vramGb} GB)</span>} className="space-y-3">
          <Meter capacity={gpu.vramGb} segments={[
            { label: 'Weights', value: memory.perGpuWeightsGb, display: `${memory.perGpuWeightsGb.toFixed(1)} GB`, color: 'bg-sky-500' },
            { label: workloadType === 'inference' ? 'KV Cache' : 'Optimizer', value: memory.perGpuKvOrOptGb, display: `${memory.perGpuKvOrOptGb.toFixed(1)} GB`, color: 'bg-sky-700' },
            { label: 'Activations', value: memory.perGpuActGb, display: `${memory.perGpuActGb.toFixed(1)} GB`, color: 'bg-zinc-600' },
            { label: 'Free', value: Math.max(0, memory.headroomGb), display: `${Math.max(0, memory.headroomGb).toFixed(1)} GB`, color: 'bg-zinc-800' },
          ]} />
          {workloadType === 'inference' && memory.kvSavingsGb > 0 && (
            <div className="pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11.5px]">
              <span className="text-zinc-400">
                KV precision: <strong className="text-sky-400">{kvPrecision.toUpperCase()}</strong>{prefixCacheRatio > 0 ? ` · ${(prefixCacheRatio * 100).toFixed(0)}% prefix sharing` : ''}
              </span>
              <span className="text-emerald-400 font-mono font-medium">Saving {(memory.kvCacheTotalGb > 0 ? memory.kvSavingsGb * memory.perGpuKvOrOptGb / memory.kvCacheTotalGb : 0).toFixed(1)} GB/GPU vs FP16, no sharing</span>
            </div>
          )}
        </Card>
      )}

      {/* Inference Performance Profile (Prefill & Decode) */}
      {workloadType === 'inference' && throughput && (
        <Card icon={Gauge} title="Inference performance profile"
          right={<span className="font-mono text-zinc-400">{throughput.batchThroughputTps?.toLocaleString()} gen tok/s · {throughput.clusterBatchPromptTps?.toLocaleString()} prompt tok/s</span>}
          className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/70">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">Prefill · compute-bound</div>
              <div className="text-sm font-semibold text-zinc-100 mb-2">Time to first token</div>
              <div className="text-2xl font-semibold font-mono text-sky-400">
                {throughput.ttftMs < 1000 ? throughput.ttftMs.toFixed(2) : throughput.ttftSec.toFixed(2)}
                <span className="text-xs text-zinc-500 ml-1 font-sans">{throughput.ttftMs < 1000 ? 'ms' : 's'}</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">at {contextLength.toLocaleString()} tokens · ~{throughput.promptTokensPerSecPerReplica?.toLocaleString()} tok/s ingestion</div>
              <div className="text-[11px] text-zinc-400 leading-relaxed mt-2.5 pt-2.5 border-t border-zinc-800/70">
                {prefixCacheRatio > 0 ? (
                  <span><strong className="text-zinc-300">{(prefixCacheRatio * 100).toFixed(0)}% prefix cached:</strong> evaluates {Math.max(1, Math.round(contextLength * (1 - (promptTokenRatio * prefixCacheRatio)))).toLocaleString()} uncached tokens ({throughput.promptPflops} PFLOPs) on {gpu.name}'s {throughput.gpuTflops?.toLocaleString()} TFLOPs engine.</span>
                ) : (
                  <span>Evaluates all {contextLength.toLocaleString()} prompt tokens in parallel ({throughput.promptPflops} PFLOPs) on {gpu.name}'s {throughput.gpuTflops?.toLocaleString()} TFLOPs engine at 50% MFU.</span>
                )}
              </div>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/70">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 mb-0.5">Decode · bandwidth-bound</div>
              <div className="text-sm font-semibold text-zinc-100 mb-2">Time per output token</div>
              <div className="text-2xl font-semibold font-mono text-emerald-400">
                {throughput.tpotMs}<span className="text-xs text-zinc-500 ml-1 font-sans">ms</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">~{throughput.tokensPerSecPerGpu} tok/s/stream · ~{throughput.batchThroughputTps?.toLocaleString()} tok/s cluster (×{dp} DP × {concurrency})</div>
              <div className="text-[11px] text-zinc-400 leading-relaxed mt-2.5 pt-2.5 border-t border-zinc-800/70">
                {throughput.decodeNote || throughput.note}. Reads weights every step across {gpu.memBandwidthTbps} TB/s HBM.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Datacenter Bill of Materials */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <SectionLabel>Datacenter Bill of Materials</SectionLabel>
          <button
            type="button"
            onClick={handleCopyBOM}
            className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedBOM ? (<><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>) : (<><Copy className="w-3.5 h-3.5 text-zinc-400" /><span>Copy BOM</span></>)}
          </button>
        </div>

        <div className="space-y-2">
          <Disclosure icon={Server} title="Compute & accelerators" defaultOpen
            right={bom.isDisaggregated ? `${bom.chassisCount} chassis (${bom.prefill.nodes}P + ${bom.decode.nodes}D)` : `${bom.totalGpus} GPUs`}>
            {bom.isDisaggregated ? (
              <Rows>
                <Row k="Prefill pool" v={`${bom.prefill.nodes}x ${bom.prefill.shortName} (${bom.prefill.gpuCount}x ${bom.prefill.gpuName})`} />
                <Row k="Decode pool" v={`${bom.decode.nodes}x ${bom.decode.shortName} (${bom.decode.gpuCount}x ${bom.decode.gpuName})`} />
                <Row k="Total accelerators" v={`${bom.totalGpus} GPUs (${bom.aggregateVramTb} TB active)`} tone="accent" />
                <Row k="RoCEv2 KV streaming" v={`~${bom.kvTransfer.promptKvChunkGb} GB (~${bom.kvTransfer.kvTransferLatencyMs} ms)`} />
                <Row k="Host processors" v={bom.hostCpu} mono={false} />
                <Row k="System memory" v={bom.systemRam} mono={false} />
              </Rows>
            ) : (
              <Rows>
                <Row k="System model" v={bom.platformName} mono={false} />
                <Row k="Architecture" v={bom.chassisFormFactor} mono={false} />
                {platform.id?.includes('smci') && <Row k="Solution tier" v="Cisco Secure AI Factory (Supermicro + Nexus)" mono={false} tone="warn" />}
                {bom.isModular && bom.fabricInterconnectModel && <Row k="Fabric interconnects" v={bom.fabricInterconnectModel} mono={false} tone="good" />}
                <Row k="Total accelerators" v={`${bom.totalGpus}x ${gpu.name} (${bom.aggregateVramTb} TB active)`} tone="accent" />
                {bom.gpusAllocated > bom.totalGpus && (
                  <Row k="Physically installed" v={`${bom.gpusAllocated}x ${gpu.name} (${bom.physicalVramTb} TB total)`} />
                )}
                <Row k="Host processors" v={bom.hostCpu} mono={false} />
                <Row k="System memory" v={bom.systemRam} mono={false} />
                <Row k="Host I/O & NICs" v={bom.hostNicsDesc} mono={false} />
              </Rows>
            )}
          </Disclosure>

          <Disclosure icon={Network} title="Lossless scale-out fabric" right={`${network.effectiveBisectionTbps.toFixed(1)} Tbps`}>
            <Rows>
              <Row k="Leaf switches" v={`${bom.leafSwitchCount}x ${bom.leafSwitchModel}`} mono={false} />
              <Row k="Spine switches" v={bom.spineSwitchCount > 0 ? `${bom.spineSwitchCount}x ${bom.spineSwitchModel}` : 'None (single node)'} mono={false} />
              <Row k="Topology" v={network.topology} mono={false} />
              <Row k="Lossless protocol" v={network.protocol === 'rocev2' ? 'RoCEv2 (PFC 802.1Qbb + ECN)' : 'Quantum-2 credit-based control'} tone="accent" mono={false} />
              <Row k="Fabric cabling" v={`${bom.fabricCablesCount}x ${bom.fabricCablesType}`} mono={false} />
            </Rows>
          </Disclosure>

          <Disclosure icon={Boxes} title="Network storage, management & serving stack">
            <Rows>
              <Row k="Storage leaf switch" v={`${bom.storageSwitchCount}x ${bom.storageSwitchModel}`} mono={false} />
              <Row k="OOB management switch" v={`${bom.oobSwitchCount}x ${bom.oobSwitchModel}`} mono={false} />
              <Row k="Serving runtime" v={`${servingEngine.toUpperCase()} on ${orchestrator.toUpperCase()}${servingArchitecture === 'llmd' ? ' (LLM-D)' : ''}`} tone="accent" />
              <Row k="Management suite" v={platform.managementSuite} mono={false} />
            </Rows>
          </Disclosure>

          <Disclosure icon={Database} title="Data platform & storage" right={storage.fits ? 'Sized to fit' : 'Undersized'}>
            <Rows>
              <Row k="Storage platform" v={`${storage.provisionedRu}x RU ${storage.storageTier.vendor} ${storage.storageTier.name}`} mono={false} />
              <Row k="Protocol" v={storage.storageTier.protocol} mono={false} />
              <Row k="Durability scheme" v={`${storage.durabilityScheme?.label || 'None (RF 1x)'}`} mono={false} />
              <Row k="Usable capacity needed" v={`${storage.requiredCapacityTb.toFixed(2)} TB`} tone="accent" />
              <Row k="Raw capacity to provision" v={`${storage.requiredRawCapacityTb.toFixed(2)} TB (${storage.replicationFactor.toFixed(2)}x)`} tone="accent" />
              <Row k="Required throughput" v={`${storage.requiredThroughputGBs.toFixed(2)} GB/s`} tone="accent" />
              <Row k="Achieved (raw / usable)" v={`${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedUsableCapacityTb.toFixed(0)} TB`} tone={storage.fits ? 'good' : 'warn'} />
              {storage.breakdown.map((b, i) => (
                <Row key={i} k={b.label} v={`${b.capacityTb.toFixed(2)} TB — ${b.note}`} mono={false} />
              ))}
            </Rows>
          </Disclosure>

          {rag.eligible && (
            <Disclosure icon={Search} title="RAG pipeline (embedding + vector database)" right={`${rag.vectorDbNodesNeeded} DB nodes`}>
              <Rows>
                <Row k="Embedding model" v={rag.embeddingModel.name} tone="accent" />
                <Row k="Vector count (chunks)" v={rag.numChunks.toLocaleString()} mono={false} />
                <Row k="Embedding GPUs provisioned" v={`${rag.embeddingGpusNeeded}x ${embeddingGpu.name}`} tone="good" />
                <Row k="Vector database" v={`${rag.vectorDbNodesNeeded}x ${rag.vectorDbPlatform.name} (${rag.bindingConstraint}-bound)`} tone="good" />
                <Row k="RAG capex / IT power" v={`$${Math.round(rag.ragComputeCapexUsd).toLocaleString()} / ${rag.ragItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {guardrails.eligible && (
            <Disclosure icon={Shield} title="Guardrails (input/output safety classifier)" right={`${guardrails.guardGpusNeeded}x ${guardModel.name}`}>
              <Rows>
                <Row k="Guard model" v={guardrails.guardModel.name} tone="accent" />
                <Row k="Guards enabled" v={[guardrails.enableInputGuard ? 'Input' : null, guardrails.enableOutputGuard ? 'Output' : null].filter(Boolean).join(' + ')} mono={false} />
                <Row k="Guard GPUs provisioned" v={`${guardrails.guardGpusNeeded}x ${guardGpu.name}`} tone="good" />
                <Row k="Added latency (TTFT / total)" v={`${(guardrails.addedTtftSec * 1000).toFixed(0)} ms / ${(guardrails.addedTotalLatencySec * 1000).toFixed(0)} ms`} mono={false} />
                <Row k="Guardrails capex / IT power" v={`$${Math.round(guardrails.guardrailsComputeCapexUsd).toLocaleString()} / ${guardrails.guardrailsItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {ingress.eligible && (
            <Disclosure icon={Globe} title="Ingress & edge (load balancing + egress bandwidth)" right={`${ingress.nodesNeeded}x ${ingressTier.name}`}>
              <Rows>
                <Row k="Ingress tier" v={`${ingressTier.vendor} — ${ingressTier.name}`} tone="accent" />
                <Row k="Ingress nodes provisioned" v={`${ingress.nodesNeeded}x ${ingressTier.name}`} tone="good" />
                <Row k="Added latency" v={`+${ingress.addedLatencyMs} ms`} mono={false} />
                <Row k="Annual egress bandwidth" v={`${Math.round(ingress.annualEgressGb).toLocaleString()} GB/yr ($${Math.round(ingress.annualEgressCostUsd).toLocaleString()}/yr)`} mono={false} />
                <Row k="Ingress capex / annual opex" v={`$${Math.round(ingress.ingressComputeCapexUsd).toLocaleString()} / $${Math.round(ingress.ingressAnnualOpexUsd).toLocaleString()}/yr`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {haDr.eligible && (
            <Disclosure icon={LifeBuoy} title="HA/DR (incremental resilience capacity)" right={haDrTier.name}>
              <Rows>
                <Row k="HA/DR tier" v={`${haDrTier.name} (${haDrTier.scope})`} tone="accent" />
                <Row k="RTO / RPO" v={`${haDrTier.rtoDescription} / ${haDrTier.rpoDescription}`} tone="accent" />
                <Row k="Incremental compute + storage capex" v={`$${Math.round(haDr.haDrComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="HA/DR IT power draw" v={`${haDr.haDrItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {mlops.eligible && (
            <Disclosure icon={GitBranch} title="MLOps lifecycle (model rollout validation pool)" right={mlopsStrategy.name}>
              <Rows>
                <Row k="Rollout strategy" v={`${mlopsStrategy.name} (${mlopsStrategy.scope})`} tone="accent" />
                <Row k="Rollback speed" v={mlopsStrategy.rollbackSpeed} tone="accent" />
                <Row k="Validation pool GPUs" v={`${mlops.validationGpuCount} (of ${mlops.baseGpuCount} primary)`} mono={false} />
                <Row k="MLOps capex" v={`$${Math.round(mlops.mlopsComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="MLOps IT power draw" v={`${mlops.mlopsItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {trainingRedundancy.eligible && (
            <Disclosure icon={LifeBuoy} title="Training spare node capacity" right={`${trainingRedundancy.spareNodeCount} spare node${trainingRedundancy.spareNodeCount === 1 ? '' : 's'}`}>
              <Rows>
                <Row k="Spare node capacity" v={`${trainingRedundancy.spareNodePct}% of ${trainingRedundancy.baseNodes} primary cluster nodes`} tone="accent" />
                <Row k="Spare nodes / GPUs" v={`${trainingRedundancy.spareNodeCount} / ${trainingRedundancy.spareGpuCount}`} mono={false} />
                <Row k="Spare node capex" v={`$${Math.round(trainingRedundancy.spareComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="Spare node IT power draw" v={`${trainingRedundancy.spareItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          <Disclosure icon={Zap} title="Power & facility footprint" right={`${facility.totalItPowerKw.toFixed(1)} kW IT`}>
            <KpiRow>
              <Kpi label="IT power load" value={`${facility.totalItPowerKw.toFixed(1)} kW`} tone="warn" />
              <Kpi label="Facility power" value={`${facility.totalFacilityPowerKw.toFixed(1)} kW`} sub={`${pue.toFixed(2)} PUE`} tone="warn" />
              <Kpi label="Racks" value={`~${facility.totalRacks}`} sub="42U standard" />
              <Kpi label="Rack units" value={`${facility.totalRuNeeded}`} sub="servers + switches" />
            </KpiRow>
          </Disclosure>

          {mig.eligible && (
            <Disclosure icon={Grid2x2} title="MIG partitioning" right={`${mig.gpuCountSavings} GPUs saved`}>
              <Rows>
                <Row k="Selected profile" v={`${mig.selectedProfile.id} (${mig.instancesPerPhysicalGpu}x per physical GPU)`} tone="accent" />
                <Row k="Naive dedicated GPUs" v={`${mig.naiveGpuCount}`} mono={false} />
                <Row k="MIG-consolidated physical GPUs" v={`${mig.physicalGpusNeeded}`} tone="good" />
                <Row k="Physical nodes needed" v={`${mig.physicalNodesNeeded}`} mono={false} />
                <Row k="Per-instance throughput" v={`~${(mig.throughputScaleFactor * 100).toFixed(0)}% of a whole GPU's rate`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          {sla.eligible && (
            <Disclosure icon={Timer} title="SLA & tail latency (M/M/c queueing)" right={`P99 ${sla.ttftP99Sec < 1 ? `${(sla.ttftP99Sec * 1000).toFixed(0)}ms` : `${sla.ttftP99Sec.toFixed(1)}s`}`}>
              <Rows>
                <Row k="Target utilization (ρ)" v={`${(sla.targetUtilization * 100).toFixed(0)}%${sla.wasClamped ? ' (clamped)' : ''}`} tone="accent" />
                <Row k="Concurrency per replica" v={`${sla.concurrencyPerReplica}`} mono={false} />
                <Row k="P(request queues)" v={`${(sla.probabilityOfQueueing * 100).toFixed(1)}%`} mono={false} />
                <Row k="Mean queueing delay" v={`${(sla.meanWaitSec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="TTFT P50 / P95 / P99" v={`${(sla.ttftP50Sec * 1000).toFixed(0)} / ${(sla.ttftP95Sec * 1000).toFixed(0)} / ${sla.ttftP99Sec < 1 ? `${(sla.ttftP99Sec * 1000).toFixed(0)}ms` : `${sla.ttftP99Sec.toFixed(2)}s`}`} tone={sla.highUtilizationWarning ? 'warn' : 'good'} />
                <Row k="Total response P50 / P95 / P99" v={`${(sla.totalResponseP50Sec * 1000).toFixed(0)} / ${(sla.totalResponseP95Sec * 1000).toFixed(0)} / ${sla.totalResponseP99Sec < 1 ? `${(sla.totalResponseP99Sec * 1000).toFixed(0)}ms` : `${sla.totalResponseP99Sec.toFixed(2)}s`}`} mono={false} />
              </Rows>
            </Disclosure>
          )}

          <Disclosure icon={DollarSign} title="Cost & TCO (illustrative estimate)" right={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`}>
            <Rows>
              <Row k="Total capex" v={`$${Math.round(cost.totalCapexUsd).toLocaleString()}`} tone="accent" />
              <Row k="Annual opex" v={`$${Math.round(cost.annualOpexUsd).toLocaleString()}/yr`} mono={false} />
              <Row k={`${cost.tcoYears}-year TCO`} v={`$${Math.round(cost.tcoUsd).toLocaleString()}`} tone="accent" />
              <Row k="Effective cost" v={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`} tone="accent" />
              {tokenEconomics.eligible && (
                <Row k={`Per 1M output tokens (${tokenEconomics.dutyCyclePct.toFixed(0)}% utilization)`} v={`$${tokenEconomics.costPer1MOutputTokensUsd.toFixed(2)} serving · $${tokenEconomics.fullyLoadedCostPer1MOutputTokensUsd.toFixed(2)} fully loaded`} />
              )}
              <Row
                k={`vs. ${cost.tcoYears}-yr cloud rental`}
                v={cost.buildVsBuySavingsUsd >= 0 ? `Owning saves $${Math.round(cost.buildVsBuySavingsUsd).toLocaleString()}` : `Cloud saves $${Math.round(-cost.buildVsBuySavingsUsd).toLocaleString()}`}
                tone={cost.buildVsBuySavingsUsd >= 0 ? 'good' : 'warn'}
              />
              <Row
                k="Capex break-even vs. cloud"
                v={cost.breakEvenMonths != null ? `~${Math.round(cost.breakEvenMonths)} months` : 'Never — cloud is cheaper'}
                mono={false}
              />
            </Rows>
          </Disclosure>
        </div>
      </div>

      {/* Visual Physical Topology Diagram Component */}
      <TopologyDiagram key={platform.id} results={results} gpu={gpu} platform={platform} protocol={protocol} />

      {/* Link out to the standalone architectural decision guide & glossary */}
      <button
        type="button"
        onClick={() => setPage('glossary')}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[12.5px] text-zinc-300">
          <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
          Architectural decision guide &amp; glossary
        </span>
        <span className="text-sky-400 text-[12.5px] shrink-0">Open →</span>
      </button>

      <div className="text-center text-[10.5px] text-zinc-500 pt-2 pb-1">
        Private AI Infrastructure Sizing Calculator · Cisco &amp; NVIDIA Datacenter Platforms
      </div>

    </aside>
  );
}
