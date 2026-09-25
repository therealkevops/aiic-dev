import React from 'react';
import { Zap } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, Field, Row, Rows, SectionLabel, SegmentedToggle, SliderField } from '../ui';

export function FacilityTab({ ctx }) {
  const {
    coloUsdPerKwPerMonth, facility, powerUsdPerKwh, pue, setColoUsdPerKwPerMonth, setPowerUsdPerKwh,
    setPue, setUseColo, useColo,
  } = ctx;
  return (
    <>
      <Card icon={Zap} title="5. Facility & Power" className="space-y-4">
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
    </>
  );
}
