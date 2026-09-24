// Ingress / edge networking reference data: the layer that sits in front of the LLM serving
// cluster -- TLS termination, load balancing/routing, and (for the CDN-edge tier) geographic
// presence close to end users. Per-node throughput and latency figures are illustrative
// single-node/single-instance defaults, editable in the UI (same posture as GPU/storage/vector-DB
// pricing) -- real capacity depends heavily on request/response size, TLS cipher overhead, and
// policy complexity. Capex anchors (entry-tier F5 BIG-IP hardware, ~$15k) and the default egress
// rate ($0.09/GB, AWS standard internet-egress first-tier list price) are verified public figures.

export const INGRESS_TIERS = [
  {
    id: "software-lb",
    name: "Software Load Balancer",
    vendor: "NGINX / Envoy / HAProxy (open source)",
    type: "self-hosted",
    throughputGbpsPerNode: 10,
    latencyOverheadMs: 2,
    estimatedUsdPerNodeCapex: 8000,
    estimatedUsdPerNodeMonthlyOpex: 200,
    notes: "Commodity 1U servers running an open-source reverse proxy -- lowest cost, most operational burden.",
  },
  {
    id: "hardware-adc",
    name: "Hardware Application Delivery Controller",
    vendor: "F5 BIG-IP class appliance",
    type: "self-hosted",
    throughputGbpsPerNode: 10,
    latencyOverheadMs: 1,
    estimatedUsdPerNodeCapex: 15000,
    estimatedUsdPerNodeMonthlyOpex: 250,
    notes: "Dedicated ASIC-accelerated appliance -- lowest per-request latency, highest capex, ~20%/yr support.",
  },
  {
    id: "api-gateway",
    name: "API Gateway",
    vendor: "Kong / Apigee class",
    type: "self-hosted",
    throughputGbpsPerNode: 5,
    latencyOverheadMs: 5,
    estimatedUsdPerNodeCapex: 10000,
    estimatedUsdPerNodeMonthlyOpex: 800,
    notes: "Adds auth, rate limiting, and request/response transformation -- more per-request CPU overhead than a plain LB.",
  },
  {
    id: "cloud-managed-lb",
    name: "Cloud-Managed Load Balancer",
    vendor: "AWS ALB / GCP Load Balancing class",
    type: "managed",
    throughputGbpsPerNode: 100,
    latencyOverheadMs: 3,
    estimatedUsdPerNodeCapex: 0,
    estimatedUsdPerNodeMonthlyOpex: 200,
    notes: "Fully managed and auto-scaling -- no hardware to buy; cost is a small base fee plus request/bandwidth usage.",
  },
  {
    id: "cdn-edge",
    name: "CDN Edge Network",
    vendor: "CloudFront / Cloudflare / Akamai class",
    type: "managed",
    throughputGbpsPerNode: 100,
    latencyOverheadMs: 1,
    estimatedUsdPerNodeCapex: 0,
    estimatedUsdPerNodeMonthlyOpex: 100,
    notes: "Terminates TLS at a PoP near the end user, reducing connection latency for geographically distributed traffic -- generation still happens at the origin GPU cluster.",
  },
];

export const DEFAULT_INGRESS_TIER_ID = "software-lb";

// AWS standard internet egress (first 10 TB/month tier) -- a commonly cited, verified public
// list-price anchor. Real negotiated rates vary by volume and provider; editable in the UI.
export const DEFAULT_EGRESS_USD_PER_GB = 0.09;
