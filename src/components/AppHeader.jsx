import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Compass, Copy, FileDown, Home, MoreHorizontal, Pin, Server } from 'lucide-react';
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

function PresetSelect({ ctx, className = '', testId }) {
  const { activePreset, applyPreset, selectedPresetId } = ctx;
  return (
    <div className={`relative ${className}`}>
      <select
        data-testid={testId}
        aria-label="Scenario preset"
        value={selectedPresetId}
        onChange={(e) => applyPreset(e.target.value)}
        title={activePreset ? `${activePreset.label}: ${activePreset.description}` : 'Custom configuration'}
        className="appearance-none w-full h-10 lg:h-8 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-md pl-2.5 pr-8 text-base lg:text-xs text-zinc-100 truncate focus:outline-none focus:border-sky-500 cursor-pointer"
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
  );
}

function MenuItem({ icon: Icon, label, onClick, testId }) {
  return (
    <button type="button" role="menuitem" data-testid={testId} onClick={onClick} className="w-full h-11 flex items-center gap-3 px-3 rounded-md text-sm text-zinc-200 hover:bg-zinc-800 cursor-pointer">
      <Icon className="w-4 h-4 text-zinc-400" />{label}
    </button>
  );
}

// The "more" menu that holds what the header cannot fit below lg.
function HeaderMenu({ ctx }) {
  const { openGuidedSetup, pinned, pinCurrentScenario, handleExportReport, handleCopyBOM, copiedBOM, setPage, navigate } = ctx;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative lg:hidden shrink-0">
      <button
        type="button"
        data-testid="header-menu"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-10 h-10 flex items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 cursor-pointer"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl p-2 space-y-1">
          <div className="md:hidden px-1 pb-2 mb-1 border-b border-zinc-800 space-y-2">
            <div className="text-[11px] text-zinc-500 px-0.5 pt-1">Scenario</div>
            <PresetSelect ctx={ctx} testId="menu-preset-select" />
            <MenuItem icon={Compass} label="Guided setup" onClick={run(openGuidedSetup)} testId="menu-guided-setup" />
          </div>
          <MenuItem icon={Pin} label={pinned ? 'Re-pin as scenario A' : 'Compare: pin as scenario A'} onClick={run(pinCurrentScenario)} testId="menu-pin-scenario" />
          <MenuItem icon={FileDown} label="Download report" onClick={run(handleExportReport)} testId="menu-export-report" />
          <MenuItem icon={copiedBOM ? Check : Copy} label={copiedBOM ? 'Copied' : 'Copy bill of materials'} onClick={run(handleCopyBOM)} />
          <MenuItem icon={BookOpen} label="Architecture guide" onClick={run(() => setPage('glossary'))} />
          <MenuItem icon={Home} label="Home" onClick={run(() => navigate({ page: 'home' }))} />
        </div>
      )}
    </div>
  );
}

export function AppHeader({ ctx }) {
  const {
    activePreset, facility, memory, results, currentLabel, openGuidedSetup,
    pinned, pinCurrentScenario, handleExportReport, handleCopyBOM, copiedBOM, setPage, navigate,
  } = ctx;
  const modified = !!activePreset && currentLabel.endsWith('(modified)');

  return (
    <header className="h-14 px-3 sm:px-4 bg-zinc-950 border-b border-zinc-800 shrink-0 z-30 flex items-center gap-2 sm:gap-4">
      <ProductMark Icon={Server} onHome={() => navigate({ page: 'home' })} tagline="Private AI capacity, cost and power planning" />
      <ModeSwitch mode="advanced" onChange={(m) => navigate({ page: m })} />

      <div className="hidden md:block h-6 w-px bg-zinc-800 shrink-0" />

      {/* Scenario (in the "more" menu below md) */}
      <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
        <PresetSelect ctx={ctx} testId="preset-select" className="flex-1 min-w-[8rem] max-w-[18rem]" />
        {modified && (
          <span className="shrink-0 text-[10.5px] text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 whitespace-nowrap" title="Settings have changed since the preset was applied">
            Modified
          </span>
        )}
        <button
          type="button"
          data-testid="guided-setup"
          onClick={openGuidedSetup}
          title="Answer five questions to get a starting design"
          aria-label="Guided setup"
          className="shrink-0 h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 whitespace-nowrap cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden xl:inline">Guided setup</span>
        </button>
      </div>

      {/* Sizing summary */}
      <div className="ml-auto flex items-center gap-4 shrink-0 min-w-0">
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

      <div className="hidden lg:block h-6 w-px bg-zinc-800 shrink-0" />

      {/* Actions (in the "more" menu below lg) */}
      <div className="hidden lg:flex items-center gap-0.5 shrink-0">
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
      <HeaderMenu ctx={ctx} />
    </header>
  );
}
