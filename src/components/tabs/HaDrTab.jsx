import React from 'react';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, SectionLabel, Tag, ToggleRow } from '../ui';
import { HA_DR_TIERS } from '../../data/hadr';

export function HaDrTab({ ctx }) {
  const {
    enableHaDr, haDr, haDrTier, selectedHaDrTierId, setEnableHaDr, setSelectedHaDrTierId,
  } = ctx;
  return (
    <>
      <Card
        icon={LifeBuoy}
        title="11. Resilience & DR"
        right={haDr.enabled ? <Tag tone={haDr.eligible ? 'good' : 'warn'}>{haDr.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          HA/DR sizes the incremental compute and storage a resilience tier adds on top of the primary site's already-sized deployment — a standby or active-active copy uses identical hardware to the primary, so only the incremental (tier − 1x) capacity is new spend. Ongoing cross-region replication bandwidth is out of scope for this estimate; only the standing compute/storage capacity and its power draw are sized.
        </Banner>

        <ToggleRow
          label="HA/DR Sizing"
          description={enableHaDr ? 'Sizing incremental compute + storage for the selected resilience tier.' : 'No additional HA/DR compute or storage sized.'}
          checked={enableHaDr}
          onChange={setEnableHaDr}
        />

        {enableHaDr && !haDr.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {haDr.reason}
          </Banner>
        )}

        {enableHaDr && haDr.eligible && (
          <>
            <Field label="HA/DR Tier" helper={
              <InfoHelper
                title="HA/DR Tier"
                text="Multi-AZ protects against a single availability zone failure within one region, with automatic failover. The remaining four are the standard cross-region disaster recovery strategies (AWS's well-established framework), trading cost for progressively lower RTO (time to recover) and RPO (data loss window)."
                whyItMatters="Compute/storage multipliers are illustrative for a typical deployment of each pattern -- the real ratio depends on how much of the secondary environment is kept warm. Only the incremental (tier − 1x) capacity beyond the primary site is new spend."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {HA_DR_TIERS.map((t) => (
                  <ChoiceCard
                    key={t.id}
                    selected={selectedHaDrTierId === t.id}
                    onClick={() => setSelectedHaDrTierId(t.id)}
                    title={`${t.name} (${t.computeMultiplier.toFixed(2)}x compute · ${t.storageMultiplier.toFixed(2)}x storage)`}
                    desc={`${t.scope} · RTO: ${t.rtoDescription} · RPO: ${t.rpoDescription} · ${t.notes}`}
                  />
                ))}
              </div>
            </Field>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>RECOVERY OBJECTIVES</SectionLabel>
              <Rows>
                <Row k="Scope" v={haDrTier.scope} mono={false} />
                <Row k="RTO (Recovery Time Objective)" v={haDrTier.rtoDescription} tone="accent" />
                <Row k="RPO (Recovery Point Objective)" v={haDrTier.rpoDescription} tone="accent" />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>INCREMENTAL CAPACITY (BEYOND THE PRIMARY SITE)</SectionLabel>
              <Rows>
                <Row k="Primary site GPUs" v={`${haDr.baseGpuCount}`} mono={false} />
                <Row k="Incremental compute capex" v={`$${Math.round(haDr.incrementalComputeCapexUsd).toLocaleString()}`} tone="accent" />
                <Row k="Incremental storage capex" v={`$${Math.round(haDr.incrementalStorageCapexUsd).toLocaleString()}`} tone="accent" />
                <Row k="Total HA/DR capex" v={`$${Math.round(haDr.haDrComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="HA/DR IT power draw" v={`${haDr.haDrItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
