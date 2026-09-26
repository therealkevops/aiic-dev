import React, { Suspense, lazy, useState, useMemo, useEffect } from 'react';
import {
  Activity, Building2, Layers, Network, Zap, HardDrive, Search, Workflow, Shield, Globe,
  LifeBuoy, GitBranch, Grid2x2, Timer, DollarSign, LineChart,
} from 'lucide-react';

import { PLATFORM_SYSTEMS, PLATFORM_VENDORS } from './data/platforms';
import { USE_CASE_PRESETS } from './data/presets';
import { DEFAULT_CONFIG, applyPresetConfig, withPlatform } from './state/config';
import { useRoute, rememberedMode } from './state/route';
import { HomePage } from './components/HomePage';
import { PageLoading } from './components/PageLoading';

// Each screen is its own chunk, so the home page loads only the engine and itself.
const AdvancedView = lazy(() => import('./components/AdvancedView'));
const LearningPage = lazy(() => import('./components/learning/LearningPage').then(m => ({ default: m.LearningPage })));
const GlossaryPage = lazy(() => import('./components/GlossaryPage').then(m => ({ default: m.GlossaryPage })));
import { computeScenario } from './utils/scenario';
import { buildBomText } from './utils/bomText';
import { scenarioMetrics } from './utils/compare';
import { buildReportHtml } from './utils/report';

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
  // --- Top-level route: home, learning mode, advanced calculator, or the guide ---
  const [route, navigate] = useRoute();
  const setPage = (p) => navigate({ page: p === 'glossary' ? 'guide' : 'advanced' });
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const setters = useMemo(() => makeSetters(setConfig), []);
  const [activeInputTab, setActiveInputTab] = useState('workload');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [copiedBOM, setCopiedBOM] = useState(false);
  // Scenario A for side-by-side comparison: a frozen copy of a configuration and its metrics.
  const [pinned, setPinned] = useState(null);
  const [guidedOpen, setGuidedOpen] = useState(false);

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
  const currentMetrics = useMemo(() => scenarioMetrics(config, scenario), [config, scenario]);
  // A preset label only describes the configuration until something is changed.
  const presetModified = useMemo(
    () => !!activePreset && Object.entries(applyPresetConfig(DEFAULT_CONFIG, activePreset.config))
      .some(([k, v]) => k in activePreset.config && config[k] !== v),
    [activePreset, config]
  );
  const currentLabel = activePreset ? `${activePreset.label}${presetModified ? ' (modified)' : ''}` : 'Custom configuration';

  const pinCurrentScenario = () => setPinned({ config, presetId: selectedPresetId, label: currentLabel, metrics: currentMetrics });
  const unpinScenario = () => setPinned(null);
  // Load A into the calculator and keep the current configuration as the new A.
  const swapWithPinned = () => {
    if (!pinned) return;
    pinCurrentScenario();
    setConfig(pinned.config);
    setSelectedPresetId(pinned.presetId);
  };

  // Vendor switch: pick that vendor's first platform, an H200 (or second) platform for the
  // LLM-D decode pool, and fall back to the vendor's default fabric if the current one isn't offered.
  const handleVendorChange = (vendorId) => {
    setConfig(c => {
      let next = { ...c, selectedVendor: vendorId };
      const vendorPlatforms = PLATFORM_SYSTEMS.filter(p => p.vendor === vendorId);
      if (vendorPlatforms.length > 0) {
        next = withPlatform(next, vendorPlatforms[0].id, PLATFORM_SYSTEMS);
        const secondaryCandidate = vendorPlatforms.find(p => p.id.includes('h200')) || vendorPlatforms[Math.min(1, vendorPlatforms.length - 1)];
        next.secondaryPlatformId = secondaryCandidate.id;
      }
      const vendor = PLATFORM_VENDORS.find(v => v.id === vendorId);
      if (vendor && !vendor.supportedProtocols.includes(next.selectedProtocolId)) next.selectedProtocolId = vendor.defaultProtocol;
      return next;
    });
  };

  const {
    workloadType, pue, enableRag, orchestrator, enableGuardrails, enableIngress,
    enableTrainingRedundancy, enableHaDr, enableMlops, enableMig,
  } = config;
  const {
    model, platform, tp, pp, dp, results, protocol, storageTier, rag, guardrails, guardModel, ingress, ingressTier,
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
    {
      id: 'sharding', label: 'Sharding', icon: Layers,
      meta: results.memory.llmd
        ? `P ${results.memory.llmd.prefill.instances}×TP${results.memory.llmd.prefill.tp} · D ${results.memory.llmd.decode.instances}×TP${results.memory.llmd.decode.tp}`
        : `TP=${tp} · PP=${pp} · DP=${dp}${results.epNodes > 1 ? ` · EP×${results.epNodes}` : ''}`,
    },
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
    { id: 'planning', label: 'Planning', icon: LineChart, meta: config.enableGrowthPlan && workloadType === 'inference' ? `+${config.demandGrowthPctPerYear}%/yr` : 'Sensitivity · rent vs buy' },
  ];

  // Everything a tab or pane component may read: config values, their setters, computed
  // scenario results and App-level UI state/handlers.
  const ctx = {
    ...config, ...setters, ...scenario,
    // In traffic mode the concurrency to size for is solved from the request rate.
    concurrency: scenario.traffic ? scenario.traffic.concurrency : config.concurrency,
    route, navigate, setPage, activeInputTab, setActiveInputTab, selectedPresetId, applyPreset, activePreset,
    handleVendorChange, copiedBOM, technicalNavTabs, economicsNavTabs,
  };
  ctx.config = config;
  ctx.openGuidedSetup = () => setGuidedOpen(true);
  ctx.setSelectedPlatformId = (id) => setConfig(c => withPlatform(c, id, PLATFORM_SYSTEMS));
  ctx.pinned = pinned;
  ctx.currentMetrics = currentMetrics;
  ctx.currentLabel = currentLabel;
  ctx.pinCurrentScenario = pinCurrentScenario;
  ctx.unpinScenario = unpinScenario;
  ctx.swapWithPinned = swapWithPinned;
  ctx.handleExportReport = () => {
    const html = buildReportHtml({ config, scenario, label: currentLabel, pinned, bomText: buildBomText(ctx) });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-sizing-report-${(selectedPresetId || 'custom')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  ctx.handleCopyBOM = () => {
    navigator.clipboard.writeText(buildBomText(ctx));
    setCopiedBOM(true);
    setTimeout(() => setCopiedBOM(false), 2500);
  };

  if (route.page === 'guide') {
    return (
      <Suspense fallback={<PageLoading />}>
        <GlossaryPage
          key={route.docId || 'overview'}
          initialDocId={route.docId}
          onBack={() => (window.history.length > 1 ? window.history.back() : navigate({ page: rememberedMode() || 'home' }))}
        />
      </Suspense>
    );
  }
  if (route.page === 'home') {
    return (
      <HomePage
        onLearn={(lessonId) => navigate({ page: 'learn', lessonId })}
        onAdvanced={() => navigate({ page: 'advanced' })}
        onGuidedSetup={() => { navigate({ page: 'advanced' }); setGuidedOpen(true); }}
        onGuide={() => navigate({ page: 'guide' })}
      />
    );
  }
  if (route.page === 'learn') {
    return (
      <Suspense fallback={<PageLoading />}>
        <LearningPage
          lessonId={route.lessonId}
          navigate={navigate}
          onOpenInAdvanced={(next) => {
            setConfig(next);
            setSelectedPresetId('');
            setActiveInputTab('workload');
            navigate({ page: 'advanced' });
          }}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <AdvancedView
        ctx={ctx}
        guidedOpen={guidedOpen}
        onCloseGuided={() => setGuidedOpen(false)}
        onApplyGuided={(next) => {
          setConfig(next);
          setSelectedPresetId('');
          setActiveInputTab('workload');
          setGuidedOpen(false);
        }}
      />
    </Suspense>
  );
}
