import React from 'react';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Field, Row, Rows, SectionLabel, SliderField, Tag, ToggleRow } from '../ui';

export function TrainingRedundancyTab({ ctx }) {
  const {
    enableTrainingRedundancy, setEnableTrainingRedundancy, setSpareNodePct, spareNodePct, trainingRedundancy,
    trainingTime, gpuMtbfHours, setGpuMtbfHours, restartMin, setRestartMin, checkpointIntervalMin, setCheckpointIntervalMin,
    nodeRepairHours, setNodeRepairHours,
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

        {trainingTime.eligible && (
          <div className="space-y-3">
            <SectionLabel>FAILURE MODEL</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="GPU MTBF (GPU-hours)">
                <input type="number" min="1000" step="5000" value={gpuMtbfHours}
                  onChange={(e) => setGpuMtbfHours(Math.max(100, Number(e.target.value) || 100))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
              </Field>
              <Field label="Restart after a failure (min)">
                <input type="number" min="1" step="5" value={restartMin}
                  onChange={(e) => setRestartMin(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
              </Field>
              <Field label="Checkpoint interval (min, 0 = optimal)">
                <input type="number" min="0" step="10" value={checkpointIntervalMin}
                  onChange={(e) => setCheckpointIntervalMin(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
              </Field>
              <Field label="Node repair time (hours)">
                <input type="number" min="1" step="12" value={nodeRepairHours}
                  onChange={(e) => setNodeRepairHours(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500" />
              </Field>
            </div>
            <Rows>
              <Row k="Job fails every" v={trainingTime.jobMtbfHours >= 48 ? `${(trainingTime.jobMtbfHours / 24).toFixed(1)} days` : `${trainingTime.jobMtbfHours.toFixed(1)} hours`} />
              <Row k="Expected failures during the run" v={trainingTime.expectedFailures < 1 ? trainingTime.expectedFailures.toFixed(2) : Math.round(trainingTime.expectedFailures).toLocaleString()} />
              <Row k={`Checkpoint every${trainingTime.usingOptimalInterval ? ' (optimal)' : ''}`} v={`${Math.round(trainingTime.checkpointIntervalMin)} min`} />
              <Row k="Goodput (useful training time)" v={`${trainingTime.goodputPct.toFixed(1)}%`} tone={trainingTime.goodputPct >= 95 ? 'good' : 'warn'} />
              <Row k="Recommended spare nodes" v={`${trainingTime.recommendedSpareNodes} (${trainingTime.recommendedSparePct.toFixed(1)}%)`} tone="accent" />
            </Rows>
            <InfoHelper
              title="Failure Model"
              text="Every GPU fails (or triggers a job-stopping fault) about once per MTBF hours, so a job on N GPUs stops every MTBF / N hours. Each stop loses the work since the last checkpoint plus the restart time; each checkpoint pauses the job for its write time (Storage tab). The optimal interval balances the two (Young/Daly). Spare nodes are sized to cover every node out for repair at once 97.5% of the time."
              whyItMatters="The 50,000 GPU-hour default follows Meta's Llama 3 report (419 unplanned interruptions in 54 days on 16,384 H100s). At 1,000+ GPUs the job stops every couple of days, so checkpoint speed and restart automation directly set how much of the cluster's time is useful."
            />
            {enableTrainingRedundancy && trainingRedundancy.eligible && trainingRedundancy.spareNodeCount !== trainingTime.recommendedSpareNodes && trainingRedundancy.baseNodes > 0 && (
              <button
                type="button"
                onClick={() => setSpareNodePct(Math.round((trainingTime.recommendedSpareNodes / trainingRedundancy.baseNodes) * 1000) / 10)}
                className="text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
              >
                Use the recommended {trainingTime.recommendedSpareNodes} spare node{trainingTime.recommendedSpareNodes === 1 ? '' : 's'}
              </button>
            )}
          </div>
        )}

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
              min="0" max="25" step="0.5"
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
