import React from 'react';
import { AlertTriangle, Globe } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, SectionLabel, SliderField, Tag, ToggleRow } from '../ui';
import { INGRESS_TIERS } from '../../data/ingress';

export function IngressTab({ ctx }) {
  const {
    egressUsdPerGb, enableIngress, ingress, ingressTier, selectedIngressTierId, setEgressUsdPerGb,
    setEnableIngress, setSelectedIngressTierId,
  } = ctx;
  return (
    <>
      <Card
        icon={Globe}
        title="10. Ingress & Edge"
        right={ingress.enabled ? <Tag tone={ingress.eligible ? 'good' : 'warn'}>{ingress.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          The ingress/edge layer terminates TLS and load-balances every response leaving the cluster -- self-hosted appliances or software instances add real capex and power like RAG/guardrails; every tier (including fully-managed ones) adds a recurring annual bill for egress bandwidth, which can be a meaningful share of ongoing opex for high-throughput serving. Its added latency is a fixed per-request delay, folded into every percentile on the SLA tab.
        </Banner>

        <ToggleRow
          label="Ingress & Edge Sizing"
          description={enableIngress ? 'Sizing a load-balancing/edge pool and its egress bandwidth bill against the cluster\'s request rate.' : 'No ingress infrastructure or egress bandwidth cost sized.'}
          checked={enableIngress}
          onChange={setEnableIngress}
        />

        {enableIngress && !ingress.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {ingress.reason}
          </Banner>
        )}

        {enableIngress && ingress.eligible && (
          <>
            <Field label="Ingress Tier" helper={
              <InfoHelper
                title="Ingress Tier"
                text="How traffic is load-balanced and TLS-terminated in front of the cluster, from a self-hosted open-source proxy to a fully-managed CDN edge network."
                whyItMatters="Self-hosted tiers (software LB, hardware ADC, API gateway) add real capex and datacenter power; managed tiers (cloud LB, CDN edge) trade that for a recurring service fee and no hardware to operate. The CDN edge tier also reduces connection latency for geographically distributed users by terminating TLS closer to them."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {INGRESS_TIERS.map((t) => (
                  <ChoiceCard
                    key={t.id}
                    selected={selectedIngressTierId === t.id}
                    onClick={() => setSelectedIngressTierId(t.id)}
                    title={`${t.name} (${t.type === 'managed' ? 'Managed' : 'Self-Hosted'})`}
                    desc={`${t.vendor} · ${t.throughputGbpsPerNode} Gbps/node · +${t.latencyOverheadMs}ms · ${t.notes}`}
                  />
                ))}
              </div>
            </Field>

            <SliderField
              label="Egress Bandwidth Rate:"
              valueLabel={`$${egressUsdPerGb.toFixed(3)}/GB`}
              min="0.02" max="0.15" step="0.005"
              value={egressUsdPerGb}
              onChange={(e) => setEgressUsdPerGb(Number(e.target.value))}
              marks={['$0.02 (Negotiated Volume)', '$0.09 (Standard List)', '$0.15 (High-Cost Region)']}
              helper={
                <InfoHelper
                  title="Egress Bandwidth Rate"
                  text="The $/GB charged for data leaving the datacenter to the internet -- every response token streamed back to a user counts against this, regardless of which ingress tier fronts it. $0.09/GB is a commonly cited standard cloud list-price anchor; real negotiated rates vary by volume and provider, often dropping well below list at scale."
                  whyItMatters="For a high-throughput API, egress can rival or exceed the ingress hardware's own cost -- it's a genuinely recurring bill, not a one-time capex line."
                />
              }
            />

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>THROUGHPUT SIZING</SectionLabel>
              <Rows>
                <Row k="Cluster request rate" v={`${ingress.requestRatePerSec.toFixed(2)} req/s`} mono={false} />
                <Row k="Avg. response size" v={`${(ingress.avgResponseBytes / 1024).toFixed(1)} KB`} mono={false} />
                <Row k="Total egress bandwidth" v={`${(ingress.totalEgressGbps * 1000).toFixed(2)} Mbps`} mono={false} />
                <Row k="Ingress nodes needed" v={`${ingress.nodesNeeded}x ${ingressTier.name}`} tone="good" />
                <Row k="Added latency (TLS + routing)" v={`+${ingress.addedLatencyMs} ms`} mono={false} />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>INGRESS & EGRESS COST (FEEDS INTO COST & TCO)</SectionLabel>
              <Rows>
                <Row k="Ingress compute capex" v={`$${Math.round(ingress.ingressComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="Annual egress bandwidth cost" v={`$${Math.round(ingress.annualEgressCostUsd).toLocaleString()}/yr (${Math.round(ingress.annualEgressGb).toLocaleString()} GB/yr)`} tone="accent" />
                <Row k="Annual managed-service / support fee" v={`$${Math.round(ingress.annualManagedServiceCostUsd).toLocaleString()}/yr`} mono={false} />
                <Row k="Total ingress annual opex" v={`$${Math.round(ingress.ingressAnnualOpexUsd).toLocaleString()}/yr`} tone="good" />
                <Row k="Ingress IT power draw" v={`${ingress.ingressItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
