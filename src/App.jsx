import React, { useState, useMemo, useEffect } from 'react';
import {
  Server,
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
  Database,
  Wand2,
  DollarSign,
  Grid2x2
} from 'lucide-react';

import { MODEL_PRESETS, PRECISION_OPTIONS } from './data/models';
import { GPU_CATALOG, NETWORK_PROTOCOLS } from './data/hardware';
import { PLATFORM_VENDORS, PLATFORM_SYSTEMS } from './data/platforms';
import { STORAGE_TIERS } from './data/storage';
import { GPU_PRICING, DEFAULT_GPU_PRICING, NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR, DEFAULT_NETWORK_HARDWARE_ADDER_PCT, DEFAULT_SUPPORT_PCT_PER_YEAR, DEFAULT_POWER_USD_PER_KWH, DEFAULT_COLO_USD_PER_KW_PER_MONTH, DEFAULT_TCO_YEARS } from './data/pricing';
import { USE_CASE_PRESETS } from './data/presets';
import { MIG_PROFILES } from './data/mig';
import { calculateInfra, calculateStorage, calculateCost, calculateMigConsolidation, recommendSharding } from './utils/calculator';
import { InfoHelper } from './components/InfoHelper';
import { TopologyDiagram } from './components/TopologyDiagram';
import { GlossaryPage } from './components/GlossaryPage';
import {
  Card, Disclosure, SectionLabel, KpiRow, Kpi, Rows, Row, Banner, Meter,
  SegmentedToggle, Field, SliderField, ScaleField, ChoiceCard, Tag
} from './components/ui';

export default function App() {
  // --- Top-level page (calculator vs. standalone glossary page) ---
  const [page, setPage] = useState('calculator'); // 'calculator' | 'glossary'

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
  const [manualDp, setManualDp] = useState(1);
  // DP is only ever auto-derived for inference, and only while TP/PP are also auto-solved
  // (the auto-DP formula is computed against the solver's own TP/PP, not a manual override).
  const [isAutoDp, setIsAutoDp] = useState(true);

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

  // --- Storage State ---
  const [selectedStorageTierId, setSelectedStorageTierId] = useState('vast-universal');
  const [checkpointRetentionCount, setCheckpointRetentionCount] = useState(3);
  const [checkpointTargetWriteTimeSec, setCheckpointTargetWriteTimeSec] = useState(60);
  const [datasetSizeTb, setDatasetSizeTb] = useState(50);
  const [modelRepoVersionCount, setModelRepoVersionCount] = useState(2);
  const [modelRepoTargetLoadTimeSec, setModelRepoTargetLoadTimeSec] = useState(120);
  const [corpusSizeGb, setCorpusSizeGb] = useState(0);
  const [enableKvOffload, setEnableKvOffload] = useState(false);

  // --- Cost & TCO State ---
  // Defaults match the default platform's GPU (h200-sxm); every figure here is an editable
  // illustrative estimate (see src/data/pricing.js), not a vendor quote.
  const [gpuUnitPriceUsd, setGpuUnitPriceUsd] = useState(DEFAULT_GPU_PRICING.estimatedUnitPriceUsd);
  const [cloudRateUsdPerHr, setCloudRateUsdPerHr] = useState(DEFAULT_GPU_PRICING.estimatedCloudRateUsdPerHr);
  const [networkHardwareAdderPct, setNetworkHardwareAdderPct] = useState(DEFAULT_NETWORK_HARDWARE_ADDER_PCT);
  const [powerUsdPerKwh, setPowerUsdPerKwh] = useState(DEFAULT_POWER_USD_PER_KWH);
  const [useColo, setUseColo] = useState(false);
  const [coloUsdPerKwPerMonth, setColoUsdPerKwPerMonth] = useState(DEFAULT_COLO_USD_PER_KW_PER_MONTH);
  const [enableNvidiaAiEnterprise, setEnableNvidiaAiEnterprise] = useState(false);
  const [supportPctPerYear, setSupportPctPerYear] = useState(DEFAULT_SUPPORT_PCT_PER_YEAR);
  const [tcoYears, setTcoYears] = useState(DEFAULT_TCO_YEARS);

  // --- MIG (Multi-Instance GPU) Partitioning State ---
  const [enableMig, setEnableMig] = useState(false);
  const [selectedMigProfileId, setSelectedMigProfileId] = useState(null); // null = auto-select smallest fitting profile

  // --- Use-case preset (header dropdown) ---
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const applyPreset = (presetId) => {
    setSelectedPresetId(presetId);
    const preset = USE_CASE_PRESETS.find(p => p.id === presetId);
    if (!preset) return; // "" / unknown = back to a blank custom configuration, nothing to apply
    const c = preset.config;
    setWorkloadType(c.workloadType);
    setSelectedModelId(c.selectedModelId);
    setSelectedPrecisionId(c.selectedPrecisionId);
    setKvPrecision(c.kvPrecision);
    setPrefixCacheRatio(c.prefixCacheRatio);
    setPromptTokenRatio(c.promptTokenRatio);
    setContextLength(c.contextLength);
    setConcurrency(c.concurrency);
    setMicroBatchSize(c.microBatchSize);
    setPue(c.pue);
    setTrainingType(c.trainingType);
    setZeroStage(c.zeroStage);
    setSelectedVendor(c.selectedVendor);
    setSelectedPlatformId(c.selectedPlatformId);
    setIsAutoSharding(c.isAutoSharding);
    setManualTp(c.manualTp);
    setManualPp(c.manualPp);
    setManualDp(c.manualDp);
    setIsAutoDp(c.isAutoDp);
    setSelectedProtocolId(c.selectedProtocolId);
    setServingEngine(c.servingEngine);
    setOrchestrator(c.orchestrator);
    setServingArchitecture(c.servingArchitecture);
    setEnableChunkedPrefill(c.enableChunkedPrefill);
    setEnablePrefixCaching(c.enablePrefixCaching);
    setEnableSpeculativeDecoding(c.enableSpeculativeDecoding);
    setLlmdDisaggregationMode(c.llmdDisaggregationMode);
    setSecondaryPlatformId(c.secondaryPlatformId);
    setPrefillNodes(c.prefillNodes);
    setDecodeNodes(c.decodeNodes);
    setSelectedStorageTierId(c.selectedStorageTierId);
    setCheckpointRetentionCount(c.checkpointRetentionCount);
    setCheckpointTargetWriteTimeSec(c.checkpointTargetWriteTimeSec);
    setDatasetSizeTb(c.datasetSizeTb);
    setModelRepoVersionCount(c.modelRepoVersionCount);
    setModelRepoTargetLoadTimeSec(c.modelRepoTargetLoadTimeSec);
    setCorpusSizeGb(c.corpusSizeGb);
    setEnableKvOffload(c.enableKvOffload);
    setGpuUnitPriceUsd(c.gpuUnitPriceUsd);
    setCloudRateUsdPerHr(c.cloudRateUsdPerHr);
    setNetworkHardwareAdderPct(c.networkHardwareAdderPct);
    setPowerUsdPerKwh(c.powerUsdPerKwh);
    setUseColo(c.useColo);
    setColoUsdPerKwPerMonth(c.coloUsdPerKwPerMonth);
    setEnableNvidiaAiEnterprise(c.enableNvidiaAiEnterprise);
    setSupportPctPerYear(c.supportPctPerYear);
    setTcoYears(c.tcoYears);
    setEnableMig(c.enableMig);
    setSelectedMigProfileId(c.selectedMigProfileId);
    setActiveInputTab('workload');
  };

  const activePreset = useMemo(
    () => USE_CASE_PRESETS.find(p => p.id === selectedPresetId) || null,
    [selectedPresetId]
  );

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
  const canAutoDp = workloadType === 'inference' && isAutoSharding;
  const dp = (canAutoDp && isAutoDp) ? autoRecommendation.dp : manualDp;

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
  const isLlmd = !!memory.llmd;

  // 3. Storage Sizing (capacity + throughput), independent of the compute solve above
  const storageTier = STORAGE_TIERS.find(t => t.id === selectedStorageTierId) || STORAGE_TIERS[0];
  const storage = useMemo(() => {
    return calculateStorage({
      workloadType,
      infraResults: results,
      storageTier,
      checkpointRetentionCount,
      checkpointTargetWriteTimeSec,
      datasetSizeTb,
      modelRepoVersionCount,
      modelRepoTargetLoadTimeSec,
      corpusSizeGb,
      enableKvOffload,
    });
  }, [
    workloadType,
    results,
    storageTier,
    checkpointRetentionCount,
    checkpointTargetWriteTimeSec,
    datasetSizeTb,
    modelRepoVersionCount,
    modelRepoTargetLoadTimeSec,
    corpusSizeGb,
    enableKvOffload,
  ]);

  // 4. MIG Partitioning -- a "what if" overlay, only meaningful for single-GPU-per-replica
  // (TP=1, PP=1) colocated inference on MIG-capable hardware; feeds an optional override into
  // Cost below rather than mutating the main compute/network/power sizing.
  const mig = useMemo(() => {
    return calculateMigConsolidation({
      infraResults: results,
      gpu,
      gpusPerChassis: platform.gpusPerChassis,
      chassisTdpKw: platform.chassisTdpKw,
      enabled: enableMig,
      migProfileId: selectedMigProfileId,
    });
  }, [results, gpu, platform, enableMig, selectedMigProfileId]);

  // 5. Cost & TCO -- consumes the already-computed infra + storage + MIG results, prices nothing new
  const decodeGpuId = memory.llmd?.decode?.gpu?.id;
  const decodeGpuPricing = decodeGpuId ? GPU_PRICING[decodeGpuId] : null;
  const cost = useMemo(() => {
    return calculateCost({
      infraResults: results,
      storageResults: storage,
      gpuUnitPriceUsd,
      cloudRateUsdPerHr,
      decodeGpuUnitPriceUsd: decodeGpuPricing?.estimatedUnitPriceUsd ?? null,
      decodeCloudRateUsdPerHr: decodeGpuPricing?.estimatedCloudRateUsdPerHr ?? null,
      networkHardwareAdderPct,
      storageUsdPerTbUsable: storageTier.estimatedUsdPerTbUsable,
      powerUsdPerKwh,
      useColo,
      coloUsdPerKwPerMonth,
      enableNvidiaAiEnterprise,
      licensingUsdPerGpuPerYear: NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR,
      supportPctPerYear,
      tcoYears,
      // Only override when MIG actually reduces the physical GPU count -- otherwise leave cost
      // identical to the non-MIG case rather than showing a slightly different number driven by
      // itPowerKw's coarser estimate (chassis power only, no network/switch power) with no real
      // consolidation to justify it.
      computeGpuCountOverride: (mig.eligible && mig.physicalGpusNeeded < mig.naiveGpuCount) ? mig.physicalGpusNeeded : null,
      itPowerKwOverride: (mig.eligible && mig.physicalGpusNeeded < mig.naiveGpuCount) ? mig.itPowerKw : null,
    });
  }, [
    results,
    storage,
    gpuUnitPriceUsd,
    cloudRateUsdPerHr,
    decodeGpuPricing,
    networkHardwareAdderPct,
    storageTier,
    powerUsdPerKwh,
    useColo,
    coloUsdPerKwPerMonth,
    enableNvidiaAiEnterprise,
    supportPctPerYear,
    tcoYears,
    mig,
  ]);

  // Copy BOM to clipboard
  const handleCopyBOM = () => {
    const isDisagg = bom.isDisaggregated;
    const bomText = `=====================================================
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
- Bisection Bandwidth: ${network.totalClusterBisectionTbps.toFixed(1)} Tbps (${network.nicSpeedGbps}G × ${network.totalComputeNics} NICs, 1:1 non-blocking)
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
- Required Capacity: ${storage.requiredCapacityTb.toFixed(2)} TB
- Required Throughput: ${storage.requiredThroughputGBs.toFixed(2)} GB/s (binding: ${storage.bindingConstraint})
- Achieved (Provisioned): ${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedThroughputGBs.toFixed(1)} GB/s
${storage.breakdown.map(b => `  * ${b.label}: ${b.capacityTb.toFixed(2)} TB — ${b.note}`).join('\n')}

5. MANAGEMENT, SERVING STACK & ORCHESTRATION
- Software Suite: ${platform.managementSuite}
- Serving Runtime: ${servingEngine.toUpperCase()} (${enableChunkedPrefill ? 'Chunked Prefill, ' : ''}${enablePrefixCaching ? 'Prefix Caching' : ''})
- Cluster Orchestrator: ${orchestrator.toUpperCase()}
- Serving Topology: ${servingArchitecture === 'llmd' ? `LLM-D Disaggregated Prefill & Decode (${bom.isHeterogeneous ? 'Heterogeneous Split' : 'Homogeneous Split'} over Lossless RoCEv2)` : 'Colocated (Unified P+D)'}

6. FACILITY & POWER FOOTPRINT
- Compute Power: ${facility.chassisPowerKw.toFixed(1)} kW
- Network Power: ${facility.networkPowerKw.toFixed(1)} kW
- Total IT Power: ${facility.totalItPowerKw.toFixed(1)} kW
- Total Facility Power (${pue.toFixed(2)} PUE): ${facility.totalFacilityPowerKw.toFixed(1)} kW
- Datacenter Racks: ~${facility.totalRacks} standard 42U Racks (${facility.totalRuNeeded} RU)

7. COST & TCO (ILLUSTRATIVE ESTIMATE -- NOT A VENDOR QUOTE)
- Total Capex: $${Math.round(cost.totalCapexUsd).toLocaleString()} (Compute $${Math.round(cost.computeCapexUsd).toLocaleString()} + Network/Storage $${Math.round(cost.networkHardwareCapexUsd + cost.storageCapexUsd).toLocaleString()})
- Annual Opex: $${Math.round(cost.annualOpexUsd).toLocaleString()}/yr (Power $${Math.round(cost.annualPowerCostUsd).toLocaleString()} + Licensing $${Math.round(cost.annualLicensingCostUsd).toLocaleString()} + Support $${Math.round(cost.annualSupportCostUsd).toLocaleString()})
- ${cost.tcoYears}-Year TCO: $${Math.round(cost.tcoUsd).toLocaleString()} (~$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr effective)
- vs. ${cost.tcoYears}-Yr Cloud Rental ($${cost.cloudEquivalentUsdPerHr.toFixed(2)}/hr cluster-wide): ${cost.buildVsBuySavingsUsd >= 0 ? `Owning saves $${Math.round(cost.buildVsBuySavingsUsd).toLocaleString()}` : `Cloud saves $${Math.round(-cost.buildVsBuySavingsUsd).toLocaleString()}`}
- Capex Break-Even vs. Cloud: ${cost.breakEvenMonths != null ? `~${Math.round(cost.breakEvenMonths)} months` : 'Never — cloud is cheaper at these rates'}
${workloadType === 'inference' && throughput ? `
8. ESTIMATED INFERENCE PERFORMANCE (PREFILL & DECODE)
- Prefill TTFT (Prompt Latency): ~${throughput.ttftMs < 1000 ? `${Number(throughput.ttftMs).toFixed(2)} ms` : `${Number(throughput.ttftSec).toFixed(2)} s`} (at ${contextLength.toLocaleString()} tokens)${isLlmd ? ` [includes ~${throughput.kvTransferLatencyMs}ms RoCEv2 handoff]` : ''}
- Prompt Ingestion Speed: ~${throughput.promptTokensPerSecPerReplica?.toLocaleString()} prompt tok/s per replica
- Generation Latency (TPOT): ~${throughput.tpotMs} ms/tok (~${throughput.tokensPerSecPerGpu} tok/s per stream)
- Cluster Generation Throughput: ~${throughput.batchThroughputTps?.toLocaleString()} gen tok/s total (×${dp} DP × ${concurrency} streams)\n` : ''}=====================================================`;

    navigator.clipboard.writeText(bomText);
    setCopiedBOM(true);
    setTimeout(() => setCopiedBOM(false), 2500);
  };

  const navTabs = [
    { id: 'workload', label: 'Workload', icon: Activity, meta: model.name },
    { id: 'platform', label: 'Platform', icon: Building2, meta: platform.shortName },
    { id: 'sharding', label: 'Sharding', icon: Layers, meta: `TP=${tp} · PP=${pp} · DP=${dp}` },
    { id: 'fabric', label: 'Fabric & PUE', icon: Network, meta: protocol.name },
    { id: 'storage', label: 'Storage', icon: HardDrive, meta: storageTier.vendor },
    { id: 'stack', label: 'Serving Stack', icon: Workflow, meta: orchestrator.toUpperCase() },
    { id: 'mig', label: 'MIG Partitioning', icon: Grid2x2, meta: mig.eligible ? mig.selectedProfile.id : (enableMig ? 'N/A' : 'Off') },
    { id: 'cost', label: 'Cost & TCO', icon: DollarSign, meta: `$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr` },
  ];

  if (page === 'glossary') {
    return <GlossaryPage onBack={() => setPage('calculator')} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-none-text">
      {/* Top Banner / Header (Compact, Fixed at top) */}
      <header className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 shrink-0 z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-semibold tracking-tight text-white flex items-center gap-2">
              <span>Private AI Infrastructure Sizing Calculator</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0">
                v2.0 · Cisco &amp; NVIDIA
              </span>
            </h1>
            <p
              className="text-[11px] text-zinc-400 hidden sm:block truncate"
              title={activePreset ? `${activePreset.label}: ${activePreset.description}` : undefined}
            >
              {activePreset
                ? <><strong className="text-sky-400 font-medium">{activePreset.label}:</strong> {activePreset.description}</>
                : 'Compute, VRAM sharding, LLM-D disaggregation, and lossless RoCEv2/IB fabric sizing.'}
            </p>
          </div>
        </div>

        {/* Use-Case Preset Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Wand2 className="w-3.5 h-3.5 text-sky-400 hidden sm:block" />
          <select
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg pl-2.5 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 max-w-[220px]"
          >
            <option value="">Preset: Custom configuration</option>
            <optgroup label="Enterprise">
              {USE_CASE_PRESETS.filter(p => p.category === 'enterprise').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Agentic">
              {USE_CASE_PRESETS.filter(p => p.category === 'agentic').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Neo-Cloud">
              {USE_CASE_PRESETS.filter(p => p.category === 'neocloud').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Quick Status KPI Strip */}
        <div className="flex items-stretch gap-px text-xs bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-3 py-1 bg-zinc-950/80 text-center min-w-0">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Platform</div>
            <div className="text-xs font-semibold text-white font-mono">
              {servingArchitecture === 'llmd'
                ? (llmdDisaggregationMode === 'heterogeneous' ? `${platform.shortName} + ${secondaryPlatform.shortName}` : `${platform.shortName} (LLM-D)`)
                : platform.shortName}
            </div>
          </div>
          <div className="px-3 py-1 bg-zinc-950/80 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">GPUs</div>
            <div className="text-xs font-semibold text-sky-400 font-mono">{results.totalGpus}</div>
          </div>
          <div className="px-3 py-1 bg-zinc-950/80 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Nodes</div>
            <div className="text-xs font-semibold text-sky-400 font-mono">{results.nodes}</div>
          </div>
          <div className="px-3 py-1 bg-zinc-950/80 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">IT Power</div>
            <div className="text-xs font-semibold text-amber-400 font-mono">{facility.totalItPowerKw.toFixed(1)} kW</div>
          </div>
          <div className="px-3 py-1 bg-zinc-950/80 text-center">
            <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Status</div>
            <div className={`text-xs font-semibold font-mono ${memory.isOOM ? 'text-amber-400' : 'text-emerald-400'}`}>
              {memory.isOOM ? 'OOM' : 'Fits'}
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Pane Layout Area (Fills Viewport Height) */}
      <div className="flex-1 flex overflow-hidden">

        {/* PANE 1: Left Navigation Rail */}
        <nav className="w-60 shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex flex-col justify-between overflow-y-auto">
          <div className="p-3 space-y-1.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Configuration
            </div>

            {navTabs.map((t, i) => {
              const Icon = t.icon;
              const active = activeInputTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveInputTab(t.id)}
                  className={`w-full text-left px-2.5 py-2.5 rounded-lg border transition cursor-pointer flex items-center gap-2.5 ${
                    active
                      ? 'bg-sky-500/10 border-sky-500/70 text-white'
                      : 'bg-transparent hover:bg-zinc-800/60 border-transparent text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className={`p-1.5 rounded-md shrink-0 ${active ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{i + 1}. {t.label}</div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{t.meta}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom of Nav Rail: Active sizing summary & copy BOM */}
          <div className="p-3 border-t border-zinc-800/90 bg-zinc-950/60 space-y-2">
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11.5px] space-y-1">
              <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase font-semibold tracking-wider">
                <span>Active Sizing</span>
                <span className={memory.isOOM ? 'text-amber-400' : 'text-emerald-400'}>
                  {memory.isOOM ? '● OOM' : '● Verified'}
                </span>
              </div>
              <div className="font-mono text-white font-medium truncate">
                {results.totalGpus}x {gpu.name} ({results.nodes} {results.nodes === 1 ? 'Node' : 'Nodes'})
              </div>
              <div className="text-zinc-400">
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
        <main className="flex-1 min-w-[380px] overflow-y-auto p-4 md:p-6 bg-zinc-950/70 border-r border-zinc-800 space-y-4">

          {/* 1. Workload Mode & Model */}
          {activeInputTab === 'workload' && (
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
                      {m.name} — {m.params}B params {m.isMoe ? '(MoE)' : ''}
                    </option>
                  ))}
                </select>
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
                marks={['2k (Prompt)', '32k (Docs)', maxContextLength >= 131072 ? '128k (Max)' : `${(maxContextLength / 1024).toFixed(0)}k (Max)`]}
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
                      min="0.1" max="0.9" step="0.05"
                      value={promptTokenRatio}
                      onChange={(e) => setPromptTokenRatio(Number(e.target.value))}
                      marks={['10% (Agentic / Code & Reasoning)', '50% (Chat)', '90% (RAG & Docs)']}
                      helper={
                        <InfoHelper
                          title="Workload Profile (Prompt vs. Output Split)"
                          text="Sets what share of each request's context window is input (prompt) tokens versus generated (output) tokens. RAG/document workloads skew high (mostly prompt, little generation); agentic and reasoning workloads skew low (a small prompt drives a long chain of generated tool calls and reasoning tokens)."
                          whyItMatters="Prefill (prompt) and decode (output) are sized differently: prefill is compute-bound and scales with prompt tokens, while decode is bandwidth-bound and scales with output tokens. Shifting this ratio shifts where the bottleneck falls and changes both throughput and KV cache growth per stream."
                        />
                      }
                    />
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
          )}

          {/* 2. SPECIFIC GPU PLATFORM SELECTION (CISCO vs. NVIDIA) */}
          {activeInputTab === 'platform' && (
            <Card
              icon={Building2}
              title="2. Datacenter Platform Selection"
              right={
                <SegmentedToggle
                  value={selectedVendor}
                  onChange={handleVendorChange}
                  options={PLATFORM_VENDORS.map(v => ({ value: v.id, label: v.id === 'cisco' ? 'Cisco Solutions' : 'NVIDIA DGX' }))}
                />
              }
              className="space-y-4"
            >
              {/* Platform Dropdown */}
              <Field
                label={`Select ${selectedVendor === 'cisco' ? 'AI Server Architecture' : 'NVIDIA DGX System'}`}
                helper={
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
                }
              >
                <select
                  value={selectedPlatformId}
                  onChange={(e) => setSelectedPlatformId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-sky-500 font-mono"
                >
                  {selectedVendor === 'cisco' ? (
                    <>
                      <optgroup label="Cisco UCS Rack Servers (AMD EPYC)">
                        {availablePlatforms
                          .filter((p) => !p.id.includes('smci') && !p.id.includes('x-series'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                      <optgroup label="Cisco UCS X-Series (Modular 7U Blade)">
                        {availablePlatforms
                          .filter((p) => p.id.includes('x-series'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                      <optgroup label="Cisco Secure AI Factory (Supermicro + Intel Xeon)">
                        {availablePlatforms
                          .filter((p) => p.id.includes('smci'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <optgroup label="NVIDIA DGX SuperPOD (Turnkey)">
                        {availablePlatforms
                          .filter((p) => p.id.includes('dgx'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                      <optgroup label="NVIDIA HGX (Generic OEM Reference Design)">
                        {availablePlatforms
                          .filter((p) => p.id.includes('hgx'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                      <optgroup label="NVIDIA MGX (Grace Superchip Reference Design)">
                        {availablePlatforms
                          .filter((p) => p.id.includes('mgx'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                          ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </Field>

              {/* Platform Specifications KPI Row */}
              <KpiRow>
                <Kpi label="Accelerator Payload" value={`${platform.gpusPerChassis}x`} sub={`${gpu.vramGb}GB VRAM/GPU`} tone="accent" />
                <Kpi label="Form Factor" value={platform.formFactor} sub={`${platform.chassisHeightRu} RU`} tone="accent" />
                <Kpi label="Chassis Power" value={`${platform.chassisTdpKw} kW`} sub="Peak load" tone="warn" />
              </KpiRow>

              {/* Host Processor & Memory Info */}
              <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg">
                <Rows>
                  <Row k="Host CPUs" v={platform.hostCpu} mono={false} />
                  <Row k="Host Memory" v={platform.systemRam} mono={false} />
                  <Row k="Host I/O" v={platform.hostNics} mono={false} />
                </Rows>
              </div>
            </Card>
          )}

          {/* 3. Parallelism & Sharding Strategy (CONDITIONED ON PRECEDING VARIABLES) */}
          {activeInputTab === 'sharding' && (
            <Card
              icon={Layers}
              title="3. Model Sharding & Parallelism"
              right={
                <SegmentedToggle
                  value={isAutoSharding ? 'auto' : 'manual'}
                  onChange={(v) => {
                    if (v === 'auto') { setIsAutoSharding(true); }
                    else { setIsAutoSharding(false); setManualTp(tp); setManualPp(pp); setManualDp(dp); }
                  }}
                  options={[{ value: 'auto', label: 'Auto-Solver' }, { value: 'manual', label: 'Manual Override' }]}
                />
              }
              className="space-y-4"
            >
              {isAutoSharding ? (
                <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Optimal Sharding Decision</span>
                    </span>
                    <Tag tone="accent">TP={tp} · PP={pp}</Tag>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {autoRecommendation.rationale}
                  </p>

                  <div className="text-[11.5px] pt-2 border-t border-zinc-800/70 flex items-center justify-between gap-3">
                    {autoRecommendation.fitsInOneNode ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate"><strong>Single Node:</strong> PP locked at 1.</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1.5 min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate"><strong>Multi-Node:</strong> TP={tp} on NVLink, PP={pp} across fabric.</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setIsAutoSharding(false); setManualTp(tp); setManualPp(pp); setManualDp(dp); }}
                      className="text-sky-400 hover:text-sky-300 underline font-medium shrink-0"
                    >
                      Override
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-200">
                    <span>Manual Mode: Customize TP &amp; PP independently.</span>
                    <button
                      type="button"
                      onClick={() => setIsAutoSharding(true)}
                      className="text-amber-300 underline font-semibold hover:text-amber-100 flex items-center gap-1 shrink-0 ml-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset to Solver
                    </button>
                  </div>

                  {/* TP Degree */}
                  <div>
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="font-medium text-zinc-300">Tensor Parallelism (TP Degree):</span>
                      <span className="font-semibold text-sky-400 font-mono">TP = {manualTp}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 4, 8].map((val) => (
                        <button
                          key={`tp-${val}`}
                          type="button"
                          onClick={() => setManualTp(val)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            manualTp === val ? 'bg-sky-600 border-sky-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
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
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="font-medium text-zinc-300">Pipeline Parallelism (PP Nodes):</span>
                      <span className="font-semibold text-sky-400 font-mono">PP = {manualPp}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 4, 8].map((val) => (
                        <button
                          key={`pp-${val}`}
                          type="button"
                          onClick={() => setManualPp(val)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            manualPp === val ? 'bg-sky-600 border-sky-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          PP={val}
                        </button>
                      ))}
                    </div>
                    {manualPp > 1 && manualTp < 8 && (
                      <div className="mt-2 p-2.5 bg-amber-950/60 border border-amber-700/60 rounded-lg text-[11px] text-amber-300 leading-snug">
                        <strong>Guidance:</strong> You have PP={manualPp} while TP is only {manualTp}. Maximize intra-node TP to 8 first over NVLink before splitting across nodes with PP.
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

              {/* DP Replicas (Applies to both modes; scales the cluster to 100s-1000s of GPUs) */}
              <div className="pt-3 border-t border-zinc-800/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">Data Parallelism / Replicas (DP):</span>
                  {canAutoDp && (
                    <SegmentedToggle
                      value={isAutoDp ? 'auto' : 'manual'}
                      onChange={(v) => { setIsAutoDp(v === 'auto'); if (v === 'manual') setManualDp(dp); }}
                      options={[{ value: 'auto', label: 'Auto-scale' }, { value: 'manual', label: 'Manual' }]}
                    />
                  )}
                </div>

                {canAutoDp && isAutoDp ? (
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">Sized to serve <strong className="text-white">{concurrency.toLocaleString()}</strong> concurrent streams</span>
                      <Tag tone="accent">DP = {dp.toLocaleString()}</Tag>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      ~{Math.ceil(concurrency / dp).toLocaleString()} streams/replica · {(dp * tp * pp).toLocaleString()} GPUs across all replicas
                    </div>
                  </div>
                ) : (
                  <ScaleField
                    value={dp}
                    onChange={setManualDp}
                    presets={[1, 8, 32, 128, 512, 2048]}
                    min={1}
                    max={4096}
                  />
                )}
                <InfoHelper
                  title="Data Parallelism (Horizontal Scaling)"
                  text="Creates complete independent copies of your model instance. Each replica serves its own share of concurrent users (or training batches) in parallel — this is the dimension that scales a deployment from a handful of GPUs to a 1,000-4,000+ GPU supercluster."
                  whyItMatters="For inference, Auto-scale derives DP directly from concurrency so every replica only has to hold KV cache for its own share of users. For training, pick DP to match your target cluster size — total GPUs = TP × PP × DP."
                />
              </div>
            </Card>
          )}

          {/* 4. Lossless Network & Facility Configuration */}
          {activeInputTab === 'fabric' && (
            <Card icon={Network} title="4. Lossless Scale-Out Fabric & Facility" className="space-y-4">
              <Field label="Scale-Out Network Architecture" helper={
                <>
                  {selectedVendor === 'cisco' && (
                    <div className="text-[11px] text-zinc-400 mt-1.5">
                      Cisco Nexus AI Fabric uses Lossless RoCEv2 (PFC 802.1Qbb + ECN). NVIDIA InfiniBand is available on NVIDIA DGX platforms.
                    </div>
                  )}
                  <InfoHelper
                    title="Why AI Requires Lossless Networks"
                    text="In distributed AI, GPUs pause at synchronization barriers (All-Reduce / All-to-All) waiting for the slowest GPU to report. Standard TCP packet drops cause multi-millisecond retransmit timeouts, causing every GPU in the cluster to stall at 0% utilization."
                    whyItMatters="RoCEv2 solves this using hardware PFC (Priority Flow Control) and ECN on Ethernet switches. InfiniBand solves it via hardware credit-based flow control."
                  />
                </>
              }>
                <select
                  value={selectedProtocolId}
                  onChange={(e) => setSelectedProtocolId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {availableProtocols.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.speedGbps} Gbps / port)</option>
                  ))}
                </select>
              </Field>

              {/* PUE Slider */}
              <div className="pt-3 border-t border-zinc-800/70">
                <SliderField
                  label="Facility PUE (Power Usage Effectiveness):"
                  valueLabel={pue.toFixed(2)}
                  accent="amber"
                  min="1.10" max="1.60" step="0.05"
                  value={pue}
                  onChange={(e) => setPue(Number(e.target.value))}
                  marks={['1.10 (Liquid Cooling)', '1.35 (Air Cooled)', '1.60 (Legacy DC)']}
                  helper={
                    <InfoHelper
                      title="Power Usage Effectiveness (PUE)"
                      text="The ratio of total datacenter facility power (cooling, lighting, UPS losses) to the IT equipment power. PUE = 1.0 is perfect efficiency — all power goes to compute."
                      whyItMatters="A liquid-cooled modern facility at PUE 1.10 uses ~18% less total power than an air-cooled one at PUE 1.35 for the same workload. This directly affects your power bill and datacenter capacity."
                    />
                  }
                />
              </div>
            </Card>
          )}

          {/* 5. Storage: checkpoint/dataset/model-repo capacity & throughput sizing */}
          {activeInputTab === 'storage' && (
            <Card
              icon={Database}
              title="5. Storage Capacity & Throughput"
              right={<Tag tone={storage.fits ? 'good' : 'warn'}>{storage.fits ? 'Sized to fit' : 'Undersized'}</Tag>}
              className="space-y-4"
            >
              <Field label="Storage Tier" helper={
                <InfoHelper
                  title="Storage Tier"
                  text="Reference storage platforms spanning the range enterprises and neo-clouds actually deploy, from throughput-dense NVMe parallel filesystems to cheap bulk object storage. Each tier is sized in rack-unit (RU) increments — capacity and throughput per RU vary widely between tiers."
                  whyItMatters="The tier determines how many RU are needed to satisfy both the capacity and throughput requirement below — whichever is more binding. A cheap, low-throughput tier can need far more RU (and rack space) than a throughput-dense one to hit the same target."
                />
              }>
                <div className="grid grid-cols-1 gap-1.5">
                  {STORAGE_TIERS.map((t) => (
                    <ChoiceCard
                      key={t.id}
                      selected={selectedStorageTierId === t.id}
                      onClick={() => setSelectedStorageTierId(t.id)}
                      title={`${t.vendor} — ${t.name}`}
                      desc={`${t.capacityPerRuTb} TB/RU · ${t.throughputPerRuGBs} GB/s/RU · ${t.recommendedFor}`}
                    />
                  ))}
                </div>
              </Field>

              {workloadType === 'training' ? (
                <>
                  <SliderField
                    label="Checkpoint Retention Count:"
                    valueLabel={`${checkpointRetentionCount} checkpoints`}
                    min="1" max="10" step="1"
                    value={checkpointRetentionCount}
                    onChange={(e) => setCheckpointRetentionCount(Number(e.target.value))}
                    marks={['1 (Latest only)', '3 (Typical)', '10 (Long rollback)']}
                  />
                  <SliderField
                    label="Checkpoint Write Time Budget:"
                    valueLabel={`${checkpointTargetWriteTimeSec}s`}
                    min="10" max="300" step="10"
                    value={checkpointTargetWriteTimeSec}
                    onChange={(e) => setCheckpointTargetWriteTimeSec(Number(e.target.value))}
                    marks={['10s (Aggressive)', '60s (Typical)', '300s (Relaxed)']}
                    helper={
                      <InfoHelper
                        title="Checkpoint Write Time Budget"
                        text="The wall-clock time budget for writing a full checkpoint (master weights + optimizer states) to storage. This sets the required sustained write throughput: throughput = checkpoint size ÷ this budget."
                        whyItMatters="At massive scale, a checkpoint that takes too long to write stalls every GPU in the cluster for its duration — a real, recurring cost during long pretraining runs. A tighter budget requires a faster (and more expensive) storage tier."
                      />
                    }
                  />
                  <ScaleField
                    label="Training Dataset Size:"
                    value={datasetSizeTb}
                    onChange={setDatasetSizeTb}
                    presets={[10, 50, 200, 1000]}
                    min={1} max={10000}
                    suffix=" TB"
                    helper={
                      <InfoHelper
                        title="Training Dataset Size"
                        text="The active, tokenized dataset footprint that must stay resident on fast storage for streaming into the training pipeline. Sized against a sustained ~200 MB/s-per-accelerator streaming target — a commonly cited floor for keeping modern accelerator pipelines fed without I/O stalls."
                        whyItMatters="Undersized dataset throughput shows up as GPU idle time waiting on data loaders, silently eating into effective MFU the same way a slow checkpoint write does."
                      />
                    }
                  />
                </>
              ) : (
                <>
                  <SliderField
                    label="Cached Model Versions:"
                    valueLabel={`${modelRepoVersionCount} versions`}
                    min="1" max="5" step="1"
                    value={modelRepoVersionCount}
                    onChange={(e) => setModelRepoVersionCount(Number(e.target.value))}
                    marks={['1 (Single version)', '2 (Blue/green)', '5 (Multi-version repo)']}
                  />
                  <SliderField
                    label="Model Load Time Budget:"
                    valueLabel={`${modelRepoTargetLoadTimeSec}s`}
                    min="15" max="300" step="15"
                    value={modelRepoTargetLoadTimeSec}
                    onChange={(e) => setModelRepoTargetLoadTimeSec(Number(e.target.value))}
                    marks={['15s (Fast autoscale)', '120s (Typical)', '300s (Relaxed)']}
                    helper={
                      <InfoHelper
                        title="Model Load Time Budget"
                        text="The wall-clock target for pulling model weights from the storage repository onto a newly booted or autoscaled serving node. Sets required read throughput: throughput = model size ÷ this budget."
                        whyItMatters="A tight budget matters for autoscaling and node-failure recovery — a slow model repo directly adds to time-to-first-token-served on a new replica."
                      />
                    }
                  />
                  <Field label="KV Cache Disk / CXL Offload">
                    <SegmentedToggle
                      options={[{ value: false, label: 'Disabled (VRAM only)' }, { value: true, label: 'Enabled' }]}
                      value={enableKvOffload}
                      onChange={setEnableKvOffload}
                    />
                  </Field>
                </>
              )}

              <ScaleField
                label="Document / Vector Corpus (optional):"
                value={corpusSizeGb}
                onChange={setCorpusSizeGb}
                presets={[0, 100, 500, 5000]}
                min={0} max={100000}
                suffix=" GB"
                helper={
                  <InfoHelper
                    title="Document / Vector Corpus"
                    text="Capacity for a RAG document store or vector index, sized independently of the compute-side KV cache. Capacity-only — not treated as throughput-binding against the storage tier."
                    whyItMatters="RAG-shaped workloads (document analysis, deep research agents) can carry a corpus far larger than the model itself; this keeps that capacity visible in the BOM even though it doesn't drive throughput sizing."
                  />
                }
              />

              <div className="pt-3 border-t border-zinc-800/70">
                <Rows>
                  <Row k="Required capacity" v={`${storage.requiredCapacityTb.toFixed(2)} TB`} tone="accent" />
                  <Row k="Required throughput" v={`${storage.requiredThroughputGBs.toFixed(2)} GB/s`} tone="accent" />
                  <Row k="Binding constraint" v={storage.bindingConstraint === 'throughput' ? 'Throughput' : 'Capacity'} mono={false} />
                  <Row k="Provisioned" v={`${storage.provisionedRu} RU of ${storage.storageTier.vendor}`} mono={false} />
                  <Row k="Achieved" v={`${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedThroughputGBs.toFixed(1)} GB/s`} tone={storage.fits ? 'good' : 'warn'} />
                </Rows>
              </div>
            </Card>
          )}

          {/* 6. Serving Stack, Orchestration & LLM-D Disaggregation */}
          {activeInputTab === 'stack' && (
            <Card
              icon={Workflow}
              title="6. Serving Engine, Orchestration & LLM-D"
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
                    desc="Decouples Prefill nodes from Decode nodes. Streams KV caches over Cisco RoCEv2."
                  />
                </div>
                <InfoHelper
                  title="What is LLM-D (Disaggregated Prefill & Decode)?"
                  text="Prefill and Decode have fundamentally opposing hardware bottlenecks: Prefill is compute-bound (Tensor Core TFLOPs), while Decode is memory-bandwidth bound (HBM TB/s). In traditional colocated serving, an incoming 32k prompt stalls ongoing token generation for all active users (causing severe latency spikes)."
                  whyItMatters="LLM-D separates the cluster into dedicated Prefill Workers (e.g. B200 / H200 nodes) and Decode Workers. Once the prompt is processed, the KV cache chunk is transferred via RDMA over Cisco Nexus lossless RoCEv2 fabric to decode workers, eliminating jitter and maximizing overall GPU utilization."
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
                        Once Prefill finishes processing the prompt, the generated KV tensor chunk streams across the Cisco Nexus 9000 lossless RoCEv2 fabric into the Decode worker's VRAM in ~{results.bom.kvTransfer.kvTransferLatencyMs}ms. The Prefill GPU immediately frees all activation memory to accept the next prompt.
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
          )}

          {/* 7. MIG (Multi-Instance GPU) Partitioning */}
          {activeInputTab === 'mig' && (
            <Card
              icon={Grid2x2}
              title="7. MIG Partitioning"
              right={mig.enabled ? <Tag tone={mig.eligible ? 'good' : 'warn'}>{mig.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
              className="space-y-4"
            >
              <Banner tone="info" icon={AlertTriangle}>
                MIG (Multi-Instance GPU) splits one physical GPU into up to 7 isolated instances. It's most valuable when a single replica needs far less than a whole GPU — small models, low concurrency, or many isolated tenants — and only applies to colocated inference where TP=1 and PP=1 (MIG instances have no NVLink between them, so a replica sharded across GPUs can't span them).
              </Banner>

              <Field label="MIG Partitioning">
                <SegmentedToggle
                  options={[{ value: false, label: 'Disabled (Dedicated Whole GPUs)' }, { value: true, label: 'Enabled' }]}
                  value={enableMig}
                  onChange={setEnableMig}
                />
              </Field>

              {enableMig && !mig.eligible && (
                <Banner tone="warn" icon={AlertTriangle}>
                  {mig.reason}
                </Banner>
              )}

              {enableMig && mig.eligible && (
                <>
                  <Field label="MIG Profile" helper={
                    <InfoHelper
                      title="MIG Profile"
                      text="Each profile trades isolated compute/memory slice size for how many instances fit on one physical GPU. Smaller profiles pack more replicas per GPU but give each replica a proportionally smaller share of compute and memory bandwidth."
                      whyItMatters="Picking a profile larger than needed wastes consolidation potential; picking one too small won't fit the workload at all. The smallest fitting profile maximizes physical GPU savings."
                    />
                  }>
                    <div className="grid grid-cols-1 gap-1.5">
                      {mig.availableProfiles.map((p) => (
                        <ChoiceCard
                          key={p.id}
                          selected={mig.selectedProfile.id === p.id}
                          onClick={() => setSelectedMigProfileId(p.id)}
                          title={p.id}
                          desc={`${p.slices}/7 compute slices · ${p.vramGb} GB VRAM · ${Math.floor(7 / p.slices)}x instances per physical GPU`}
                        />
                      ))}
                    </div>
                  </Field>

                  <div className="pt-3 border-t border-zinc-800/70">
                    <Rows>
                      <Row k="Replica footprint" v={`${memory.perGpuTotalUsedGb.toFixed(1)} GB`} mono={false} />
                      <Row k="Selected profile" v={`${mig.selectedProfile.id} (${mig.instancesPerPhysicalGpu}x per physical GPU)`} tone="accent" />
                      <Row k="Naive dedicated GPUs" v={`${mig.naiveGpuCount}`} mono={false} />
                      <Row k="MIG-consolidated physical GPUs" v={`${mig.physicalGpusNeeded}`} tone="good" />
                      <Row k="Physical GPU savings" v={`${mig.gpuCountSavings} GPUs (${mig.savingsPct.toFixed(0)}%)`} tone="good" />
                      <Row k="Physical nodes needed" v={`${mig.physicalNodesNeeded}`} mono={false} />
                      <Row k="Per-instance throughput" v={`~${(mig.throughputScaleFactor * 100).toFixed(0)}% of a whole GPU's rate`} mono={false} />
                    </Rows>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* 8. Cost & TCO */}
          {activeInputTab === 'cost' && (
            <Card
              icon={DollarSign}
              title="8. Cost & TCO"
              right={<Tag tone={cost.buildVsBuySavingsUsd >= 0 ? 'good' : 'warn'}>{cost.buildVsBuySavingsUsd >= 0 ? 'Owning wins' : 'Cloud wins'}</Tag>}
              className="space-y-4"
            >
              <Banner tone="info" icon={AlertTriangle}>
                Every figure below is an editable illustrative estimate, not a vendor quote — NVIDIA and enterprise storage vendors don't publish list prices. Replace with your actual quote for a real budget number.
              </Banner>

              {mig.eligible && mig.physicalGpusNeeded < mig.naiveGpuCount && (
                <Banner tone="good" icon={Grid2x2}>
                  MIG partitioning is active: compute capex and power below are priced against {mig.physicalGpusNeeded} MIG-consolidated physical GPU{mig.physicalGpusNeeded === 1 ? '' : 's'} ({mig.selectedProfile.id}), not the {mig.naiveGpuCount} dedicated GPUs a non-MIG deployment would need — a {mig.savingsPct.toFixed(0)}% reduction. The cloud comparison stays priced at {mig.naiveGpuCount} GPU-hours (cloud rental doesn't get the same consolidation benefit unless the provider offers fractional MIG billing).
                </Banner>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label={`${gpu.name} — Unit Price (Capex)`}>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                    <input type="number" min="0" step="500" value={gpuUnitPriceUsd}
                      onChange={(e) => setGpuUnitPriceUsd(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
                  </div>
                </Field>
                <Field label={`${gpu.name} — Cloud Rate ($/GPU-hr)`}>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                    <input type="number" min="0" step="0.05" value={cloudRateUsdPerHr}
                      onChange={(e) => setCloudRateUsdPerHr(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
                  </div>
                </Field>
              </div>

              <SliderField
                label="Network + Storage Hardware Adder:"
                valueLabel={`${networkHardwareAdderPct}%`}
                min="5" max="30" step="1"
                value={networkHardwareAdderPct}
                onChange={(e) => setNetworkHardwareAdderPct(Number(e.target.value))}
                marks={['5% (Minimal)', '15% (Typical)', '30% (Heavy Fabric)']}
                helper={
                  <InfoHelper
                    title="Network + Storage Hardware Adder"
                    text="Switches, cabling, transceivers, and out-of-band management hardware, modeled as a percentage of compute (GPU) capex rather than pricing every switch SKU individually — per-SKU enterprise networking pricing is just as opaque as GPU pricing. 10-20% is a commonly cited industry range for a well-architected AI cluster."
                    whyItMatters="This is on top of, not instead of, the GPU cost — skipping it understates capex by a meaningful margin, especially for large rail-optimized fabrics."
                  />
                }
              />

              <Field label="Power Billing Model">
                <SegmentedToggle
                  options={[{ value: false, label: 'Owned Datacenter ($/kWh)' }, { value: true, label: 'Colocation ($/kW/month)' }]}
                  value={useColo}
                  onChange={setUseColo}
                />
              </Field>

              {useColo ? (
                <Field label="Colocation Rate ($/kW/month)">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                    <input type="number" min="0" step="5" value={coloUsdPerKwPerMonth}
                      onChange={(e) => setColoUsdPerKwPerMonth(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
                  </div>
                  <div className="text-[10.5px] text-zinc-500 mt-1">Billed against IT load — the colo provider's own cooling/facility overhead is baked into their rate.</div>
                </Field>
              ) : (
                <SliderField
                  label="Electricity Rate ($/kWh):"
                  valueLabel={`$${powerUsdPerKwh.toFixed(2)}`}
                  min="0.05" max="0.30" step="0.01"
                  value={powerUsdPerKwh}
                  onChange={(e) => setPowerUsdPerKwh(Number(e.target.value))}
                  marks={['$0.05 (Low-Cost Region)', '$0.12 (US Average)', '$0.30 (High-Cost Region)']}
                  helper={<div className="text-[10.5px] text-zinc-500 mt-1">Billed against PUE-adjusted facility load (IT load × PUE) — your own cooling overhead is on your meter.</div>}
                />
              )}

              <Field label="NVIDIA AI Enterprise Software Licensing">
                <SegmentedToggle
                  options={[{ value: false, label: 'Open-Source Stack Only' }, { value: true, label: 'Include ($4,500/GPU/yr)' }]}
                  value={enableNvidiaAiEnterprise}
                  onChange={setEnableNvidiaAiEnterprise}
                />
              </Field>

              <SliderField
                label="Hardware Support & Maintenance:"
                valueLabel={`${supportPctPerYear}% of capex/yr`}
                min="5" max="25" step="1"
                value={supportPctPerYear}
                onChange={(e) => setSupportPctPerYear(Number(e.target.value))}
                marks={['5% (Minimal)', '15% (Typical)', '25% (Premium SLA)']}
              />

              <SliderField
                label="TCO Planning Horizon:"
                valueLabel={`${tcoYears} year${tcoYears > 1 ? 's' : ''}`}
                min="1" max="5" step="1"
                value={tcoYears}
                onChange={(e) => setTcoYears(Number(e.target.value))}
                marks={['1 yr', '3 yr (Typical)', '5 yr']}
              />

              <div className="pt-3 border-t border-zinc-800/70">
                <Rows>
                  <Row k="Compute capex" v={`$${Math.round(cost.computeCapexUsd).toLocaleString()}`} tone="accent" />
                  <Row k="Network + storage capex" v={`$${Math.round(cost.networkHardwareCapexUsd + cost.storageCapexUsd).toLocaleString()}`} mono={false} />
                  <Row k="Total capex" v={`$${Math.round(cost.totalCapexUsd).toLocaleString()}`} tone="accent" />
                  <Row k="Annual opex" v={`$${Math.round(cost.annualOpexUsd).toLocaleString()}/yr`} mono={false} />
                  <Row k={`${cost.tcoYears}-year TCO`} v={`$${Math.round(cost.tcoUsd).toLocaleString()}`} tone="accent" />
                  <Row k="Effective cost" v={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`} tone="accent" />
                  <Row k="Cloud-equivalent rate" v={`$${cost.cloudEquivalentUsdPerHr.toFixed(2)}/hr cluster-wide`} mono={false} />
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
              </div>
            </Card>
          )}

        </main>

        {/* PANE 3: Right Results Pane (Independently Scrollable) */}
        <aside className="w-[44%] xl:w-[42%] min-w-[420px] max-w-[760px] shrink-0 overflow-y-auto p-4 md:p-6 bg-zinc-900/30 space-y-4">

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
          {results.warnings.length > 0 && !memory.isOOM && (
            <Banner tone="warn" icon={AlertTriangle} title="Architecture sizing notice">
              <ul className="list-disc list-inside space-y-1">
                {results.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
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
                { label: workloadType === 'inference' ? 'KV Cache' : 'Optimizer', value: memory.perGpuKvOrOptGb, display: `${memory.perGpuKvOrOptGb.toFixed(1)} GB${workloadType === 'inference' && memory.kvSavingsGb > 0 ? ` (-${memory.kvSavingsGb.toFixed(1)} GB)` : ''}`, color: 'bg-sky-700' },
                { label: 'Activations', value: memory.perGpuActGb, display: `${memory.perGpuActGb.toFixed(1)} GB`, color: 'bg-zinc-600' },
                { label: 'Free', value: Math.max(0, memory.headroomGb), display: `${Math.max(0, memory.headroomGb).toFixed(1)} GB`, color: 'bg-zinc-800' },
              ]} />
              {workloadType === 'inference' && memory.kvSavingsGb > 0 && (
                <div className="pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11.5px]">
                  <span className="text-zinc-400">
                    KV precision: <strong className="text-sky-400">{kvPrecision.toUpperCase()}</strong>{prefixCacheRatio > 0 ? ` · ${(prefixCacheRatio * 100).toFixed(0)}% prefix sharing` : ''}
                  </span>
                  <span className="text-emerald-400 font-mono font-medium">Saving {memory.kvSavingsGb.toFixed(1)} GB</span>
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

              <Disclosure icon={Network} title="Lossless scale-out fabric" right={`${network.totalClusterBisectionTbps.toFixed(1)} Tbps`}>
                <Rows>
                  <Row k="Leaf switches" v={`${bom.leafSwitchCount}x ${bom.leafSwitchModel}`} mono={false} />
                  <Row k="Spine switches" v={bom.spineSwitchCount > 0 ? `${bom.spineSwitchCount}x ${bom.spineSwitchModel}` : 'None (single node)'} mono={false} />
                  <Row k="Topology" v="1:1 non-blocking Clos" mono={false} />
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
                  <Row k="Required capacity" v={`${storage.requiredCapacityTb.toFixed(2)} TB`} tone="accent" />
                  <Row k="Required throughput" v={`${storage.requiredThroughputGBs.toFixed(2)} GB/s`} tone="accent" />
                  <Row k="Achieved (provisioned)" v={`${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedThroughputGBs.toFixed(1)} GB/s`} tone={storage.fits ? 'good' : 'warn'} />
                  {storage.breakdown.map((b, i) => (
                    <Row key={i} k={b.label} v={`${b.capacityTb.toFixed(2)} TB — ${b.note}`} mono={false} />
                  ))}
                </Rows>
              </Disclosure>

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

              <Disclosure icon={DollarSign} title="Cost & TCO (illustrative estimate)" right={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`}>
                <Rows>
                  <Row k="Total capex" v={`$${Math.round(cost.totalCapexUsd).toLocaleString()}`} tone="accent" />
                  <Row k="Annual opex" v={`$${Math.round(cost.annualOpexUsd).toLocaleString()}/yr`} mono={false} />
                  <Row k={`${cost.tcoYears}-year TCO`} v={`$${Math.round(cost.tcoUsd).toLocaleString()}`} tone="accent" />
                  <Row k="Effective cost" v={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`} tone="accent" />
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

      </div>
    </div>
  );
}
