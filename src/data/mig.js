// NVIDIA Multi-Instance GPU (MIG) profiles, by GPU catalog id. MIG splits one physical GPU
// into up to 7 isolated instances, each with a fixed slice of SMs and a fixed share of VRAM --
// useful when a workload's real footprint is far smaller than one whole GPU (small models,
// low concurrency, or many isolated small tenants in a neo-cloud multi-tenant deployment).
//
// Only Ampere-and-later datacenter SXM/PCIe parts with MIG hardware support are listed here.
// L40S (Ada Lovelace) and H100 NVL (dual-die PCIe-bridged pair, not a standard single MIG card)
// are deliberately excluded -- they don't support MIG.
//
// Profile memory sizes are NVIDIA's published values (verified against the MIG User Guide and
// public documentation): the classic 5-tier profile set (1g/2g/3g/4g/7g of 7 compute slices),
// scaled to each GPU's total VRAM. slices is out of 7 total; maxInstancesPerGpu = floor(7/slices)
// (the standard homogeneous-profile deployment pattern -- one profile size per physical GPU).
export const MIG_PROFILES = {
  "a100-sxm-80gb": [
    { id: "1g.10gb", slices: 1, vramGb: 10 },
    { id: "2g.20gb", slices: 2, vramGb: 20 },
    { id: "3g.40gb", slices: 3, vramGb: 40 },
    { id: "4g.40gb", slices: 4, vramGb: 40 },
    { id: "7g.80gb", slices: 7, vramGb: 80 },
  ],
  "h100-sxm": [
    { id: "1g.10gb", slices: 1, vramGb: 10 },
    { id: "2g.20gb", slices: 2, vramGb: 20 },
    { id: "3g.40gb", slices: 3, vramGb: 40 },
    { id: "4g.40gb", slices: 4, vramGb: 40 },
    { id: "7g.80gb", slices: 7, vramGb: 80 },
  ],
  "h200-sxm": [
    { id: "1g.18gb", slices: 1, vramGb: 18 },
    { id: "2g.35gb", slices: 2, vramGb: 35 },
    { id: "3g.71gb", slices: 3, vramGb: 71 },
    { id: "4g.71gb", slices: 4, vramGb: 71 },
    { id: "7g.141gb", slices: 7, vramGb: 141 },
  ],
  "b200-sxm": [
    { id: "1g.23gb", slices: 1, vramGb: 23 },
    { id: "2g.45gb", slices: 2, vramGb: 45 },
    { id: "3g.90gb", slices: 3, vramGb: 90 },
    { id: "4g.90gb", slices: 4, vramGb: 90 },
    { id: "7g.180gb", slices: 7, vramGb: 180 },
  ],
};

export function maxInstancesPerGpu(profile) {
  return Math.max(1, Math.floor(7 / profile.slices));
}
