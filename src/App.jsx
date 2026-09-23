import React, { useState, useMemo, useEffect } from 'react';
import { 
  Server, 
  Cpu, 
  Network, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  FileText, 
  HardDrive, 
  Activity, 
  BookOpen,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Gauge,
  Boxes,
  Workflow,
  Sliders,
  Database
} from 'lucide-react';

import { MODEL_PRESETS, PRECISION_OPTIONS } from './data/models';
import { GPU_CATALOG, NETWORK_PROTOCOLS } from './data/hardware';
import { PLATFORM_VENDORS, PLATFORM_SYSTEMS } from './data/platforms';
import { calculateInfra, recommendSharding } from './utils/calculator';
import { InfoHelper, GlossaryCard } from './components/InfoHelper';
import { TopologyDiagram } from './components/TopologyDiagram';

export default function App() {
  // --- Workload & Model State ---
  const [workloadType, setWorkloadType] = useState('inference'); // 'inference' | 'training'
  const [selectedModelId, setSelectedModelId] = useState('llama3-70b');
  const [customParams, setCustomParams] = useState(70);
  const [customNumHeads, setCustomNumHeads] = useState(32);
  const [customKvHeads, setCustomKvHeads] = useState(8);
  const [customLayers, setCustomLayers] = useState(48);

  const [selectedPrecisionId, setSelectedPrecisionId] = useState('fp8');
  const [kvPrecision, setKvPrecision] = useState('fp16'); // 'fp16' | 'fp8' | 'int4'
  const [prefixCacheRatio, setPrefixCacheRatio] = useState(0); // 0 to 0.8
  const [promptTokenRatio, setPromptTokenRatio] = useState(0.8); // 0.8 = 80% prompt / 20% gen
  const [contextLength, setContextLength] = useState(16384);
  const [concurrency, setConcurrency] = useState(8);
  const [microBatchSize, setMicroBatchSize] = useState(2); // training micro-batch

  // Facility PUE state
  const [pue, setPue] = useState(1.35);

  // Training state
  const [trainingType, setTrainingType] = useState('pretrain_sft'); // 'pretrain_sft' | 'lora'
  const [zeroStage, setZeroStage] = useState(3); // 0, 1, 2, 3

  // --- Platform & Hardware State (Cisco vs. NVIDIA) ---
  const [selectedVendor, setSelectedVendor] = useState('cisco'); // 'cisco' | 'nvidia'
  const [selectedPlatformId, setSelectedPlatformId] = useState('cisco-c885a-h200');

  // Filter available platforms by selected vendor
  const availablePlatforms = useMemo(() => {
    return PLATFORM_SYSTEMS.filter(p => p.vendor === selectedVendor);
  }, [selectedVendor]);

  const platform = PLATFORM_SYSTEMS.find(p => p.id === selectedPlatformId) || availablePlatforms[0];
  const gpu = GPU_CATALOG.find(g => g.id === platform.gpuId) || GPU_CATALOG[0];

  // Parallelism State (Auto vs Manual)
  const [isAutoSharding, setIsAutoSharding] = useState(true);
  const [manualTp, setManualTp] = useState(8);
  const [manualPp, setManualPp] = useState(1);
  const [dp, setDp] = useState(1);

  // Network Protocol
  const [selectedProtocolId, setSelectedProtocolId] = useState('rocev2');

  // Filter available protocols by vendor (Cisco = RoCEv2 only, NVIDIA = RoCEv2 + InfiniBand)
  const availableProtocols = useMemo(() => {
    return NETWORK_PROTOCOLS.filter(p =>
      selectedVendor === 'cisco' ? p.id === 'rocev2' : true
    );
  }, [selectedVendor]);

  // Clipboard feedback state
  const [copiedBOM, setCopiedBOM] = useState(false);

  // --- Input Navigation Tabs ---
  const [activeInputTab, setActiveInputTab] = useState('workload'); // 'workload' | 'platform' | 'sharding' | 'fabric' | 'stack'

  // --- BOM View Mode ---
  const [bomViewMode, setBomViewMode] = useState('summary'); // 'summary' | 'detailed'

  // --- Serving Stack & LLM-D State ---
  const [servingEngine, setServingEngine] = useState('vllm'); // 'vllm' | 'trt-llm' | 'tgi'
  const [orchestrator, setOrchestrator] = useState('kserve'); // 'kserve' | 'ray' | 'docker'
  const [servingArchitecture, setServingArchitecture] = useState('colocated'); // 'colocated' | 'llmd'
  const [enableChunkedPrefill, setEnableChunkedPrefill] = useState(true);
  const [enablePrefixCaching, setEnablePrefixCaching] = useState(true);
  const [enableSpeculativeDecoding, setEnableSpeculativeDecoding] = useState(false);
  const [llmdDisaggregationMode, setLlmdDisaggregationMode] = useState('heterogeneous'); // 'heterogeneous' | 'homogeneous'
  const [secondaryPlatformId, setSecondaryPlatformId] = useState('cisco-c885a-h200');
  const [prefillNodes, setPrefillNodes] = useState(1);
  const [decodeNodes, setDecodeNodes] = useState(2);

  // Secondary platform and GPU for LLM-D heterogeneous decode pool
  const secondaryPlatform = useMemo(() => {
    return availablePlatforms.find(p => p.id === secondaryPlatformId) || availablePlatforms[0];
  }, [availablePlatforms, secondaryPlatformId]);

  const secondaryGpu = useMemo(() => {
    return GPU_CATALOG.find(g => g.id === secondaryPlatform.gpuId) || GPU_CATALOG[0];
  }, [secondaryPlatform]);

  // Dynamically constructed model object (handles custom model overrides)
  const model = useMemo(() => {
    const base = MODEL_PRESETS.find(m => m.id === selectedModelId) || MODEL_PRESETS[1];
    if (selectedModelId === 'custom') {
      return {
        ...base,
        params: Number(customParams) || 32,
        numHeads: Number(customNumHeads) || 32,
        kvHeads: Number(customKvHeads) || 8,
        layers: Number(customLayers) || 48,
      };
    }
    return base;
  }, [selectedModelId, customParams, customNumHeads, customKvHeads, customLayers]);

  // Clamp context length if it exceeds the model's native limit
  const maxContextLength = model.maxContextLength || 131072;
  useEffect(() => {
    if (contextLength > maxContextLength) {
      setContextLength(maxContextLength);
    }
  }, [model.id, maxContextLength]);

  const precision = PRECISION_OPTIONS.find(p => p.id === selectedPrecisionId) || PRECISION_OPTIONS[1];
  const protocol = NETWORK_PROTOCOLS.find(p => p.id === selectedProtocolId) || NETWORK_PROTOCOLS[0];

  // Vendor switch handler
  const handleVendorChange = (vendorId) => {
    setSelectedVendor(vendorId);
    const vendorPlatforms = PLATFORM_SYSTEMS.filter(p => p.vendor === vendorId);
    if (vendorPlatforms.length > 0) {
      setSelectedPlatformId(vendorPlatforms[0].id);
      const secondaryCandidate = vendorPlatforms.find(p => p.id.includes('h200')) || vendorPlatforms[Math.min(1, vendorPlatforms.length - 1)];
      setSecondaryPlatformId(secondaryCandidate.id);
    }
    if (vendorId === 'cisco') {
      setSelectedProtocolId('rocev2');
    }
  };


  const effectiveConcurrency = workloadType === 'inference' ? concurrency : microBatchSize;

  // 1. Auto-Sharding Solver: Computes optimal TP and PP based on preceding variables
  const autoRecommendation = useMemo(() => {
    return recommendSharding({
      workloadType,
      model,
      customParams,
      precision,
      kvPrecision,
      prefixCacheRatio,
      promptTokenRatio,
      contextLength,
      concurrency: effectiveConcurrency,
      gpu,
      platform,
      trainingType,
      zeroStage
    });
  }, [
    workloadType,
    model,
    customParams,
    precision,
    kvPrecision,
    prefixCacheRatio,
    promptTokenRatio,
    contextLength,
    effectiveConcurrency,
    gpu,
    platform,
    trainingType,
    zeroStage
  ]);

  const tp = isAutoSharding ? autoRecommendation.tp : manualTp;
  const pp = isAutoSharding ? autoRecommendation.pp : manualPp;

  // 2. Full Infrastructure & Network Sizing Calculation
  const results = useMemo(() => {
    return calculateInfra({
      workloadType,
      model,
      customParams,
      precision,
      kvPrecision,
      prefixCacheRatio,
      promptTokenRatio,
      contextLength,
      concurrency: effectiveConcurrency,
      gpu,
      platform,
      tp,
      pp,
      dp,
      trainingType,
      zeroStage,
      networkProtocol: selectedProtocolId,
      pue,
      servingConfig: {
        servingEngine,
        orchestrator,
        servingArchitecture,
        enableChunkedPrefill,
        enablePrefixCaching,
        enableSpeculativeDecoding,
        llmdDisaggregationMode,
        secondaryPlatform,
        secondaryGpu,
        prefillNodes,
        decodeNodes
      }
    });
  }, [
    workloadType,
    model,
    customParams,
    precision,
    kvPrecision,
    prefixCacheRatio,
    promptTokenRatio,
    contextLength,
    effectiveConcurrency,
    gpu,
    platform,
    tp,
    pp,
    dp,
    trainingType,
    zeroStage,
    selectedProtocolId,
    pue,
    servingEngine,
    orchestrator,
    servingArchitecture,
    enableChunkedPrefill,
    enablePrefixCaching,
    enableSpeculativeDecoding,
    llmdDisaggregationMode,
    secondaryPlatform,
    secondaryGpu,
    prefillNodes,
    decodeNodes
  ]);

  const { memory, facility, network, bom, throughput } = results;

  // Copy BOM to clipboard
  const handleCopyBOM = () => {
    const isLlmd = bom.isDisaggregated;
    const bomText = `=====================================================
AI INFRASTRUCTURE DATACENTER BILL OF MATERIALS (DC BOM)
${isLlmd ? `Serving Architecture: LLM-D Disaggregated (${bom.isHeterogeneous ? 'Heterogeneous Split' : 'Homogeneous Split'})
Prefill Platform: ${bom.prefill.platformName}
Decode Platform: ${bom.decode.platformName}` : `Platform: ${platform.name}`}
Vendor: ${selectedVendor === 'cisco' ? (platform.id?.includes('smci') ? 'Cisco Secure AI Factory (Supermicro Compute + Nexus Fabric)' : 'Cisco UCS & Nexus AI Fabric') : 'NVIDIA DGX SuperPOD'}
=====================================================

1. COMPUTE CLUSTER
${isLlmd ? `- Prefill Compute Pool: ${bom.prefill.nodes}x ${bom.prefill.platformName} (${bom.prefill.gpuCount}x ${bom.prefill.gpuName})
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
- Bisection Bandwidth: ${network.totalClusterBisectionTbps.toFixed(1)} Tbps (${network.nicSpeedGbps}G × ${network.totalComputeNics} NICs × 2 directions)
- NIC Speed: ${network.nicSpeedGbps}G per GPU (${network.nicSpeedGbps === 800 ? '800G ConnectX-8 Blackwell-class' : '400G ConnectX-7 Hopper-class'})
- Lossless Protocol: ${network.protocol === 'rocev2' ? 'Lossless RoCEv2 (PFC 802.1Qbb + ECN)' : 'NVIDIA Quantum-2 Credit-Based Flow Control'}
- Compute Cabling: ${bom.fabricCablesCount}x ${bom.fabricCablesType}

3. STORAGE & OUT-OF-BAND (OOB) NETWORK
- Storage Leaf Switches: ${bom.storageSwitchCount}x ${bom.storageSwitchModel}
- OOB Management Switches: ${bom.oobSwitchCount}x ${bom.oobSwitchModel}
- Storage/Mgmt Cabling: ${bom.storageCablesCount}x 100G/1G Cables

4. MANAGEMENT, SERVING STACK & ORCHESTRATION
- Software Suite: ${platform.managementSuite}
- Serving Runtime: ${servingEngine.toUpperCase()} (${enableChunkedPrefill ? 'Chunked Prefill, ' : ''}${enablePrefixCaching ? 'Prefix Caching' : ''})
- Cluster Orchestrator: ${orchestrator.toUpperCase()}
- Serving Topology: ${servingArchitecture === 'llmd' ? `LLM-D Disaggregated Prefill & Decode (${bom.isHeterogeneous ? 'Heterogeneous Split' : 'Homogeneous Split'} over Lossless RoCEv2)` : 'Colocated (Unified P+D)'}

5. FACILITY & POWER FOOTPRINT
- Compute Power: ${facility.chassisPowerKw.toFixed(1)} kW
- Network Power: ${facility.networkPowerKw.toFixed(1)} kW
- Total IT Power: ${facility.totalItPowerKw.toFixed(1)} kW
- Total Facility Power (${pue.toFixed(2)} PUE): ${facility.totalFacilityPowerKw.toFixed(1)} kW
- Datacenter Racks: ~${facility.totalRacks} standard 42U Racks (${facility.totalRuNeeded} RU)
${workloadType === 'inference' && throughput ? `
6. ESTIMATED INFERENCE PERFORMANCE (PREFILL & DECODE)
- Prefill TTFT (Prompt Latency): ~${throughput.ttftMs < 1000 ? `${throughput.ttftMs} ms` : `${throughput.ttftSec} s`} (at ${contextLength.toLocaleString()} tokens)${isLlmd ? ` [includes ~${throughput.kvTransferLatencyMs}ms RoCEv2 handoff]` : ''}
- Prompt Ingestion Speed: ~${throughput.promptTokensPerSecPerReplica?.toLocaleString()} prompt tok/s per replica
- Generation Latency (TPOT): ~${throughput.tpotMs} ms/tok (~${throughput.tokensPerSecPerGpu} tok/s per stream)
- Cluster Generation Throughput: ~${throughput.batchThroughputTps?.toLocaleString()} gen tok/s total (×${dp} DP × ${concurrency} streams)\n` : ''}=====================================================`;

    navigator.clipboard.writeText(bomText);
    setCopiedBOM(true);
    setTimeout(() => setCopiedBOM(false), 2500);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-none-text">
      {/* Top Banner / Header (Compact, Fixed at top) */}
      <header className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 shrink-0 z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span>Private AI Infrastructure Sizing Calculator</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                v2.0 • Cisco & NVIDIA
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Compute, VRAM sharding, LLM-D disaggregation, and lossless RoCEv2/IB fabric sizing.
            </p>
          </div>
        </div>


        {/* Quick Status KPI Pill Box */}
        <div className="flex items-center gap-2 text-xs bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1">
          <div className="px-1.5 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Platform</div>
            <div className="text-xs font-bold text-white font-mono truncate max-w-[140px]" title={servingArchitecture === 'llmd' && llmdDisaggregationMode === 'heterogeneous' ? `${platform.shortName} + ${secondaryPlatform.shortName}` : platform.shortName}>
              {servingArchitecture === 'llmd'
                ? (llmdDisaggregationMode === 'heterogeneous' ? `${platform.shortName} + ${secondaryPlatform.shortName}` : `${platform.shortName} (LLM-D)`)
                : platform.shortName}
            </div>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="px-1.5 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">GPUs</div>
            <div className="text-xs font-bold text-sky-400">{results.totalGpus}</div>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="px-1.5 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Nodes</div>
            <div className="text-xs font-bold text-sky-400">{results.nodes}</div>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="px-1.5 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">IT Power</div>
            <div className="text-xs font-bold text-amber-400">{facility.totalItPowerKw.toFixed(1)} kW</div>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="px-1.5 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Status</div>
            <div className={`text-xs font-bold ${memory.isOOM ? 'text-amber-400' : 'text-emerald-400'}`}>
              {memory.isOOM ? 'OOM' : 'Fits'}
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Pane Layout Area (Fills Viewport Height) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* PANE 1: Left Navigation Rail */}
        <nav className="w-56 lg:w-60 shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex flex-col justify-between overflow-y-auto">
          <div className="p-3 space-y-1.5">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Configuration
            </div>

            {/* Tab 1: Workload */}
            <button
              type="button"
              onClick={() => setActiveInputTab('workload')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                activeInputTab === 'workload'
                  ? 'bg-sky-500/10 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/80 border-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${activeInputTab === 'workload' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">1. Workload</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {model.name}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  activeInputTab === 'workload' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {model.params}B
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {precision.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 capitalize">
                  {workloadType}
                </span>
              </div>
            </button>

            {/* Tab 2: Platform */}
            <button
              type="button"
              onClick={() => setActiveInputTab('platform')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                activeInputTab === 'platform'
                  ? 'bg-sky-500/10 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/80 border-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${activeInputTab === 'platform' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">2. Platform</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {platform.vendor === 'cisco' ? 'Cisco AI Factory' : 'NVIDIA DGX'}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono truncate max-w-[110px] ${
                  activeInputTab === 'platform' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {platform.shortName}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {gpu.name}
                </span>
              </div>
            </button>

            {/* Tab 3: Sharding */}
            <button
              type="button"
              onClick={() => setActiveInputTab('sharding')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                activeInputTab === 'sharding'
                  ? 'bg-sky-500/10 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/80 border-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${activeInputTab === 'sharding' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">3. Sharding</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {isAutoSharding ? 'Auto-Recommended' : 'Custom Manual'}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  activeInputTab === 'sharding' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  TP={tp}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  PP={pp}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  DP={dp}
                </span>
              </div>
            </button>

            {/* Tab 4: Fabric */}
            <button
              type="button"
              onClick={() => setActiveInputTab('fabric')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                activeInputTab === 'fabric'
                  ? 'bg-sky-500/10 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/80 border-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${activeInputTab === 'fabric' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Network className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">4. Fabric & PUE</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {protocol.name}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  activeInputTab === 'fabric' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {protocol.speedGbps}G
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {pue.toFixed(2)} PUE
                </span>
              </div>
            </button>

            {/* Tab 5: Stack */}
            <button
              type="button"
              onClick={() => setActiveInputTab('stack')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                activeInputTab === 'stack'
                  ? 'bg-sky-500/10 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/80 border-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${activeInputTab === 'stack' ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Workflow className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">5. Serving Stack</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {orchestrator.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                  activeInputTab === 'stack' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {servingEngine}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  servingArchitecture === 'llmd' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {servingArchitecture === 'llmd' ? (llmdDisaggregationMode === 'heterogeneous' ? 'LLM-D (Hetero)' : 'LLM-D (Homo)') : 'Coloc'}
                </span>
              </div>
            </button>
          </div>

          {/* Bottom of Nav Rail: Active sizing summary & copy BOM */}
          <div className="p-3 border-t border-zinc-800/90 bg-zinc-950/60 space-y-2">
            <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-bold">
                <span>Active Sizing</span>
                <span className={memory.isOOM ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {memory.isOOM ? '● OOM' : '● Verified'}
                </span>
              </div>
              <div className="font-mono text-white font-semibold truncate text-[11px]">
                {results.totalGpus}x {gpu.name} ({results.nodes} {results.nodes === 1 ? 'Node' : 'Nodes'})
              </div>
              <div className="text-[10px] text-zinc-400">
                IT Power: <strong className="text-amber-400 font-mono">{facility.totalItPowerKw.toFixed(1)} kW</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyBOM}
              className="w-full py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copiedBOM ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied BOM!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy BOM Spec</span>
                </>
              )}
            </button>
          </div>
        </nav>

        {/* PANE 2: Central Configuration Variables Pane (Independently Scrollable) */}
        <main className="flex-1 min-w-[360px] overflow-y-auto p-4 md:p-6 bg-zinc-950/70 border-r border-zinc-800 space-y-4">

          {/* 1. Workload Mode & Model */}
          {activeInputTab === 'workload' && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-sky-400" />
                  1. Workload & Model Selection
                </span>
              <div className="flex p-0.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setWorkloadType('inference')}
                  className={`px-3 py-1 rounded-md transition ${
                    workloadType === 'inference'
                      ? 'bg-sky-600 text-white font-medium'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Inference
                </button>
                <button
                  type="button"
                  onClick={() => setWorkloadType('training')}
                  className={`px-3 py-1 rounded-md transition ${
                    workloadType === 'training'
                      ? 'bg-sky-600 text-white font-medium'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Training / SFT
                </button>
              </div>
            </div>


            {/* Model Preset Dropdown */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Base AI Model Architecture
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {MODEL_PRESETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.params}B params {m.isMoe ? '(MoE)' : ''}
                  </option>
                ))}
              </select>
              <InfoHelper
                title="Model Parameter Count"
                text="The number of neural network weights in billions. Dense models compute all parameters on every token. Mixture-of-Experts (MoE) models only activate a small subset per token, but still require aggregate VRAM to store all experts in memory."
                whyItMatters="Model size determines the baseline VRAM floor. A 70B model requires 70 GB in FP8 or 140 GB in FP16 before any user tokens are even processed."
              />
            </div>

            {/* Custom Param input if custom */}
            {selectedModelId === 'custom' && (
              <div className="space-y-3 bg-zinc-950/70 p-3 rounded-lg border border-zinc-800">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Custom Total Parameters (in Billions)
                  </label>
                  <input
                    type="number"
                    value={customParams}
                    onChange={(e) => setCustomParams(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    min="1"
                    max="2000"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Layers</label>
                    <input
                      type="number"
                      value={customLayers}
                      onChange={(e) => setCustomLayers(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      min="1"
                      max="200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Query Heads</label>
                    <input
                      type="number"
                      value={customNumHeheads || customNumHeads}
                      onChange={(e) => setCustomNumHeads(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      min="1"
                      max="256"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">KV Heads (GQA)</label>
                    <input
                      type="number"
                      value={customKvHeads}
                      onChange={(e) => setCustomKvHeads(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      min="1"
                      max="128"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Precision / Quantization */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Weight Precision & Quantization
              </label>
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
              <InfoHelper
                title="Quantization Precision"
                text="How many bytes each weight occupies in GPU RAM. FP16/BF16 is full 16-bit precision (2 bytes). FP8 (1 byte) halves weight memory with virtually zero reasoning loss on modern Hopper/Blackwell cards. INT4 (0.5 bytes) shrinks memory by 75%."
                whyItMatters="Dropping from FP16 to FP8 cuts your required GPU count in half for model weights, drastically reducing private cluster cost."
              />
            </div>

            {/* Context Length Slider */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-zinc-300">Context Window Length:</span>
                <span className="font-bold text-sky-400">{contextLength.toLocaleString()} tokens</span>
              </div>
              <input
                type="range"
                min="2048"
                max={maxContextLength}
                step="2048"
                value={Math.min(contextLength, maxContextLength)}
                onChange={(e) => setContextLength(Number(e.target.value))}
                className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>2k (Prompt)</span>
                <span>32k (Docs)</span>
                <span>{maxContextLength >= 131072 ? '128k (Max)' : `${(maxContextLength / 1024).toFixed(0)}k (Max)`}</span>
              </div>
              {maxContextLength < 131072 && (
                <div className="text-[10px] text-amber-400 mt-1 font-medium">
                  ⚠️ {model.name} natively supports up to {(maxContextLength / 1024).toFixed(0)}k tokens maximum.
                </div>
              )}
              <InfoHelper
                title="Context Window & KV Cache"
                text="The total token span (input prompt + output generation) processed in a single prompt. For every token processed, the attention mechanism must store Key and Value vectors in GPU VRAM (the KV Cache) to avoid recalculating past context."
                whyItMatters="At 128k tokens, the KV Cache often consumes MORE VRAM than the model weights themselves! High context mandates GPUs with large VRAM (e.g. H200 141GB)."
              />
            </div>

            {/* Concurrency / Batch Size */}
            {workloadType === 'inference' ? (
              <>
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-medium text-zinc-300">Concurrent User Requests (Batch Size):</span>
                  <span className="font-bold text-sky-400">{concurrency} streams</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="64"
                  step="1"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                />
                <InfoHelper
                  title="Concurrency & KV Cache Multiplying"
                  text="How many separate users or agent tasks are generating answers at the exact same millisecond. Each concurrent stream maintains its own independent KV Cache in GPU memory."
                  whyItMatters="If 16 users are querying a 32k context simultaneously, your GPU cluster must store 16 distinct KV caches in VRAM at the same time."
                />
              </div>

              {/* Advanced KV Cache Optimization Sub-panel */}
              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    <span>KV Cache Architecture & Optimization</span>
                  </div>
                  {results?.memory?.kvSavingsGb > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 font-mono font-medium">
                      ⚡ -{results.memory.kvSavingsGb.toFixed(1)} GB Saved
                    </span>
                  )}
                </div>

                {/* KV Cache Precision Selector */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    KV Cache Precision (<code className="text-sky-400 font-mono">--kv-cache-dtype</code>)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKvPrecision('fp16')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium border transition text-center ${
                        kvPrecision === 'fp16'
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div>FP16 / BF16</div>
                      <div className="text-[9px] text-zinc-500">2.0 B (Default)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKvPrecision('fp8')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium border transition text-center ${
                        kvPrecision === 'fp8'
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>FP8 E4M3</span>
                        <span className="text-[9px] text-emerald-400 font-mono">-50%</span>
                      </div>
                      <div className="text-[9px] text-zinc-500">1.0 B (vLLM / SGLang)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKvPrecision('int4')}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium border transition text-center ${
                        kvPrecision === 'int4'
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>INT4 / FP4</span>
                        <span className="text-[9px] text-emerald-400 font-mono">-75%</span>
                      </div>
                      <div className="text-[9px] text-zinc-500">0.5 B (engine-dependent)</div>
                    </button>
                  </div>
                  <InfoHelper
                    title="KV Cache Precision (FP16 vs FP8)"
                    text="Modern inference engines allow quantizing the KV cache independently from model weights. Running --kv-cache-dtype fp8 cuts KV memory in half, doubling the concurrent sessions supported on the same GPU cluster with virtually imperceptible perplexity loss."
                    whyItMatters="At long context lengths (32k–128k), FP8 KV cache often prevents needing extra server nodes just to hold conversation memory."
                  />
                </div>

                {/* Automatic Prefix Caching */}
                <div>
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="font-medium text-zinc-300">Automatic Prefix Caching Hit Rate:</span>
                    <span className="font-bold text-sky-400 font-mono">{(prefixCacheRatio * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.80"
                    step="0.05"
                    value={prefixCacheRatio}
                    onChange={(e) => setPrefixCacheRatio(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                    <span>0% (Unique Queries)</span>
                    <span>40% (Shared RAG / System Prompt)</span>
                    <span>80% (Multi-turn Chat)</span>
                  </div>
                  {prefixCacheRatio > 0 && concurrency > 1 && (
                    <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                      ✓ Automatic prefix caching deduplicating ~{Math.round(contextLength * promptTokenRatio * prefixCacheRatio).toLocaleString()} shared tokens across {concurrency} streams
                    </div>
                  )}
                  <InfoHelper
                    title="Automatic Prefix Caching"
                    text="In vLLM and SGLang, shared prompt tokens (such as a 4k system prompt or document corpus) are stored once in GPU VRAM and referenced across all concurrent streams rather than copied per user."
                    whyItMatters="High prefix hit rates drastically reduce KV cache memory pressure and accelerate Time-to-First-Token (TTFT) by bypassing prefill computation on repeated prefixes."
                  />
                </div>

                {/* Prompt vs Output Generation Ratio */}
                <div>
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="font-medium text-zinc-300">Workload Profile (Prompt vs. Output Split):</span>
                    <span className="font-bold text-sky-400 font-mono">
                      {(promptTokenRatio * 100).toFixed(0)}% Prompt / {((1 - promptTokenRatio) * 100).toFixed(0)}% Gen
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPromptTokenRatio(0.8)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition text-center ${
                        promptTokenRatio === 0.8
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      80 / 20 (RAG & Docs)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptTokenRatio(0.5)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition text-center ${
                        promptTokenRatio === 0.5
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      50 / 50 (Chat)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptTokenRatio(0.2)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition text-center ${
                        promptTokenRatio === 0.2
                          ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      20 / 80 (Code & Reasoning)
                    </button>
                  </div>
                </div>

              </div>
            </>
          ) : (
              /* Training Options */
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium text-zinc-300">Micro-Batch Size per GPU:</span>
                    <span className="font-bold text-sky-400">{microBatchSize} sequences</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={microBatchSize}
                    onChange={(e) => setMicroBatchSize(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                    <span>1 (safest, gradient checkpointing)</span>
                    <span>8 (faster, more activation VRAM)</span>
                  </div>
                  <InfoHelper
                    title="Micro-Batch Size (Training)"
                    text="The number of training sequences processed simultaneously per GPU before a gradient update. Larger micro-batches increase GPU utilization but require more activation memory."
                    whyItMatters="With gradient checkpointing, micro-batch=1 minimizes memory use. Increase it if you have VRAM headroom to improve GPU compute utilization."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Training Strategy
                  </label>
                  <select
                    value={trainingType}
                    onChange={(e) => setTrainingType(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="pretrain_sft">Full Parameter Training / SFT (16 bytes/param base)</option>
                    <option value="lora">LoRA / QLoRA Adapter Fine-Tuning (~1% trainable)</option>
                  </select>
                </div>

                {trainingType === 'pretrain_sft' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      ZeRO / FSDP Sharding Stage
                    </label>
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
                    <InfoHelper
                      title="ZeRO Memory Sharding Stages"
                      text="In AdamW training, optimizer states take 12 bytes per parameter (3x the model size!). ZeRO-3 / PyTorch FSDP slices weights, gradients, and optimizer states across all GPUs in the cluster."
                      whyItMatters="Full training without ZeRO-3 requires massive clusters. ZeRO-3 allows a 70B model to be trained across 8x H100s instead of 32+ GPUs."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. SPECIFIC GPU PLATFORM SELECTION (CISCO vs. NVIDIA) */}
        {activeInputTab === 'platform' && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-sky-400" />
                2. Datacenter Platform Selection
              </span>
              
              {/* Vendor Selector Pill */}
              <div className="flex p-0.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                {PLATFORM_VENDORS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleVendorChange(v.id)}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      selectedVendor === v.id
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {v.id === 'cisco' ? 'Cisco Solutions' : 'NVIDIA DGX'}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Dropdown */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Select {selectedVendor === 'cisco' ? 'AI Server Architecture' : 'NVIDIA DGX System'}
              </label>
              <select
                value={selectedPlatformId}
                onChange={(e) => setSelectedPlatformId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono text-[11px]"
              >
                {selectedVendor === 'cisco' ? (
                  <>
                    <optgroup label="── Cisco UCS Rack Servers (AMD EPYC) ──" className="bg-zinc-900 text-sky-300 font-sans font-bold">
                      {availablePlatforms
                        .filter((p) => !p.id.includes('smci') && !p.id.includes('x-series'))
                        .map((p) => (
                          <option key={p.id} value={p.id} className="bg-zinc-950 text-white font-mono">
                            {p.name} — {p.formFactor}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="── Cisco UCS X-Series (Modular 7U Blade) ──" className="bg-zinc-900 text-zinc-300 font-sans font-bold">
                      {availablePlatforms
                        .filter((p) => p.id.includes('x-series'))
                        .map((p) => (
                          <option key={p.id} value={p.id} className="bg-zinc-950 text-white font-mono">
                            {p.name} — {p.formFactor}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="── Cisco Secure AI Factory (Supermicro + Intel Xeon) ──" className="bg-zinc-900 text-amber-300 font-sans font-bold">
                      {availablePlatforms
                        .filter((p) => p.id.includes('smci'))
                        .map((p) => (
                          <option key={p.id} value={p.id} className="bg-zinc-950 text-white font-mono">
                            {p.name} — {p.formFactor}
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  availablePlatforms.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-950 text-white font-mono">
                      {p.name} — {p.formFactor}
                    </option>
                  ))
                )}
              </select>
              <InfoHelper
                title={
                  platform.id?.includes('smci')
                    ? 'Cisco Secure AI Factory with Supermicro Compute'
                    : selectedVendor === 'cisco'
                    ? 'Cisco UCS & Nexus AI Platform'
                    : 'NVIDIA DGX SuperPOD Architecture'
                }
                text={
                  platform.id?.includes('smci')
                    ? 'Supermicro HGX GPU SuperServers (SYS-821GE-TNHR / SYS-A21GE-NBRT) integrated into the Cisco Secure AI Factory reference architecture. Features dual Intel Xeon Scalable processors, up to 8TB DDR5 system memory (32 DIMMs), and high-density front NVMe bays, paired with Cisco Nexus 9000 deep-buffer RoCEv2 fabric and unified Intersight management.'
                    : selectedVendor === 'cisco'
                    ? 'Cisco UCS C885A M8 pairs 8x NVIDIA HGX SXM GPUs with dual AMD EPYC processors and Cisco Nexus 9000 deep-buffer RoCEv2 switches. Managed centrally via Cisco Intersight and Nexus Dashboard (NDFC).'
                    : 'NVIDIA DGX SuperPOD is NVIDIA’s turnkey AI supercomputing reference architecture. Features DGX 8U chassis with dual Intel Xeon processors, ConnectX-7/8 OSFP NICs, and choice of Quantum-2 InfiniBand or Spectrum-4 Ethernet.'
                }
                whyItMatters={
                  platform.id?.includes('smci')
                    ? 'Combines Supermicro’s extreme memory expandability (up to 8TB RAM for CPU dataset staging/offload) and Blackwell 10U thermal design with enterprise Cisco Nexus lossless networking and Intersight governance.'
                    : selectedVendor === 'cisco'
                    ? 'Ideal for enterprise datacenters wanting seamless integration into existing Cisco network infrastructure with automated RoCEv2 buffer tuning.'
                    : 'Ideal for pure AI supercomputing clusters requiring turnkey vendor support directly from NVIDIA.'
                }
              />
            </div>

            {/* Platform Specifications Pill Row */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                <div className="text-[10px] text-zinc-400">Accelerator Payload</div>
                <div className="font-bold text-sky-400 text-xs">{platform.gpusPerChassis}x {gpu.name.split(' ')[1]}</div>
                <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{gpu.vramGb}GB VRAM / GPU</div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                <div className="text-[10px] text-zinc-400">Form Factor</div>
                <div className="font-bold text-sky-400 text-xs">{platform.formFactor}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{platform.chassisHeightRu} Rack Units</div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                <div className="text-[10px] text-zinc-400">Chassis Power</div>
                <div className="font-bold text-amber-400 text-xs">{platform.chassisTdpKw} kW</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">Peak Load</div>
              </div>
            </div>

            {/* Host Processor & Memory Info */}
            <div className="p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg text-[11px] text-zinc-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>• <strong>Host CPUs:</strong> {platform.hostCpu}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {platform.hostCpu.includes('EPYC') ? 'AMD EPYC' : 'Intel Xeon'}
                </span>
              </div>
              <div>• <strong>Host Memory:</strong> {platform.systemRam}</div>
              <div>• <strong>Host I/O:</strong> {platform.hostNics}</div>
            </div>
          </div>
        )}

        {/* 3. Parallelism & Sharding Strategy (CONDITIONED ON PRECEDING VARIABLES) */}
        {activeInputTab === 'sharding' && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                3. Model Sharding & Parallelism
              </span>

              {/* Mode Toggle: Auto vs Manual */}
              <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAutoSharding(true)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 text-xs font-medium ${
                    isAutoSharding
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-sky-300" />
                  <span>Auto-Solver</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoSharding(false);
                    setManualTp(tp);
                    setManualPp(pp);
                  }}
                  className={`px-2.5 py-1 rounded transition text-xs font-medium ${
                    !isAutoSharding
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Manual Override
                </button>
              </div>
            </div>

            {/* Dynamic Content based on Auto vs Manual */}
            {isAutoSharding ? (
              <div className="space-y-3">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      <span>Optimal Sharding Decision</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-mono font-bold">
                      TP={tp} • PP={pp}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {autoRecommendation.rationale}
                  </p>

                  <div className="text-[11px] pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-300">
                      {autoRecommendation.fitsInOneNode ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span><strong>Single Node:</strong> PP locked at 1 (zero pipeline bubble stalls).</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span><strong>Multi-Node:</strong> TP={tp} on NVLink; PP={pp} across fabric.</span>
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoSharding(false);
                        setManualTp(tp);
                        setManualPp(pp);
                      }}
                      className="text-sky-400 hover:text-sky-300 underline font-medium text-[10px]"
                    >
                      Override
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Manual Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between p-2 bg-amber-950/30 border border-amber-800/50 rounded text-xs text-amber-200">
                  <span>Manual Mode: Customize TP & PP independently.</span>
                  <button
                    type="button"
                    onClick={() => setIsAutoSharding(true)}
                    className="text-amber-300 underline font-semibold hover:text-amber-100 text-[10px] ml-2 flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Reset to Solver
                  </button>
                </div>

                {/* TP Degree */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium text-zinc-300">Tensor Parallelism (TP Degree):</span>
                    <span className="font-bold text-sky-400">TP = {manualTp}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 4, 8].map((val) => (
                      <button
                        key={`tp-${val}`}
                        type="button"
                        onClick={() => setManualTp(val)}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          manualTp === val
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        TP={val}
                      </button>
                    ))}
                  </div>
                  <InfoHelper
                    title="Tensor Parallelism (Intra-Node Splitting)"
                    text="Slices individual weight matrices (layers) across multiple GPUs simultaneously. All GPUs must communicate on EVERY single token generation step via All-Reduce operations."
                    whyItMatters="GOLDEN RULE: TP must stay inside a single 8-GPU chassis over NVLink! Never set TP > 8 across network cables, or latency will spike by 10x to 50x."
                  />
                </div>

                {/* PP Degree */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium text-zinc-300">Pipeline Parallelism (PP Nodes):</span>
                    <span className="font-bold text-sky-400">PP = {manualPp}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 4, 8].map((val) => (
                      <button
                        key={`pp-${val}`}
                        type="button"
                        onClick={() => setManualPp(val)}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          manualPp === val
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        PP={val}
                      </button>
                    ))}
                  </div>
                  {manualPp > 1 && manualTp < 8 && (
                    <div className="mt-1.5 p-2 bg-amber-950/60 border border-amber-700/60 rounded text-[11px] text-amber-300 leading-snug">
                      💡 <strong>Guidance:</strong> You have PP={manualPp} while TP is only {manualTp}. Maximize intra-node TP to 8 first over NVLink before splitting across nodes with PP.
                    </div>
                  )}
                  <InfoHelper
                    title="Pipeline Parallelism (Multi-Node Chaining)"
                    text="Assigns consecutive layers of the model to different server nodes (e.g. Node 1 runs layers 1-40, Node 2 runs layers 41-80). Nodes only communicate when passing activation data from the boundary layer."
                    whyItMatters="Used when a model is simply too big to fit inside a single 8-GPU node even at TP=8 (e.g., LLaMA-405B at FP16 or massive training)."
                  />
                </div>
              </div>
            )}

            {/* DP Replicas (Applies to both modes) */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-zinc-300">Data Parallelism / Replicas (DP):</span>
                <span className="font-bold text-sky-400">DP = {dp}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={dp}
                onChange={(e) => setDp(Number(e.target.value))}
                className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
              <InfoHelper
                title="Data Parallelism (Horizontal Scaling)"
                text="Creates complete independent copies of your model instance. Each replica serves a distinct batch of users in parallel, or handles a slice of training batches."
                whyItMatters="Increase DP to scale throughput and serve 100s of concurrent users with zero latency degradation."
              />
            </div>
          </div>
        )}

        {/* 4. Lossless Network & Facility Configuration */}
        {activeInputTab === 'fabric' && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-sky-400" />
                4. Lossless Scale-Out Fabric & Facility
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Scale-Out Network Architecture
              </label>
              <select
                value={selectedProtocolId}
                onChange={(e) => setSelectedProtocolId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {availableProtocols.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.speedGbps} Gbps / port)
                  </option>
                ))}
              </select>
              {selectedVendor === 'cisco' && (
                <div className="text-[10px] text-zinc-400 mt-1">
                  ℹ️ Cisco Nexus AI Fabric uses Lossless RoCEv2 (PFC 802.1Qbb + ECN). NVIDIA InfiniBand is available on NVIDIA DGX platforms.
                </div>
              )}
              <InfoHelper
                title="Why AI Requires Lossless Networks"
                text="In distributed AI, GPUs pause at synchronization barriers (All-Reduce / All-to-All) waiting for the slowest GPU to report. Standard TCP packet drops cause multi-millisecond retransmit timeouts, causing every GPU in the cluster to stall at 0% utilization."
                whyItMatters="RoCEv2 solves this using hardware PFC (Priority Flow Control) and ECN on Ethernet switches. InfiniBand solves it via hardware credit-based flow control."
              />
            </div>

            {/* PUE Slider */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-zinc-300">Facility PUE (Power Usage Effectiveness):</span>
                <span className="font-bold text-amber-400">{pue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.10"
                max="1.60"
                step="0.05"
                value={pue}
                onChange={(e) => setPue(Number(e.target.value))}
                className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>1.10 (Liquid Cooling)</span>
                <span>1.35 (Air Cooled)</span>
                <span>1.60 (Legacy DC)</span>
              </div>
              <InfoHelper
                title="Power Usage Effectiveness (PUE)"
                text="The ratio of total datacenter facility power (cooling, lighting, UPS losses) to the IT equipment power. PUE = 1.0 is perfect efficiency — all power goes to compute."
                whyItMatters="A liquid-cooled modern facility at PUE 1.10 uses ~18% less total power than an air-cooled one at PUE 1.35 for the same workload. This directly affects your power bill and datacenter capacity."
              />
            </div>
          </div>
        )}

        {/* 5. Serving Stack, Orchestration & LLM-D Disaggregation */}
        {activeInputTab === 'stack' && (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="font-semibold text-sm text-zinc-200 flex items-center gap-1.5">
                <Workflow className="w-4 h-4 text-sky-400" />
                5. Serving Engine, Orchestration & LLM-D
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                servingArchitecture === 'llmd' 
                  ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}>
                {servingArchitecture === 'llmd' ? 'LLM-D Disaggregated' : 'Colocated'}
              </span>
            </div>

            {/* Inference Engine Selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                High-Throughput Inference Runtime
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'vllm', name: 'vLLM (v1)', desc: 'PagedAttention + Chunked Prefill' },
                  { id: 'trt-llm', name: 'TensorRT-LLM', desc: 'NVIDIA Graph Compiler' },
                  { id: 'tgi', name: 'HuggingFace TGI', desc: 'Text Generation Inference' }
                ].map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => setServingEngine(engine.id)}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      servingEngine === engine.id
                        ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">{engine.name}</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{engine.desc}</div>
                  </button>
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
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Cluster Orchestration & Model Lifecycle
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'kserve', name: 'KServe (K8s)', desc: 'Cisco IKS / OpenShift' },
                  { id: 'ray', name: 'Ray Serve', desc: 'Distributed Pythonic' },
                  { id: 'docker', name: 'Docker / Compose', desc: 'Bare-Metal Container' }
                ].map((orch) => (
                  <button
                    key={orch.id}
                    type="button"
                    onClick={() => setOrchestrator(orch.id)}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      orchestrator === orch.id
                        ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">{orch.name}</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{orch.desc}</div>
                  </button>
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
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Serving Topology: Colocated vs. LLM-D Disaggregation
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServingArchitecture('colocated')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    servingArchitecture === 'colocated'
                      ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Unified (Colocated)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">Standard</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                    Every GPU handles both Prefill (prompt) and Decode (generation) in the same process.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setServingArchitecture('llmd')}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    servingArchitecture === 'llmd'
                      ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-sky-400">LLM-D Disaggregated</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/80 font-bold">Next-Gen</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                    Decouples Prefill nodes from Decode nodes. Streams KV caches over Cisco RoCEv2.
                  </div>
                </button>
              </div>

              <InfoHelper
                title="What is LLM-D (Disaggregated Prefill & Decode)?"
                text="Prefill and Decode have fundamentally opposing hardware bottlenecks: Prefill is compute-bound (Tensor Core TFLOPs), while Decode is memory-bandwidth bound (HBM TB/s). In traditional colocated serving, an incoming 32k prompt stalls ongoing token generation for all active users (causing severe latency spikes)."
                whyItMatters="LLM-D separates the cluster into dedicated Prefill Workers (e.g. B200 / H200 nodes) and Decode Workers. Once the prompt is processed, the KV cache chunk is transferred via RDMA over Cisco Nexus lossless RoCEv2 fabric to decode workers, eliminating jitter and maximizing overall GPU utilization."
              />
            </div>

            {/* LLM-D Disaggregation Configuration Panel */}
            {servingArchitecture === 'llmd' && (
              <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-xs text-zinc-200 uppercase tracking-wide">
                      LLM-D Disaggregation Configuration
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 font-semibold">
                    vLLM / KServe Disaggregated Architecture
                  </span>
                </div>

                {/* Strategy Toggle: Heterogeneous vs Homogeneous */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Hardware Compute Disaggregation Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLlmdDisaggregationMode('heterogeneous')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        llmdDisaggregationMode === 'heterogeneous'
                          ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-sky-400">Heterogeneous Split</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 font-semibold">
                          Optimal TCO
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                        Asymmetric: Compute-dense GPUs for Prefill (B200/H100) + Memory-dense GPUs for Decode (H200 141GB).
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLlmdDisaggregationMode('homogeneous')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        llmdDisaggregationMode === 'homogeneous'
                          ? 'bg-zinc-800 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-200">Homogeneous Split</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-semibold">
                          Uniform Fleet
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                        Symmetric: Both Prefill and Decode pools deploy identical server chassis from the primary platform.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Dual Node Allocation: Prefill Nodes & Decode Nodes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  
                  {/* Prefill Node Sizing */}
                  <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                        Prefill Workers (Prompt Ingestion)
                      </span>
                      <span className="font-mono font-bold text-sky-400 text-xs">
                        {prefillNodes} Node{prefillNodes > 1 ? 's' : ''} ({prefillNodes * platform.gpusPerChassis}x GPUs)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={prefillNodes}
                      onChange={(e) => setPrefillNodes(Number(e.target.value))}
                      className="w-full accent-sky-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                      <span>Platform: {platform.shortName}</span>
                      <span className="text-sky-300 font-mono">0 KV Retained (Compute-Bound)</span>
                    </div>
                  </div>

                  {/* Decode Node Sizing */}
                  <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        Decode Workers (Token Generation)
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {decodeNodes} Node{decodeNodes > 1 ? 's' : ''} ({decodeNodes * (llmdDisaggregationMode === 'heterogeneous' ? secondaryPlatform.gpusPerChassis : platform.gpusPerChassis)}x GPUs)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      step="1"
                      value={decodeNodes}
                      onChange={(e) => setDecodeNodes(Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                      <span>Platform: {llmdDisaggregationMode === 'heterogeneous' ? secondaryPlatform.shortName : platform.shortName}</span>
                      <span className="text-emerald-300 font-mono">KV Cache Bound ({effectiveConcurrency} Streams)</span>
                    </div>
                  </div>

                </div>

                {/* Disaggregation Ratio & Guidance */}
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs">
                  <div className="text-zinc-300 text-[11px]">
                    Prefill-to-Decode Cluster Ratio: <strong>{prefillNodes}P : {decodeNodes}D</strong> (1:{(decodeNodes / prefillNodes).toFixed(1)} ratio)
                  </div>
                  <span className="text-[10px] text-amber-400 font-medium">
                    {decodeNodes >= prefillNodes * 2 
                      ? '✓ High-throughput generation sizing' 
                      : 'ℹ Recommendation: 1:2 to 1:4 ratio for long context'}
                  </span>
                </div>

                {/* Heterogeneous Secondary Compute Platform Selector */}
                {llmdDisaggregationMode === 'heterogeneous' && (
                  <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-sky-400" />
                        Secondary Compute Platform (Decode Pool)
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Vendor: {selectedVendor === 'cisco' ? 'Cisco AI Factory' : 'NVIDIA DGX'}
                      </span>
                    </div>

                    <select
                      value={secondaryPlatformId}
                      onChange={(e) => setSecondaryPlatformId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px] text-zinc-300">
                      <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-500">Decode GPU</div>
                        <div className="font-bold text-white font-mono mt-0.5">{secondaryGpu.name}</div>
                      </div>
                      <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-500">HBM Capacity</div>
                        <div className="font-bold text-emerald-400 font-mono mt-0.5">{secondaryGpu.vramGb} GB HBM</div>
                      </div>
                      <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-500">HBM Bandwidth</div>
                        <div className="font-bold text-emerald-300 font-mono mt-0.5">{secondaryGpu.memBandwidthTbps || 4.8} TB/s</div>
                      </div>
                      <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-500">Chassis Form Factor</div>
                        <div className="font-mono text-zinc-300 mt-0.5 truncate">{secondaryPlatform.formFactor}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lossless RoCEv2 KV Cache Network Streaming Pill */}
                {results.bom.kvTransfer && (
                  <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-1.5 text-xs text-zinc-300">
                    <div className="flex items-center justify-between font-bold text-sky-400">
                      <span className="flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-sky-400" />
                        Lossless RoCEv2 KV Cache Network Streaming (GPUDirect RDMA)
                      </span>
                      <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
                        {results.bom.kvTransfer.fabricNicSpeed}G Fabric
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-400">Prompt KV Chunk Size</div>
                        <div className="font-bold text-white text-xs mt-0.5 font-mono">
                          ~{results.bom.kvTransfer.promptKvChunkGb} GB
                        </div>
                        <div className="text-[8px] text-zinc-500 mt-0.5">Per {contextLength.toLocaleString()} tokens</div>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-400">RoCEv2 Line Rate</div>
                        <div className="font-bold text-sky-400 text-xs mt-0.5 font-mono">
                          {results.bom.kvTransfer.fabricNicSpeed === 800 ? '~90 GB/s' : '~45 GB/s'}
                        </div>
                        <div className="text-[8px] text-zinc-500 mt-0.5">90% Wire Efficiency</div>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded border border-zinc-800">
                        <div className="text-[9px] text-zinc-400">Network Handoff Latency</div>
                        <div className="font-bold text-emerald-400 text-xs mt-0.5 font-mono">
                          ~{results.bom.kvTransfer.kvTransferLatencyMs} ms
                        </div>
                        <div className="text-[8px] text-zinc-500 mt-0.5">Zero GPU CPU Copy</div>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-normal pt-1">
                      💡 <strong>RDMA Advantage:</strong> Once Prefill finishes processing the prompt, the generated KV tensor chunk is streamed directly across the Cisco Nexus 9000 lossless RoCEv2 fabric into the Decode worker's VRAM in just <strong>~{results.bom.kvTransfer.kvTransferLatencyMs}ms</strong>. The Prefill GPU immediately frees all activation memory to accept the next prompt.
                    </p>
                  </div>
                )}

              </div>
            )}

            {/* Advanced Serving Optimizations Checkboxes */}
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2.5 text-xs">
              <span className="font-bold text-zinc-200 text-xs block">Engine Optimization Flags</span>
              
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableChunkedPrefill}
                  onChange={(e) => setEnableChunkedPrefill(e.target.checked)}
                  className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded"
                />
                <div>
                  <span className="font-medium text-zinc-200">Chunked Prefill (vLLM / TRT-LLM)</span>
                  <span className="block text-[10px] text-zinc-400">Splits large prompts into chunks and batches them alongside ongoing decode steps to prevent generation starvation.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePrefixCaching}
                  onChange={(e) => setEnablePrefixCaching(e.target.checked)}
                  className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded"
                />
                <div>
                  <span className="font-medium text-zinc-200">Automatic prefix caching</span>
                  <span className="block text-[10px] text-zinc-400">Retains common system prompts and RAG contexts in VRAM across queries, bypassing prefill computation for repeated prefixes.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSpeculativeDecoding}
                  onChange={(e) => setEnableSpeculativeDecoding(e.target.checked)}
                  className="mt-0.5 accent-sky-500 w-3.5 h-3.5 rounded"
                />
                <div>
                  <span className="font-medium text-zinc-200">Speculative Decoding (Draft Model Acceleration)</span>
                  <span className="block text-[10px] text-zinc-400">Pairs a lightweight draft model (e.g. LLaMA 8B) with the target model (LLaMA 70B) to verify multiple candidate tokens per memory read pass.</span>
                </div>
              </label>
            </div>

          </div>
        )}

        </main>

        {/* PANE 3: Right Summary Pane (Independently Scrollable) */}
        <aside className="w-[46%] xl:w-[48%] min-w-[400px] max-w-[780px] shrink-0 overflow-y-auto p-4 md:p-6 bg-zinc-900/30 space-y-4">
          
          {/* Sizing Status Banner */}
          {memory.llmd ? (
            <div className={`p-4 rounded-xl border ${
              memory.isOOM 
                ? 'bg-amber-950/40 border-amber-800 text-amber-200' 
                : (memory.llmd.prefill.headroomGb < 10 || memory.llmd.decode.headroomGb < 10)
                ? 'bg-amber-950/40 border-amber-800 text-amber-200' 
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                {memory.isOOM ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="font-bold text-sm flex items-center justify-between">
                    <span>
                      {memory.isOOM ? (
                        memory.llmd.prefill.isOOM && memory.llmd.decode.isOOM
                          ? 'OUT OF MEMORY: Both Prefill & Decode pools exceed GPU VRAM'
                          : memory.llmd.prefill.isOOM
                          ? `OUT OF MEMORY: Prefill pool exceeds VRAM on ${memory.llmd.prefill.gpu.name}`
                          : `OUT OF MEMORY: Decode pool exceeds VRAM on ${memory.llmd.decode.gpu.name}`
                      ) : (
                        `LLM-D Disaggregated Architecture Verified (Dual-Pool Sizing)`
                      )}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-700 text-zinc-300">
                      {memory.llmd.isHeterogeneous ? 'Heterogeneous' : 'Homogeneous'} Split
                    </span>
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed space-y-1">
                    {memory.isOOM ? (
                      results.recommendations.map((rec, i) => (
                        <div key={i} className="text-amber-300 font-medium">💡 Fix: {rec}</div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between bg-zinc-950/60 px-2.5 py-1.5 rounded border border-zinc-800/80">
                          <span className="text-sky-400 font-medium">
                            • Prefill Pool ({memory.llmd.prefill.nodes}x {memory.llmd.prefill.platform.shortName}):
                          </span>
                          <span className="font-mono text-zinc-200 text-[11px]">
                            <strong>{memory.llmd.prefill.totalUsedGb.toFixed(1)} GB</strong> / {memory.llmd.prefill.gpu.vramGb} GB ({memory.llmd.prefill.utilization}%) • <span className="text-emerald-400 font-semibold">{memory.llmd.prefill.headroomGb.toFixed(1)} GB free</span> (0 retained KV)
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-zinc-950/60 px-2.5 py-1.5 rounded border border-zinc-800/80">
                          <span className="text-emerald-400 font-medium">
                            • Decode Pool ({memory.llmd.decode.nodes}x {memory.llmd.decode.platform.shortName}):
                          </span>
                          <span className="font-mono text-zinc-200 text-[11px]">
                            <strong>{memory.llmd.decode.totalUsedGb.toFixed(1)} GB</strong> / {memory.llmd.decode.gpu.vramGb} GB ({memory.llmd.decode.utilization}%) • <span className="text-emerald-400 font-semibold">{memory.llmd.decode.headroomGb.toFixed(1)} GB free</span> ({effectiveConcurrency} streams)
                          </span>
                        </div>
                        <div className="text-[11px] text-sky-400 flex items-center gap-1.5 pt-0.5">
                          <Zap className="w-3.5 h-3.5 text-sky-400" />
                          <span>Lossless RoCEv2 KV Cache Streaming: ~{memory.llmd.kvTransfer.promptKvChunkGb} GB streamed in ~{memory.llmd.kvTransfer.kvTransferLatencyMs} ms over {memory.llmd.kvTransfer.fabricNicSpeed}G fabric.</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Colocated Sizing Status Banner */
            <div className={`p-4 rounded-xl border ${
              memory.isOOM 
                ? 'bg-amber-950/40 border-amber-800 text-amber-200' 
                : memory.headroomGb < 10 
                ? 'bg-amber-950/40 border-amber-800 text-amber-200' 
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                {memory.isOOM ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    {memory.isOOM 
                      ? `OUT OF MEMORY: Workload exceeds usable GPU VRAM by ${(memory.perGpuTotalUsedGb - memory.usableGpuCapacityGb).toFixed(1)} GB per GPU` 
                      : `Hardware Verified: Workload fits with ${memory.headroomGb.toFixed(1)} GB usable VRAM headroom per GPU`}
                  </div>
                  <div className="text-xs text-zinc-300 leading-relaxed">
                    {memory.isOOM ? (
                      results.recommendations.map((rec, i) => (
                        <div key={i} className="text-amber-300 font-medium">💡 Fix: {rec}</div>
                      ))
                    ) : (
                      <span>
                        Each GPU will use <strong>{memory.perGpuTotalUsedGb.toFixed(1)} GB</strong> ({memory.memoryUtilizationPercent}%) 
                        of <strong>{gpu.vramGb} GB</strong> available on <strong>{platform.name}</strong>.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Architecture Notices / Warnings Banner (if any) */}
          {results.warnings.length > 0 && !memory.isOOM && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-1 text-xs text-amber-200">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Architecture Sizing Notice</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 pl-1">
                {results.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* VRAM Allocation Visual Breakdown */}
          {memory.llmd ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  Disaggregated VRAM Breakdown (Dual Compute Pools)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800">
                  {memory.llmd.isHeterogeneous ? 'Heterogeneous VRAM Sizing' : 'Homogeneous Sizing'}
                </span>
              </div>

              {/* Pool 1: Decode Worker VRAM (Capacity-Bound) */}
              <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Decode Worker Pool (KV Cache Capacity & Bandwidth Bound)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300">
                    Target: {memory.llmd.decode.gpu.name} ({memory.llmd.decode.gpu.vramGb} GB HBM)
                  </span>
                </div>

                {/* Decode Stacked Progress Bar */}
                <div className="h-5 w-full bg-zinc-900 rounded-lg overflow-hidden flex border border-zinc-800 p-0.5">
                  <div
                    style={{ width: `${Math.min(100, (memory.llmd.decode.weightsGb / memory.llmd.decode.gpu.vramGb) * 100)}%` }}
                    className="bg-sky-500 hover:bg-sky-400 transition-all"
                    title={`Weights: ${memory.llmd.decode.weightsGb.toFixed(1)} GB`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (memory.llmd.decode.kvGb / memory.llmd.decode.gpu.vramGb) * 100)}%` }}
                    className="bg-sky-700 hover:bg-sky-600 transition-all"
                    title={`KV Cache: ${memory.llmd.decode.kvGb.toFixed(1)} GB`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (memory.llmd.decode.actGb / memory.llmd.decode.gpu.vramGb) * 100)}%` }}
                    className="bg-zinc-600 hover:bg-zinc-500 transition-all"
                    title={`Decode Activations: ${memory.llmd.decode.actGb.toFixed(1)} GB`}
                  />
                </div>

                {/* Decode Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-sky-500"></div>
                    <span className="text-zinc-300">Weights: <strong>{memory.llmd.decode.weightsGb.toFixed(1)} GB</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-sky-700"></div>
                    <span className="text-zinc-300">KV Cache: <strong>{memory.llmd.decode.kvGb.toFixed(1)} GB</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-600"></div>
                    <span className="text-zinc-300">Activations: <strong>{memory.llmd.decode.actGb.toFixed(1)} GB</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-700"></div>
                    <span className="text-zinc-400">Free: <strong>{Math.max(0, memory.llmd.decode.headroomGb).toFixed(1)} GB</strong></span>
                  </div>
                </div>
              </div>

              {/* Pool 2: Prefill Worker VRAM (Compute-Bound, 0 KV Retained) */}
              <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-sky-400" />
                    Prefill Worker Pool (Compute-Dense TFLOPs Engine)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300">
                    Target: {memory.llmd.prefill.gpu.name} ({memory.llmd.prefill.gpu.vramGb} GB HBM)
                  </span>
                </div>

                {/* Prefill Stacked Progress Bar */}
                <div className="h-5 w-full bg-zinc-900 rounded-lg overflow-hidden flex border border-zinc-800 p-0.5">
                  <div
                    style={{ width: `${Math.min(100, (memory.llmd.prefill.weightsGb / memory.llmd.prefill.gpu.vramGb) * 100)}%` }}
                    className="bg-sky-500 hover:bg-sky-400 transition-all"
                    title={`Weights: ${memory.llmd.prefill.weightsGb.toFixed(1)} GB`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (memory.llmd.prefill.actGb / memory.llmd.prefill.gpu.vramGb) * 100)}%` }}
                    className="bg-zinc-600 hover:bg-zinc-500 transition-all"
                    title={`Prompt Activations: ${memory.llmd.prefill.actGb.toFixed(1)} GB`}
                  />
                </div>

                {/* Prefill Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-sky-500"></div>
                    <span className="text-zinc-300">Weights: <strong>{memory.llmd.prefill.weightsGb.toFixed(1)} GB</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-600"></div>
                    <span className="text-zinc-300">Prompt Act: <strong>{memory.llmd.prefill.actGb.toFixed(1)} GB</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-800 border border-zinc-700"></div>
                    <span className="text-sky-400 font-semibold">KV Cache: <strong>0 GB (RDMA Stream)</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-700"></div>
                    <span className="text-zinc-400">Free: <strong>{Math.max(0, memory.llmd.prefill.headroomGb).toFixed(1)} GB</strong></span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Colocated VRAM Allocation Visual Breakdown */
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  VRAM Memory Breakdown (Per GPU)
                </span>
                <span className="text-zinc-400">
                  Target: {gpu.name} ({gpu.vramGb} GB Total)
                </span>
              </div>

              {/* Stacked Progress Bar */}
              <div className="h-6 w-full bg-zinc-950 rounded-lg overflow-hidden flex border border-zinc-800 p-0.5">
                {/* Sharded Weights */}
                <div
                  style={{ width: `${Math.min(100, (memory.perGpuWeightsGb / gpu.vramGb) * 100)}%` }}
                  className="bg-sky-500 hover:bg-sky-400 transition-all relative group"
                  title={`Weights: ${memory.perGpuWeightsGb.toFixed(1)} GB`}
                />
                {/* KV Cache or Optimizer */}
                <div
                  style={{ width: `${Math.min(100, (memory.perGpuKvOrOptGb / gpu.vramGb) * 100)}%` }}
                  className="bg-sky-700 hover:bg-sky-600 transition-all relative group"
                  title={`KV Cache / Optimizer: ${memory.perGpuKvOrOptGb.toFixed(1)} GB`}
                />
                {/* Activation / Overhead */}
                <div
                  style={{ width: `${Math.min(100, (memory.perGpuActGb / gpu.vramGb) * 100)}%` }}
                  className="bg-zinc-600 hover:bg-zinc-500 transition-all relative group"
                  title={`Activations/Overhead: ${memory.perGpuActGb.toFixed(1)} GB`}
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-sky-500"></div>
                  <span className="text-zinc-300">
                    Weights: <strong>{memory.perGpuWeightsGb.toFixed(1)} GB</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-sky-700"></div>
                  <span className="text-zinc-300">
                    {workloadType === 'inference' ? 'KV Cache:' : 'Optimizer:'}{' '}
                    <strong>{memory.perGpuKvOrOptGb.toFixed(1)} GB</strong>
                    {workloadType === 'inference' && memory.kvSavingsGb > 0 && (
                      <span className="text-[10px] text-emerald-400 font-mono ml-1 font-medium">
                        (-{memory.kvSavingsGb.toFixed(1)} GB)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-zinc-600"></div>
                  <span className="text-zinc-300">
                    Activations: <strong>{memory.perGpuActGb.toFixed(1)} GB</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-zinc-700"></div>
                  <span className="text-zinc-400">
                    Free VRAM: <strong>{Math.max(0, memory.headroomGb).toFixed(1)} GB</strong>
                  </span>
                </div>
              </div>

              {/* KV Optimization Summary Callout */}
              {workloadType === 'inference' && memory.kvSavingsGb > 0 && (
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>KV Precision: <strong className="text-sky-400">{kvPrecision.toUpperCase()}</strong> ({kvPrecision === 'fp8' ? '1.0 B' : kvPrecision === 'int4' ? '0.5 B' : '2.0 B'}/elem){prefixCacheRatio > 0 ? ` • ${(prefixCacheRatio * 100).toFixed(0)}% Prefix Sharing` : ''}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-medium">
                    ⚡ Saving {memory.kvSavingsGb.toFixed(1)} GB Total VRAM
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Inference Performance Profile (Dual: Prefill & Decode) */}
          {workloadType === 'inference' && throughput && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  Inference Performance Profile: Prefill (TTFT) & Decode (TPOT)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 font-mono">
                  {throughput.batchThroughputTps?.toLocaleString()} gen tok/s • {throughput.clusterBatchPromptTps?.toLocaleString()} prompt tok/s
                </span>
              </div>

              {/* Two-Column Grid: Prefill vs Decode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Phase 1: Prefill (Prompt Ingestion) */}
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/90 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-sky-400" />
                      1. Prefill Phase (Prompt Ingestion)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-sky-300 border border-zinc-700 font-mono font-bold">
                      Compute-Bound
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-zinc-900/90 p-2 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Time to 1st Token (TTFT)</div>
                      <div className="font-bold text-sky-400 text-sm mt-0.5 font-mono">
                        {throughput.ttftMs < 1000 ? `${throughput.ttftMs} ms` : `${throughput.ttftSec} s`}
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">at {contextLength.toLocaleString()} tokens</div>
                    </div>
                    <div className="bg-zinc-900/90 p-2 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Prompt Ingestion Rate</div>
                      <div className="font-bold text-sky-400 text-sm mt-0.5 font-mono">
                        ~{throughput.promptTokensPerSecPerReplica?.toLocaleString()} tok/s
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">Per Model Replica</div>
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                    ⚡ <strong>Tensor Core Bound:</strong> {prefixCacheRatio > 0 ? (
                      <span><strong>{(prefixCacheRatio * 100).toFixed(0)}% Prefix Cached:</strong> Evaluates {Math.max(1, Math.round(contextLength * (1 - (promptTokenRatio * prefixCacheRatio)))).toLocaleString()} uncached tokens ({throughput.promptPflops} PFLOPs) using {gpu.name}’s {throughput.gpuTflops?.toLocaleString()} TFLOPs engine.</span>
                    ) : (
                      <span>Evaluates all {contextLength.toLocaleString()} prompt tokens in parallel ({throughput.promptPflops} PFLOPs) using {gpu.name}’s {throughput.gpuTflops?.toLocaleString()} TFLOPs engine at 50% MFU.</span>
                    )}
                  </div>
                </div>

                {/* Phase 2: Decode (Token Generation) */}
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/90 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      2. Decode Phase (Token Generation)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-300 border border-zinc-700 font-mono font-bold">
                      Bandwidth-Bound
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-zinc-900/90 p-2 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Generation Latency (TPOT)</div>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5 font-mono">
                        ~{throughput.tpotMs} ms/tok
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">~{throughput.tokensPerSecPerGpu} tok/s stream</div>
                    </div>
                    <div className="bg-zinc-900/90 p-2 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-400">Cluster Batch Total</div>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5 font-mono">
                        ~{throughput.batchThroughputTps?.toLocaleString()} tok/s
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">×{dp} DP × {concurrency} Streams</div>
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                    💾 <strong>Memory Bandwidth Bound:</strong> {throughput.decodeNote || throughput.note}. Generation reads model weights on each step across {gpu.memBandwidthTbps} TB/s HBM.
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* DATACENTER BILL OF MATERIALS (DC BOM) - CISCO & NVIDIA SPECIFIC */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-sm text-zinc-100">
                  Datacenter Bill of Materials (DC BOM)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-sans">
                  {selectedVendor === 'cisco'
                    ? platform.id?.includes('smci')
                      ? 'Cisco Secure AI Factory (Supermicro + Nexus)'
                      : 'Cisco UCS & Nexus'
                    : 'NVIDIA DGX SuperPOD'}
                </span>
              </div>

              {/* View Switcher: Summary vs Granular Spec & Copy BOM */}
              <div className="flex items-center gap-2">
                <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setBomViewMode('summary')}
                    className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      bomViewMode === 'summary'
                        ? 'bg-sky-600 text-white font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Summary Pane
                  </button>
                  <button
                    type="button"
                    onClick={() => setBomViewMode('detailed')}
                    className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      bomViewMode === 'detailed'
                        ? 'bg-sky-600 text-white font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Granular Spec
                  </button>
                </div>

                {/* Copy BOM Button */}
                <button
                  type="button"
                  onClick={handleCopyBOM}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedBOM ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">BOM Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy BOM</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* View 1: Executive Summary Pane */}
            {bomViewMode === 'summary' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  
                  {/* Summary Card 1: Compute Platform */}
                  <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-sky-400" />
                        {bom.isDisaggregated ? 'Disaggregated Compute Nodes' : 'Compute Nodes & Accelerators'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                        {bom.isDisaggregated 
                          ? `${bom.chassisCount} Chassis (${bom.prefill.nodes}P + ${bom.decode.nodes}D)`
                          : (bom.isModular ? `${bom.chassisCount}x X9508 (${bom.bladePairsCount} Pairs)` : `${bom.chassisCount} Chassis`)}
                      </span>
                    </div>
                    {bom.isDisaggregated ? (
                      <div className="space-y-1.5 text-zinc-300 text-[11px]">
                        <div className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
                          <span className="text-sky-400 font-semibold">• Prefill Pool:</span>
                          <span className="font-mono text-white font-bold">{bom.prefill.nodes}x {bom.prefill.shortName} ({bom.prefill.gpuCount}x {bom.prefill.gpuName})</span>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
                          <span className="text-emerald-400 font-semibold">• Decode Pool:</span>
                          <span className="font-mono text-white font-bold">{bom.decode.nodes}x {bom.decode.shortName} ({bom.decode.gpuCount}x {bom.decode.gpuName})</span>
                        </div>
                        <div className="flex justify-between pt-0.5">
                          <span className="text-zinc-400">Total Accelerators:</span>
                          <span className="font-bold text-sky-400 font-mono">{bom.totalGpus} GPUs ({bom.aggregateVramTb} TB Active)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">RoCEv2 KV Stream:</span>
                          <span className="text-zinc-200 font-mono text-[10px]">~{bom.kvTransfer.promptKvChunkGb} GB/prompt (~{bom.kvTransfer.kvTransferLatencyMs} ms)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-zinc-300 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">System Model:</span>
                          <span className="font-bold text-white font-mono">{bom.platformName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Total Accelerators:</span>
                          <span className="font-bold text-sky-400 font-mono">{bom.totalGpus}x {gpu.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Aggregate VRAM:</span>
                          <span className="font-mono text-zinc-200">{bom.aggregateVramTb} TB Active {bom.gpusAllocated > bom.totalGpus ? `(${bom.physicalVramTb} TB physical)` : ''}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Host Processors:</span>
                          <span className="text-zinc-200 font-mono text-[10px] truncate max-w-[190px]" title={platform.hostCpu}>{platform.hostCpu}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary Card 2: Lossless Network Fabric */}
                  <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-sky-400" />
                        Lossless Scale-Out Fabric
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                        {network.totalClusterBisectionTbps.toFixed(1)} Tbps
                      </span>
                    </div>
                    <div className="space-y-1.5 text-zinc-300 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Leaf Switches:</span>
                        <span className="font-bold text-white font-mono">{bom.leafSwitchCount}x {bom.leafSwitchModel.split(' ')[2] || bom.leafSwitchModel.split(' ')[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Spine Switches:</span>
                        <span className="font-mono text-zinc-200">{bom.spineSwitchCount > 0 ? `${bom.spineSwitchCount}x Non-Blocking Spine` : 'None (Single Node)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Lossless Protocol:</span>
                        <span className="font-mono text-sky-400">{network.protocol === 'rocev2' ? 'Lossless RoCEv2 (PFC+ECN)' : 'Quantum-2 IB'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Fabric Cables:</span>
                        <span className="font-mono text-zinc-200">{bom.fabricCablesCount}x {network.nicSpeedGbps}G Twinax/AOC</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Card 3: Storage, OOB & Serving Stack */}
                  <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-sky-400" />
                        Serving Stack & Management
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                        {servingArchitecture === 'llmd' ? (bom.isHeterogeneous ? 'LLM-D (Hetero)' : 'LLM-D (Homo)') : 'Colocated'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-zinc-300 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Serving Runtime:</span>
                        <span className="font-bold text-white font-mono">{servingEngine.toUpperCase()} on {orchestrator.toUpperCase()}</span>
                      </div>
                      {bom.isDisaggregated && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">RoCEv2 KV Cache:</span>
                          <span className="font-mono text-sky-400">~{bom.kvTransfer.promptKvChunkGb}GB @ {bom.kvTransfer.fabricNicSpeed}G (~{bom.kvTransfer.kvTransferLatencyMs}ms)</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Storage Switches:</span>
                        <span className="font-mono text-zinc-200">{bom.storageSwitchCount}x GPUDirect Storage Leaf</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Management & OOB:</span>
                        <span className="font-mono text-zinc-200">{bom.oobSwitchCount}x 1G Mgmt Switch</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Management Suite:</span>
                        <span className="text-zinc-300 font-mono text-[10px] truncate max-w-[190px]" title={platform.managementSuite}>{platform.managementSuite}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Card 4: Datacenter Facility Footprint */}
                  <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Facility & Rack Footprint
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                        {pue.toFixed(2)} PUE
                      </span>
                    </div>
                    <div className="space-y-1.5 text-zinc-300 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Peak IT Load:</span>
                        <span className="font-bold text-amber-400 font-mono">{facility.totalItPowerKw.toFixed(1)} kW</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Facility Power Draw:</span>
                        <span className="font-bold text-amber-400 font-mono">{facility.totalFacilityPowerKw.toFixed(1)} kW</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Datacenter Racks:</span>
                        <span className="font-mono text-white font-bold">~{facility.totalRacks} standard 42U Racks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Rack Space Needed:</span>
                        <span className="font-mono text-zinc-300">{facility.totalRuNeeded} RU Usable</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Switch to detailed view button */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-zinc-500">
                    High-level architectural summary of all datacenter infrastructure components.
                  </span>
                  <button
                    type="button"
                    onClick={() => setBomViewMode('detailed')}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View Line-by-Line Equipment Breakdown</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ) : (
              /* View 2: Granular Datacenter BOM Table */
              <div className="space-y-3 text-xs">
                
                {/* Category 1: Compute Platform */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 space-y-1.5">
                  <div className="font-bold text-sky-400 text-xs flex items-center justify-between">
                    <span>1. Compute Servers & Accelerators</span>
                    <span className="text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 font-mono text-[11px]">
                      {bom.isDisaggregated 
                        ? `${bom.chassisCount} Chassis (${bom.prefill.nodes}P + ${bom.decode.nodes}D) • ${bom.totalGpus} GPUs Total`
                        : (bom.isModular ? `${bom.chassisCount}x X9508 (7U) • ${bom.bladePairsCount} Pairs` : `${bom.chassisCount} Chassis`) + ` • ${bom.totalGpus} GPUs Total`}
                    </span>
                  </div>
                  {bom.isDisaggregated ? (
                    <div className="space-y-2 text-zinc-300 text-[11px] pt-1">
                      <div className="bg-zinc-900/70 p-2.5 rounded border border-zinc-800 space-y-1">
                        <div className="font-bold text-sky-400 flex items-center justify-between">
                          <span>• Prefill Compute Pool (Prompt Processing & TFLOPs Engine)</span>
                          <span className="text-zinc-300 font-mono text-[10px]">{bom.prefill.totalPowerKw.toFixed(1)} kW • {bom.prefill.ru} RU</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-zinc-300 text-[11px]">
                          <div>Platform: <strong>{bom.prefill.nodes}x {bom.prefill.platformName}</strong></div>
                          <div>Accelerators: <strong>{bom.prefill.gpuCount}x {bom.prefill.gpuName}</strong></div>
                          <div className="text-[10px] text-zinc-400">Role: Evaluates prompt tokens with zero retained KV cache overhead.</div>
                          <div className="text-[10px] text-sky-400">Parallelism: TP={Math.min(8, bom.prefill.gpuCount)}, PP={Math.max(1, Math.ceil(bom.prefill.gpuCount / 8))}</div>
                        </div>
                      </div>

                      <div className="bg-zinc-900/70 p-2.5 rounded border border-zinc-800 space-y-1">
                        <div className="font-bold text-emerald-400 flex items-center justify-between">
                          <span>• Decode Compute Pool (Token Generation & Pooled KV Caches)</span>
                          <span className="text-zinc-300 font-mono text-[10px]">{bom.decode.totalPowerKw.toFixed(1)} kW • {bom.decode.ru} RU</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-zinc-300 text-[11px]">
                          <div>Platform: <strong>{bom.decode.nodes}x {bom.decode.platformName}</strong></div>
                          <div>Accelerators: <strong>{bom.decode.gpuCount}x {bom.decode.gpuName}</strong></div>
                          <div className="text-[10px] text-zinc-400">Role: Memory-bandwidth bound autoregressive generation ({effectiveConcurrency} active streams).</div>
                          <div className="text-[10px] text-emerald-400">Parallelism: TP={Math.min(8, bom.decode.gpuCount)}, PP={Math.max(1, Math.ceil(bom.decode.gpuCount / 8))}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 text-[11px] pt-0.5">
                        <div>• <strong>Total Accelerators:</strong> {bom.totalGpus} GPUs ({bom.aggregateVramTb} TB HBM logically active)</div>
                        <div>• <strong>RoCEv2 KV Cache Streaming:</strong> ~{bom.kvTransfer.promptKvChunkGb} GB streamed in ~{bom.kvTransfer.kvTransferLatencyMs} ms over {bom.kvTransfer.fabricNicSpeed}G fabric</div>
                        <div>• <strong>Host Processors:</strong> {bom.hostCpu}</div>
                        <div>• <strong>System Memory:</strong> {bom.systemRam}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 text-[11px] pt-1">
                      <div>• <strong>Platform Model:</strong> {bom.platformName}</div>
                      <div>• <strong>Architecture:</strong> {bom.chassisFormFactor}</div>
                      {platform.id?.includes('smci') && (
                        <div className="md:col-span-2 text-amber-400">
                          • <strong>Solution Tier:</strong> Cisco Secure AI Factory Validated Design (Supermicro Compute Node + Cisco Nexus Fabric)
                        </div>
                      )}
                      {bom.isModular && bom.fabricInterconnectModel && (
                        <div className="md:col-span-2 text-emerald-400">• <strong>Fabric Interconnects:</strong> {bom.fabricInterconnectModel}</div>
                      )}
                      <div>• <strong>Workload Required:</strong> {bom.totalGpus}x {gpu.name} ({bom.aggregateVramTb} TB HBM logically active)</div>
                      {bom.gpusAllocated > bom.totalGpus && (
                        <div className="text-zinc-400">
                          • <strong>Physically Installed:</strong> {bom.gpusAllocated}x {gpu.name} ({bom.physicalVramTb} TB HBM total — {bom.gpusAllocated - bom.totalGpus} sockets unallocated)
                        </div>
                      )}
                      <div>• <strong>Host Processors:</strong> {bom.hostCpu}</div>
                      <div>• <strong>System Memory:</strong> {bom.systemRam}</div>
                      <div>• <strong>Host I/O & NICs:</strong> {bom.hostNicsDesc}</div>
                    </div>
                  )}
                </div>

                {/* Category 2: Lossless Compute Network Fabric */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 space-y-1.5">
                  <div className="font-bold text-sky-400 text-xs flex items-center justify-between">
                    <span>2. Lossless Scale-Out Network Fabric</span>
                    <span className="text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700 font-mono text-[11px]">
                      {network.totalClusterBisectionTbps.toFixed(1)} Tbps Bisection
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 text-[11px] pt-1">
                    <div>• <strong>Rail Leaf Switches:</strong> {bom.leafSwitchCount}x {bom.leafSwitchModel}</div>
                    <div>• <strong>Spine Switches:</strong> {bom.spineSwitchCount}x {bom.spineSwitchModel}</div>
                    <div>• <strong>Topology:</strong> 1:1 Non-Blocking Clos (Zero Oversubscription)</div>
                    <div>• <strong>Lossless Mechanism:</strong> {network.protocol === 'rocev2' ? 'PFC (802.1Qbb) + ECN Flow Control' : 'Quantum-2 Credit-Based Control'}</div>
                    <div className="md:col-span-2">• <strong>Fabric Cabling:</strong> {bom.fabricCablesCount}x {bom.fabricCablesType}</div>
                  </div>
                </div>

                {/* Category 3: Storage, Out-of-Band & Management */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 space-y-1.5">
                  <div className="font-bold text-sky-400 text-xs flex items-center justify-between">
                    <span>3. Storage, Management & Software</span>
                    <span className="text-zinc-400 text-[10px]">GPUDirect & Telemetry</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 text-[11px] pt-1">
                    <div>• <strong>Storage Leaf Switch:</strong> {bom.storageSwitchCount}x {bom.storageSwitchModel}</div>
                    <div>• <strong>OOB Mgmt Switch:</strong> {bom.oobSwitchCount}x {bom.oobSwitchModel}</div>
                    <div>• <strong>Serving Stack:</strong> {servingEngine.toUpperCase()} on {orchestrator.toUpperCase()} {servingArchitecture === 'llmd' ? '(LLM-D)' : ''}</div>
                    <div>• <strong>Management Suite:</strong> {platform.managementSuite}</div>
                  </div>
                </div>

                {/* Category 4: Datacenter Facility Footprint */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded bg-zinc-900">
                    <div className="text-[10px] text-zinc-400">IT Power Load</div>
                    <div className="font-bold text-amber-400 text-sm mt-0.5">{facility.totalItPowerKw.toFixed(1)} kW</div>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900">
                    <div className="text-[10px] text-zinc-400">Total Facility Power</div>
                    <div className="font-bold text-amber-400 text-sm mt-0.5">{facility.totalFacilityPowerKw.toFixed(1)} kW</div>
                    <div className="text-[9px] text-zinc-500">{pue.toFixed(2)} PUE</div>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900">
                    <div className="text-[10px] text-zinc-400">Datacenter Racks</div>
                    <div className="font-bold text-white text-sm mt-0.5">~{facility.totalRacks} Racks</div>
                    <div className="text-[9px] text-zinc-500">42U Standard</div>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900">
                    <div className="text-[10px] text-zinc-400">Total Usable RU</div>
                    <div className="font-bold text-white text-sm mt-0.5">{facility.totalRuNeeded} RU</div>
                    <div className="text-[9px] text-zinc-500">Servers + Switches</div>
                  </div>
                </div>

                {/* Back to Summary button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setBomViewMode('summary')}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>← Back to BOM Summary Pane</span>
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* Visual Physical Topology Diagram Component */}
          <TopologyDiagram key={platform.id} results={results} gpu={gpu} platform={platform} protocol={protocol} />

          {/* Architectural Decision Guide & Plain English Glossary (Inside Summary Pane) */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs uppercase tracking-wide">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Architectural Decision Guide & Glossary</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
              <GlossaryCard
                term="Cisco (UCS & Supermicro) vs. NVIDIA DGX"
                definition="Cisco solutions offer compute flexibility: native Cisco UCS servers (AMD EPYC) and Supermicro HGX servers (Intel Xeon + up to 8TB RAM), both unified on Cisco Nexus deep-buffer RoCEv2 switches and Intersight. NVIDIA DGX provides turnkey SuperPOD reference clusters direct from NVIDIA."
                impact="Cisco gives enterprise network control and multi-vendor compute choice; DGX is turnkey pure-play AI supercomputing."
              />
              <GlossaryCard
                term="Tensor Parallelism (TP)"
                definition="Divides each matrix math calculation across a group of GPUs simultaneously. Because GPUs must communicate after every token, it must remain on high-speed NVLink."
                impact="Keep TP ≤ 8 (single node). Crossing standard network cables causes massive latency slowdowns."
              />
              <GlossaryCard
                term="Pipeline Parallelism (PP)"
                definition="Distributes consecutive layers of a giant model across separate server chassis (Node 1 does layers 1-40, Node 2 does 41-80)."
                impact="Used when a model exceeds 1 node. TP is maxed out inside the node, and PP bridges the nodes."
              />
              <GlossaryCard
                term="Lossless RoCEv2 (Nexus AI Fabric)"
                definition="AI clusters synchronize at barrier steps. If a single network packet is dropped, all GPUs sit idle waiting for a retransmission."
                impact="Cisco Nexus 9000 Cloud Scale ASICs provide deep packet buffers and smart ECN to eliminate packet drops without needing InfiniBand."
              />
              <GlossaryCard
                term="KV Cache Memory"
                definition="Remembers earlier words in a chat so the model doesn't recompute them. Scales directly with context window length and the number of active users."
                impact="Long context (32k–128k) eats more memory than the model weights! Choose high-VRAM GPUs like H200."
              />
              <GlossaryCard
                term="Rail-Optimized Leaf-Spine"
                definition="Each GPU in a server is cabled to an independent leaf switch rail, preventing inter-GPU traffic jams."
                impact="Delivers 1:1 non-blocking throughput across nodes without communication contention."
              />
            </div>

            <div className="text-center text-[10px] text-zinc-500 pt-3 pb-1">
              Private AI Infrastructure Sizing Calculator • Cisco & NVIDIA Datacenter Platforms • Port 8999
            </div>
          </div>

        </aside>

      </div>
    </div>
  );
}

