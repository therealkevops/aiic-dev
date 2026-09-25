// What-if analyses that re-run the whole scenario with changed inputs: the largest workload a
// power budget supports, which inputs move cost the most, and a year-by-year growth plan.
// computeScenario() takes about a millisecond, so each analysis runs it a few dozen times at most.
import { computeScenario } from './scenario.js';

/** The config field that carries demand for this workload, and its current value. */
export function demandDriver(config) {
  if (config.workloadType === 'training') return { key: 'manualDp', value: config.manualDp, label: 'data-parallel replicas', integer: true };
  if (config.sizingInputMode === 'traffic') {
    return config.trafficInputType === 'rps'
      ? { key: 'peakRequestsPerSec', value: config.peakRequestsPerSec, label: 'requests/s', integer: false }
      : { key: 'peakActiveUsers', value: config.peakActiveUsers, label: 'peak-hour users', integer: true };
  }
  return { key: 'concurrency', value: config.concurrency, label: 'concurrent streams', integer: true };
}

/** Config with demand multiplied by `factor` (RAG query load follows the same traffic). */
export function scaleDemand(config, factor) {
  const d = demandDriver(config);
  const raw = d.value * factor;
  const next = { ...config, [d.key]: d.integer ? Math.max(1, Math.round(raw)) : Math.max(0.01, Number(raw.toFixed(2))) };
  if (config.workloadType === 'inference' && config.enableRag) next.ragQueryQps = Math.max(0.1, Number((config.ragQueryQps * factor).toFixed(2)));
  return next;
}

const facilityKwOf = (s) => s.cost.billedFacilityPowerKw;

/**
 * Largest demand whose facility power (IT load × PUE, including add-on pools) fits the budget.
 * Demand is searched as a multiple of the current value; the result reports the fitted demand,
 * GPUs and power.
 */
export function fitPowerBudget(config, budgetKw) {
  if (!(budgetKw > 0)) return { eligible: false };
  const d = demandDriver(config);
  const evalAt = (f) => {
    const cfg = scaleDemand(config, f);
    const s = computeScenario(cfg);
    return { f, demand: cfg[d.key], kw: facilityKwOf(s), gpus: s.results.totalGpus, scenario: s };
  };
  const current = evalAt(1);
  const minFactor = (d.integer ? 1 : 0.01) / d.value;
  const smallest = evalAt(minFactor);
  if (smallest.kw > budgetKw) {
    return { eligible: true, fits: false, driver: d, current, best: null, minimumKw: smallest.kw, budgetKw };
  }
  let lo = minFactor;
  let hi;
  if (current.kw <= budgetKw) {
    lo = 1;
    hi = 2;
    while (hi < 4096 && evalAt(hi).kw <= budgetKw) { lo = hi; hi *= 2; }
    if (hi >= 4096) hi = 4096;
  } else {
    hi = 1;
  }
  for (let i = 0; i < 30 && (hi - lo) / hi > 0.002; i++) {
    const mid = (lo + hi) / 2;
    if (evalAt(mid).kw <= budgetKw) lo = mid; else hi = mid;
  }
  const best = evalAt(lo);
  return { eligible: true, fits: true, driver: d, current, best, budgetKw, headroomKw: budgetKw - current.kw };
}

// Inputs varied by the sensitivity analysis. `delta` is the relative swing each way; fields
// that can't vary for the current configuration are skipped.
const SENSITIVITY_INPUTS = [
  { key: 'gpuUnitPriceUsd', label: 'GPU price', delta: 0.2, fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'powerUsdPerKwh', label: 'Electricity price', delta: 0.5, when: (c) => !c.useColo, fmt: (v) => `$${v.toFixed(3)}/kWh` },
  { key: 'coloUsdPerKwPerMonth', label: 'Colocation rate', delta: 0.3, when: (c) => c.useColo, fmt: (v) => `$${Math.round(v)}/kW-mo` },
  { key: 'pue', label: 'PUE', delta: 0.1, min: 1.0, when: (c) => !c.useColo, fmt: (v) => v.toFixed(2) },
  { key: 'supportPctPerYear', label: 'Support & maintenance', delta: 0.33, fmt: (v) => `${v.toFixed(1)}%/yr` },
  { key: 'networkHardwareAdderPct', label: 'Network + storage adder', delta: 0.33, fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'contextLength', label: 'Context length', delta: 0.5, integer: true, when: (c) => c.workloadType === 'inference', fmt: (v) => `${Math.round(v).toLocaleString()} tokens` },
  { key: '_demand', label: 'Demand', delta: 0.5, when: (c) => c.workloadType === 'inference' },
  { key: 'dutyCyclePct', label: 'Utilization', delta: 0.4, max: 100, min: 5, perTokenOnly: true, fmt: (v) => `${Math.round(v)}%` },
];

/**
 * Tornado-style sensitivity: each input is moved down and up by its swing with everything else
 * held, and the change in the metric is recorded. Sorted by total swing, largest first.
 * metric: 'tco' (total cost of ownership) or 'costPer1M' (serving cost per 1M output tokens).
 */
export function sensitivityAnalysis(config, metric = 'tco', base = computeScenario(config)) {
  const read = (s) => (metric === 'costPer1M'
    ? (s.tokenEconomics?.eligible ? s.tokenEconomics.costPer1MOutputTokensUsd : null)
    : s.cost.tcoUsd);
  const baseValue = read(base);
  if (baseValue == null) return { eligible: false };
  const rows = [];
  for (const input of SENSITIVITY_INPUTS) {
    if (input.when && !input.when(config)) continue;
    if (input.perTokenOnly && metric !== 'costPer1M') continue;
    const at = (sign) => {
      if (input.key === '_demand') {
        const cfg = scaleDemand(config, 1 + sign * input.delta);
        const d = demandDriver(cfg);
        return { cfg, shown: `${d.integer ? Math.round(d.value).toLocaleString() : d.value} ${d.label}` };
      }
      let v = config[input.key] * (1 + sign * input.delta);
      if (input.integer) v = Math.round(v);
      if (input.min != null) v = Math.max(input.min, v);
      if (input.max != null) v = Math.min(input.max, v);
      if (input.key === 'contextLength') v = Math.min(v, base.maxContextLength);
      return { cfg: { ...config, [input.key]: v }, shown: input.fmt(v) };
    };
    const lo = at(-1);
    const hi = at(1);
    const loValue = read(computeScenario(lo.cfg));
    const hiValue = read(computeScenario(hi.cfg));
    if (loValue == null || hiValue == null) continue;
    rows.push({
      key: input.key,
      label: input.label,
      swingPct: Math.round(input.delta * 100),
      lowInput: lo.shown,
      highInput: hi.shown,
      lowValue: loValue,
      highValue: hiValue,
      swing: Math.abs(hiValue - loValue),
    });
  }
  rows.sort((a, b) => b.swing - a.swing);
  return { eligible: rows.length > 0, metric, baseValue, rows };
}

/**
 * Year-by-year capacity plan for growing inference demand. Each year is sized for that year's
 * demand. A year's capex is the increase in total capex (GPUs, fabric, storage, add-ons) from
 * last year's design to this year's, at this year's prices; a refresh year buys the whole design
 * again. Opex is the annual opex of the design in service that year. The comparison buys the
 * final-year design on day one.
 */
export function growthPlan(config) {
  if (config.workloadType !== 'inference') return { eligible: false, reason: 'Growth planning applies to inference demand.' };
  const years = Math.max(1, config.tcoYears);
  const growth = Math.max(0, config.demandGrowthPctPerYear / 100);
  const priceChange = config.gpuPriceChangePctPerYear / 100;
  const refreshIndex = config.refreshYear > 1 && config.refreshYear <= years ? config.refreshYear - 1 : -1;
  const priceFactorAt = (y) => Math.max(0.05, Math.pow(1 + priceChange, y));
  const sizeFor = (demandFactor, priceFactor) => computeScenario({
    ...scaleDemand(config, demandFactor),
    gpuUnitPriceUsd: config.gpuUnitPriceUsd * priceFactor,
  });
  const driver = demandDriver(config);
  const rows = [];
  let installed = 0;
  let cumulativeUsd = 0;
  for (let y = 0; y < years; y++) {
    const demandFactor = Math.pow(1 + growth, y);
    const s = sizeFor(demandFactor, priceFactorAt(y));
    const refresh = y === refreshIndex;
    let capexUsd = s.cost.totalCapexUsd;
    if (y > 0 && !refresh) {
      const lastYearDesignAtTodaysPrice = sizeFor(Math.pow(1 + growth, y - 1), priceFactorAt(y));
      capexUsd = Math.max(0, s.cost.totalCapexUsd - lastYearDesignAtTodaysPrice.cost.totalCapexUsd);
    }
    const needed = s.results.totalGpus;
    const nextInstalled = Math.max(installed, needed);
    const bought = refresh ? nextInstalled : nextInstalled - installed;
    installed = nextInstalled;
    const opexUsd = s.cost.annualOpexUsd;
    cumulativeUsd += capexUsd + opexUsd;
    rows.push({
      year: y + 1,
      demandFactor,
      demand: scaleDemand(config, demandFactor)[driver.key],
      gpusNeeded: needed,
      gpusInstalled: installed,
      gpusBought: bought,
      refresh,
      racks: s.facility.totalRacks,
      facilityKw: s.cost.billedFacilityPowerKw,
      capexUsd,
      opexUsd,
      cumulativeUsd,
    });
  }
  // Alternative: buy the final year's design on day one at today's price (and again at refresh).
  const upfront = sizeFor(Math.pow(1 + growth, years - 1), 1);
  const upfrontRefreshCapex = refreshIndex >= 0 ? sizeFor(Math.pow(1 + growth, years - 1), priceFactorAt(refreshIndex)).cost.totalCapexUsd : 0;
  const upfrontTotalUsd = upfront.cost.totalCapexUsd + upfrontRefreshCapex + upfront.cost.annualOpexUsd * years;
  return {
    eligible: true,
    driver,
    rows,
    totalUsd: cumulativeUsd,
    upfront: { gpus: upfront.results.totalGpus, totalUsd: upfrontTotalUsd },
    savingsVsUpfrontUsd: upfrontTotalUsd - cumulativeUsd,
  };
}
