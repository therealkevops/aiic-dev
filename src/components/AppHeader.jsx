import React from 'react';
import { BookOpen, Check, ChevronDown, Compass, Copy, FileDown, Pin, Server } from 'lucide-react';
import { USE_CASE_PRESETS } from '../data/presets';
import { ModeSwitch, ProductMark } from './ModeSwitch';

const PRESET_GROUPS = [
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'agentic', label: 'Agentic' },
  { id: 'neocloud', label: 'Neo-cloud' },
];

// Toolbar button: icon always, label on wide screens (the tooltip carries it below that).
function ActionButton({ icon: Icon, label, title, onClick, active = false, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title={title}
      aria-label={label}
      className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition cursor-pointer ${
        active ? 'text-emerald-300 bg-emerald-500/10' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );
}

function Stat({ label, value, testId }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span data-testid={testId} className="text-[13px] font-semibold text-zinc-100 tabular-nums">{value}</span>
    </div>
  );
}

export function AppHeader({ ctx }) {
  const {
    activePreset, applyPreset, facility, memory, results, selectedPresetId, currentLabel, openGuidedSetup,
    pinned, pinCurrentScenario, handleExportReport, handleCopyBOM, copiedBOM, setPage, navigate,
  } = ctx;
  const modified = !!activePreset && currentLabel.endsWith('(modified)');

  return (
    <header className="h-14 px-4 bg-zinc-950 border-b border-zinc-800 shrink-0 z-10 flex items-center gap-4">
      <ProductMark Icon={Server} onHome={() => navigate({ page: 'home' })} tagline="Private AI capacity, cost and power planning" />
      <ModeSwitch mode="advanced" onChange={(m) => navigate({ page: m })} />

      <div className="h-6 w-px bg-zinc-800 shrink-0" />

      {/* Scenario */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <select
            data-testid="preset-select"
            aria-label="Scenario preset"
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
            title={activePreset ? `${activePreset.label}: ${activePreset.description}` : 'Custom configuration'}
            className="appearance-none h-8 w-[13rem] xl:w-[16rem] 2xl:w-[18rem] bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-md pl-2.5 pr-8 text-xs text-zinc-100 truncate focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">Custom configuration</option>
            {PRESET_GROUPS.map(g => (
              <optgroup key={g.id} label={g.label}>
                {USE_CASE_PRESETS.filter(p => p.category === g.id).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {modified && (
          <span className="text-[10.5px] text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 whitespace-nowrap" title="Settings have changed since the preset was applied">
            Modified
          </span>
        )}
        <button
          type="button"
          data-testid="guided-setup"
          onClick={openGuidedSetup}
          title="Answer five questions to get a starting design"
          aria-label="Guided setup"
          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 whitespace-nowrap cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden xl:inline">Guided setup</span>
        </button>
      </div>

      {/* Sizing summary */}
      <div className="ml-auto flex items-center gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-4">
          <Stat label="GPUs" value={results.totalGpus.toLocaleString()} testId="kpi-gpus" />
          <Stat label="Nodes" value={results.nodes.toLocaleString()} testId="kpi-nodes" />
          <Stat label="IT power" value={`${facility.totalItPowerKw.toFixed(1)} kW`} testId="kpi-power" />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] leading-none font-medium whitespace-nowrap ${
            memory.isOOM ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${memory.isOOM ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span data-testid="kpi-status">{memory.isOOM ? 'Out of memory' : 'Fits'}</span>
        </span>
      </div>

      <div className="h-6 w-px bg-zinc-800 shrink-0" />

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <ActionButton
          icon={Pin}
          label={pinned ? 'Re-pin A' : 'Compare'}
          title="Freeze this configuration as scenario A, then change settings to compare against it"
          onClick={pinCurrentScenario}
          testId="pin-scenario"
        />
        <ActionButton icon={FileDown} label="Report" title="Download a printable HTML report of this sizing" onClick={handleExportReport} testId="export-report" />
        <ActionButton
          icon={copiedBOM ? Check : Copy}
          label={copiedBOM ? 'Copied' : 'Copy BOM'}
          title="Copy the bill of materials as text"
          onClick={handleCopyBOM}
          active={copiedBOM}
        />
        <ActionButton icon={BookOpen} label="Guide" title="Architecture guide and glossary" onClick={() => setPage('glossary')} />
      </div>
    </header>
  );
}
