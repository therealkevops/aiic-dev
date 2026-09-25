import React, { useMemo, useState } from 'react';
import { Cloud, LineChart, TrendingUp } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, Row, Rows, SegmentedToggle, SliderField, Tag, ToggleRow } from '../ui';
import { growthPlan, sensitivityAnalysis } from '../../utils/whatIf';

// Two categorical slots (validated for the dark card surface): input lowered / input raised.
const LOW_COLOR = '#3987e5';
const HIGH_COLOR = '#d95926';

const usdCompact = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3).toLocaleString()}k`;
  return `$${Math.round(v).toLocaleString()}`;
};
const usd = (v) => `$${Math.round(v).toLocaleString()}`;

function Tornado({ analysis, format }) {
  const [hover, setHover] = useState(null);
  const values = analysis.rows.flatMap(r => [r.lowValue, r.highValue]).concat(analysis.baseValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.04 || Math.abs(analysis.baseValue) * 0.05 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (v) => ((v - lo) / (hi - lo)) * 100;
  const base = x(analysis.baseValue);
  const bar = (value, color, top) => {
    const left = Math.min(base, x(value));
    const width = Math.max(0.4, Math.abs(x(value) - base));
    const toRight = value >= analysis.baseValue;
    return (
      <div
        className="absolute h-2"
        style={{
          left: `${left}%`, width: `${width}%`, top, background: color,
          borderRadius: toRight ? '0 4px 4px 0' : '4px 0 0 4px',
        }}
      />
    );
  };
  return (
    <div data-testid="sensitivity-chart">
      <div className="flex items-center gap-4 text-[11px] text-zinc-400 mb-2">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: LOW_COLOR }} />Input lowered</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: HIGH_COLOR }} />Input raised</span>
        <span className="ml-auto">Base {format(analysis.baseValue)}</span>
      </div>
      <div className="space-y-1">
        {analysis.rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[132px_1fr] items-center gap-2 py-1 rounded hover:bg-zinc-900/60"
            onMouseEnter={() => setHover(r.key)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="text-[11.5px] text-zinc-300 leading-tight">
              {r.label}
              <div className="text-[10px] text-zinc-500">±{r.swingPct}%</div>
            </div>
            <div className="relative h-[22px]">
              <div className="absolute top-0 bottom-0 w-px bg-zinc-600" style={{ left: `${base}%` }} />
              {bar(r.lowValue, LOW_COLOR, 2)}
              {bar(r.highValue, HIGH_COLOR, 12)}
              {hover === r.key && (
                <div className="absolute z-10 right-0 -top-12 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-[10.5px] text-zinc-200 whitespace-nowrap shadow-lg">
                  <div><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: LOW_COLOR }} />{r.lowInput}: {format(r.lowValue)}</div>
                  <div><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: HIGH_COLOR }} />{r.highInput}: {format(r.highValue)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <details className="mt-3 text-[11px] text-zinc-400">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Show as table</summary>
        <table className="w-full mt-2 border-collapse">
          <thead className="text-zinc-500 text-[10.5px] uppercase">
            <tr><th className="text-left py-1">Input</th><th className="text-left py-1">Lowered</th><th className="text-right py-1">Result</th><th className="text-left py-1 pl-2">Raised</th><th className="text-right py-1">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {analysis.rows.map(r => (
              <tr key={r.key}>
                <td className="py-1 font-sans text-zinc-300">{r.label}</td>
                <td className="py-1">{r.lowInput}</td>
                <td className="py-1 text-right">{format(r.lowValue)}</td>
                <td className="py-1 pl-2">{r.highInput}</td>
                <td className="py-1 text-right">{format(r.highValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function PlanningTab({ ctx }) {
  const {
    config, workloadType, rentVsBuy, cloudReservedDiscountPct, setCloudReservedDiscountPct, tcoYears,
    enableGrowthPlan, setEnableGrowthPlan, demandGrowthPctPerYear, setDemandGrowthPctPerYear,
    gpuPriceChangePctPerYear, setGpuPriceChangePctPerYear, refreshYear, setRefreshYear, tokenEconomics, setActiveInputTab,
  } = ctx;
  const inference = workloadType === 'inference';
  const [metric, setMetric] = useState('tco');
  const activeMetric = inference && tokenEconomics.eligible ? metric : 'tco';
  const analysis = useMemo(() => sensitivityAnalysis(config, activeMetric), [config, activeMetric]);
  const plan = useMemo(() => (inference && enableGrowthPlan ? growthPlan(config) : null), [config, inference, enableGrowthPlan]);
  const format = activeMetric === 'costPer1M' ? (v) => `$${v.toFixed(2)}` : usdCompact;

  return (
    <>
      <Card
        icon={LineChart}
        title="16. Planning: What Moves the Cost"
        right={inference && tokenEconomics.eligible ? (
          <SegmentedToggle
            options={[{ value: 'tco', label: 'TCO' }, { value: 'costPer1M', label: '$ / 1M tokens' }]}
            value={activeMetric}
            onChange={setMetric}
          />
        ) : null}
        className="space-y-3"
      >
        <div className="text-[11.5px] text-zinc-400 leading-relaxed">
          Each input is moved down and up by the amount shown, with everything else held, and the calculator re-sizes the whole design.
          The longest bars are the inputs worth pinning down first. Sizing moves in whole servers, so a change can show no effect until it crosses a server boundary.
          {activeMetric === 'costPer1M' && ' Utilization and demand only change cost per token, not the hardware bill.'}
        </div>
        {analysis.eligible ? <Tornado analysis={analysis} format={format} /> : <div className="text-xs text-zinc-500">No inputs to vary for this configuration.</div>}
      </Card>

      <Card icon={Cloud} title="Rent vs. Buy" className="space-y-4">
        <SliderField
          label="Reserved / committed-use discount:"
          valueLabel={`${cloudReservedDiscountPct}% off on-demand`}
          min="0" max="70" step="5"
          value={cloudReservedDiscountPct}
          onChange={(e) => setCloudReservedDiscountPct(Number(e.target.value))}
          marks={['0%', '35% (typical 1-3 yr)', '70%']}
          helper={
            <InfoHelper
              title="Reserved capacity discount"
              text="Cloud providers discount GPU instances when you commit to a term (typically 1 or 3 years) instead of paying the on-demand hourly rate. The on-demand rate is set on Cost & TCO."
              whyItMatters="Reserved capacity is the fair comparison for a cluster that runs all the time; on-demand scaled to use is the fair comparison for bursty traffic that could autoscale."
            />
          }
        />
        <Rows>
          {rentVsBuy.options.map(o => (
            <Row
              key={o.id}
              k={<span>{o.label}{o.cheapest && <span className="ml-2"><Tag tone="good">cheapest</Tag></span>}<div className="text-[10.5px] text-zinc-500">{o.note}</div></span>}
              v={<span>{usd(o.usd)}{o.id !== 'own' && <div className={`text-[10.5px] ${o.deltaVsOwnUsd >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{o.deltaVsOwnUsd >= 0 ? `owning saves ${usdCompact(o.deltaVsOwnUsd)}` : `renting saves ${usdCompact(-o.deltaVsOwnUsd)}`}</div>}</span>}
              tone={o.cheapest ? 'good' : 'neutral'}
            />
          ))}
        </Rows>
        <div className="text-[10.5px] text-zinc-500">
          Over {tcoYears} years. Cloud options rent the GPU servers; storage and add-on pools ({usdCompact(rentVsBuy.nonGpuUsd)}) are counted at their owned cost on every line so the comparison is like for like.
          {inference && ' Utilization is set on '}
          {inference && <button type="button" onClick={() => setActiveInputTab('cost')} className="text-sky-400 underline cursor-pointer">Cost &amp; TCO</button>}
          {inference && '.'}
        </div>
      </Card>

      <Card icon={TrendingUp} title="Growth Over Time" className="space-y-4">
        {!inference ? (
          <div className="text-xs text-zinc-500">Growth planning applies to inference demand. For training, the Facility &amp; Power tab shows how large a job a power budget supports.</div>
        ) : (
          <>
            <ToggleRow
              label="Plan capacity year by year"
              description={enableGrowthPlan ? `Sizes each of the ${tcoYears} years for that year's demand.` : 'Off: one design sized for today.'}
              checked={enableGrowthPlan}
              onChange={setEnableGrowthPlan}
            />
            {enableGrowthPlan && plan?.eligible && (
              <>
                <SliderField
                  label="Demand growth per year:"
                  valueLabel={`+${demandGrowthPctPerYear}%`}
                  min="0" max="300" step="10"
                  value={demandGrowthPctPerYear}
                  onChange={(e) => setDemandGrowthPctPerYear(Number(e.target.value))}
                  marks={['0%', '100% (doubling)', '300%']}
                />
                <SliderField
                  label="GPU price change per year:"
                  valueLabel={`${gpuPriceChangePctPerYear > 0 ? '+' : ''}${gpuPriceChangePctPerYear}%`}
                  min="-40" max="20" step="5"
                  value={gpuPriceChangePctPerYear}
                  onChange={(e) => setGpuPriceChangePctPerYear(Number(e.target.value))}
                  marks={['-40%', '0%', '+20%']}
                />
                <div>
                  <div className="text-xs font-medium text-zinc-300 mb-1.5">Hardware refresh</div>
                  <SegmentedToggle
                    options={[0, 3, 4, 5].filter(y => y === 0 || y <= tcoYears).map(y => ({ value: y, label: y === 0 ? 'None' : `Start of year ${y}` }))}
                    value={refreshYear > 1 && refreshYear <= tcoYears ? refreshYear : 0}
                    onChange={setRefreshYear}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse" data-testid="growth-plan">
                    <thead className="text-zinc-500 text-[10px] uppercase tracking-wide">
                      <tr>
                        <th className="text-left py-1.5 pr-2 font-medium">Year</th>
                        <th className="text-right py-1.5 pr-2 font-medium">{plan.driver.label}</th>
                        <th className="text-right py-1.5 pr-2 font-medium">GPUs</th>
                        <th className="text-right py-1.5 pr-2 font-medium">Bought</th>
                        <th className="text-right py-1.5 pr-2 font-medium">Power</th>
                        <th className="text-right py-1.5 pr-2 font-medium">Capex</th>
                        <th className="text-right py-1.5 pr-2 font-medium">Opex</th>
                        <th className="text-right py-1.5 font-medium">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                      {plan.rows.map(r => (
                        <tr key={r.year}>
                          <td className="py-1.5 pr-2 font-sans">{r.year}{r.refresh && <span className="ml-1 text-[10px] text-amber-400 font-sans">refresh</span>}</td>
                          <td className="py-1.5 pr-2 text-right">{r.demand.toLocaleString()}</td>
                          <td className="py-1.5 pr-2 text-right">{r.gpusInstalled.toLocaleString()}</td>
                          <td className="py-1.5 pr-2 text-right">{r.gpusBought ? `+${r.gpusBought.toLocaleString()}` : '—'}</td>
                          <td className="py-1.5 pr-2 text-right">{r.facilityKw.toFixed(0)} kW</td>
                          <td className="py-1.5 pr-2 text-right">{usdCompact(r.capexUsd)}</td>
                          <td className="py-1.5 pr-2 text-right">{usdCompact(r.opexUsd)}</td>
                          <td className="py-1.5 text-right">{usdCompact(r.cumulativeUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Rows>
                  <Row k={`Phased purchases, ${tcoYears}-year spend`} v={usd(plan.totalUsd)} tone="accent" />
                  <Row k={`Buying year-${tcoYears} capacity up front (${plan.upfront.gpus.toLocaleString()} GPUs)`} v={usd(plan.upfront.totalUsd)} />
                  <Row
                    k="Phasing vs. up front"
                    v={plan.savingsVsUpfrontUsd >= 0 ? `saves ${usd(plan.savingsVsUpfrontUsd)}` : `costs ${usd(-plan.savingsVsUpfrontUsd)} more`}
                    tone={plan.savingsVsUpfrontUsd >= 0 ? 'good' : 'warn'}
                  />
                </Rows>
                <div className="text-[10.5px] text-zinc-500">
                  Each year is re-sized for that year&apos;s demand. Capex is the increase in the whole design (GPUs, fabric, storage, add-ons) over last year&apos;s, at that year&apos;s GPU price; a refresh buys the whole design again. The planning horizon is the TCO horizon on Cost &amp; TCO.
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}
