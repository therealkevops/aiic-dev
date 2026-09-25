import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, SectionLabel, Tag, ToggleRow } from '../ui';
import { GUARDRAIL_MODELS } from '../../data/guardrails';
import { GPU_CATALOG } from '../../data/hardware';
import { GPU_PRICING } from '../../data/pricing';

export function GuardrailsTab({ ctx }) {
  const {
    enableGuardrails, enableInputGuard, enableOutputGuard, guardGpu, guardGpuId, guardGpuUnitPriceUsd,
    guardrails, selectedGuardModelId, setEnableGuardrails, setEnableInputGuard, setEnableOutputGuard, setGuardGpuId,
    setGuardGpuUnitPriceUsd, setSelectedGuardModelId,
  } = ctx;
  return (
    <>
      <Card
        icon={Shield}
        title="9. Guardrails"
        right={guardrails.enabled ? <Tag tone={guardrails.eligible ? 'good' : 'warn'}>{guardrails.eligible ? 'Eligible' : 'Not eligible'}</Tag> : <Tag>Off</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          Guardrails run a small(er) safety-classifier model alongside the main LLM to screen requests: an input guard classifies the prompt before generation starts, and/or an output guard classifies the full response before it's returned. Like RAG, this is real standing infrastructure — its capex and power feed into Cost & TCO. Added latency is a fixed per-request delay (not queueing), so it's folded straight into every percentile on the SLA tab rather than modeled as its own distribution there.
        </Banner>

        <ToggleRow
          label="Guardrails Sizing"
          description={enableGuardrails ? 'Sizing a safety-classifier pool against the cluster\'s request rate.' : 'No guardrail infrastructure sized.'}
          checked={enableGuardrails}
          onChange={setEnableGuardrails}
        />

        {enableGuardrails && !guardrails.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {guardrails.reason}
          </Banner>
        )}

        {enableGuardrails && guardrails.eligible && (
          <>
            <Field label="Guard Model" helper={
              <InfoHelper
                title="Guard Model"
                text="A safety-classifier model fine-tuned to detect policy violations (violence, jailbreaks, PII, hate speech, etc.) in a prompt or response, rather than generate free-form text."
                whyItMatters="Larger guard models generally classify more accurately across more categories, but cost proportionally more compute and add more latency per request -- Llama Guard 3 8B needs roughly 8x the throughput-sizing compute of the 1B variant."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {GUARDRAIL_MODELS.map((m) => (
                  <ChoiceCard
                    key={m.id}
                    selected={selectedGuardModelId === m.id}
                    onClick={() => setSelectedGuardModelId(m.id)}
                    title={`${m.name} (${m.paramsBillion}B params)`}
                    desc={`${m.vendor} · ${m.notes}`}
                  />
                ))}
              </div>
            </Field>

            <ToggleRow
              label="Input Guard"
              description="Classifies the prompt before generation starts -- adds latency to TTFT."
              checked={enableInputGuard}
              onChange={setEnableInputGuard}
            />
            <ToggleRow
              label="Output Guard"
              description="Classifies the full response before it's returned -- adds latency to the end of the response."
              checked={enableOutputGuard}
              onChange={setEnableOutputGuard}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Guard GPU">
                <select
                  value={guardGpuId}
                  onChange={(e) => {
                    setGuardGpuId(e.target.value);
                    setGuardGpuUnitPriceUsd(GPU_PRICING[e.target.value]?.estimatedUnitPriceUsd ?? 0);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {GPU_CATALOG.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Guard GPU — Unit Price (Capex)">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                  <input type="number" min="0" step="500" value={guardGpuUnitPriceUsd}
                    onChange={(e) => setGuardGpuUnitPriceUsd(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
                </div>
              </Field>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>THROUGHPUT SIZING</SectionLabel>
              <Rows>
                <Row k="Cluster request rate" v={`${guardrails.requestRatePerSec.toFixed(2)} req/s`} mono={false} />
                <Row k="Guard GPUs needed" v={`${guardrails.guardGpusNeeded}x ${guardGpu.name}`} tone="good" />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>ADDED LATENCY (FOLDED INTO SLA TAB'S PERCENTILES)</SectionLabel>
              <Rows>
                <Row k="Input guard latency" v={enableInputGuard ? `${(guardrails.inputGuardLatencySec * 1000).toFixed(1)} ms` : 'Disabled'} mono={false} />
                <Row k="Output guard latency" v={enableOutputGuard ? `${(guardrails.outputGuardLatencySec * 1000).toFixed(1)} ms` : 'Disabled'} mono={false} />
                <Row k="Added to TTFT" v={`${(guardrails.addedTtftSec * 1000).toFixed(1)} ms`} tone="accent" />
                <Row k="Added to total response time" v={`${(guardrails.addedTotalLatencySec * 1000).toFixed(1)} ms`} tone="accent" />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>GUARDRAILS COST (FEEDS INTO COST & TCO)</SectionLabel>
              <Rows>
                <Row k="Guardrails compute capex" v={`$${Math.round(guardrails.guardrailsComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="Guardrails IT power draw" v={`${guardrails.guardrailsItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
