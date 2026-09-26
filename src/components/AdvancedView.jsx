import React, { Suspense, lazy, useState } from 'react';
import { LearnLink } from './learning/LearnLink';
import { AppHeader } from './AppHeader';
import { NavRail, NavDrawer } from './NavRail';
import { SectionBar, SummaryBar } from './MobileBars';
import { useMinWidth, BREAKPOINTS } from '../state/useMediaQuery';
import { ResultsPane } from './ResultsPane';
import { WorkloadTab } from './tabs/WorkloadTab';
import { PlatformTab } from './tabs/PlatformTab';
import { ShardingTab } from './tabs/ShardingTab';
import { NetworkTab } from './tabs/NetworkTab';
import { FacilityTab } from './tabs/FacilityTab';
import { StorageTab } from './tabs/StorageTab';
import { RagTab } from './tabs/RagTab';
import { ServingStackTab } from './tabs/ServingStackTab';
import { GuardrailsTab } from './tabs/GuardrailsTab';
import { IngressTab } from './tabs/IngressTab';
import { HaDrTab } from './tabs/HaDrTab';
import { TrainingRedundancyTab } from './tabs/TrainingRedundancyTab';
import { MlopsTab } from './tabs/MlopsTab';
import { MigTab } from './tabs/MigTab';
import { SlaTab } from './tabs/SlaTab';
import { CostTab } from './tabs/CostTab';
import { PlanningTab } from './tabs/PlanningTab';

const GuidedSetup = lazy(() => import('./GuidedSetup').then(m => ({ default: m.GuidedSetup })));

// The Advanced-mode calculator screen. Its state lives in App (so presets, lessons and guided
// setup can load designs into it); this module holds the layout and is loaded on demand.
export default function AdvancedView({ ctx, guidedOpen, onCloseGuided, onApplyGuided }) {
  const { activeInputTab, setActiveInputTab, navigate, workloadType } = ctx;
  // Below lg one pane shows at a time and the section list is a slide-out menu.
  const wide = useMinWidth(BREAKPOINTS.lg);
  const [pane, setPane] = useState('inputs');
  const [sectionsOpen, setSectionsOpen] = useState(false);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-none-text">
      {/* Top Banner / Header (Compact, Fixed at top) */}
      <AppHeader ctx={ctx} />

      {guidedOpen && (
        <Suspense fallback={null}>
          <GuidedSetup current={ctx.config} onClose={onCloseGuided} onApply={onApplyGuided} />
        </Suspense>
      )}

      {!wide && (
        <>
          <SectionBar ctx={ctx} pane={pane} onPane={setPane} onOpenSections={() => setSectionsOpen(true)} />
          <NavDrawer
            ctx={ctx}
            open={sectionsOpen}
            onClose={() => setSectionsOpen(false)}
            onSelect={(id) => { setActiveInputTab(id); setPane('inputs'); setSectionsOpen(false); }}
          />
        </>
      )}

      {/* Main layout: nav rail, inputs and results side by side from lg; one pane at a time below */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* PANE 1: Left Navigation Rail */}
        {wide && <NavRail ctx={ctx} />}

        {/* PANE 2: Central Configuration Variables Pane (Independently Scrollable) */}
        {(wide || pane === 'inputs') && (
        <main data-testid="config-pane" className="flex-1 min-w-0 lg:min-w-[360px] overflow-y-auto p-3 sm:p-4 md:p-6 bg-zinc-950/70 lg:border-r border-zinc-800 space-y-4">

          <LearnLink tabId={activeInputTab} navigate={navigate} />

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

          {/* 16. Planning: sensitivity, rent vs buy, growth over time */}
          {activeInputTab === 'planning' && <PlanningTab ctx={ctx} />}

        </main>
        )}

        {/* PANE 3: Right Results Pane (Independently Scrollable) */}
        {(wide || pane === 'results') && <ResultsPane ctx={ctx} />}

      </div>

      {!wide && <SummaryBar ctx={ctx} pane={pane} onPane={setPane} />}
    </div>
  );
}
