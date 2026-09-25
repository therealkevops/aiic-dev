import React from 'react';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Row, Rows, SectionLabel, SliderField, Tag, ToggleRow } from '../ui';

export function TrainingRedundancyTab({ ctx }) {
  const {
    enableTrainingRedundancy, setEnableTrainingRedundancy, setSpareNodePct, spareNodePct, trainingRedundancy,
  } = ctx;
  return (
    <>
      <Card
        icon={LifeBuoy}
        title="11. Resilience & DR"
        right={trainingRedundancy.enabled ? <Tag tone={trainingRedundancy.eligible ? 'good' : 'warn'}>{trainingRedundancy.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          Training's primary resilience mechanism is checkpoint/resume, already sized on the Storage tab. Separately, at hyperscale (hundreds-to-thousands of GPUs, weeks-long jobs) it's standard practice to keep a small buffer of already-racked, powered spare nodes on the floor -- ready to swap in for a failed node without stalling the run while a replacement is procured. Below the rounding threshold for your current cluster size, this naturally sizes to zero -- a support contract's RMA turnaround is fine for small, short jobs.
        </Banner>

        <ToggleRow
          label="Training Spare Node Capacity"
          description={enableTrainingRedundancy ? 'Sizing standing spare/hot-standby nodes as a % of the training cluster.' : 'No additional spare node capacity sized.'}
          checked={enableTrainingRedundancy}
          onChange={setEnableTrainingRedundancy}
        />

        {enableTrainingRedundancy && !trainingRedundancy.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {trainingRedundancy.reason}
          </Banner>
        )}

        {enableTrainingRedundancy && trainingRedundancy.eligible && (
          <>
            <SliderField
              label="Spare Node Capacity:"
              valueLabel={`${trainingRedundancy.spareNodePct}%`}
              min="0" max="10" step="0.5"
              value={spareNodePct}
              onChange={(e) => setSpareNodePct(Number(e.target.value))}
              marks={['0% (No Buffer)', '2% (Typical Hyperscale)', '10% (Aggressive)']}
              helper={
                <InfoHelper
                  title="Spare Node Capacity"
                  text="Standing spare compute nodes, already racked and powered, kept idle and ready to swap in for a failed node mid-run. Sized as a percentage of the training cluster's own node count, rounded to the nearest whole node -- small clusters naturally round to zero spares."
                  whyItMatters="A multi-week pretraining run across thousands of GPUs will see hardware failures often enough that waiting on a replacement node's procurement lead time is a real, costly risk to the run's wall-clock schedule. This is purely additive spend -- there's no 'already counted' base to subtract, unlike HA/DR's tier multipliers."
                />
              }
            />

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>SPARE NODE SIZING</SectionLabel>
              <Rows>
                <Row k="Primary cluster nodes" v={`${trainingRedundancy.baseNodes}`} mono={false} />
                <Row k="GPUs per node" v={`${trainingRedundancy.gpusPerNode}`} mono={false} />
                <Row k="Spare nodes" v={`${trainingRedundancy.spareNodeCount}`} tone="accent" />
                <Row k="Spare GPUs" v={`${trainingRedundancy.spareGpuCount}`} tone="accent" />
                <Row k="Spare node capex" v={`$${Math.round(trainingRedundancy.spareComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="Spare node IT power draw" v={`${trainingRedundancy.spareItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
