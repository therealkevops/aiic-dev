// MLOps lifecycle reference data: the three standard model-rollout validation patterns used to
// safely promote a new model version into production. Each needs its own standing compute pool
// alongside the primary serving cluster -- these are well-established industry-standard release
// patterns (not vendor-specific figures), so unlike GPU/storage pricing there's no external
// benchmark to verify; the only illustrative default is the canary traffic percentage.

export const MLOPS_STRATEGIES = [
  {
    id: "canary-release",
    name: "Canary Release",
    scope: "Routes a small, configurable percentage of live traffic to the new model version",
    capacityMultiplier: null, // derived from the user-set canary traffic percentage, not fixed
    rollbackSpeed: "Seconds (traffic-split revert to 0%)",
    notes: "Cheapest validation pattern -- the canary pool only needs to be sized for its own slice of traffic, not the full cluster.",
  },
  {
    id: "shadow-deployment",
    name: "Shadow Deployment",
    scope: "Mirrors 100% of live traffic to the new version for silent evaluation -- its responses are logged and compared, never returned to users",
    capacityMultiplier: 1.0,
    rollbackSpeed: "N/A (shadow traffic never reaches users, so there's nothing to roll back)",
    notes: "Full-scale validation under real production load with zero user-facing risk -- at the cost of a full duplicate compute pool for the validation window.",
  },
  {
    id: "blue-green-cutover",
    name: "Blue/Green Cutover",
    scope: "Validates a fully-scaled duplicate pool (green) before an instant router flip from the current pool (blue)",
    capacityMultiplier: 1.0,
    rollbackSpeed: "Seconds (instant router flip back to blue)",
    notes: "Simplest mental model and fastest rollback of the three, but requires the most standing spare capacity since green must match blue's full scale before cutover.",
  },
];

export const DEFAULT_MLOPS_STRATEGY_ID = "canary-release";
export const DEFAULT_CANARY_TRAFFIC_PCT = 10;
