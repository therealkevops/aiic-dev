// Self-contained HTML sizing report for the current scenario (and the pinned comparison
// scenario, if any). Opens in any browser and prints cleanly to PDF.
import { scenarioMetrics, compareMetrics } from './compare.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function table(headers, rows) {
  return `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function assumptions(config, s) {
  const c = config;
  const on = (b) => (b ? 'On' : 'Off');
  const rows = [
    ['Workload', c.workloadType === 'inference' ? 'Inference' : `Training (${c.trainingType === 'lora' ? 'LoRA' : 'full parameter'}, ZeRO-${c.zeroStage})`],
    ['Model', `${s.model.name} — license: ${s.model.license?.name || 'n/a'}`],
    ['Weight / KV precision', `${s.precision.name} / ${c.kvPrecision.toUpperCase()}`],
    ['Context window', `${c.contextLength.toLocaleString()} tokens (${Math.round(c.promptTokenRatio * 100)}% prompt)`],
  ];
  if (c.workloadType === 'inference') {
    rows.push(
      s.traffic
        ? ['Peak traffic', `${s.traffic.requestsPerSec.toFixed(2)} requests/s → ${s.traffic.concurrency.toLocaleString()} concurrent requests at ${Math.round(s.traffic.utilization * 100)}% utilization`]
        : ['Concurrent streams', c.concurrency.toLocaleString()],
      ['Prefix cache sharing', `${Math.round(c.prefixCacheRatio * 100)}%`],
      ['Reasoning tokens per output token', c.reasoningTokensPerOutputToken || 0],
      ['Request-length mix', c.requestMixEnabled ? `${c.shortRequestPct}% short (${c.shortRequestTokens.toLocaleString()} tokens)` : 'Off'],
      ['Serving', `${c.servingEngine} / ${c.orchestrator} / ${c.servingArchitecture === 'llmd' ? 'disaggregated (LLM-D)' : 'colocated'}`],
      ['Latency targets', c.latencyTargetsEnabled ? `TTFT ≤ ${c.targetTtftSec}s, TPOT ≤ ${c.targetTpotMs} ms` : 'Off (memory sizing)'],
    );
  } else {
    rows.push(['Micro-batch', c.microBatchSize]);
  }
  rows.push(
    ['Platform', s.platform.name],
    ['Sharding', `${c.isAutoSharding ? 'Auto' : 'Manual'}: TP=${s.tp}, PP=${s.pp}, DP=${s.dp}${s.results.epNodes > 1 ? `, expert-parallel over ${s.results.epNodes} chassis` : ''}`],
    ['Memory headroom margin', `${c.memoryHeadroomPct}%`],
    ['Network', `${s.protocol.name}, ${c.oversubscriptionRatio}:1 oversubscription`],
    ['Facility', `PUE ${c.pue.toFixed(2)}, ${c.useColo ? `colocation $${c.coloUsdPerKwPerMonth}/kW-month` : `owned DC $${c.powerUsdPerKwh}/kWh`}`],
    ['Storage', `${s.storageTier.name}, ${s.durabilityScheme?.label || 'no durability scheme'}; KV offload ${on(c.enableKvOffload)}`],
    ['Add-ons', `RAG ${on(c.enableRag)}, guardrails ${on(c.enableGuardrails)}, ingress ${on(c.enableIngress)}, HA/DR ${on(c.enableHaDr)}, MLOps ${on(c.enableMlops)}, MIG ${on(c.enableMig)}`],
    ['GPU price / cloud rate', `$${c.gpuUnitPriceUsd.toLocaleString()} / $${c.cloudRateUsdPerHr}/GPU-hr`],
    ['Support, network adder, TCO period', `${c.supportPctPerYear}%/yr, ${c.networkHardwareAdderPct}%, ${c.tcoYears} years`],
  );
  if (c.workloadType === 'inference') {
    rows.push(['Utilization; API comparison price', `${c.dutyCyclePct}%; $${c.apiInputUsdPer1M} in / $${c.apiOutputUsdPer1M} out per 1M tokens`]);
  }
  return table(['Input', 'Value'], rows.map(([k, v]) => [esc(k), esc(v)]));
}

export function buildReportHtml({ config, scenario, label, pinned, bomText, generatedAt = new Date() }) {
  const metrics = scenarioMetrics(config, scenario);
  const summary = table(['Metric', 'Value'], metrics.map(m => [esc(m.label), esc(m.display)]));
  const comparison = pinned
    ? `<h2>Comparison with scenario A: ${esc(pinned.label)}</h2>${table(
        ['Metric', `A · ${pinned.label}`, `B · ${label}`, 'B vs A'],
        compareMetrics(pinned.metrics, metrics).map(r => [
          esc(r.label),
          `<span class="${r.winner === 'a' ? 'better' : ''}">${esc(r.a)}</span>`,
          `<span class="${r.winner === 'b' ? 'better' : ''}">${esc(r.b)}</span>`,
          r.delta == null ? '' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(0)}%`,
        ]),
      )}`
    : '';
  const notices = scenario.warnings.length
    ? `<h2>Notices</h2><ul>${scenario.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Infrastructure Sizing Report — ${esc(label)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #18181b; background: #fff; max-width: 960px; margin: 0 auto; padding: 32px 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e4e4e7; }
  .meta { color: #52525b; font-size: 13px; }
  .note { color: #52525b; font-size: 12px; background: #f4f4f5; padding: 8px 10px; border-radius: 6px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  th { color: #52525b; font-weight: 600; font-size: 12px; }
  td.num { font-variant-numeric: tabular-nums; }
  .better { color: #047857; font-weight: 600; }
  ul { padding-left: 20px; }
  pre { white-space: pre-wrap; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; background: #f4f4f5; padding: 12px; border-radius: 6px; }
  .print { float: right; font: inherit; padding: 6px 12px; border: 1px solid #d4d4d8; background: #fff; border-radius: 6px; cursor: pointer; }
  @media print { .print { display: none; } body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<button class="print" onclick="window.print()">Print / save as PDF</button>
<h1>AI Infrastructure Sizing Report</h1>
<div class="meta">${esc(label)} · generated ${esc(generatedAt.toISOString().slice(0, 16).replace('T', ' '))} UTC</div>
<div class="note">Estimates from the Private AI Infrastructure Sizing Calculator. Prices are illustrative defaults or user inputs, not vendor quotes; performance figures are analytical estimates, not benchmarks.</div>
<h2>Summary</h2>
${summary}
${comparison}
${notices}
<h2>Key assumptions</h2>
${assumptions(config, scenario)}
<h2>Bill of materials</h2>
<pre>${esc(bomText)}</pre>
</body>
</html>
`;
}
