import React from 'react';
import { ArrowLeftRight, Pin, X } from 'lucide-react';
import { Card } from './ui';
import { compareMetrics } from '../utils/compare';

// Side-by-side view of the pinned scenario (A) against the live configuration (B). Better
// values are green; the delta column is B relative to A.
export function ScenarioCompare({ ctx }) {
  const { pinned, currentMetrics, swapWithPinned, unpinScenario, currentLabel } = ctx;
  if (!pinned) return null;
  const rows = compareMetrics(pinned.metrics, currentMetrics);
  const groups = [...new Set(rows.map(r => r.group))];
  const tone = (side, r) => (r.winner === side ? 'text-emerald-400' : 'text-zinc-200');

  return (
    <Card
      icon={Pin}
      title="Scenario comparison"
      right={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={swapWithPinned}
            title="Load A into the calculator and pin the current configuration as A"
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 cursor-pointer"
          >
            <ArrowLeftRight className="w-3 h-3" /> Swap
          </button>
          <button
            type="button"
            onClick={unpinScenario}
            title="Stop comparing"
            className="p-1 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] text-left border-collapse" data-testid="scenario-compare">
          <thead className="text-zinc-500 text-[10.5px] uppercase tracking-wide">
            <tr>
              <th className="py-1.5 pr-2 font-medium">Metric</th>
              <th className="py-1.5 pr-2 font-medium">A · {pinned.label}</th>
              <th className="py-1.5 pr-2 font-medium">B · {currentLabel}</th>
              <th className="py-1.5 font-medium text-right">B vs A</th>
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g} className="divide-y divide-zinc-800/60">
              <tr><td colSpan={4} className="pt-3 pb-1 text-[10.5px] uppercase tracking-wide text-zinc-500">{g}</td></tr>
              {rows.filter(r => r.group === g).map(r => (
                <tr key={r.label}>
                  <td className="py-1.5 pr-2 text-zinc-400 align-top">{r.label}</td>
                  <td className={`py-1.5 pr-2 font-mono align-top ${tone('a', r)}`}>{r.a}</td>
                  <td className={`py-1.5 pr-2 font-mono align-top ${tone('b', r)}`}>{r.b}</td>
                  <td className="py-1.5 font-mono text-right align-top text-zinc-400">
                    {r.delta == null ? '' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}
