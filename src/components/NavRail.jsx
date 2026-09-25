import React from 'react';
import { Check, Copy, FileDown, Pin } from 'lucide-react';

export function NavRail({ ctx }) {
  const {
    pinned, pinCurrentScenario, handleExportReport,
    activeInputTab, copiedBOM, economicsNavTabs, facility, gpu, handleCopyBOM,
    memory, results, setActiveInputTab, technicalNavTabs,
  } = ctx;
  return (
    <nav className="w-60 shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex flex-col justify-between overflow-y-auto">
      <div className="p-2.5 space-y-0.5">
        <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Technical Configuration
        </div>

        {technicalNavTabs.map((t, i) => {
          const Icon = t.icon;
          const active = activeInputTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`nav-${t.id}`}
              onClick={() => setActiveInputTab(t.id)}
              className={`w-full text-left px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-sky-500/10 border-sky-500/70 text-white'
                  : 'bg-transparent hover:bg-zinc-800/60 border-transparent text-zinc-300 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-md shrink-0 ${active ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-xs font-semibold">{i + 1}. {t.label}</div>
                <div className="text-[10.5px] text-zinc-400 truncate">{t.meta}</div>
              </div>
            </button>
          );
        })}

        <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-t border-zinc-800/70 mt-1">
          Economics &amp; SLA
        </div>

        {economicsNavTabs.map((t, i) => {
          const Icon = t.icon;
          const active = activeInputTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`nav-${t.id}`}
              onClick={() => setActiveInputTab(t.id)}
              className={`w-full text-left px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-sky-500/10 border-sky-500/70 text-white'
                  : 'bg-transparent hover:bg-zinc-800/60 border-transparent text-zinc-300 hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-md shrink-0 ${active ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-xs font-semibold">{i + 1}. {t.label}</div>
                <div className="text-[10.5px] text-zinc-400 truncate">{t.meta}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom of Nav Rail: Active sizing summary & copy BOM */}
      <div className="p-2 border-t border-zinc-800/90 bg-zinc-950/60 space-y-1">
        <div className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-0.5">
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
          className="w-full py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
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

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="pin-scenario"
            onClick={pinCurrentScenario}
            title="Freeze the current configuration as scenario A, then change settings to compare against it"
            className="py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5 text-zinc-400" />
            <span>{pinned ? 'Re-pin A' : 'Pin as A'}</span>
          </button>
          <button
            type="button"
            data-testid="export-report"
            onClick={handleExportReport}
            title="Download a printable HTML report of this sizing"
            className="py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-zinc-400" />
            <span>Report</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
