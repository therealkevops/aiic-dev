// Reference storage tiers for checkpoint, dataset, model-repository, and KV-offload sizing.
// capacityPerRuTb / throughputPerRuGBs are RAW capacity/throughput per standard 42U-rack-unit
// appliance/shelf (before any replication/erasure-coding overhead -- see DURABILITY_SCHEMES
// below), used to size how many RU of a given tier are needed to hit both a capacity and a
// throughput target (whichever is larger wins, same "binding constraint" pattern used for GPU
// sharding).
//
// estimatedUsdPerTbRaw is an illustrative capex estimate, not a vendor quote -- enterprise
// storage pricing is just as opaque/negotiated as GPU pricing, with no published list prices.
// It prices raw TB (what you actually buy from the vendor), not usable TB after durability
// overhead. Editable in the UI; defaults are round numbers reflecting each tier's relative
// positioning (NVMe parallel-fs performance tiers command a premium per TB over bulk object
// storage).
export const STORAGE_TIERS = [
  {
    id: "weka-nvme",
    vendor: "WekaFS",
    name: "WekaFS NVMe All-Flash Parallel Filesystem",
    tier: "parallel-fs",
    capacityPerRuTb: 130,
    throughputPerRuGBs: 24,
    estimatedUsdPerTbRaw: 400,
    latencyProfile: "Sub-millisecond, GPUDirect Storage capable",
    protocol: "NFS / POSIX / S3 / GPUDirect Storage",
    recommendedFor: "Frontier pretraining checkpoint/dataset I/O at 1,000+ GPU scale — highest throughput-per-RU of any tier here.",
    description: "Software-defined NVMe parallel filesystem built for the highest-throughput training clusters. Prioritizes aggregate bandwidth over raw capacity density."
  },
  {
    id: "vast-universal",
    vendor: "VAST Data",
    name: "VAST Data Universal Storage",
    tier: "parallel-fs",
    capacityPerRuTb: 350,
    throughputPerRuGBs: 14,
    estimatedUsdPerTbRaw: 200,
    latencyProfile: "Low-millisecond, flash-native (DASE architecture)",
    protocol: "NFS / SMB / S3 / GPUDirect Storage",
    recommendedFor: "General-purpose AI factory storage — one namespace for datasets, checkpoints, and inference model repos.",
    description: "Flash-native, disaggregated shared-everything architecture. A common default for enterprise and neo-cloud AI clusters that need one platform to serve every stage of the pipeline."
  },
  {
    id: "pure-flashblade",
    vendor: "Pure Storage",
    name: "Pure FlashBlade//E",
    tier: "hybrid-flash",
    capacityPerRuTb: 250,
    throughputPerRuGBs: 9,
    estimatedUsdPerTbRaw: 350,
    latencyProfile: "Low-millisecond, all-flash file + object",
    protocol: "NFS / SMB / S3",
    recommendedFor: "Enterprise deployments standardizing on an existing Pure estate — file and object from one platform.",
    description: "All-flash unified file and object platform, popular in enterprises already running Pure for primary storage and wanting a single vendor relationship."
  },
  {
    id: "netapp-aff",
    vendor: "NetApp",
    name: "NetApp AFF A-Series (ONTAP)",
    tier: "hybrid-flash",
    capacityPerRuTb: 200,
    throughputPerRuGBs: 6,
    estimatedUsdPerTbRaw: 250,
    latencyProfile: "Low-millisecond, enterprise NAS",
    protocol: "NFS / SMB / iSCSI",
    recommendedFor: "Regulated-industry / air-gapped enterprise deployments needing mature snapshotting, replication, and compliance tooling.",
    description: "Enterprise-grade NAS with decades of compliance, snapshot, and replication tooling. The conservative choice for regulated on-prem deployments over raw throughput."
  },
  {
    id: "ceph-bulk",
    vendor: "Ceph / S3-Compatible",
    name: "Ceph Bulk Object Storage",
    tier: "bulk-object",
    capacityPerRuTb: 600,
    throughputPerRuGBs: 3,
    estimatedUsdPerTbRaw: 40,
    latencyProfile: "Tens of milliseconds, object semantics",
    protocol: "S3",
    recommendedFor: "Cold dataset archive, long-tail checkpoint retention, or minimum-footprint air-gapped deployments where cost-per-TB dominates.",
    description: "Cheapest capacity-per-RU tier here by a wide margin, at the cost of throughput and latency. Best for data that's written once and read rarely."
  }
];

// Durability schemes: how much raw capacity a storage system consumes to protect against
// drive/node failure. replicationFactor is raw TB needed per TB of usable data (e.g. 3x
// replication needs 3 raw TB to store 1 usable TB; 8+3 erasure coding needs 11/8 raw TB).
// This is a policy choice largely orthogonal to which storage tier is selected -- real
// deployments pick it based on their failure-tolerance and cost targets, not the vendor.
export const DURABILITY_SCHEMES = [
  {
    id: "replicated-2x",
    label: "Replicated 2x",
    replicationFactor: 2.0,
    description: "Two full copies. Tolerates a single drive/node failure. Simple, lowest-overhead redundancy short of none -- common for less-critical or already-backed-up data."
  },
  {
    id: "replicated-3x",
    label: "Replicated 3x",
    replicationFactor: 3.0,
    description: "Three full copies -- the classic Ceph/HDFS default. Tolerates two simultaneous failures. Highest overhead of the options here, in exchange for the largest durability margin."
  },
  {
    id: "erasure-coded-8-3",
    label: "Erasure Coded (8+3)",
    replicationFactor: 11 / 8,
    description: "8 data shards + 3 parity shards. Tolerates up to 3 simultaneous shard failures at far less overhead than 3x replication -- the common modern default for large-scale flash parallel filesystems."
  },
  {
    id: "erasure-coded-10-4",
    label: "Erasure Coded (10+4)",
    replicationFactor: 14 / 10,
    description: "10 data shards + 4 parity shards. Tolerates up to 4 simultaneous shard failures with slightly better raw efficiency than 8+3 -- common at very large (1,000+ GPU) scale."
  }
];
