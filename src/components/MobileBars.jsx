import React from 'react';
import { ChevronDown, Menu } from 'lucide-react';

// Below lg the calculator shows one pane at a time. The section bar picks the section and
// switches between inputs and results; the summary bar keeps the headline numbers in view.

export function SectionBar({ ctx, pane, onPane, onOpenSections }) {
  const { activeInputTab, technicalNavTabs, economicsNavTabs } = ctx;
  const all = [...technicalNavTabs, ...economicsNavTabs];
  const index = all.findIndex(t => t.id === activeInputTab);
  const tab = all[index] || all[0];
  const Icon = tab.icon;
  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 py-2 flex items-center gap-2">
      <button
        type="button"
        data-testid="open-sections"
        onClick={onOpenSections}
        aria-label={`Section: ${index + 1}. ${tab.label}. Choose another section`}
        className="flex-1 min-w-0 h-10 flex items-center gap-2 px-3 rounded-md border border-zinc-700 bg-zinc-900 text-left cursor-pointer"
      >
        <Menu className="w-4 h-4 text-zinc-400 shrink-0" />
        <Icon className="w-4 h-4 text-sky-400 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm text-zinc-100">
          <span className="text-zinc-500 tabular-nums mr-1">{index + 1}.</span>{tab.label}
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
      </button>
      <div role="tablist" aria-label="View" className="shrink-0 inline-flex h-10 p-0.5 rounded-md border border-zinc-800 bg-zinc-900">
        {[{ id: 'inputs', label: 'Inputs' }, { id: 'results', label: 'Results' }].map(o => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={pane === o.id}
            data-testid={`pane-${o.id}`}
            onClick={() => onPane(o.id)}
            className={`px-3 rounded text-sm font-medium cursor-pointer ${pane === o.id ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SummaryBar({ ctx, pane, onPane }) {
  const { results, facility, memory } = ctx;
  return (
    <button
      type="button"
      data-testid="summary-bar"
      onClick={() => onPane(pane === 'results' ? 'inputs' : 'results')}
      className="shrink-0 w-full border-t border-zinc-800 bg-zinc-950 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center gap-4 text-left cursor-pointer"
    >
      <span className="flex items-baseline gap-1.5"><span className="text-xs text-zinc-500">GPUs</span><span className="text-sm font-semibold text-zinc-100 tabular-nums">{results.totalGpus.toLocaleString()}</span></span>
      <span className="flex items-baseline gap-1.5"><span className="text-xs text-zinc-500">Power</span><span className="text-sm font-semibold text-zinc-100 tabular-nums">{facility.totalItPowerKw.toFixed(1)} kW</span></span>
      <span className="hidden sm:flex items-baseline gap-1.5"><span className="text-xs text-zinc-500">Nodes</span><span className="text-sm font-semibold text-zinc-100 tabular-nums">{results.nodes.toLocaleString()}</span></span>
      <span className="ml-auto flex items-center gap-1.5 text-xs">
        <span className={`w-1.5 h-1.5 rounded-full ${memory.isOOM ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        <span className="text-sky-400 font-medium">{pane === 'results' ? 'Edit inputs' : 'View results'}</span>
      </span>
    </button>
  );
}
