// Cost & TCO reference data. NVIDIA does not publish list prices for data-center GPUs or
// enterprise storage appliances — every dollar figure here is a clearly-labeled illustrative
// default sourced from public secondary-market/reseller/cloud-rental data, not a vendor quote.
// Every figure is user-editable in the UI (same posture as the PUE slider): defaults exist so
// the tool is useful out of the box, but should be replaced with the user's actual quote.

// GPU acquisition (capex) and dedicated-cloud rental (opex comparison) estimates, by GPU catalog id.
// Sources (as of this session): public GPU pricing roundups (e.g. purchase prices clustering in
// a $25k-45k band across H100/H200/B200; specialized/dedicated cloud rental rates, not
// hyperscaler on-demand, since that's the more relevant "neo-cloud" comparison point).
export const GPU_PRICING = {
  "h200-sxm":       { estimatedUnitPriceUsd: 35000, estimatedCloudRateUsdPerHr: 3.75 },
  "b200-sxm":       { estimatedUnitPriceUsd: 40000, estimatedCloudRateUsdPerHr: 7.50 },
  "h100-sxm":       { estimatedUnitPriceUsd: 27500, estimatedCloudRateUsdPerHr: 3.00 },
  "h100-nvl":       { estimatedUnitPriceUsd: 30000, estimatedCloudRateUsdPerHr: 3.25 },
  "l40s-pcie":      { estimatedUnitPriceUsd: 8500,  estimatedCloudRateUsdPerHr: 1.20 },
  "a100-sxm-80gb":  { estimatedUnitPriceUsd: 9000,  estimatedCloudRateUsdPerHr: 1.50 },
  "b300-sxm":       { estimatedUnitPriceUsd: 50000, estimatedCloudRateUsdPerHr: 9.00 },
  "rtx-pro-6000":   { estimatedUnitPriceUsd: 10000, estimatedCloudRateUsdPerHr: 1.80 },
  "mi300x":         { estimatedUnitPriceUsd: 15000, estimatedCloudRateUsdPerHr: 2.50 },
  "mi325x":         { estimatedUnitPriceUsd: 20000, estimatedCloudRateUsdPerHr: 3.00 },
  "mi355x":         { estimatedUnitPriceUsd: 30000, estimatedCloudRateUsdPerHr: 5.00 },
};

export const DEFAULT_GPU_PRICING = { estimatedUnitPriceUsd: 30000, estimatedCloudRateUsdPerHr: 3.00 };

// NVIDIA AI Enterprise: $4,500/GPU/year list (1-year term; multi-year terms price out to the
// same effective annual rate). Optional layer -- many deployments run a pure open-source stack
// (vLLM/KServe/Ray/Kubernetes) without it.
export const NVIDIA_AI_ENTERPRISE_USD_PER_GPU_PER_YEAR = 4500;

// Industry rule-of-thumb: network fabric + out-of-band/management hardware typically runs
// 10-20% of compute (GPU) capex in a well-architected AI cluster. Modeled as a single adder
// rather than pricing every switch SKU individually, since per-SKU enterprise networking
// pricing is just as opaque/negotiated as GPU pricing.
export const DEFAULT_NETWORK_HARDWARE_ADDER_PCT = 15;

// Enterprise hardware support/maintenance contracts commonly run 12-18% of hardware capex/year.
export const DEFAULT_SUPPORT_PCT_PER_YEAR = 15;

// Commercial electricity: US averages commonly cited in the $0.08-0.18/kWh band; varies widely
// by region and utility contract.
export const DEFAULT_POWER_USD_PER_KWH = 0.12;

// Colocation: commonly cited market range is roughly $100-250/kW/month for wholesale/colo space.
export const DEFAULT_COLO_USD_PER_KW_PER_MONTH = 150;

export const DEFAULT_TCO_YEARS = 3;
