export const GPU_CATALOG = [
  {
    id: "h200-sxm",
    name: "NVIDIA H200 (141GB SXM5)",
    vendor: "NVIDIA",
    vramGb: 141,
    memBandwidthTbps: 4.8,
    // Peak Dense Tensor Core TFLOPs (non-sparse)
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tflops: 3958,
    interconnect: "NVLink 4 (900 GB/s)",
    interconnectType: "nvlink",
    formFactor: "SXM5 (8 GPUs per Chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    costTier: "$$$$",
    notes: "Top choice for frontier inference and long-context (128k+) reasoning models."
  },
  {
    id: "b200-sxm",
    name: "NVIDIA Blackwell B200 (180GB)",
    vendor: "NVIDIA",
    vramGb: 180,
    memBandwidthTbps: 8.0,
    // Peak Dense Tensor Core TFLOPs (non-sparse)
    fp16Tflops: 2250,
    fp8Tflops: 4500,
    int4Tflops: 9000,
    interconnect: "NVLink 5 (1,800 GB/s)",
    interconnectType: "nvlink",
    formFactor: "SXM6 (8 GPUs per Chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 14.3,
    chassisHeightRu: 8,
    costTier: "$$$$$",
    notes: "Next-gen flagship with 8.0 TB/s memory bandwidth for MoE models & frontier pretraining."
  },
  {
    id: "h100-sxm",
    name: "NVIDIA H100 (80GB SXM5)",
    vendor: "NVIDIA",
    vramGb: 80,
    memBandwidthTbps: 3.35,
    // Peak Dense Tensor Core TFLOPs (non-sparse)
    fp16Tflops: 989,
    fp8Tflops: 1979,
    int4Tflops: 3958,
    interconnect: "NVLink 4 (900 GB/s)",
    interconnectType: "nvlink",
    formFactor: "SXM5 (8 GPUs per Chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    costTier: "$$$$",
    notes: "Industry workhorse for high-speed model training and low-latency inference."
  },
  {
    id: "h100-nvl",
    name: "NVIDIA H100 NVL (94GB PCIe)",
    vendor: "NVIDIA",
    vramGb: 94,
    memBandwidthTbps: 3.9,
    // Peak Dense Tensor Core TFLOPs (non-sparse, per-card)
    fp16Tflops: 835,
    fp8Tflops: 1670,
    int4Tflops: 3340,
    interconnect: "NVLink Bridge (600 GB/s pair) + PCIe Gen5",
    interconnectType: "nvlink-bridge",
    formFactor: "PCIe Dual-Slot (FHFL)",
    gpusPerChassis: 4,
    chassisTdpKw: 3.2,
    chassisHeightRu: 4,
    costTier: "$$$$",
    notes: "Paired dual-card with direct 600 GB/s NVLink bridge. Optimized for 70B LLM inference on PCIe/blade servers."
  },
  {
    id: "l40s-pcie",
    name: "NVIDIA L40S (48GB PCIe)",
    vendor: "NVIDIA",
    vramGb: 48,
    memBandwidthTbps: 0.86,
    // Peak Dense Tensor Core TFLOPs (non-sparse)
    fp16Tflops: 366,
    fp8Tflops: 733,
    int4Tflops: 1466,
    interconnect: "PCIe Gen4 (64 GB/s bi-dir)",
    interconnectType: "pcie",
    formFactor: "PCIe (4 or 8 GPUs per Chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 3.8,
    chassisHeightRu: 4,
    costTier: "$$",
    notes: "Air-cooled PCIe card. Cost-effective for fine-tuning & mid-sized inference, but lacks NVLink."
  },
  {
    id: "a100-sxm-80gb",
    name: "NVIDIA A100 (80GB SXM4)",
    vendor: "NVIDIA",
    vramGb: 80,
    memBandwidthTbps: 2.04,
    // Peak Dense Tensor Core TFLOPs (non-sparse; A100 lacks FP8 Tensor Cores)
    fp16Tflops: 312,
    fp8Tflops: 312, // fallback to FP16
    int4Tflops: 624,
    interconnect: "NVLink 3 (600 GB/s)",
    interconnectType: "nvlink",
    formFactor: "SXM4 (8 GPUs per Chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 6.5,
    chassisHeightRu: 8,
    costTier: "$$$",
    notes: "Previous-generation flagship. Solid and proven for standard SFT and general serving."
  }
];

export const NETWORK_PROTOCOLS = [
  {
    id: "rocev2",
    name: "Lossless Ethernet (RoCEv2)",
    speedGbps: 400,
    cableType: "QSFP112 / OSFP DAC/AOC",
    description: "Lossless RDMA over standard Converged Ethernet. Relies on switch-level Priority Flow Control (PFC) and Explicit Congestion Notification (ECN). Widely adopted in enterprise private clouds.",
    keyRequirements: [
      "Switch hardware PFC (Priority Flow Control 802.1Qbb)",
      "ECN (Explicit Congestion Notification RFC 3168) on buffers",
      "Jumbo Frames MTU 9000-9216 enabled end-to-end",
      "Strict traffic queue isolation (lossless RDMA queue + best-effort queue)"
    ]
  },
  {
    id: "infiniband",
    name: "NVIDIA Quantum-2 InfiniBand (NDR 400G)",
    speedGbps: 400,
    cableType: "OSFP Flat-top / Twinax Copper",
    description: "Dedicated ultra-low latency compute fabric with credit-based flow control built into the hardware layer. Zero packet loss natively without relying on software PFC tunings.",
    keyRequirements: [
      "InfiniBand Subnet Manager running on master switch/node",
      "Native credit-based buffer flow control (lossless by design)",
      "Adaptive routing hardware acceleration",
      "Dedicated InfiniBand leaf/spine fabric switches"
    ]
  }
];
