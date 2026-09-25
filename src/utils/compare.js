// Headline metrics for one scenario, shared by the side-by-side comparison and the exported
// report. `better` says which direction is an improvement ('lower' / 'higher'), so a
// comparison can colour deltas; null means neither direction is inherently better.

const usd = (v) => `$${Math.round(v).toLocaleString()}`;
const sec = (s) => (s == null || !Number.isFinite(s) ? '—' : s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);

export function scenarioMetrics(config, s) {
  const inference = config.workloadType === 'inference';
  const t = s.throughput;
  const rows = [
    { group: 'Design', label: 'Model', value: s.model.name, better: null },
    { group: 'Design', label: 'Precision (weights / KV)', value: `${s.precision.name.split(' ')[0]} / ${config.kvPrecision.toUpperCase()}`, better: null },
    { group: 'Design', label: 'Platform', value: s.platform.name, better: null },
    { group: 'Design', label: 'Sharding', value: `TP=${s.tp} · PP=${s.pp} · DP=${s.dp}${s.results.epNodes > 1 ? ` · EP×${s.results.epNodes}` : ''}`, better: null },
    { group: 'Design', label: inference ? 'Concurrent streams' : 'Micro-batch', value: inference ? config.concurrency : config.microBatchSize, format: (v) => v.toLocaleString(), better: null },
    { group: 'Design', label: 'Context window', value: config.contextLength, format: (v) => `${v.toLocaleString()} tokens`, better: null },
    { group: 'Footprint', label: 'GPUs', value: s.results.totalGpus, format: (v) => v.toLocaleString(), better: 'lower' },
    { group: 'Footprint', label: 'Nodes', value: s.results.nodes, format: (v) => v.toLocaleString(), better: 'lower' },
    { group: 'Footprint', label: 'Racks', value: s.facility.totalRacks, format: (v) => v.toLocaleString(), better: 'lower' },
    { group: 'Footprint', label: 'IT power', value: s.facility.totalItPowerKw, format: (v) => `${v.toFixed(1)} kW`, better: 'lower' },
    { group: 'Footprint', label: 'Memory used per GPU', value: s.memory.perGpuTotalUsedGb, format: (v) => `${v.toFixed(1)} GB`, better: null },
    { group: 'Footprint', label: 'Fits in memory', value: s.memory.isOOM ? 'No (OOM)' : 'Yes', better: null },
  ];
  if (inference && t) {
    rows.push(
      { group: 'Performance', label: 'Time to first token', value: t.ttftSec, format: sec, better: 'lower' },
      { group: 'Performance', label: 'Time per output token', value: Number(t.tpotMs), format: (v) => `${v.toFixed(1)} ms`, better: 'lower' },
      { group: 'Performance', label: 'P99 time to first token', value: s.sla.eligible ? s.sla.ttftP99Sec : null, format: sec, better: 'lower' },
      { group: 'Performance', label: 'Cluster output throughput', value: t.batchThroughputTps, format: (v) => `${Math.round(v).toLocaleString()} tok/s`, better: 'higher' },
    );
  }
  rows.push(
    { group: 'Cost', label: 'Total capex', value: s.cost.totalCapexUsd, format: usd, better: 'lower' },
    { group: 'Cost', label: 'Annual opex', value: s.cost.annualOpexUsd, format: usd, better: 'lower' },
    { group: 'Cost', label: `${s.cost.tcoYears}-year TCO`, value: s.cost.tcoUsd, format: usd, better: 'lower' },
    { group: 'Cost', label: 'Effective $/GPU-hour', value: s.cost.effectiveUsdPerGpuHour, format: (v) => `$${v.toFixed(2)}`, better: 'lower' },
  );
  if (s.tokenEconomics?.eligible) {
    rows.push({ group: 'Cost', label: `Per 1M output tokens (serving, ${s.tokenEconomics.dutyCyclePct.toFixed(0)}% util.)`, value: s.tokenEconomics.costPer1MOutputTokensUsd, format: (v) => `$${v.toFixed(2)}`, better: 'lower' });
  }
  return rows.map(r => ({ ...r, display: r.value == null ? '—' : (r.format ? r.format(r.value) : String(r.value)) }));
}

/**
 * Pairs two metric lists row by row (matched on label) and marks which side is better.
 * Rows present in only one scenario (e.g. performance for training) show a dash on the other.
 */
export function compareMetrics(a, b) {
  const labels = [...new Set([...a.map(r => r.label), ...b.map(r => r.label)])];
  return labels.map((label) => {
    const ra = a.find(r => r.label === label);
    const rb = b.find(r => r.label === label);
    const row = ra || rb;
    let winner = null;
    if (row.better && typeof ra?.value === 'number' && typeof rb?.value === 'number' && ra.value !== rb.value) {
      const aLower = ra.value < rb.value;
      winner = (row.better === 'lower') === aLower ? 'a' : 'b';
    }
    let delta = null;
    if (typeof ra?.value === 'number' && typeof rb?.value === 'number' && ra.value !== 0 && row.better) {
      delta = ((rb.value - ra.value) / Math.abs(ra.value)) * 100;
    }
    return { group: row.group, label, a: ra?.display ?? '—', b: rb?.display ?? '—', winner, delta };
  });
}
