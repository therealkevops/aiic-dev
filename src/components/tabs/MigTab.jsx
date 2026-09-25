import React from 'react';
import { AlertTriangle, Grid2x2 } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, Tag, ToggleRow } from '../ui';

export function MigTab({ ctx }) {
  const {
    enableMig, memory, mig, setEnableMig, setSelectedMigProfileId,
  } = ctx;
  return (
    <>
      <Card
        icon={Grid2x2}
        title="13. MIG Partitioning"
        right={mig.enabled ? <Tag tone={mig.eligible ? 'good' : 'warn'}>{mig.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          MIG (Multi-Instance GPU) splits one physical GPU into up to 7 isolated instances. It's most valuable when a single replica needs far less than a whole GPU — small models, low concurrency, or many isolated tenants — and only applies to colocated inference where TP=1 and PP=1 (MIG instances have no NVLink between them, so a replica sharded across GPUs can't span them).
        </Banner>

        <ToggleRow
          label="MIG Partitioning"
          description={enableMig ? 'Packing replicas onto isolated MIG instances where eligible.' : 'Each replica gets a dedicated whole GPU.'}
          checked={enableMig}
          onChange={setEnableMig}
        />

        {enableMig && !mig.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {mig.reason}
          </Banner>
        )}

        {enableMig && mig.eligible && (
          <>
            <Field label="MIG Profile" helper={
              <InfoHelper
                title="MIG Profile"
                text="Each profile trades isolated compute/memory slice size for how many instances fit on one physical GPU. Smaller profiles pack more replicas per GPU but give each replica a proportionally smaller share of compute and memory bandwidth."
                whyItMatters="Picking a profile larger than needed wastes consolidation potential; picking one too small won't fit the workload at all. The smallest fitting profile maximizes physical GPU savings."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {mig.availableProfiles.map((p) => (
                  <ChoiceCard
                    key={p.id}
                    selected={mig.selectedProfile.id === p.id}
                    onClick={() => setSelectedMigProfileId(p.id)}
                    title={p.id}
                    desc={`${p.slices}/7 compute slices · ${p.vramGb} GB VRAM · ${Math.floor(7 / p.slices)}x instances per physical GPU`}
                  />
                ))}
              </div>
            </Field>

            <div className="pt-3 border-t border-zinc-800/70">
              <Rows>
                <Row k="Replica footprint" v={`${memory.perGpuTotalUsedGb.toFixed(1)} GB`} mono={false} />
                <Row k="Selected profile" v={`${mig.selectedProfile.id} (${mig.instancesPerPhysicalGpu}x per physical GPU)`} tone="accent" />
                <Row k="Naive dedicated GPUs" v={`${mig.naiveGpuCount}`} mono={false} />
                <Row k="MIG-consolidated physical GPUs" v={`${mig.physicalGpusNeeded}`} tone="good" />
                <Row k="Physical GPU savings" v={`${mig.gpuCountSavings} GPUs (${mig.savingsPct.toFixed(0)}%)`} tone="good" />
                <Row k="Physical nodes needed" v={`${mig.physicalNodesNeeded}`} mono={false} />
                <Row k="Per-instance throughput" v={`~${(mig.throughputScaleFactor * 100).toFixed(0)}% of a whole GPU's rate`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
