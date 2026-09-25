// Plain-text bill of materials for the current scenario (Copy BOM button, reports).
export function buildBomText(ctx) {
  const {
    bom, canaryTrafficPct, concurrency, contextLength, cost, dp,
    effectiveConcurrency, embeddingGpu, enableChunkedPrefill, enablePrefixCaching, facility, gpu,
    guardGpu, guardrails, haDr, haDrTier, ingress, ingressTier,
    isLlmd, mlops, mlopsStrategy, network, orchestrator, platform,
    pue, rag, selectedVendor, servingArchitecture, servingEngine, sla,
    storage, throughput, trainingRedundancy, workloadType,
  } = ctx;
  const isDisagg = bom.isDisaggregated;
  return `=====================================================
AI INFRASTRUCTURE DATACENTER BILL OF MATERIALS (DC BOM)
${isDisagg ? `Serving Architecture: LLM-D Disaggregated (${bom.isHeterogeneous ? 'Heterogeneous Split' : 'Homogeneous Split'})
Prefill Platform: ${bom.prefill.platformName}
Decode Platform: ${bom.decode.platformName}` : `Platform: ${platform.name}`}
Vendor: ${selectedVendor === 'cisco' ? (platform.id?.includes('smci') ? 'Cisco Secure AI Factory (Supermicro Compute + Nexus Fabric)' : 'Cisco UCS & Nexus AI Fabric') : 'NVIDIA DGX SuperPOD'}
=====================================================

1. COMPUTE CLUSTER
${isDisagg ? `- Prefill Compute Pool: ${bom.prefill.nodes}x ${bom.prefill.platformName} (${bom.prefill.gpuCount}x ${bom.prefill.gpuName})
  * Role: Prompt Ingestion / Compute-Dense Phase (0 retained KV cache)
  * Power & Footprint: ${bom.prefill.totalPowerKw.toFixed(1)} kW, ${bom.prefill.ru} RU
- Decode Compute Pool: ${bom.decode.nodes}x ${bom.decode.platformName} (${bom.decode.gpuCount}x ${bom.decode.gpuName})
  * Role: Token Generation / Pooled KV Cache Phase (${effectiveConcurrency} concurrent streams)
  * Power & Footprint: ${bom.decode.totalPowerKw.toFixed(1)} kW, ${bom.decode.ru} RU
- Total Cluster Accelerators: ${bom.totalGpus} GPUs (${bom.aggregateVramTb} TB HBM active, ${bom.physicalVramTb} TB physical)
- Lossless RoCEv2 KV Cache Streaming: ~${bom.kvTransfer.promptKvChunkGb} GB per prompt @ ${bom.kvTransfer.fabricNicSpeed}G line rate (~${bom.kvTransfer.kvTransferLatencyMs} ms handoff)` : `- Server System: ${bom.platformName}
- Architecture: ${bom.chassisFormFactor}
${bom.isModular && bom.fabricInterconnectModel ? `- Fabric Interconnects: ${bom.fabricInterconnectModel}\n` : ''}- Accelerators: ${bom.totalGpus}x ${gpu.name} (${bom.aggregateVramTb} TB HBM active, ${bom.physicalVramTb} TB physical)
${bom.activeParamsNote ? `- MoE Active Params: ${bom.activeParamsNote}\n` : ''}- Host Processors: ${platform.hostCpu}
- System Memory: ${platform.systemRam}
- Host NICs: ${platform.hostNics}`}

2. LOSSLESS COMPUTE FABRIC
- Leaf Switches: ${bom.leafSwitchCount}x ${bom.leafSwitchModel}
- Spine Switches: ${bom.spineSwitchCount}x ${bom.spineSwitchModel}
- Topology: ${network.topology}
- Effective Bisection Bandwidth: ${network.effectiveBisectionTbps.toFixed(1)} Tbps${network.effectiveOversubscriptionRatio > 1 ? ` (derated ${network.effectiveOversubscriptionRatio.toFixed(0)}:1 from ${network.totalClusterBisectionTbps.toFixed(1)} Tbps raw NIC-aggregate)` : ` (${network.nicSpeedGbps}G × ${network.totalComputeNics} NICs, 1:1 non-blocking)`}
- NIC Speed: ${network.nicSpeedGbps}G per GPU (${network.nicSpeedGbps === 800 ? '800G ConnectX-8 Blackwell-class' : '400G ConnectX-7 Hopper-class'})
- Lossless Protocol: ${network.protocol === 'rocev2' ? 'Lossless RoCEv2 (PFC 802.1Qbb + ECN)' : 'NVIDIA Quantum-2 Credit-Based Flow Control'}
- Compute Cabling: ${bom.fabricCablesCount}x ${bom.fabricCablesType}

3. STORAGE & OUT-OF-BAND (OOB) NETWORK
- Storage Leaf Switches: ${bom.storageSwitchCount}x ${bom.storageSwitchModel}
- OOB Management Switches: ${bom.oobSwitchCount}x ${bom.oobSwitchModel}
- Storage/Mgmt Cabling: ${bom.storageCablesCount}x 100G/1G Cables

4. DATA PLATFORM & STORAGE (${storage.fits ? 'Sized to fit' : 'UNDERSIZED — increase RU or pick a faster tier'})
- Storage Platform: ${storage.provisionedRu}x RU ${storage.storageTier.vendor} ${storage.storageTier.name}
- Protocol: ${storage.storageTier.protocol}
- Durability Scheme: ${storage.durabilityScheme?.label || 'None (RF 1x)'}
- Usable Capacity Needed: ${storage.requiredCapacityTb.toFixed(2)} TB
- Raw Capacity to Provision: ${storage.requiredRawCapacityTb.toFixed(2)} TB (${storage.replicationFactor.toFixed(2)}x)
- Required Throughput: ${storage.requiredThroughputGBs.toFixed(2)} GB/s (binding: ${storage.bindingConstraint})
- Achieved (Raw / Usable): ${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedUsableCapacityTb.toFixed(0)} TB, ${storage.achievedThroughputGBs.toFixed(1)} GB/s
${storage.breakdown.map(b => `  * ${b.label}: ${b.capacityTb.toFixed(2)} TB — ${b.note}`).join('\n')}
${rag.eligible ? `
5. RAG PIPELINE (EMBEDDING + VECTOR DATABASE)
- Embedding Model: ${rag.embeddingModel.name} (${rag.embeddingModel.paramsMillion.toLocaleString()}M params, ${rag.embeddingModel.dims} dims)
- Extractable Text / Vector Count: ${rag.extractableTextGb.toFixed(0)} GB / ${rag.numChunks.toLocaleString()} chunks
- Embedding GPUs Provisioned: ${rag.embeddingGpusNeeded}x ${embeddingGpu.name} (ingestion: ${rag.actualIngestionTimeHours.toFixed(1)} hrs, live query: ${rag.queryEmbeddingGpusNeeded} GPUs)
- Vector Database: ${rag.vectorDbNodesNeeded}x ${rag.vectorDbPlatform.name} (${rag.bindingConstraint}-bound, ${rag.vectorDbRamGb.toLocaleString()} GB RAM)
- RAG Capex / IT Power: $${Math.round(rag.ragComputeCapexUsd).toLocaleString()} / ${rag.ragItPowerKw.toFixed(2)} kW (included in Cost & TCO below)\n` : ''}
6. MANAGEMENT, SERVING STACK & ORCHESTRATION
- Software Suite: ${platform.managementSuite}
- Serving Runtime: ${servingEngine.toUpperCase()} (${enableChunkedPrefill ? 'Chunked Prefill, ' : ''}${enablePrefixCaching ? 'Prefix Caching' : ''})
- Cluster Orchestrator: ${orchestrator.toUpperCase()}
- Serving Topology: ${servingArchitecture === 'llmd' ? `LLM-D Disaggregated Prefill & Decode (${bom.isHeterogeneous ? 'Heterogeneous Split' : 'Homogeneous Split'} over Lossless RoCEv2)` : 'Colocated (Unified P+D)'}
${guardrails.eligible ? `
7. GUARDRAILS (INPUT/OUTPUT SAFETY CLASSIFIER)
- Guard Model: ${guardrails.guardModel.name} (${guardrails.guardModel.paramsBillion}B params, ${guardrails.guardModel.vendor})
- Guards Enabled: ${[guardrails.enableInputGuard ? 'Input' : null, guardrails.enableOutputGuard ? 'Output' : null].filter(Boolean).join(' + ')}
- Guard GPUs Provisioned: ${guardrails.guardGpusNeeded}x ${guardGpu.name} (cluster request rate: ${guardrails.requestRatePerSec.toFixed(2)} req/s)
- Added Latency (TTFT / Total Response): ${(guardrails.addedTtftSec * 1000).toFixed(1)} ms / ${(guardrails.addedTotalLatencySec * 1000).toFixed(1)} ms
- Guardrails Capex / IT Power: $${Math.round(guardrails.guardrailsComputeCapexUsd).toLocaleString()} / ${guardrails.guardrailsItPowerKw.toFixed(2)} kW (included in Cost & TCO below)\n` : ''}${ingress.eligible ? `
8. INGRESS & EDGE (LOAD BALANCING + EGRESS BANDWIDTH)
- Ingress Tier: ${ingressTier.vendor} — ${ingressTier.name} (${ingressTier.type})
- Ingress Nodes Provisioned: ${ingress.nodesNeeded}x ${ingressTier.name} (cluster request rate: ${ingress.requestRatePerSec.toFixed(2)} req/s)
- Added Latency (TLS + Routing): +${ingress.addedLatencyMs} ms
- Annual Egress Bandwidth: ${Math.round(ingress.annualEgressGb).toLocaleString()} GB/yr ($${Math.round(ingress.annualEgressCostUsd).toLocaleString()}/yr)
- Ingress Capex / Annual Opex: $${Math.round(ingress.ingressComputeCapexUsd).toLocaleString()} / $${Math.round(ingress.ingressAnnualOpexUsd).toLocaleString()}/yr (included in Cost & TCO below)\n` : ''}${haDr.eligible ? `
9. HA/DR (INCREMENTAL RESILIENCE CAPACITY)
- Tier: ${haDrTier.name} (${haDrTier.scope})
- RTO / RPO: ${haDrTier.rtoDescription} / ${haDrTier.rpoDescription}
- Primary Site GPUs: ${haDr.baseGpuCount}
- Incremental Compute + Storage Capex: $${Math.round(haDr.haDrComputeCapexUsd).toLocaleString()} (included in Cost & TCO below)
- HA/DR IT Power Draw: ${haDr.haDrItPowerKw.toFixed(2)} kW\n` : ''}${trainingRedundancy.eligible ? `
9. TRAINING SPARE NODE CAPACITY
- Primary Cluster Nodes: ${trainingRedundancy.baseNodes} (${trainingRedundancy.gpusPerNode} GPUs/node)
- Spare Node Capacity: ${trainingRedundancy.spareNodePct}% -> ${trainingRedundancy.spareNodeCount} spare nodes (${trainingRedundancy.spareGpuCount} GPUs)
- Spare Node Capex: $${Math.round(trainingRedundancy.spareComputeCapexUsd).toLocaleString()} (included in Cost & TCO below)
- Spare Node IT Power Draw: ${trainingRedundancy.spareItPowerKw.toFixed(2)} kW\n` : ''}${mlops.eligible ? `
10. MLOPS LIFECYCLE (MODEL ROLLOUT VALIDATION)
- Strategy: ${mlopsStrategy.name} (${mlopsStrategy.scope})
- Rollback Speed: ${mlopsStrategy.rollbackSpeed}
${mlopsStrategy.id === 'canary-release' ? `- Canary Traffic Share: ${canaryTrafficPct}%\n` : ''}- Validation Pool GPUs: ${mlops.validationGpuCount} (of ${mlops.baseGpuCount} primary site GPUs)
- MLOps Capex: $${Math.round(mlops.mlopsComputeCapexUsd).toLocaleString()} (included in Cost & TCO below)
- MLOps IT Power Draw: ${mlops.mlopsItPowerKw.toFixed(2)} kW\n` : ''}
11. FACILITY & POWER FOOTPRINT
- Compute Power: ${facility.chassisPowerKw.toFixed(1)} kW
- Network Power: ${facility.networkPowerKw.toFixed(1)} kW
- Total IT Power: ${facility.totalItPowerKw.toFixed(1)} kW
- Total Facility Power (${pue.toFixed(2)} PUE): ${facility.totalFacilityPowerKw.toFixed(1)} kW
- Datacenter Racks: ~${facility.totalRacks} standard 42U Racks (${facility.totalRuNeeded} RU)

12. COST & TCO (ILLUSTRATIVE ESTIMATE -- NOT A VENDOR QUOTE)
- Total Capex: $${Math.round(cost.totalCapexUsd).toLocaleString()} (Compute $${Math.round(cost.computeCapexUsd).toLocaleString()} + Network/Storage $${Math.round(cost.networkHardwareCapexUsd + cost.storageCapexUsd).toLocaleString()}${rag.eligible ? ` + RAG $${Math.round(cost.ragCapexUsd).toLocaleString()}` : ''}${guardrails.eligible ? ` + Guardrails $${Math.round(cost.guardrailsCapexUsd).toLocaleString()}` : ''}${ingress.eligible ? ` + Ingress $${Math.round(cost.ingressCapexUsd).toLocaleString()}` : ''}${haDr.eligible ? ` + HA/DR $${Math.round(cost.haDrCapexUsd).toLocaleString()}` : ''}${trainingRedundancy.eligible ? ` + Spare Nodes $${Math.round(cost.trainingRedundancyCapexUsd).toLocaleString()}` : ''}${mlops.eligible ? ` + MLOps $${Math.round(cost.mlopsCapexUsd).toLocaleString()}` : ''})
- Annual Opex: $${Math.round(cost.annualOpexUsd).toLocaleString()}/yr (Power $${Math.round(cost.annualPowerCostUsd).toLocaleString()} + Licensing $${Math.round(cost.annualLicensingCostUsd).toLocaleString()} + Support $${Math.round(cost.annualSupportCostUsd).toLocaleString()}${ingress.eligible ? ` + Ingress Egress/Fees $${Math.round(cost.ingressAnnualOpexUsd).toLocaleString()}` : ''})
- ${cost.tcoYears}-Year TCO: $${Math.round(cost.tcoUsd).toLocaleString()} (~$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr effective)
- vs. ${cost.tcoYears}-Yr Cloud Rental ($${cost.cloudEquivalentUsdPerHr.toFixed(2)}/hr cluster-wide): ${cost.buildVsBuySavingsUsd >= 0 ? `Owning saves $${Math.round(cost.buildVsBuySavingsUsd).toLocaleString()}` : `Cloud saves $${Math.round(-cost.buildVsBuySavingsUsd).toLocaleString()}`}
- Capex Break-Even vs. Cloud: ${cost.breakEvenMonths != null ? `~${Math.round(cost.breakEvenMonths)} months` : 'Never — cloud is cheaper at these rates'}
${workloadType === 'inference' && throughput ? `
12. ESTIMATED INFERENCE PERFORMANCE (PREFILL & DECODE)
- Prefill TTFT (Prompt Latency): ~${throughput.ttftMs < 1000 ? `${Number(throughput.ttftMs).toFixed(2)} ms` : `${Number(throughput.ttftSec).toFixed(2)} s`} (at ${contextLength.toLocaleString()} tokens)${isLlmd ? ` [includes ~${throughput.kvTransferLatencyMs}ms RoCEv2 handoff]` : ''}
- Prompt Ingestion Speed: ~${throughput.promptTokensPerSecPerReplica?.toLocaleString()} prompt tok/s per replica
- Generation Latency (TPOT): ~${throughput.tpotMs} ms/tok (~${throughput.tokensPerSecPerGpu} tok/s per stream)
- Cluster Generation Throughput: ~${throughput.batchThroughputTps?.toLocaleString()} gen tok/s total (×${dp} DP × ${concurrency} streams)\n` : ''}${sla.eligible ? `
13. SLA & TAIL LATENCY (M/M/c QUEUEING AT TARGET ρ=${(sla.targetUtilization * 100).toFixed(0)}%${sla.wasClamped ? ', clamped' : ''})
- Concurrency per Replica (C): ${sla.concurrencyPerReplica}
- P(Request Queues) — Erlang C: ${(sla.probabilityOfQueueing * 100).toFixed(1)}%
- Mean Queueing Delay: ${(sla.meanWaitSec * 1000).toFixed(1)} ms
- TTFT — Baseline / P50 / P95 / P99: ${(sla.ttftBaselineSec * 1000).toFixed(1)} / ${(sla.ttftP50Sec * 1000).toFixed(1)} / ${(sla.ttftP95Sec * 1000).toFixed(1)} / ${sla.ttftP99Sec < 1 ? `${(sla.ttftP99Sec * 1000).toFixed(1)} ms` : `${sla.ttftP99Sec.toFixed(2)} s`}
- TPOT (unaffected by queueing): ${(sla.tpotSec * 1000).toFixed(2)} ms/tok
- Total Response Time — Baseline / P50 / P95 / P99: ${(sla.totalResponseBaselineSec * 1000).toFixed(1)} / ${(sla.totalResponseP50Sec * 1000).toFixed(1)} / ${(sla.totalResponseP95Sec * 1000).toFixed(1)} / ${sla.totalResponseP99Sec < 1 ? `${(sla.totalResponseP99Sec * 1000).toFixed(1)} ms` : `${sla.totalResponseP99Sec.toFixed(2)} s`} (includes Ingress/Guardrails fixed latency where enabled)\n` : ''}=====================================================`;
}
