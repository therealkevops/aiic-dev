// Planning figures derived from one computed scenario: energy and carbon, and renting the same
// GPUs from a cloud provider. Pure functions of the scenario's outputs; what-if analyses that
// re-run the whole scenario (power budget, sensitivity, growth) live in whatIf.js.

const HOURS_PER_YEAR = 24 * 365;

/**
 * Energy use and emissions. Power is nameplate (chassis TDP × PUE, as Cost & TCO bills it), so
 * these are upper bounds: real servers average below TDP, and idle hours draw less than busy ones.
 */
export function calculateEnergy({ cost, throughput, tokenEconomics, trainingTime, gridCarbonKgPerKwh = 0 }) {
  const facilityKw = cost.billedFacilityPowerKw;
  const annualMwh = (facilityKw * HOURS_PER_YEAR) / 1000;
  const intensity = Math.max(0, gridCarbonKgPerKwh);
  const out = {
    facilityKw,
    annualMwh,
    annualTco2: annualMwh * intensity, // MWh × kg/kWh = tonnes
    gridCarbonKgPerKwh: intensity,
    kwhPer1MOutputTokensAtLoad: null,
    kwhPer1MOutputTokensAtUtilization: null,
    kgCo2Per1MOutputTokensAtUtilization: null,
    trainingRunMwh: null,
    trainingRunTco2: null,
  };
  const tps = throughput?.batchThroughputTps;
  if (tps > 0) out.kwhPer1MOutputTokensAtLoad = (facilityKw / (tps * 3600)) * 1e6;
  if (tokenEconomics?.eligible && tokenEconomics.outputTokensPerMonth > 0) {
    // The cluster draws power around the clock; only the busy share of hours produces tokens.
    out.kwhPer1MOutputTokensAtUtilization = (annualMwh * 1000) / (tokenEconomics.outputTokensPerMonth * 12) * 1e6;
    out.kgCo2Per1MOutputTokensAtUtilization = out.kwhPer1MOutputTokensAtUtilization * intensity;
  }
  if (trainingTime?.eligible) {
    out.trainingRunMwh = trainingTime.energyMwh;
    out.trainingRunTco2 = trainingTime.energyMwh * intensity;
  }
  return out;
}

/**
 * Owning versus renting the same GPUs over the TCO horizon. The cloud options rent the GPU
 * servers; storage and add-on pools (RAG, guardrails, HA/DR ...) are charged at their owned cost
 * on every option, so the comparison is like for like.
 */
export function calculateRentVsBuy({ cost, totalGpus, cloudRateUsdPerHr, reservedDiscountPct = 0, dutyCyclePct = 100, isInference }) {
  const years = cost.tcoYears;
  const servingTcoUsd = cost.servingCapexUsd + cost.servingAnnualOpexUsd * years;
  const nonGpuUsd = Math.max(0, cost.tcoUsd - servingTcoUsd);
  const onDemandUsd = totalGpus * cloudRateUsdPerHr * HOURS_PER_YEAR * years;
  const discount = Math.min(0.9, Math.max(0, reservedDiscountPct / 100));
  const options = [
    { id: 'own', label: 'Buy and run it', usd: cost.tcoUsd, note: 'Capex plus power, support and licensing' },
    { id: 'reserved', label: `Cloud, ${years}-year reserved`, usd: onDemandUsd * (1 - discount) + nonGpuUsd, note: `${Math.round(discount * 100)}% off on-demand, always on` },
    { id: 'on-demand', label: 'Cloud, on-demand, always on', usd: onDemandUsd + nonGpuUsd, note: 'List hourly rate around the clock' },
  ];
  if (isInference) {
    const duty = Math.min(1, Math.max(0.01, dutyCyclePct / 100));
    options.push({
      id: 'elastic',
      label: 'Cloud, on-demand, scaled to use',
      usd: onDemandUsd * duty + nonGpuUsd,
      note: `Pays only for the ${Math.round(duty * 100)}% of hours at load; assumes perfect autoscaling`,
    });
  }
  const cheapest = options.reduce((a, b) => (b.usd < a.usd ? b : a));
  return {
    years,
    nonGpuUsd,
    options: options.map(o => ({ ...o, deltaVsOwnUsd: o.usd - cost.tcoUsd, cheapest: o.id === cheapest.id })),
    cheapestId: cheapest.id,
  };
}
