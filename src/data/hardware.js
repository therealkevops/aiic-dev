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
    fp4Tflops: 9000, // native FP4 (NVFP4/MXFP4) Tensor Cores
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
    id: "b300-sxm",
    name: "NVIDIA Blackwell Ultra B300 (288GB)",
    vendor: "NVIDIA",
    vramGb: 288,
    memBandwidthTbps: 8.0,
    // Peak Dense Tensor Core TFLOPs (non-sparse)
    fp16Tflops: 2250,
    fp8Tflops: 4500,
    int4Tflops: 4500, // INT8/INT4 de-emphasized on Blackwell Ultra; weight-only INT4 runs at FP8/FP16 rates
    fp4Tflops: 13500, // native FP4 (NVFP4/MXFP4)
    interconnect: "NVLink 5 (1,800 GB/s)",
    interconnectType: "nvlink",
    linkBwUniGBs: 900,
    formFactor: "SXM (8 GPUs per HGX baseboard)",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 10,
    costTier: "$$$$$",
    notes: "Blackwell Ultra: 288GB HBM3e per GPU and ~1.5x B200 dense FP4. Built for reasoning-model inference and trillion-parameter MoE serving."
  },
  {
    id: "gb200",
    name: "NVIDIA GB200 (186GB, NVL72)",
    vendor: "NVIDIA",
    vramGb: 186,
    memBandwidthTbps: 8.0,
    // Peak Dense Tensor Core TFLOPs (non-sparse); GB200 runs at ~1.2 kW
    fp16Tflops: 2500,
    fp8Tflops: 5000,
    int4Tflops: 10000,
    fp4Tflops: 10000,
    interconnect: "NVLink 5 (1,800 GB/s) across a 72-GPU NVLink domain",
    interconnectType: "nvlink",
    linkBwUniGBs: 900,
    formFactor: "NVL72 rack (18 compute trays x 4 GPUs)",
    gpusPerChassis: 72,
    chassisTdpKw: 120,
    chassisHeightRu: 48,
    costTier: "$$$$$",
    notes: "Grace Blackwell superchips in a liquid-cooled rack where all 72 GPUs share one NVLink domain, so tensor and expert parallelism can span the whole rack without touching the network."
  },
  {
    id: "gb300",
    name: "NVIDIA GB300 (288GB, NVL72)",
    vendor: "NVIDIA",
    vramGb: 288,
    memBandwidthTbps: 8.0,
    fp16Tflops: 2500,
    fp8Tflops: 5000,
    int4Tflops: 5000,
    fp4Tflops: 15000,
    interconnect: "NVLink 5 (1,800 GB/s) across a 72-GPU NVLink domain",
    interconnectType: "nvlink",
    linkBwUniGBs: 900,
    formFactor: "NVL72 rack (18 compute trays x 4 GPUs)",
    gpusPerChassis: 72,
    chassisTdpKw: 135,
    chassisHeightRu: 48,
    costTier: "$$$$$",
    notes: "Blackwell Ultra NVL72: 288GB HBM3e per GPU and ~1.5x GB200 dense FP4, aimed at reasoning inference and trillion-parameter MoE serving."
  },
  {
    id: "rtx-pro-6000",
    name: "NVIDIA RTX PRO 6000 Blackwell Server (96GB PCIe)",
    vendor: "NVIDIA",
    vramGb: 96,
    memBandwidthTbps: 1.6,
    // Peak Dense Tensor Core TFLOPs (non-sparse, approximate)
    fp16Tflops: 500,
    fp8Tflops: 1000,
    int4Tflops: 2000,
    fp4Tflops: 2000,
    interconnect: "PCIe Gen5 x16 (64 GB/s each way), no NVLink",
    interconnectType: "pcie",
    formFactor: "PCIe Dual-Slot (up to 8 per chassis)",
    gpusPerChassis: 8,
    chassisTdpKw: 6.5,
    chassisHeightRu: 4,
    costTier: "$$",
    notes: "Air-cooled Blackwell PCIe card with 96GB GDDR7 and native FP4. The L40S successor for enterprise inference where each model fits on one card."
  },
  {
    id: "mi300x",
    name: "AMD Instinct MI300X (192GB)",
    vendor: "AMD",
    vramGb: 192,
    memBandwidthTbps: 5.3,
    // Peak Dense Matrix TFLOPs (non-sparse)
    fp16Tflops: 1307,
    fp8Tflops: 2615,
    int4Tflops: 2615, // no native INT4/FP4; weight-only 4-bit runs at FP8/FP16 rates
    interconnect: "Infinity Fabric (896 GB/s aggregate, 7 links)",
    interconnectType: "infinity-fabric",
    linkBwUniGBs: 448,
    formFactor: "OAM (8 GPUs per UBB baseboard)",
    gpusPerChassis: 8,
    chassisTdpKw: 10.5,
    chassisHeightRu: 8,
    costTier: "$$$",
    notes: "192GB HBM3 fits a 70B FP16 model on one GPU. Served with vLLM or SGLang on ROCm; TensorRT-LLM is NVIDIA-only."
  },
  {
    id: "mi325x",
    name: "AMD Instinct MI325X (256GB)",
    vendor: "AMD",
    vramGb: 256,
    memBandwidthTbps: 6.0,
    fp16Tflops: 1307,
    fp8Tflops: 2615,
    int4Tflops: 2615,
    interconnect: "Infinity Fabric (896 GB/s aggregate, 7 links)",
    interconnectType: "infinity-fabric",
    linkBwUniGBs: 448,
    formFactor: "OAM (8 GPUs per UBB baseboard)",
    gpusPerChassis: 8,
    chassisTdpKw: 12.5,
    chassisHeightRu: 8,
    costTier: "$$$$",
    notes: "MI300X compute with 256GB HBM3e and 6 TB/s: more KV capacity per GPU for long-context and high-concurrency serving."
  },
  {
    id: "mi355x",
    name: "AMD Instinct MI355X (288GB)",
    vendor: "AMD",
    vramGb: 288,
    memBandwidthTbps: 8.0,
    // Peak Dense Matrix TFLOPs (non-sparse, approximate)
    fp16Tflops: 2500,
    fp8Tflops: 5000,
    int4Tflops: 5000,
    fp4Tflops: 10000, // native FP4/FP6 (MXFP4)
    interconnect: "Infinity Fabric (~1,075 GB/s aggregate)",
    interconnectType: "infinity-fabric",
    linkBwUniGBs: 538,
    formFactor: "OAM (8 GPUs per UBB baseboard, liquid-cooled)",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 8,
    costTier: "$$$$",
    notes: "CDNA 4 with native FP4/FP6 and 288GB HBM3e; ~1.4kW per GPU, typically liquid-cooled."
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
