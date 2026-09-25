import React from 'react';
import { AlertTriangle, DollarSign, Grid2x2, Zap } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Field, Row, Rows, SliderField, Tag, ToggleRow } from '../ui';

// Illustrative per-token API price points ($ per 1M input / output tokens) for quick comparison.
const API_PRICE_PRESETS = [
  { label: 'Hosted open 8B', input: 0.1, output: 0.1 },
  { label: 'Hosted open 70B', input: 0.6, output: 0.8 },
  { label: 'Hosted open MoE', input: 0.5, output: 2.0 },
  { label: 'Frontier', input: 3, output: 15 },
];

export function CostTab({ ctx }) {
  const {
    cloudRateUsdPerHr, coloUsdPerKwPerMonth, cost, enableNvidiaAiEnterprise, gpu, gpuUnitPriceUsd,
    guardrails, haDr, ingress, mig, mlops, networkHardwareAdderPct,
    powerUsdPerKwh, rag, setActiveInputTab, setCloudRateUsdPerHr, setEnableNvidiaAiEnterprise, setGpuUnitPriceUsd,
    setNetworkHardwareAdderPct, setSupportPctPerYear, setTcoYears, supportPctPerYear, tcoYears, trainingRedundancy,
    useColo, tokenEconomics, dutyCyclePct, setDutyCyclePct, apiInputUsdPer1M, setApiInputUsdPer1M,
    apiOutputUsdPer1M, setApiOutputUsdPer1M,
  } = ctx;
  return (
    <>
      <Card
        icon={DollarSign}
        title="15. Cost & TCO"
        right={<Tag tone={cost.buildVsBuySavingsUsd >= 0 ? 'good' : 'warn'}>{cost.buildVsBuySavingsUsd >= 0 ? 'Owning wins' : 'Cloud wins'}</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          Every figure below is an editable illustrative estimate, not a vendor quote — NVIDIA and enterprise storage vendors don't publish list prices. Replace with your actual quote for a real budget number.
        </Banner>

        {mig.eligible && mig.physicalGpusNeeded < mig.naiveGpuCount && (
          <Banner tone="good" icon={Grid2x2}>
            MIG partitioning is active: compute capex and power below are priced against {mig.physicalGpusNeeded} MIG-consolidated physical GPU{mig.physicalGpusNeeded === 1 ? '' : 's'} ({mig.selectedProfile.id}), not the {mig.naiveGpuCount} dedicated GPUs a non-MIG deployment would need — a {mig.savingsPct.toFixed(0)}% reduction. The cloud comparison stays priced at {mig.naiveGpuCount} GPU-hours (cloud rental doesn't get the same consolidation benefit unless the provider offers fractional MIG billing).
          </Banner>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`${gpu.name} — Unit Price (Capex)`}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input type="number" min="0" step="500" value={gpuUnitPriceUsd}
                onChange={(e) => setGpuUnitPriceUsd(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
            </div>
          </Field>
          <Field label={`${gpu.name} — Cloud Rate ($/GPU-hr)`}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input type="number" min="0" step="0.05" value={cloudRateUsdPerHr}
                onChange={(e) => setCloudRateUsdPerHr(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
            </div>
          </Field>
        </div>
        <div className="text-[10.5px] text-zinc-500 -mt-2">
          Choosing a platform with a different GPU resets both fields to that GPU&apos;s catalog estimate.
        </div>

        <SliderField
          label="Network + Storage Hardware Adder:"
          valueLabel={`${networkHardwareAdderPct}%`}
          min="5" max="30" step="1"
          value={networkHardwareAdderPct}
          onChange={(e) => setNetworkHardwareAdderPct(Number(e.target.value))}
          marks={['5% (Minimal)', '15% (Typical)', '30% (Heavy Fabric)']}
          helper={
            <InfoHelper
              title="Network + Storage Hardware Adder"
              text="Switches, cabling, transceivers, and out-of-band management hardware, modeled as a percentage of compute (GPU) capex rather than pricing every switch SKU individually — per-SKU enterprise networking pricing is just as opaque as GPU pricing. 10-20% is a commonly cited industry range for a well-architected AI cluster."
              whyItMatters="This is on top of, not instead of, the GPU cost — skipping it understates capex by a meaningful margin, especially for large rail-optimized fabrics."
            />
          }
        />

        <Banner tone="info" icon={Zap}>
          Power billing model, electricity/colocation rate, and PUE now live on the <button type="button" onClick={() => setActiveInputTab('facility')} className="text-sky-400 underline cursor-pointer">Facility &amp; Power</button> tab — {useColo ? `currently Colocation at $${coloUsdPerKwPerMonth}/kW/month` : `currently Owned Datacenter at $${powerUsdPerKwh.toFixed(2)}/kWh`}, feeding directly into the annual power cost below.
        </Banner>

        <ToggleRow
          label="NVIDIA AI Enterprise Software Licensing"
          description={enableNvidiaAiEnterprise ? 'Included at $4,500/GPU/yr.' : 'Open-source stack only — no licensing cost.'}
          checked={enableNvidiaAiEnterprise}
          onChange={setEnableNvidiaAiEnterprise}
        />

        <SliderField
          label="Hardware Support & Maintenance:"
          valueLabel={`${supportPctPerYear}% of capex/yr`}
          min="5" max="25" step="1"
          value={supportPctPerYear}
          onChange={(e) => setSupportPctPerYear(Number(e.target.value))}
          marks={['5% (Minimal)', '15% (Typical)', '25% (Premium SLA)']}
        />

        <SliderField
          label="TCO Planning Horizon:"
          valueLabel={`${tcoYears} year${tcoYears > 1 ? 's' : ''}`}
          min="1" max="5" step="1"
          value={tcoYears}
          onChange={(e) => setTcoYears(Number(e.target.value))}
          marks={['1 yr', '3 yr (Typical)', '5 yr']}
        />

        <div className="pt-3 border-t border-zinc-800/70">
          <Rows>
            <Row k="Compute capex" v={`$${Math.round(cost.computeCapexUsd).toLocaleString()}`} tone="accent" />
            <Row k="Network + storage capex" v={`$${Math.round(cost.networkHardwareCapexUsd + cost.storageCapexUsd).toLocaleString()}`} mono={false} />
            {rag.eligible && (
              <Row k="RAG capex (embedding + vector DB)" v={`$${Math.round(cost.ragCapexUsd).toLocaleString()}`} mono={false} />
            )}
            {guardrails.eligible && (
              <Row k="Guardrails capex" v={`$${Math.round(cost.guardrailsCapexUsd).toLocaleString()}`} mono={false} />
            )}
            {ingress.eligible && (
              <Row k="Ingress capex" v={`$${Math.round(cost.ingressCapexUsd).toLocaleString()}`} mono={false} />
            )}
            {haDr.eligible && (
              <Row k="HA/DR capex" v={`$${Math.round(cost.haDrCapexUsd).toLocaleString()}`} mono={false} />
            )}
            {mlops.eligible && (
              <Row k="MLOps capex" v={`$${Math.round(cost.mlopsCapexUsd).toLocaleString()}`} mono={false} />
            )}
            {trainingRedundancy.eligible && (
              <Row k="Training redundancy capex" v={`$${Math.round(cost.trainingRedundancyCapexUsd).toLocaleString()}`} mono={false} />
            )}
            <Row k="Total capex" v={`$${Math.round(cost.totalCapexUsd).toLocaleString()}`} tone="accent" />
            <Row k="Annual opex" v={`$${Math.round(cost.annualOpexUsd).toLocaleString()}/yr`} mono={false} />
            {ingress.eligible && (
              <Row k="  incl. ingress egress/service fees" v={`$${Math.round(cost.ingressAnnualOpexUsd).toLocaleString()}/yr`} mono={false} />
            )}
            <Row k={`${cost.tcoYears}-year TCO`} v={`$${Math.round(cost.tcoUsd).toLocaleString()}`} tone="accent" />
            <Row k="Effective cost" v={`$${cost.effectiveUsdPerGpuHour.toFixed(2)}/GPU-hr`} tone="accent" />
            <Row k="Cloud-equivalent rate" v={`$${cost.cloudEquivalentUsdPerHr.toFixed(2)}/hr cluster-wide`} mono={false} />
            <Row
              k={`vs. ${cost.tcoYears}-yr cloud rental`}
              v={cost.buildVsBuySavingsUsd >= 0 ? `Owning saves $${Math.round(cost.buildVsBuySavingsUsd).toLocaleString()}` : `Cloud saves $${Math.round(-cost.buildVsBuySavingsUsd).toLocaleString()}`}
              tone={cost.buildVsBuySavingsUsd >= 0 ? 'good' : 'warn'}
            />
            <Row
              k="Capex break-even vs. cloud"
              v={cost.breakEvenMonths != null ? `~${Math.round(cost.breakEvenMonths)} months` : 'Never — cloud is cheaper'}
              mono={false}
            />
          </Rows>
        </div>
      </Card>
      {tokenEconomics.eligible && (
        <Card icon={DollarSign} title="Cost per Token vs. API" className="space-y-4">
          <SliderField
            label="Utilization (share of hours at sized load):"
            valueLabel={`${dutyCyclePct}%`}
            min="5" max="100" step="5"
            value={dutyCyclePct}
            onChange={(e) => setDutyCyclePct(Number(e.target.value))}
            marks={['5% (bursty)', '50%', '100% (always busy)']}
            helper={
              <InfoHelper
                title="Utilization / Duty Cycle"
                text="The cluster is sized for its peak concurrency. This is how much of the month it actually runs at that load on average -- e.g. 40% for a business-hours internal tool, 70-90% for a shared platform with steady traffic."
                whyItMatters="Owned hardware costs the same whether busy or idle, so cost per token falls in direct proportion to utilization. A per-token API only charges for what you use."
              />
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="API price, input ($ / 1M tokens)">
              <input type="number" min="0" step="0.05" value={apiInputUsdPer1M}
                onChange={(e) => setApiInputUsdPer1M(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
            </Field>
            <Field label="API price, output ($ / 1M tokens)">
              <input type="number" min="0" step="0.05" value={apiOutputUsdPer1M}
                onChange={(e) => setApiOutputUsdPer1M(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {API_PRICE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setApiInputUsdPer1M(p.input); setApiOutputUsdPer1M(p.output); }}
                className="px-2 py-1 rounded-md border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-400 hover:text-white hover:border-zinc-700 cursor-pointer"
              >
                {p.label} (${p.input} / ${p.output})
              </button>
            ))}
          </div>
          <div className="text-[10.5px] text-zinc-500">
            Illustrative price points only; API prices change often. Reasoning tokens are billed as output tokens, as providers do.
          </div>
          <Rows>
            <Row k="Requests per month" v={Math.round(tokenEconomics.requestsPerMonth).toLocaleString()} />
            <Row k="Serving cluster, per month" v={`$${Math.round(tokenEconomics.monthlyCostUsd).toLocaleString()}`} />
            <Row k="Cost per 1M output tokens" v={`$${tokenEconomics.costPer1MOutputTokensUsd.toFixed(2)}`} tone="accent" />
            <Row k="Cost per 1M tokens (input + output)" v={`$${tokenEconomics.costPer1MTotalTokensUsd.toFixed(2)}`} />
            <Row k="Same requests on the API, per month" v={`$${Math.round(tokenEconomics.apiMonthlyCostUsd).toLocaleString()}`} />
            <Row
              k="Owning vs. API, per month"
              v={tokenEconomics.monthlySavingsVsApiUsd >= 0 ? `Owning saves $${Math.round(tokenEconomics.monthlySavingsVsApiUsd).toLocaleString()}` : `API saves $${Math.round(-tokenEconomics.monthlySavingsVsApiUsd).toLocaleString()}`}
              tone={tokenEconomics.monthlySavingsVsApiUsd >= 0 ? 'good' : 'warn'}
            />
            <Row
              k="Break-even utilization"
              v={tokenEconomics.crossoverDutyPct == null ? 'n/a' : tokenEconomics.crossoverReachable ? `${tokenEconomics.crossoverDutyPct.toFixed(0)}%` : `Not reachable (needs ${tokenEconomics.crossoverDutyPct.toFixed(0)}%)`}
              tone={tokenEconomics.crossoverReachable ? 'neutral' : 'warn'}
            />
          </Rows>
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            Serving cluster = GPUs, their fabric, power, support and licensing, amortized over {tcoYears} years. Storage, RAG, guardrails, ingress, HA/DR and MLOps pools are left out because you would usually still run them alongside an API; fully loaded, the cost is ${Math.round(tokenEconomics.fullyLoadedMonthlyCostUsd).toLocaleString()}/month (${tokenEconomics.fullyLoadedCostPer1MOutputTokensUsd.toFixed(2)} per 1M output tokens).
          </div>
        </Card>
      )}
    </>
  );
}
