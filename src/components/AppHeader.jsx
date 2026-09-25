import React from 'react';
import { Compass, Server, Wand2 } from 'lucide-react';
import { USE_CASE_PRESETS } from '../data/presets';

export function AppHeader({ ctx }) {
  const {
    activePreset, applyPreset, facility, llmdDisaggregationMode, memory, platform, openGuidedSetup,
    results, secondaryPlatform, selectedPresetId, servingArchitecture,
  } = ctx;
  return (
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

      {/* Guided setup + use-case preset dropdown */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="guided-setup"
          onClick={openGuidedSetup}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-700 bg-sky-950/40 hover:bg-sky-900/50 text-xs text-sky-200 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" /> Guided setup
        </button>
        <Wand2 className="w-3.5 h-3.5 text-sky-400 hidden sm:block" />
        <select
          data-testid="preset-select"
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
          <div data-testid="kpi-gpus" className="text-xs font-semibold text-sky-400 font-mono">{results.totalGpus}</div>
        </div>
        <div className="px-3 py-1 bg-zinc-950/80 text-center">
          <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Nodes</div>
          <div data-testid="kpi-nodes" className="text-xs font-semibold text-sky-400 font-mono">{results.nodes}</div>
        </div>
        <div className="px-3 py-1 bg-zinc-950/80 text-center">
          <div className="text-zinc-500 uppercase tracking-wider text-[9px]">IT Power</div>
          <div data-testid="kpi-power" className="text-xs font-semibold text-amber-400 font-mono">{facility.totalItPowerKw.toFixed(1)} kW</div>
        </div>
        <div className="px-3 py-1 bg-zinc-950/80 text-center">
          <div className="text-zinc-500 uppercase tracking-wider text-[9px]">Status</div>
          <div data-testid="kpi-status" className={`text-xs font-semibold font-mono ${memory.isOOM ? 'text-amber-400' : 'text-emerald-400'}`}>
            {memory.isOOM ? 'OOM' : 'Fits'}
          </div>
        </div>
      </div>
    </header>
  );
}
