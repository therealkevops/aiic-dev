import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity, Building2, Layers, Network, Zap, HardDrive, Search, Workflow, Shield, Globe,
  LifeBuoy, GitBranch, Grid2x2, Timer, DollarSign,
} from 'lucide-react';

import { PLATFORM_SYSTEMS } from './data/platforms';
import { USE_CASE_PRESETS } from './data/presets';
import { DEFAULT_CONFIG, applyPresetConfig } from './state/config';
import { computeScenario } from './utils/scenario';
import { buildBomText } from './utils/bomText';
import { GlossaryPage } from './components/GlossaryPage';
import { AppHeader } from './components/AppHeader';
import { NavRail } from './components/NavRail';
import { ResultsPane } from './components/ResultsPane';
import { WorkloadTab } from './components/tabs/WorkloadTab';
import { PlatformTab } from './components/tabs/PlatformTab';
import { ShardingTab } from './components/tabs/ShardingTab';
import { NetworkTab } from './components/tabs/NetworkTab';
import { FacilityTab } from './components/tabs/FacilityTab';
import { StorageTab } from './components/tabs/StorageTab';
import { RagTab } from './components/tabs/RagTab';
import { ServingStackTab } from './components/tabs/ServingStackTab';
import { GuardrailsTab } from './components/tabs/GuardrailsTab';
import { IngressTab } from './components/tabs/IngressTab';
import { HaDrTab } from './components/tabs/HaDrTab';
import { TrainingRedundancyTab } from './components/tabs/TrainingRedundancyTab';
import { MlopsTab } from './components/tabs/MlopsTab';
import { MigTab } from './components/tabs/MigTab';
import { SlaTab } from './components/tabs/SlaTab';
import { CostTab } from './components/tabs/CostTab';

// One setter per config field (setContextLength, setEnableRag, ...), each accepting a value or
// an updater function, so tab components read like they did when every field was its own state.
function makeSetters(setConfig) {
  const setters = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    setters[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) =>
      setConfig(c => ({ ...c, [key]: typeof value === 'function' ? value(c[key]) : value }));
  }
  return setters;
}

export default function App() {
  // --- Top-level page (calculator vs. standalone glossary page) ---
  const [page, setPage] = useState('calculator'); // 'calculator' | 'glossary'
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const setters = useMemo(() => makeSetters(setConfig), []);
  const [activeInputTab, setActiveInputTab] = useState('workload');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [copiedBOM, setCopiedBOM] = useState(false);

  const scenario = useMemo(() => computeScenario(config), [config]);

  // Clamp the stored context length when a model with a shorter native limit is selected.
  useEffect(() => {
    if (config.contextLength > scenario.maxContextLength) setters.setContextLength(scenario.maxContextLength);
  }, [scenario.model.id, scenario.maxContextLength]);

  const applyPreset = (presetId) => {
    setSelectedPresetId(presetId);
    const preset = USE_CASE_PRESETS.find(p => p.id === presetId);
    if (!preset) return; // "" / unknown = keep the current configuration as a custom one
    setConfig(c => applyPresetConfig(c, preset.config));
    setActiveInputTab('workload');
  };
  const activePreset = useMemo(
    () => USE_CASE_PRESETS.find(p => p.id === selectedPresetId) || null,
    [selectedPresetId]
  );

  // Vendor switch: pick that vendor's first platform, an H200 (or second) platform for the
  // LLM-D decode pool, and force RoCEv2 on Cisco (no InfiniBand option there).
  const handleVendorChange = (vendorId) => {
    setConfig(c => {
      const next = { ...c, selectedVendor: vendorId };
      const vendorPlatforms = PLATFORM_SYSTEMS.filter(p => p.vendor === vendorId);
      if (vendorPlatforms.length > 0) {
        next.selectedPlatformId = vendorPlatforms[0].id;
        const secondaryCandidate = vendorPlatforms.find(p => p.id.includes('h200')) || vendorPlatforms[Math.min(1, vendorPlatforms.length - 1)];
        next.secondaryPlatformId = secondaryCandidate.id;
      }
      if (vendorId === 'cisco') next.selectedProtocolId = 'rocev2';
      return next;
    });
  };

  const {
    workloadType, pue, enableRag, orchestrator, enableGuardrails, enableIngress,
    enableTrainingRedundancy, enableHaDr, enableMlops, enableMig,
  } = config;
  const {
    model, platform, tp, pp, dp, protocol, storageTier, rag, guardrails, guardModel, ingress, ingressTier,
    trainingRedundancy, haDr, haDrTier, mlops, mlopsStrategy, mig, sla, cost,
  } = scenario;

  // Nav rail is split into two discrete groups: the technical architecture knobs (workload
  // through MIG) that determine what gets built, and the economics/SLA tabs (SLA, Cost & TCO)
  // that report on what those technical choices cost and how they perform -- consumed, not
  // configured. Grouping declutters the now-12-tab technical list without losing the single-page
  // live reactivity of toggling a knob and immediately seeing its cost/SLA impact.
  const technicalNavTabs = [
    { id: 'workload', label: 'Workload', icon: Activity, meta: model.name },
    { id: 'platform', label: 'Platform', icon: Building2, meta: platform.shortName },
    { id: 'sharding', label: 'Sharding', icon: Layers, meta: `TP=${tp} · PP=${pp} · DP=${dp}` },
    { id: 'network', label: 'Network Fabric', icon: Network, meta: protocol.name },
    { id: 'facility', label: 'Facility & Power', icon: Zap, meta: `${pue.toFixed(2)} PUE` },
    { id: 'storage', label: 'Storage', icon: HardDrive, meta: storageTier.vendor },
    { id: 'rag', label: 'RAG Pipeline', icon: Search, meta: rag.eligible ? `${rag.vectorDbNodesNeeded} DB nodes` : (enableRag ? 'N/A' : 'Off') },
    { id: 'stack', label: 'Serving Stack', icon: Workflow, meta: orchestrator.toUpperCase() },
    { id: 'guardrails', label: 'Guardrails', icon: Shield, meta: guardrails.eligible ? `${guardrails.guardGpusNeeded}x ${guardModel.name}` : (enableGuardrails ? 'N/A' : 'Off') },
    { id: 'ingress', label: 'Ingress & Edge', icon: Globe, meta: ingress.eligible ? `${ingress.nodesNeeded}x ${ingressTier.name}` : (enableIngress ? 'N/A' : 'Off') },
    {
      id: 'hadr',
      label: 'Resilience & DR',
      icon: LifeBuoy,
      meta: workloadType === 'training'
        ? (trainingRedundancy.eligible ? `${trainingRedundancy.spareNodeCount} spare node${trainingRedundancy.spareNodeCount === 1 ? '' : 's'}` : (enableTrainingRedundancy ? 'N/A' : 'Off'))
        : (haDr.eligible ? haDrTier.name : (enableHaDr ? 'N/A' : 'Off')),
    },
    { id: 'mlops', label: 'MLOps Lifecycle', icon: GitBranch, meta: mlops.eligible ? mlopsStrategy.name : (enableMlops ? 'N/A' : 'Off') },
    { id: 'mig', label: 'MIG Partitioning', icon: Grid2x2, meta: mig.eligible ? mig.selectedProfile.id : (enableMig ? 'N/A' : 'Off') },
  ];
  const economicsNavTabs = [
    { id: 'sla', label: 'SLA & Tail Latency', icon: Timer, meta: sla.eligible ? `P99 ${sla.ttftP99Sec < 1 ? `${(sla.ttftP99Sec * 1000).toFixed(0)}ms` : `${sla.ttftP99Sec.toFixed(1)}s`}` : 'N/A' },
    { id: 'cost', label: 'Cost & TCO', icon: DollarSign, meta: `$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr` },
  ];

  // Everything a tab or pane component may read: config values, their setters, computed
  // scenario results and App-level UI state/handlers.
  const ctx = {
    ...config, ...setters, ...scenario,
    page, setPage, activeInputTab, setActiveInputTab, selectedPresetId, applyPreset, activePreset,
    handleVendorChange, copiedBOM, technicalNavTabs, economicsNavTabs,
  };
  ctx.handleCopyBOM = () => {
    navigator.clipboard.writeText(buildBomText(ctx));
    setCopiedBOM(true);
    setTimeout(() => setCopiedBOM(false), 2500);
  };

  if (page === 'glossary') {
    return <GlossaryPage onBack={() => setPage('calculator')} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-none-text">
      {/* Top Banner / Header (Compact, Fixed at top) */}
      <AppHeader ctx={ctx} />

      {/* Main 3-Pane Layout Area (Fills Viewport Height) */}
      <div className="flex-1 flex overflow-hidden">

        {/* PANE 1: Left Navigation Rail */}
        <NavRail ctx={ctx} />

        {/* PANE 2: Central Configuration Variables Pane (Independently Scrollable) */}
        <main data-testid="config-pane" className="flex-1 min-w-[380px] overflow-y-auto p-4 md:p-6 bg-zinc-950/70 border-r border-zinc-800 space-y-4">

          {/* 1. Workload Mode & Model */}
          {activeInputTab === 'workload' && <WorkloadTab ctx={ctx} />}

          {/* 2. SPECIFIC GPU PLATFORM SELECTION (CISCO vs. NVIDIA) */}
          {activeInputTab === 'platform' && <PlatformTab ctx={ctx} />}

          {/* 3. Parallelism & Sharding Strategy (CONDITIONED ON PRECEDING VARIABLES) */}
          {activeInputTab === 'sharding' && <ShardingTab ctx={ctx} />}

          {/* 4. Network Fabric Configuration */}
          {activeInputTab === 'network' && <NetworkTab ctx={ctx} />}

          {/* 5. Facility & Power Configuration */}
          {activeInputTab === 'facility' && <FacilityTab ctx={ctx} />}

          {/* 6. Storage: checkpoint/dataset/model-repo capacity & throughput sizing */}
          {activeInputTab === 'storage' && <StorageTab ctx={ctx} />}

          {/* 7. RAG Pipeline: embedding-compute ingestion sizing + vector database serving */}
          {activeInputTab === 'rag' && <RagTab ctx={ctx} />}

          {/* 8. Serving Stack, Orchestration & LLM-D Disaggregation */}
          {activeInputTab === 'stack' && <ServingStackTab ctx={ctx} />}

          {/* 9. Guardrails: input/output safety-classifier pool */}
          {activeInputTab === 'guardrails' && <GuardrailsTab ctx={ctx} />}

          {/* 10. Ingress & Edge: load-balancing/TLS-termination/edge layer in front of the cluster */}
          {activeInputTab === 'ingress' && <IngressTab ctx={ctx} />}

          {/* 11. High Availability / Disaster Recovery: replica multipliers, RTO/RPO */}
          {activeInputTab === 'hadr' && workloadType === 'inference' && <HaDrTab ctx={ctx} />}

          {/* 11. Resilience & DR (training branch): spare/hot-standby node capacity, since HA/DR's
              live-replica redundancy doesn't apply to a training run -- see calculateTrainingRedundancy(). */}
          {activeInputTab === 'hadr' && workloadType === 'training' && <TrainingRedundancyTab ctx={ctx} />}

          {/* 12. MLOps Lifecycle: canary/shadow/blue-green model-rollout validation pool sizing */}
          {activeInputTab === 'mlops' && <MlopsTab ctx={ctx} />}

          {/* 13. MIG (Multi-Instance GPU) Partitioning */}
          {activeInputTab === 'mig' && <MigTab ctx={ctx} />}

          {/* 14. SLA / Tail-Latency Queueing */}
          {activeInputTab === 'sla' && <SlaTab ctx={ctx} />}

          {/* 15. Cost & TCO */}
          {activeInputTab === 'cost' && <CostTab ctx={ctx} />}

        </main>

        {/* PANE 3: Right Results Pane (Independently Scrollable) */}
        <ResultsPane ctx={ctx} />

      </div>
    </div>
  );
}
