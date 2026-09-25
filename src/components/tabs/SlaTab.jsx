import React from 'react';
import { AlertTriangle, Timer } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Row, Rows, SectionLabel, SliderField, Tag } from '../ui';

export function SlaTab({ ctx }) {
  const {
    setTargetUtilization, sla, targetUtilization,
  } = ctx;
  return (
    <>
      <Card
        icon={Timer}
        title="14. SLA & Tail Latency"
        right={sla.eligible ? <Tag tone={sla.highUtilizationWarning ? 'warn' : 'good'}>{sla.highUtilizationWarning ? 'Near saturation' : 'Eligible'}</Tag> : <Tag>N/A</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          Point-estimate TTFT/TPOT above assume a request has a free batch slot the instant it arrives. In practice, a replica serves at most C concurrent requests (its continuous-batching concurrency) — anything beyond that queues for a slot. This uses an M/M/c (Erlang C) queueing model to estimate how much that queueing adds to TTFT at a target utilization. TPOT is unaffected: once a request is admitted to the running batch, decode proceeds at the same steady-state rate regardless of how busy the replica was before admission. When enabled, Ingress and Guardrails add fixed (non-queueing) latency ahead of and behind this queueing model — folded into every percentile below, not just shown on their own tabs.
        </Banner>

        {!sla.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {sla.reason}
          </Banner>
        )}

        {sla.eligible && (
          <>
            <div className="pt-1">
              <SliderField
                label="Target Replica Utilization (ρ):"
                valueLabel={`${(sla.targetUtilization * 100).toFixed(0)}%${sla.wasClamped ? ' (clamped)' : ''}`}
                min="0.05" max="0.99" step="0.01"
                value={targetUtilization}
                onChange={(e) => setTargetUtilization(Number(e.target.value))}
                marks={['5% (Idle)', '70% (Typical Target)', '99% (Saturated)']}
                helper={
                  <InfoHelper
                    title="Target Replica Utilization (ρ)"
                    text="The fraction of each replica's concurrency slots (C) you expect to be busy on average, given your offered load. Offered load in Erlangs = ρ × C. Utilization is clamped below 100% — an M/M/c queue is only stable for ρ < 1, and wait times diverge as ρ → 1."
                    whyItMatters="Higher utilization packs more requests per GPU (lower $/request) but tail latency grows sharply as you approach saturation. This is the classic throughput-vs-latency trade-off — pick the point that matches your SLA."
                  />
                }
              />
            </div>

            {sla.highUtilizationWarning && (
              <Banner tone="warn" icon={AlertTriangle}>
                At ρ = {(sla.targetUtilization * 100).toFixed(0)}%, tail queueing delay grows sharply — the replica is close to saturation. Consider more replicas (higher DP) or a lower target utilization if P95/P99 latency matters.
              </Banner>
            )}

            <div className="pt-3 border-t border-zinc-800/70">
              <Rows>
                <Row k="Concurrency per replica (C)" v={`${sla.concurrencyPerReplica}`} mono={false} />
                <Row k="Mean service time / slot" v={`${(sla.meanServiceTimeSec * 1000).toFixed(0)} ms`} mono={false} />
                <Row k="P(request queues) — Erlang C" v={`${(sla.probabilityOfQueueing * 100).toFixed(1)}%`} tone="accent" />
                <Row k="Mean queueing delay" v={`${(sla.meanWaitSec * 1000).toFixed(1)} ms`} mono={false} />
              </Rows>
            </div>

            {(sla.extraPreQueueLatencySec > 0 || sla.extraPostGenerationLatencySec > 0) && (
              <div className="pt-3 border-t border-zinc-800/70">
                <SectionLabel>ADD-ON MODULE LATENCY FOLDED IN (FIXED, NOT QUEUEING)</SectionLabel>
                <Rows>
                  {sla.extraPreQueueLatencySec > 0 && (
                    <Row k="Pre-queue (Ingress TLS/routing + Guardrails input guard)" v={`+${(sla.extraPreQueueLatencySec * 1000).toFixed(1)} ms`} tone="accent" />
                  )}
                  {sla.extraPostGenerationLatencySec > 0 && (
                    <Row k="Post-generation (Guardrails output guard)" v={`+${(sla.extraPostGenerationLatencySec * 1000).toFixed(1)} ms`} tone="accent" />
                  )}
                </Rows>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>TTFT AT PERCENTILE (BASELINE + QUEUEING DELAY)</SectionLabel>
              <Rows>
                <Row k="Baseline TTFT (no queueing)" v={`${(sla.ttftBaselineSec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P50 TTFT" v={`${(sla.ttftP50Sec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P90 TTFT" v={`${(sla.ttftP90Sec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P95 TTFT" v={`${(sla.ttftP95Sec * 1000).toFixed(1)} ms`} tone="accent" />
                <Row k="P99 TTFT" v={`${sla.ttftP99Sec < 1 ? `${(sla.ttftP99Sec * 1000).toFixed(1)} ms` : `${sla.ttftP99Sec.toFixed(2)} s`}`} tone="warn" />
                <Row k="TPOT (unaffected by queueing)" v={`${(sla.tpotSec * 1000).toFixed(2)} ms/tok`} mono={false} />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>TOTAL RESPONSE TIME AT PERCENTILE (TTFT + DECODE + POST-GEN)</SectionLabel>
              <Rows>
                <Row k="Baseline total response (no queueing)" v={`${(sla.totalResponseBaselineSec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P50 total response" v={`${(sla.totalResponseP50Sec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P90 total response" v={`${(sla.totalResponseP90Sec * 1000).toFixed(1)} ms`} mono={false} />
                <Row k="P95 total response" v={`${(sla.totalResponseP95Sec * 1000).toFixed(1)} ms`} tone="accent" />
                <Row k="P99 total response" v={`${sla.totalResponseP99Sec < 1 ? `${(sla.totalResponseP99Sec * 1000).toFixed(1)} ms` : `${sla.totalResponseP99Sec.toFixed(2)} s`}`} tone="warn" />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
