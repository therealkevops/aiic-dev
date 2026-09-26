import React, { useEffect, useMemo, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { PLATFORM_VENDORS } from '../data/platforms';
import { ChoiceCard, ScaleField, SegmentedToggle, Tag } from './ui';
import { DEFAULT_ANSWERS, DOC_LENGTHS, USE_CASES, recommendFromAnswers } from '../utils/guidedSetup';

const usd = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3).toLocaleString()}k`);

function Question({ n, title, hint, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-semibold text-zinc-100"><span className="text-sky-400 mr-1.5">{n}.</span>{title}</h3>
      {hint && <p className="text-[11px] text-zinc-500 -mt-1">{hint}</p>}
      {children}
    </section>
  );
}

const inputCls = 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500';

export function GuidedSetup({ current, onApply, onClose }) {
  const [answers, setAnswers] = useState({ ...DEFAULT_ANSWERS, vendor: current.selectedVendor || DEFAULT_ANSWERS.vendor });
  const [pickedId, setPickedId] = useState(null);
  const set = (k) => (v) => { setAnswers(a => ({ ...a, [k]: v })); setPickedId(null); };
  const useCase = USE_CASES.find(u => u.id === answers.useCase);
  const training = !!useCase.training;
  const result = useMemo(() => recommendFromAnswers(answers, current), [answers, current]);
  const chosen = result.candidates.find(c => c.platformId === pickedId) || result.recommended;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-setup-title"
        data-testid="guided-setup-dialog"
        className="w-full max-w-5xl bg-zinc-900 sm:border border-zinc-800 sm:rounded-xl shadow-2xl min-h-full sm:min-h-0 sm:my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-zinc-900 sm:rounded-t-xl flex items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800">
          <h2 id="guided-setup-title" className="text-sm font-semibold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" /> Guided setup
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-[1fr_380px] gap-0">
          <div className="p-4 sm:p-5 space-y-5 md:border-r border-zinc-800">
            <Question n={1} title="What will it do?">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {USE_CASES.map(u => (
                  <ChoiceCard key={u.id} selected={answers.useCase === u.id} onClick={() => set('useCase')(u.id)} title={u.label} desc={u.desc} />
                ))}
              </div>
            </Question>

            {training ? (
              <Question n={2} title="How much data, and how soon?" hint="Training tokens are the dataset size times the number of passes over it.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[11px] text-zinc-400 space-y-1 block">
                    <span>Training tokens (billions)</span>
                    <input type="number" min="0.01" step="0.1" className={inputCls}
                      value={answers.trainingTokensB ?? ''}
                      placeholder={useCase.id === 'pretrain' ? '15000' : '0.3'}
                      onChange={(e) => set('trainingTokensB')(Number(e.target.value) || null)} />
                  </label>
                  <label className="text-[11px] text-zinc-400 space-y-1 block">
                    <span>Finish within (days)</span>
                    <input type="number" min="1" step="1" className={inputCls}
                      value={answers.deadlineDays}
                      onChange={(e) => set('deadlineDays')(Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                </div>
              </Question>
            ) : (
              <>
                <Question n={2} title="How many people use it in the busiest hour?">
                  <ScaleField
                    label="Peak-hour users"
                    value={answers.peakUsers}
                    onChange={set('peakUsers')}
                    presets={[50, 500, 5000, 50000]}
                    max={10000000}
                  />
                  <label className="text-[11px] text-zinc-400 flex items-center gap-2">
                    Requests per user per hour
                    <input type="number" min="1" step="1" className={`${inputCls} w-20`}
                      value={answers.requestsPerUserPerHour ?? useCase.requestsPerUserPerHour}
                      onChange={(e) => set('requestsPerUserPerHour')(Math.max(1, Number(e.target.value) || 1))} />
                    <span className="text-zinc-500">typical for {useCase.label.toLowerCase()}: {useCase.requestsPerUserPerHour}</span>
                  </label>
                </Question>
                <Question n={3} title="How long are the documents or conversations?">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {DOC_LENGTHS.map(d => (
                      <ChoiceCard key={d.id} selected={answers.docLength === d.id} onClick={() => set('docLength')(d.id)} title={d.label} desc={`${d.desc} (${(d.tokens / 1024).toFixed(0)}k tokens)`} />
                    ))}
                  </div>
                </Question>
              </>
            )}

            <Question n={training ? 3 : 4} title="Must it run air-gapped, with no internet connection?" hint="Air-gapped designs use on-premises load balancing and no public egress.">
              <SegmentedToggle
                options={[{ value: false, label: 'No' }, { value: true, label: 'Yes, air-gapped' }]}
                value={answers.airGapped}
                onChange={set('airGapped')}
              />
            </Question>

            <Question n={training ? 4 : 5} title="Hardware vendor and budget" hint="Every platform from the vendor is sized and the lowest total cost of ownership within budget is recommended.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[11px] text-zinc-400 space-y-1 block">
                  <span>Vendor</span>
                  <select className={inputCls} value={answers.vendor} onChange={(e) => set('vendor')(e.target.value)}>
                    {PLATFORM_VENDORS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>
                <label className="text-[11px] text-zinc-400 space-y-1 block">
                  <span>Capex budget ($, 0 = no limit)</span>
                  <input type="number" min="0" step="50000" className={inputCls}
                    value={answers.budgetUsd}
                    onChange={(e) => set('budgetUsd')(Math.max(0, Number(e.target.value) || 0))} />
                </label>
              </div>
            </Question>
          </div>

          <div className="p-4 sm:p-5 space-y-3 bg-zinc-950/40">
            <h3 className="text-[13px] font-semibold text-zinc-100">Recommendation</h3>
            {!chosen ? (
              <p className="text-xs text-zinc-400">No platform from this vendor can hold this workload. Try another vendor or a shorter document length.</p>
            ) : (
              <>
                {result.overBudget && !pickedId && (
                  <p className="text-[11px] text-amber-300">Nothing fits the budget; showing the lowest-capex design.</p>
                )}
                <div className="rounded-lg border border-sky-800 bg-sky-950/30 p-3 space-y-1" data-testid="guided-recommendation">
                  <div className="text-xs font-semibold text-white">{chosen.platformName}</div>
                  <div className="text-[11.5px] text-zinc-300 font-mono">
                    {chosen.gpus.toLocaleString()} GPUs · {usd(chosen.capexUsd)} capex · {usd(chosen.tcoUsd)} TCO
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {chosen.trainingDays != null
                      ? `Trains in ~${chosen.trainingDays.toFixed(0)} days`
                      : `~${chosen.concurrency.toLocaleString()} requests in flight at peak`} · {chosen.facilityKw.toFixed(0)} kW facility power
                  </div>
                  {chosen.tpotMs != null && (
                    <div className={`text-[11px] ${chosen.meetsLatency ? 'text-zinc-400' : 'text-amber-300'}`}>
                      First token {chosen.ttftSec < 1 ? `${Math.round(chosen.ttftSec * 1000)} ms` : `${chosen.ttftSec.toFixed(1)} s`} · {chosen.tpotMs.toFixed(0)} ms per token{chosen.meetsLatency ? '' : ' (misses the latency targets)'}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500">All options: those meeting the latency targets first, then lowest total cost. Click one to choose it.</div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800/70">
                  {result.candidates.map(c => (
                    <button
                      key={c.platformId}
                      type="button"
                      onClick={() => setPickedId(c.platformId)}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] cursor-pointer hover:bg-zinc-900 ${c.platformId === chosen.platformId ? 'bg-zinc-900' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-200 truncate">{c.gpuName}</span>
                        <span className="font-mono text-zinc-300 shrink-0">{usd(c.tcoUsd)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-zinc-500">
                        <span className="truncate">{c.gpus.toLocaleString()} GPUs · {usd(c.capexUsd)} capex</span>
                        <span className="flex gap-1 shrink-0">
                          {!c.meetsLatency && <Tag tone="warn">misses latency</Tag>}
                          {!c.withinBudget && <Tag tone="warn">over budget</Tag>}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="guided-apply"
                  onClick={() => onApply(chosen.config)}
                  className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Use this design
                </button>
                <p className="text-[10.5px] text-zinc-500">
                  Starts from the closest preset and sizes it for peak traffic. Every setting stays editable afterwards; review model, latency targets and prices on the tabs.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
