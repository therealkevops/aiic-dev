import React, { useMemo } from 'react';
import { Gauge, Leaf, Zap } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Field, Row, Rows, ScaleField, SectionLabel, SegmentedToggle, SliderField, ToggleRow } from '../ui';
import { fitPowerBudget } from '../../utils/whatIf';

// Typical starting points when the cooling type changes; both stay editable.
const COOLING_DEFAULTS = {
  air: { pue: 1.35, rackPowerKw: 28 },
  liquid: { pue: 1.15, rackPowerKw: 80 },
};

const fmtKw = (kw) => (kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : `${kw.toFixed(1)} kW`);

export function FacilityTab({ ctx }) {
  const {
    coloUsdPerKwPerMonth, facility, powerUsdPerKwh, pue, setColoUsdPerKwPerMonth, setPowerUsdPerKwh,
    setPue, setUseColo, useColo, config, cost, energy, platform, workloadType,
    coolingType, setCoolingType, rackPowerKw, setRackPowerKw, facilityPowerBudgetKw, setFacilityPowerBudgetKw,
    gridCarbonKgPerKwh, setGridCarbonKgPerKwh,
  } = ctx;
  const fit = useMemo(() => fitPowerBudget(config, facilityPowerBudgetKw), [config, facilityPowerBudgetKw]);
  const chooseCooling = (type) => {
    setCoolingType(type);
    setPue(COOLING_DEFAULTS[type].pue);
    setRackPowerKw(COOLING_DEFAULTS[type].rackPowerKw);
  };
  return (
    <>
      <Card icon={Zap} title="5. Facility & Power" className="space-y-4">
        <Field
          label="Cooling"
          helper={
            <div className="text-[10.5px] text-zinc-500 mt-1.5">
              {coolingType === 'liquid'
                ? 'Direct-to-chip liquid cooling: dense racks and a lower PUE. Required for GB200/GB300 NVL72 and MI355X.'
                : 'Air cooling: most enterprise data halls, but rack power is limited to roughly 20-40 kW.'}
              {' '}Switching sets a typical PUE and rack power limit; adjust both below.
            </div>
          }
        >
          <SegmentedToggle
            options={[{ value: 'air', label: 'Air cooled' }, { value: 'liquid', label: 'Liquid cooled' }]}
            value={coolingType}
            onChange={chooseCooling}
          />
        </Field>
        {platform.requiresLiquidCooling && coolingType !== 'liquid' && (
          <Banner tone="warn" icon={Zap}>{platform.name} is liquid-cooled only.</Banner>
        )}

        <SliderField
          label="Rack power limit:"
          valueLabel={`${rackPowerKw} kW per rack`}
          accent="amber"
          min="8" max="140" step="2"
          value={rackPowerKw}
          onChange={(e) => setRackPowerKw(Number(e.target.value))}
          marks={['8 kW', '40 kW (air max)', '140 kW (liquid)']}
          helper={
            <InfoHelper
              title="Rack power limit"
              text="The power each rack position can deliver and cool. Servers are packed into racks until either the rack units or this limit runs out. Rack-scale systems such as GB200 NVL72 come as a fixed rack and ignore this limit."
              whyItMatters={`A ${platform.chassisTdpKw} kW server needs at least that much per rack. Older data halls built for 8-15 kW racks may fit only one GPU server per rack, which multiplies floor space.`}
            />
          }
        />

        <SliderField
          label="Facility PUE (Power Usage Effectiveness):"
          valueLabel={pue.toFixed(2)}
          accent="amber"
          min="1.10" max="1.60" step="0.05"
          value={pue}
          onChange={(e) => setPue(Number(e.target.value))}
          marks={['1.10 (Liquid Cooling)', '1.35 (Air Cooled)', '1.60 (Legacy DC)']}
          helper={
            <InfoHelper
              title="Power Usage Effectiveness (PUE)"
              text="The ratio of total datacenter facility power (cooling, lighting, UPS losses) to the IT equipment power. PUE = 1.0 is perfect efficiency — all power goes to compute."
              whyItMatters="A liquid-cooled modern facility at PUE 1.10 uses ~18% less total power than an air-cooled one at PUE 1.35 for the same workload. This directly affects your power bill and datacenter capacity -- but only under Owned Datacenter billing below. Colocation bills a flat $/kW rate on IT load with the provider's own PUE baked in, so this slider has no effect on cost in that mode."
            />
          }
        />

        {/* Live facility power readout -- reacts to the PUE slider above */}
        <div className="pt-3 border-t border-zinc-800/70">
          <SectionLabel>RESULTING FACILITY POWER</SectionLabel>
          <Rows>
            <Row k="IT power load (PUE-independent)" v={`${facility.totalItPowerKw.toFixed(1)} kW`} mono={false} />
            <Row k="Cooling + overhead" v={`${facility.coolingOverhead.toFixed(1)} kW`} tone="accent" />
            <Row k="Total facility power" v={`${facility.totalFacilityPowerKw.toFixed(1)} kW`} tone="good" />
          </Rows>
        </div>

        <div className="pt-3 border-t border-zinc-800/70">
          <Field
            label="Power Billing Model"
            helper={
              <div className="text-[10.5px] text-zinc-500 mt-1.5">
                {useColo ? 'Billed $/kW/month against IT load.' : 'Billed $/kWh against PUE-adjusted facility load.'}
              </div>
            }
          >
            <SegmentedToggle
              options={[{ value: false, label: 'Owned Datacenter' }, { value: true, label: 'Colocation' }]}
              value={useColo}
              onChange={setUseColo}
            />
          </Field>

          {useColo ? (
            <Field label="Colocation Rate ($/kW/month)">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                <input type="number" min="0" step="5" value={coloUsdPerKwPerMonth}
                  onChange={(e) => setColoUsdPerKwPerMonth(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
              </div>
              <div className="text-[10.5px] text-zinc-500 mt-1">Billed against IT load — the colo provider's own cooling/facility overhead is baked into their rate.</div>
            </Field>
          ) : (
            <SliderField
              label="Electricity Rate ($/kWh):"
              valueLabel={`$${powerUsdPerKwh.toFixed(2)}`}
              min="0.05" max="0.30" step="0.01"
              value={powerUsdPerKwh}
              onChange={(e) => setPowerUsdPerKwh(Number(e.target.value))}
              marks={['$0.05 (Low-Cost Region)', '$0.12 (US Average)', '$0.30 (High-Cost Region)']}
              helper={<div className="text-[10.5px] text-zinc-500 mt-1">Billed against PUE-adjusted facility load (IT load × PUE) — your own cooling overhead is on your meter.</div>}
            />
          )}
        </div>
      </Card>

      <Card icon={Gauge} title="Power Budget" className="space-y-4">
        <ToggleRow
          label="Size against a facility power budget"
          description={facilityPowerBudgetKw > 0 ? 'Shows how much workload the available power supports.' : 'Off: no power limit.'}
          checked={facilityPowerBudgetKw > 0}
          onChange={(on) => setFacilityPowerBudgetKw(on ? Math.max(50, Math.ceil(cost.billedFacilityPowerKw * 1.5 / 50) * 50) : 0)}
        />
        {facilityPowerBudgetKw > 0 && (
          <>
            <ScaleField
              label="Facility power available (kW)"
              value={facilityPowerBudgetKw}
              onChange={setFacilityPowerBudgetKw}
              presets={[100, 250, 500, 1000, 5000]}
              min={1}
              max={500000}
              suffix=" kW"
            />
            {fit.eligible && !fit.fits && (
              <Banner tone="danger" icon={Gauge}>
                Even the smallest {workloadType === 'training' ? 'training job' : 'deployment'} of this design needs {fmtKw(fit.minimumKw)}, more than {fmtKw(facilityPowerBudgetKw)}.
              </Banner>
            )}
            {fit.eligible && fit.fits && (
              <Rows>
                <Row k="This design needs" v={fmtKw(fit.current.kw)} tone={fit.current.kw <= facilityPowerBudgetKw ? 'good' : 'warn'} />
                <Row k={fit.current.kw <= facilityPowerBudgetKw ? 'Headroom' : 'Over budget by'} v={fmtKw(Math.abs(facilityPowerBudgetKw - fit.current.kw))} tone={fit.current.kw <= facilityPowerBudgetKw ? 'good' : 'warn'} />
                <Row
                  k={`Most ${fit.driver.label} that fit`}
                  v={`${fit.best.demand.toLocaleString()} (${fit.best.demand >= fit.current.demand ? `${(fit.best.demand / fit.current.demand).toFixed(1)}x` : `${Math.round((fit.best.demand / fit.current.demand) * 100)}%`} of today)`}
                  tone="accent"
                />
                <Row k="GPUs at that size" v={fit.best.gpus.toLocaleString()} />
                <Row k="Facility power at that size" v={fmtKw(fit.best.kw)} />
                {workloadType === 'training' && fit.best.scenario.trainingTime?.eligible && (
                  <Row k="Time to train at that size" v={`${fit.best.scenario.trainingTime.wallClockDays.toFixed(0)} days`} />
                )}
              </Rows>
            )}
            <div className="text-[10.5px] text-zinc-500">
              Counts facility power (IT load × PUE) for GPUs, network, storage and every enabled add-on, at nameplate power.
            </div>
          </>
        )}
      </Card>

      <Card icon={Leaf} title="Energy & Carbon" className="space-y-4">
        <Field label="Grid carbon intensity (kg CO₂ per kWh)">
          <input type="number" min="0" max="1.5" step="0.01" value={gridCarbonKgPerKwh}
            onChange={(e) => setGridCarbonKgPerKwh(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
          <div className="text-[10.5px] text-zinc-500 mt-1">US average is about 0.37 (EPA eGRID 2022). Use your utility&apos;s figure, or near 0 for a renewable supply contract.</div>
        </Field>
        <Rows>
          <Row k="Energy per year" v={`${energy.annualMwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} MWh`} />
          <Row k="Emissions per year" v={`${energy.annualTco2.toLocaleString(undefined, { maximumFractionDigits: 0 })} t CO₂`} />
          {energy.kwhPer1MOutputTokensAtLoad != null && (
            <Row k="Energy per 1M output tokens, at full load" v={`${energy.kwhPer1MOutputTokensAtLoad.toFixed(2)} kWh`} />
          )}
          {energy.kwhPer1MOutputTokensAtUtilization != null && (
            <Row k={`Energy per 1M output tokens, at ${ctx.dutyCyclePct}% utilization`} v={`${energy.kwhPer1MOutputTokensAtUtilization.toFixed(2)} kWh`} tone="accent" />
          )}
          {energy.kgCo2Per1MOutputTokensAtUtilization != null && (
            <Row k="Carbon per 1M output tokens" v={`${energy.kgCo2Per1MOutputTokensAtUtilization.toFixed(2)} kg CO₂`} />
          )}
          {energy.trainingRunMwh != null && (
            <>
              <Row k="Energy for the training run" v={`${energy.trainingRunMwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} MWh`} tone="accent" />
              <Row k="Emissions for the training run" v={`${energy.trainingRunTco2.toLocaleString(undefined, { maximumFractionDigits: 0 })} t CO₂`} />
            </>
          )}
        </Rows>
        <div className="text-[10.5px] text-zinc-500">
          Upper bounds at nameplate power: real servers average below their rated power, and idle hours draw less than busy ones. Utilization is set on Cost &amp; TCO.
        </div>
      </Card>
    </>
  );
}
