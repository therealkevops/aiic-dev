import React from 'react';
import { AlertTriangle, GitBranch } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, SectionLabel, SliderField, Tag, ToggleRow } from '../ui';
import { MLOPS_STRATEGIES } from '../../data/mlops';

export function MlopsTab({ ctx }) {
  const {
    canaryTrafficPct, enableMlops, mlops, mlopsStrategy, selectedMlopsStrategyId, setCanaryTrafficPct,
    setEnableMlops, setSelectedMlopsStrategyId,
  } = ctx;
  return (
    <>
      <Card
        icon={GitBranch}
        title="12. MLOps Lifecycle"
        right={mlops.enabled ? <Tag tone={mlops.eligible ? 'good' : 'warn'}>{mlops.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          MLOps sizes a standing validation pool for safely rolling out a new model version -- canary release routes a small configurable traffic slice, shadow deployment mirrors 100% of traffic for silent evaluation, and blue/green cutover validates a full duplicate pool before an instant flip. Unlike HA/DR (a resilience multiplier on top of the primary), this pool is purely additive spend with no "already counted" base to subtract.
        </Banner>

        <ToggleRow
          label="MLOps Validation Pool Sizing"
          description={enableMlops ? 'Sizing an additive validation pool for the selected rollout strategy.' : 'No additional MLOps validation compute sized.'}
          checked={enableMlops}
          onChange={setEnableMlops}
        />

        {enableMlops && !mlops.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {mlops.reason}
          </Banner>
        )}

        {enableMlops && mlops.eligible && (
          <>
            <Field label="Rollout Strategy" helper={
              <InfoHelper
                title="Rollout Strategy"
                text="Canary release only needs enough capacity for its own traffic slice, making it the cheapest validation pattern. Shadow deployment and blue/green cutover both require a full-scale duplicate pool -- shadow for silent, zero-user-risk evaluation, blue/green for the fastest rollback via an instant router flip."
                whyItMatters="The validation pool's size (and therefore its capex) is driven entirely by this choice: a canary's cost scales with its traffic share, while shadow and blue/green always cost the same as the primary pool."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {MLOPS_STRATEGIES.map((s) => (
                  <ChoiceCard
                    key={s.id}
                    selected={selectedMlopsStrategyId === s.id}
                    onClick={() => setSelectedMlopsStrategyId(s.id)}
                    title={`${s.name}${s.capacityMultiplier != null ? ` (${s.capacityMultiplier.toFixed(2)}x pool)` : ''}`}
                    desc={`${s.scope} · Rollback: ${s.rollbackSpeed} · ${s.notes}`}
                  />
                ))}
              </div>
            </Field>

            {mlopsStrategy.id === 'canary-release' && (
              <SliderField
                label="Canary Traffic Share:"
                valueLabel={`${canaryTrafficPct}%`}
                min="1" max="100" step="1"
                value={canaryTrafficPct}
                onChange={(e) => setCanaryTrafficPct(Number(e.target.value))}
                marks={['1% (Minimal)', '10% (Typical)', '100% (Full)']}
              />
            )}

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>VALIDATION POOL SIZING</SectionLabel>
              <Rows>
                <Row k="Primary site GPUs" v={`${mlops.baseGpuCount}`} mono={false} />
                <Row k="Validation pool GPUs" v={`${mlops.validationGpuCount}`} tone="accent" />
                <Row k="Capacity multiplier" v={`${mlops.capacityMultiplier.toFixed(2)}x`} tone="accent" />
                <Row k="MLOps capex" v={`$${Math.round(mlops.mlopsComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="MLOps IT power draw" v={`${mlops.mlopsItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
