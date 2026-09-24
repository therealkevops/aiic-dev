// High Availability / Disaster Recovery reference data. Multi-AZ is the classic HA tier --
// protects against a single availability zone failure within one region, with automatic
// failover. The remaining four tiers are AWS's well-established DR strategy framework (Backup &
// Restore, Pilot Light, Warm Standby, Multi-Site Active-Active), which protect against a full
// regional disaster and trade cost for progressively lower RTO/RPO. Compute/storage multipliers
// are illustrative estimates for a *typical* deployment of each pattern -- editable in the UI,
// same posture as other catalog defaults in this app -- since the real multiplier depends heavily
// on how much of the secondary environment is kept warm.

export const HA_DR_TIERS = [
  {
    id: "multi-az",
    name: "Multi-AZ (High Availability)",
    scope: "Single region, multiple availability zones",
    computeMultiplier: 1.33, // N+1 across 3 AZs
    storageMultiplier: 1.0, // typically already synchronously replicated within a region's storage service
    rtoDescription: "Seconds (automatic failover)",
    rpoDescription: "Near-zero (synchronous)",
    notes: "Protects against a single AZ failure, not a regional disaster. The lightest-weight resilience tier -- usually the starting point before any DR strategy.",
  },
  {
    id: "backup-restore",
    name: "Backup & Restore",
    scope: "Cross-region DR",
    computeMultiplier: 1.0, // no standby compute -- provisioned on demand from backups during a failover
    storageMultiplier: 1.1, // backup/snapshot storage overhead only, not a full duplicate copy
    rtoDescription: "Hours to days",
    rpoDescription: "Hours (last backup)",
    notes: "Lowest-cost DR strategy: periodic backups shipped to a second region, infrastructure stood up from scratch on failover. Highest RTO/RPO of the DR tiers.",
  },
  {
    id: "pilot-light",
    name: "Pilot Light",
    scope: "Cross-region DR",
    computeMultiplier: 1.1, // a minimal core kept running in the DR region; most capacity scaled up on failover
    storageMultiplier: 2.0, // full data continuously replicated to the DR region
    rtoDescription: "Hours",
    rpoDescription: "Minutes",
    notes: "A minimal core of the deployment stays running in the secondary region with continuously replicated data; the rest is scaled up from infrastructure-as-code on failover.",
  },
  {
    id: "warm-standby",
    name: "Warm Standby",
    scope: "Cross-region DR",
    computeMultiplier: 1.5, // a scaled-down but fully functional secondary environment, always on
    storageMultiplier: 2.0,
    rtoDescription: "Minutes",
    rpoDescription: "Seconds",
    notes: "A scaled-down but fully functional replica of the deployment runs continuously in the secondary region and is scaled up to full capacity on failover.",
  },
  {
    id: "multi-site-active-active",
    name: "Multi-Site Active-Active",
    scope: "Cross-region DR",
    computeMultiplier: 2.0, // both regions run at full capacity simultaneously
    storageMultiplier: 2.0,
    rtoDescription: "Near-zero",
    rpoDescription: "Near-zero",
    notes: "Full duplicate deployments run simultaneously in two (or more) regions, both serving live traffic. Highest resilience and highest cost.",
  },
];

export const DEFAULT_HA_DR_TIER_ID = "multi-az";
