export const PLATFORM_VENDORS = [
  {
    id: "cisco",
    name: "Cisco UCS & Nexus AI Fabric",
    tagline: "Enterprise-grade AI compute with Nexus deep-buffer lossless RoCEv2 networking & Intersight management",
    description: "Built for enterprise datacenters integrating AI into existing network architectures. Leverages Cisco Nexus 9000 switches with Cloud Scale ASICs, dynamic packet priority, and centralized Intersight operations.",
    defaultProtocol: "rocev2",
    managementSuite: "Cisco Intersight Cloud Orchestration + Nexus Dashboard (NDFC)",
    supportedProtocols: ["rocev2"]
  },
  {
    id: "nvidia",
    name: "NVIDIA DGX SuperPOD Reference Architecture",
    tagline: "Turnkey, high-density AI supercomputing platform direct from NVIDIA",
    description: "NVIDIA's purpose-built reference architecture for frontier AI clusters. Available with either native Quantum-2 InfiniBand or Spectrum-4 Lossless Ethernet, orchestrated by NVIDIA Base Command Manager.",
    defaultProtocol: "rocev2",
    managementSuite: "NVIDIA Base Command Manager + Unified Fabric Manager (UFM)",
    supportedProtocols: ["rocev2", "infiniband"]
  },
  {
    id: "amd",
    name: "AMD Instinct Platform (OEM 8-GPU OAM)",
    tagline: "AMD Instinct GPUs on a standard 8-GPU UBB baseboard with lossless Ethernet scale-out",
    description: "OEM-built servers (Dell, Supermicro, HPE, Lenovo and others) around AMD's 8-GPU Universal Baseboard, scaled out over RoCEv2 Ethernet with 400G NICs (e.g. AMD Pensando Pollara). Software stack is ROCm with vLLM or SGLang.",
    defaultProtocol: "rocev2",
    managementSuite: "OEM BMC / Redfish + AMD ROCm / AMD Infinity Hub containers",
    supportedProtocols: ["rocev2"]
  }
];

export const PLATFORM_SYSTEMS = [
  // --- Cisco UCS Platforms (AMD EPYC & Intel Xeon) ---
  {
    id: "cisco-c885a-h200",
    vendor: "cisco",
    name: "Cisco UCS C885A M8 (8x NVIDIA H200 141GB)",
    shortName: "UCS C885A M8",
    gpuId: "h200-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G ConnectX-7 per GPU
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A at full 400G load
    hostCpu: "Dual AMD EPYC 9004/9005 Series (up to 256 cores total)",
    systemRam: "2.0 TB DDR5 (24x DIMM slots)",
    hostNics: "8x 400G ConnectX-7 OSFP PCIe adapters (1 NIC per GPU) + 2x 100/200G Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G QSFP-DD/OSFP)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 40/100G GPUDirect Storage Switch)",
    oobSwitchModel: "Cisco Catalyst 1000 / 9200 (48-port 1G Management)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP Direct Attach Copper (DAC) & AOC",
    notes: "Flagship 8-GPU AI server designed with Cisco Nexus deep-buffer RoCEv2 architecture to prevent packet drops."
  },
  {
    id: "cisco-c885a-b200",
    vendor: "cisco",
    name: "Cisco UCS C885A M8 (8x NVIDIA B200 180GB)",
    shortName: "UCS C885A M8 (Blackwell)",
    gpuId: "b200-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 14.3,
    chassisHeightRu: 8,
    nicSpeedGbps: 800,         // 800G ConnectX-8 SuperNICs on Blackwell platform
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A at full 400G/800G load
    hostCpu: "Dual AMD EPYC 9005 Series (Turin, up to 384 cores)",
    systemRam: "3.0 TB DDR5",
    hostNics: "8x 800G ConnectX-8 / ConnectX-7 Adapters (1 NIC per GPU) + 2x Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G QSFP-DD/OSFP)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G GPUDirect Storage Switch)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G Management)",
    transceiverType: "Cisco 800G/400G OSFP/QSFP-DD Transceivers & Twinax DACs",
    notes: "Next-gen Blackwell 8-GPU platform for massive multi-node training and MoE serving."
  },
  {
    id: "cisco-c885a-h100",
    vendor: "cisco",
    name: "Cisco UCS C885A M8 (8x NVIDIA H100 80GB)",
    shortName: "UCS C885A M8 (H100)",
    gpuId: "h100-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G ConnectX-7
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A
    hostCpu: "Dual AMD EPYC 9004 Series Processors",
    systemRam: "2.0 TB DDR5",
    hostNics: "8x 400G ConnectX-7 OSFP Adapters + 2x Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 40/100G)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP DAC/AOC",
    notes: "Workhorse enterprise 8-GPU server for standard training, fine-tuning, and general inference."
  },
  {
    id: "cisco-c880a-b300",
    vendor: "cisco",
    name: "Cisco UCS C880A M8 (8x NVIDIA HGX B300 288GB)",
    shortName: "UCS C880A M8 (B300)",
    gpuId: "b300-sxm",
    formFactor: "10U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 10,
    nicSpeedGbps: 800,         // 800G ConnectX-8 SuperNICs
    switchPowerKw: 3.5,
    hostCpu: "Dual Intel Xeon 6 Processors",
    systemRam: "Up to 4.0 TB DDR5",
    hostNics: "8x 800G ConnectX-8 SuperNICs (1 per GPU) + 2x Storage NICs / BlueField-3 DPU",
    leafSwitchModel: "Cisco Nexus 9364E-SG2 (64-port 800G, 51.2T)",
    spineSwitchModel: "Cisco Nexus 9364E-SG2 (64-port 800G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G GPUDirect Storage Switch)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G Management)",
    transceiverType: "Cisco 800G OSFP Transceivers & Twinax DACs",
    notes: "Blackwell Ultra HGX B300 platform: 288GB HBM3e per GPU for reasoning-model and trillion-parameter MoE serving."
  },
  {
    id: "cisco-c885a-mi300x",
    vendor: "cisco",
    name: "Cisco UCS C885A M8 (8x AMD Instinct MI300X 192GB)",
    shortName: "UCS C885A M8 (MI300X)",
    gpuId: "mi300x",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.5,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,
    switchPowerKw: 3.5,
    hostCpu: "Dual AMD EPYC 9004/9005 Series",
    systemRam: "2.0 TB DDR5",
    hostNics: "8x 400G NICs (1 per GPU; NVIDIA ConnectX-7 or AMD Pensando Pollara 400) + 2x Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP DAC/AOC",
    managementSuite: "Cisco Intersight + Nexus Dashboard; AMD ROCm software stack",
    notes: "The C885A M8 with AMD Instinct MI300X: 1.5TB of HBM3 per node. Serve with vLLM or SGLang on ROCm (TensorRT-LLM is NVIDIA-only)."
  },
  {
    id: "cisco-c845a-rtxpro",
    vendor: "cisco",
    name: "Cisco UCS C845A M8 (8x NVIDIA RTX PRO 6000 Blackwell 96GB PCIe)",
    shortName: "UCS C845A M8 (RTX PRO)",
    gpuId: "rtx-pro-6000",
    formFactor: "4U Rack Chassis (NVIDIA MGX)",
    gpusPerChassis: 8,
    chassisTdpKw: 6.5,
    chassisHeightRu: 4,
    nicSpeedGbps: 400,
    switchPowerKw: 3.5,
    hostCpu: "Dual AMD EPYC 9005 Series",
    systemRam: "Up to 3.0 TB DDR5",
    hostNics: "Up to 8x 400G ConnectX-7 / ConnectX-8 SuperNICs + BlueField-3 DPU",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP DAC/AOC",
    notes: "MGX-based PCIe server scaling from 2 to 8 RTX PRO 6000 Blackwell GPUs. Air-cooled successor to L40S servers for enterprise inference; no NVLink, so keep each model on one card."
  },
  {
    id: "cisco-c245-l40s",
    vendor: "cisco",
    name: "Cisco UCS C245 M8 (4x NVIDIA L40S 48GB PCIe)",
    shortName: "UCS C245 M8 (PCIe)",
    gpuId: "l40s-pcie",
    formFactor: "2U Rack Chassis",
    gpusPerChassis: 4,
    chassisTdpKw: 2.1,
    chassisHeightRu: 2,
    nicSpeedGbps: 100,         // 100/200G ConnectX-6 Dx on L40S PCIe platform
    switchPowerKw: 0.9,        // Nexus 93180YC-FX3 (25G access switch)
    hostCpu: "Dual AMD EPYC 9004 Series Processors",
    systemRam: "1.0 TB DDR5",
    hostNics: "2x 100/200G ConnectX-6 Dx / ConnectX-7 Adapters",
    leafSwitchModel: "Cisco Nexus 93180YC-FX3 (48-port 25G + 6-port 100G)",
    spineSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G)",
    storageSwitchModel: "Shared with Leaf Network",
    oobSwitchModel: "Cisco Catalyst 1000 (48-port 1G)",
    transceiverType: "Cisco 100G/25G SFP28/QSFP28 DACs",
    notes: "Air-cooled 2U server for cost-effective enterprise inference and lightweight LoRA fine-tuning."
  },
  {
    id: "cisco-x-series-l40s",
    vendor: "cisco",
    name: "Cisco UCS X-Series (X210c + X440p with 4x L40S 48GB PCIe)",
    shortName: "UCS X-Series (4x L40S)",
    gpuId: "l40s-pcie",
    isModular: true,
    modularChassisModel: "Cisco UCS X9508 7U Modular Chassis",
    bladesPerPair: 2,
    pairsPerChassis: 4,
    formFactor: "7U Modular Chassis (X9508) • 4x L40S per Blade Pair (up to 16 GPUs/chassis)",
    gpusPerChassis: 4,
    chassisTdpKw: 1.6,
    chassisHeightRu: 7,
    nicSpeedGbps: 100,         // UCS VIC 15231 100G to UCS 9108 IFMs
    switchPowerKw: 1.5,        // Nexus 9336C-FX2-E (100G switch)
    hostCpu: "Dual Intel Xeon Scalable (4th/5th Gen) or AMD EPYC in X210c Compute Node",
    systemRam: "1.5 TB DDR5 in X210c Compute Node",
    hostNics: "Cisco UCS VIC 15231 (100G) / VIC 15428 to Dual UCS 9108 IFMs",
    fabricInterconnectModel: "Dual Cisco UCS 6536 Fabric Interconnects (36-port 100G/400G)",
    leafSwitchModel: "Cisco Nexus 9336C-FX2-E / 9364D-GX2A (via UCS 6536 FI)",
    spineSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G/400G Non-Blocking)",
    storageSwitchModel: "Integrated into UCS 6536 FI + Nexus 9336C Unified Fabric",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 100G QSFP28 / 400G QSFP-DD DACs & MPO Trunk Cables",
    managementSuite: "Cisco Intersight Cloud Orchestrator (Hardware Profiles & Policies)",
    notes: "High-density modular blade platform. Connects X210c compute blades to X440p PCIe accelerator nodes via Cisco X-Fabric. Supports up to 16x L40S GPUs per 7U chassis for high-throughput enterprise inference."
  },
  {
    id: "cisco-x-series-h100-nvl",
    vendor: "cisco",
    name: "Cisco UCS X-Series (X210c + X440p with 2x H100 NVL 94GB PCIe)",
    shortName: "UCS X-Series (2x H100 NVL)",
    gpuId: "h100-nvl",
    isModular: true,
    modularChassisModel: "Cisco UCS X9508 7U Modular Chassis",
    bladesPerPair: 2,
    pairsPerChassis: 4,
    formFactor: "7U Modular Chassis (X9508) • 2x H100 NVL (94GB) per Blade Pair (up to 8 GPUs/chassis)",
    gpusPerChassis: 2,
    chassisTdpKw: 1.8,
    chassisHeightRu: 7,
    nicSpeedGbps: 100,         // UCS VIC 15231 100G to UCS 9108 IFMs
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A (400G)
    hostCpu: "Dual Intel Xeon Scalable (5th Gen Emerald Rapids) in X210c Compute Node",
    systemRam: "1.5 TB DDR5 in X210c Compute Node",
    hostNics: "Cisco UCS VIC 15231 (100G) to Dual UCS 9108 IFMs",
    fabricInterconnectModel: "Dual Cisco UCS 6536 Fabric Interconnects (36-port 100G/400G)",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G via UCS 6536 FI)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G Non-Blocking)",
    storageSwitchModel: "Integrated into UCS 6536 FI + Nexus 9336C Unified Fabric",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 100G QSFP28 / 400G QSFP-DD DACs & MPO Trunk Cables",
    managementSuite: "Cisco Intersight Cloud Orchestration",
    notes: "Combines 94GB H100 NVL with dual-card 600 GB/s NVLink bridge inside the X440p PCIe module. Ideal for running 70B FP8 LLMs in a modular blade footprint with Intersight governance."
  },

  // --- Cisco Secure AI Factory: Supermicro Compute + Cisco Nexus Fabric ---
  // High-performance Supermicro HGX GPU servers integrated into the Cisco Secure AI Factory portfolio.
  // Combines Supermicro rack-scale GPU compute (Intel Xeon Scalable + up to 8TB RAM) with
  // Cisco Nexus 9000 deep-buffer RoCEv2 fabric and unified Cisco Intersight management.
  {
    id: "cisco-smci-821ge-h200",
    vendor: "cisco",
    name: "Supermicro SYS-821GE-TNHR (8x H200 141GB SXM5)",
    shortName: "SMCI 821GE (H200)",
    gpuId: "h200-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.5,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G ConnectX-7 OSFP
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A
    hostCpu: "Dual 5th Gen Intel Xeon Scalable (up to 128 cores total)",
    systemRam: "Up to 8.0 TB DDR5 (32x DIMM slots)",
    hostNics: "8x 400G ConnectX-7 OSFP adapters (1 NIC per GPU) + 2x 100/200G Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G QSFP-DD/OSFP)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 40/100G GPUDirect Storage Switch)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G Management)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP Direct Attach Copper (DAC) & AOC",
    managementSuite: "Cisco Intersight + Supermicro SuperCloud Composer (Redfish API)",
    notes: "Cisco Secure AI Factory with NVIDIA: Supermicro 8-GPU HGX H200 server paired with Cisco Nexus deep-buffer RoCEv2 fabric."
  },
  {
    id: "cisco-smci-821ge-h100",
    vendor: "cisco",
    name: "Supermicro SYS-821GE-TNHR (8x H100 80GB SXM5)",
    shortName: "SMCI 821GE (H100)",
    gpuId: "h100-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G ConnectX-7 OSFP
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A
    hostCpu: "Dual 4th/5th Gen Intel Xeon Scalable Processors",
    systemRam: "Up to 8.0 TB DDR5 (32x DIMM slots)",
    hostNics: "8x 400G ConnectX-7 OSFP adapters + 2x Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 40/100G)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G)",
    transceiverType: "Cisco 400G QSFP-DD / OSFP DAC/AOC",
    managementSuite: "Cisco Intersight + Supermicro SuperCloud Composer (Redfish API)",
    notes: "Cisco Secure AI Factory: Supermicro 8-GPU HGX H100 system coupled with Cisco Nexus RoCEv2 fabric."
  },
  {
    id: "cisco-smci-a21ge-b200",
    vendor: "cisco",
    name: "Supermicro SYS-A21GE-NBRT (8x Blackwell B200 180GB)",
    shortName: "SMCI A21GE (B200)",
    gpuId: "b200-sxm",
    formFactor: "10U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 10,       // 10U chassis engineered for thermal headroom on Blackwell
    nicSpeedGbps: 800,         // 800G ConnectX-8 SuperNICs on Blackwell platform
    switchPowerKw: 3.5,        // Nexus 9364D-GX2A (400G/800G)
    hostCpu: "Dual 5th Gen Intel Xeon Scalable Processors",
    systemRam: "Up to 8.0 TB DDR5 (32x DIMM slots)",
    hostNics: "8x 800G ConnectX-8 SuperNICs / ConnectX-7 + 2x Storage NICs",
    leafSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G QSFP-DD/OSFP)",
    spineSwitchModel: "Cisco Nexus 9364D-GX2A (64-port 400G/800G Non-Blocking)",
    storageSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G GPUDirect Storage Switch)",
    oobSwitchModel: "Cisco Catalyst 9200 (48-port 1G Management)",
    transceiverType: "Cisco 800G/400G OSFP/QSFP-DD Transceivers & Twinax DACs",
    managementSuite: "Cisco Intersight + Supermicro SuperCloud Composer (Redfish API)",
    notes: "Blackwell-generation 10U chassis engineered for extreme thermal headroom, 8x B200 180GB, and Cisco Nexus 800G/400G fabric."
  },
  {
    id: "cisco-smci-421ge-l40s",
    vendor: "cisco",
    name: "Supermicro SYS-421GE-TNRT (8x NVIDIA L40S 48GB PCIe)",
    shortName: "SMCI 421GE (8x L40S)",
    gpuId: "l40s-pcie",
    formFactor: "4U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 4.2,
    chassisHeightRu: 4,
    nicSpeedGbps: 100,         // 100/200G ConnectX-6 Dx / ConnectX-7
    switchPowerKw: 0.9,        // Nexus 93180YC-FX3
    hostCpu: "Dual 4th/5th Gen Intel Xeon Scalable Processors",
    systemRam: "Up to 8.0 TB DDR5 (32x DIMM slots)",
    hostNics: "4x 100/200G ConnectX-6 Dx / ConnectX-7 PCIe Adapters",
    leafSwitchModel: "Cisco Nexus 93180YC-FX3 (48-port 25G + 6-port 100G)",
    spineSwitchModel: "Cisco Nexus 9336C-FX2-E (36-port 100G)",
    storageSwitchModel: "Shared with Leaf Network",
    oobSwitchModel: "Cisco Catalyst 1000 (48-port 1G)",
    transceiverType: "Cisco 100G/25G SFP28/QSFP28 DACs",
    managementSuite: "Cisco Intersight + Supermicro BMC",
    notes: "Air-cooled 4U server with 8x L40S PCIe GPUs for high-density enterprise inference and batch serving over Cisco Nexus."
  },

  // --- NVIDIA DGX SuperPOD Platforms ---
  {
    id: "nvidia-gb200-nvl72",
    vendor: "nvidia",
    name: "NVIDIA GB200 NVL72 (72x GB200 186GB, one NVLink domain)",
    shortName: "GB200 NVL72",
    gpuId: "gb200",
    formFactor: "48U liquid-cooled rack (18 compute trays + 9 NVLink switch trays)",
    gpusPerChassis: 72,        // one NVLink domain = one rack
    nvlinkDomainGpus: 72,
    chassisTdpKw: 120,        // whole rack
    chassisHeightRu: 48,
    rackKw: 130,           // rack-scale power & liquid cooling; replaces the default per-rack limit
    scaleOutRails: 8,          // rail-optimized scale-out fabric uses 8 rails, as on 8-GPU nodes
    nicSpeedGbps: 400,
    switchPowerKw: 2.5,
    hostCpu: "36x NVIDIA Grace CPUs (2 per compute tray, 72 Arm Neoverse V2 cores each)",
    systemRam: "Up to 17 TB LPDDR5X (coherent with GPU HBM over NVLink-C2C)",
    hostNics: "72x 400Gb/s ConnectX SuperNICs (1 per GPU) + BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-X800 (XDR InfiniBand) or Spectrum-X SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-X800 or Spectrum-X SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G/400G OSFP Transceivers & Copper DACs",
    managementSuite: "NVIDIA Mission Control / Base Command Manager",
    notes: "Rack-scale system: 72 Blackwell GPUs and 36 Grace CPUs in one NVLink domain (130 TB/s aggregate). Tensor and expert parallelism can span the rack, so large MoE models and long-context serving avoid network hops. Requires ~120 kW liquid-cooled racks."
  },
  {
    id: "nvidia-gb300-nvl72",
    vendor: "nvidia",
    name: "NVIDIA GB300 NVL72 (72x GB300 288GB, one NVLink domain)",
    shortName: "GB300 NVL72",
    gpuId: "gb300",
    formFactor: "48U liquid-cooled rack (18 compute trays + 9 NVLink switch trays)",
    gpusPerChassis: 72,        // one NVLink domain = one rack
    nvlinkDomainGpus: 72,
    chassisTdpKw: 135,        // whole rack
    chassisHeightRu: 48,
    rackKw: 145,           // rack-scale power & liquid cooling; replaces the default per-rack limit
    scaleOutRails: 8,          // rail-optimized scale-out fabric uses 8 rails, as on 8-GPU nodes
    nicSpeedGbps: 800,
    switchPowerKw: 2.5,
    hostCpu: "36x NVIDIA Grace CPUs (2 per compute tray, 72 Arm Neoverse V2 cores each)",
    systemRam: "Up to 17 TB LPDDR5X (coherent with GPU HBM over NVLink-C2C)",
    hostNics: "72x 800Gb/s ConnectX SuperNICs (1 per GPU) + BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-X800 (XDR InfiniBand) or Spectrum-X SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-X800 or Spectrum-X SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G/400G OSFP Transceivers & Copper DACs",
    managementSuite: "NVIDIA Mission Control / Base Command Manager",
    notes: "Blackwell Ultra rack-scale system: 72 GPUs with 288GB each (20.7 TB of HBM3e) in one NVLink domain. Aimed at reasoning inference and trillion-parameter MoE. Requires ~135 kW liquid-cooled racks."
  },
  {
    id: "nvidia-dgx-h200",
    vendor: "nvidia",
    name: "NVIDIA DGX H200 (8x H200 141GB SXM5)",
    shortName: "DGX H200 System",
    gpuId: "h200-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400Gb/s ConnectX-7 NICs
    switchPowerKw: 2.5,        // NVIDIA Spectrum-4 SN5600 / Quantum-2 QM9700
    hostCpu: "Dual Intel Xeon Platinum 8480C Processors (112 cores)",
    systemRam: "2.0 TB System Memory",
    hostNics: "8x 400Gb/s OSFP ConnectX-7 NICs for compute + 2x BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 (NDR 400G InfiniBand) or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 (64-port NDR 400G) or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-3 SN4600 (64-port 200G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G Management)",
    transceiverType: "NVIDIA LinkX 400G OSFP Flat-top / Twinax Copper Cables",
    notes: "NVIDIA's flagship reference supercomputing node with 1.1TB aggregate HBM3e memory."
  },
  {
    id: "nvidia-dgx-b300",
    vendor: "nvidia",
    name: "NVIDIA DGX B300 (8x B300 288GB)",
    shortName: "DGX B300 System",
    gpuId: "b300-sxm",
    formFactor: "10U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 10,
    nicSpeedGbps: 800,         // 800Gb/s ConnectX-8 SuperNICs
    switchPowerKw: 2.5,
    hostCpu: "Dual Intel Xeon 6 Processors",
    systemRam: "2.0 TB System Memory",
    hostNics: "8x 800Gb/s ConnectX-8 SuperNICs + 2x BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-X800 (XDR InfiniBand) or Spectrum-X SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-X800 or Spectrum-X SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G OSFP Transceivers & Copper DACs",
    notes: "Blackwell Ultra DGX node: 2.3TB of HBM3e across 8 GPUs, aimed at reasoning inference and large-MoE training."
  },
  {
    id: "nvidia-dgx-b200",
    vendor: "nvidia",
    name: "NVIDIA DGX B200 (8x B200 180GB SXM6)",
    shortName: "DGX B200 System",
    gpuId: "b200-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 14.3,
    chassisHeightRu: 8,
    nicSpeedGbps: 800,         // 800Gb/s ConnectX-8 SuperNICs on Blackwell
    switchPowerKw: 2.5,        // NVIDIA Spectrum-4 SN5600 / Quantum-2 QM9700
    hostCpu: "Dual Intel Xeon 6 Processors (Granite Rapids)",
    systemRam: "2.0 TB System Memory",
    hostNics: "8x 800Gb/s ConnectX-8 SuperNICs + 2x BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 / XDR InfiniBand or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G/400G OSFP Transceivers & Copper DACs",
    notes: "Blackwell-generation DGX platform engineered for trillion-parameter frontier model training."
  },
  {
    id: "nvidia-dgx-h100",
    vendor: "nvidia",
    name: "NVIDIA DGX H100 (8x H100 80GB SXM5)",
    shortName: "DGX H100 System",
    gpuId: "h100-sxm",
    formFactor: "8U Rack Chassis",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400Gb/s ConnectX-7 NICs
    switchPowerKw: 2.5,        // NVIDIA Quantum-2 QM9700 / Spectrum-4 SN5600
    hostCpu: "Dual Intel Xeon Platinum 8480C Processors (112 cores)",
    systemRam: "2.0 TB System Memory",
    hostNics: "8x 400Gb/s OSFP ConnectX-7 NICs + 2x BlueField-3 DPUs",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 (NDR 400G) or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-3 SN4600 (64-port 200G)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 400G OSFP Flat-top / Twinax DACs",
    notes: "Proven reference architecture for standard AI datacenter clusters and SuperPOD pods."
  },

  // --- NVIDIA HGX: Open 8-GPU Baseboard Reference Design (Generic ODM/OEM) ---
  // The NVSwitch baseboard licensed to ODMs/OEMs (Foxconn, Quanta, Wiwynn, Supermicro, etc.) —
  // the same 8-GPU tray inside every DGX / Cisco / Supermicro box above, without a specific
  // vendor's chassis, host platform, or management stack layered on top.
  {
    id: "nvidia-hgx-h200",
    vendor: "nvidia",
    name: "NVIDIA HGX H200 (8x H200 141GB SXM5) — Generic OEM Reference Design",
    shortName: "HGX H200 (Generic)",
    gpuId: "h200-sxm",
    formFactor: "8U Universal GPU Tray (HGX Baseboard)",
    gpusPerChassis: 8,
    chassisTdpKw: 10.2,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400Gb/s ConnectX-7 NICs (OEM-selected)
    switchPowerKw: 2.5,        // NVIDIA Spectrum-4 SN5600 / Quantum-2 QM9700
    hostCpu: "Dual x86 Host CPUs (Intel Xeon or AMD EPYC — OEM's choice)",
    systemRam: "2.0 TB System Memory (typical)",
    hostNics: "8x 400Gb/s ConnectX-7 OSFP NICs (1 per GPU, OEM-selected)",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 (NDR 400G InfiniBand) or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-3 SN4600 (64-port 200G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G Management)",
    transceiverType: "NVIDIA LinkX 400G OSFP Flat-top / Twinax Copper Cables",
    managementSuite: "OEM BMC / Redfish (vendor-neutral) + optional NVIDIA Base Command Manager",
    notes: "Open HGX 8-GPU NVSwitch baseboard reference design. Use this when sizing for a whitebox / ODM-built cluster rather than a specific vendor's turnkey chassis — the compute math is identical to DGX H200, only the host platform and management stack are generic."
  },
  {
    id: "nvidia-hgx-b200",
    vendor: "nvidia",
    name: "NVIDIA HGX B200 (8x B200 180GB SXM6) — Generic OEM Reference Design",
    shortName: "HGX B200 (Generic)",
    gpuId: "b200-sxm",
    formFactor: "8U Universal GPU Tray (HGX Baseboard)",
    gpusPerChassis: 8,
    chassisTdpKw: 14.3,
    chassisHeightRu: 8,
    nicSpeedGbps: 800,         // 800Gb/s ConnectX-8 SuperNICs (OEM-selected)
    switchPowerKw: 2.5,        // NVIDIA Spectrum-4 SN5600 / Quantum-2 QM9700
    hostCpu: "Dual x86 Host CPUs (Intel Xeon 6 or AMD EPYC — OEM's choice)",
    systemRam: "2.0 TB System Memory (typical)",
    hostNics: "8x 800Gb/s ConnectX-8 SuperNICs (1 per GPU, OEM-selected)",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 / XDR InfiniBand or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G/400G OSFP Transceivers & Copper DACs",
    managementSuite: "OEM BMC / Redfish (vendor-neutral) + optional NVIDIA Base Command Manager",
    notes: "Open HGX 8-GPU Blackwell baseboard reference design for whitebox / ODM-built clusters. Compute math is identical to DGX B200; only the host platform and management stack are generic."
  },

  // --- NVIDIA MGX: Grace Superchip Modular Reference Design ---
  // MGX is NVIDIA's modular mechanical/tray specification (tool-less trays, shared power
  // shelves) that OEMs assemble into fixed-configuration 1U/2U servers — distinct from Cisco's
  // X-Series blade-pair-in-a-shared-chassis modularity. Its differentiated use case is the
  // Grace CPU superchip line: coherent NVLink-C2C CPU-GPU memory in a compact node.
  {
    id: "nvidia-mgx-gh200",
    vendor: "nvidia",
    name: "NVIDIA MGX Grace Hopper GH200 (2x GH200 Superchip, 141GB HBM3e each)",
    shortName: "MGX GH200 (Grace Hopper)",
    gpuId: "h200-sxm",
    formFactor: "2U Rack Chassis (MGX Modular Reference Design)",
    gpusPerChassis: 2,
    chassisTdpKw: 2.0,         // ~900-1000W per superchip (Grace CPU + H200-class GPU) + overhead
    chassisHeightRu: 2,
    nicSpeedGbps: 400,         // 400Gb/s ConnectX-7
    switchPowerKw: 2.5,        // NVIDIA Quantum-2 QM9700 / Spectrum-4 SN5600
    hostCpu: "2x NVIDIA Grace CPU (72-core Arm Neoverse V2 each, 144 cores total) — 900 GB/s coherent NVLink-C2C to its own GPU",
    systemRam: "2x 480GB LPDDR5X (960GB total, unified-addressable with GPU HBM3e)",
    hostNics: "2x 400Gb/s ConnectX-7 OSFP NICs (1 per superchip)",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 (NDR 400G InfiniBand) or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-3 SN4600 (64-port 200G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 400G OSFP Flat-top / Twinax Copper Cables",
    managementSuite: "OEM BMC / Redfish + NVIDIA Base Command Manager",
    notes: "Each of the 2 GPUs has its own dedicated Grace CPU joined by 900 GB/s coherent NVLink-C2C — no PCIe host bottleneck, unified CPU+GPU memory addressing. Well suited to memory-capacity-bound workloads (huge embedding tables, CPU-offloaded KV cache, vector search) that benefit from fast CPU-GPU memory coherence rather than raw NVLink GPU-GPU bandwidth."
  },
  {
    id: "nvidia-mgx-gb200-nvl2",
    vendor: "nvidia",
    name: "NVIDIA MGX GB200 NVL2 (2x Grace Blackwell Superchip, 180GB HBM3e each)",
    shortName: "MGX GB200 NVL2",
    gpuId: "b200-sxm",
    formFactor: "2U Rack Chassis (MGX Modular Reference Design)",
    gpusPerChassis: 2,
    chassisTdpKw: 2.7,         // ~1.2-1.3kW per superchip (Grace CPU + B200-class GPU) + overhead
    chassisHeightRu: 2,
    nicSpeedGbps: 800,         // 800Gb/s ConnectX-8 SuperNICs
    switchPowerKw: 2.5,        // NVIDIA Spectrum-4 SN5600 / Quantum-2 QM9700
    hostCpu: "2x NVIDIA Grace CPU (72-core Arm Neoverse V2 each) — 900 GB/s coherent NVLink-C2C to its own GPU",
    systemRam: "2x 480GB LPDDR5X (960GB total, unified-addressable with GPU HBM3e)",
    hostNics: "2x 800Gb/s ConnectX-8 SuperNICs (1 per superchip)",
    leafSwitchModel: "NVIDIA Quantum-2 QM9700 / XDR InfiniBand or Spectrum-4 SN5600 (RoCEv2)",
    spineSwitchModel: "NVIDIA Quantum-2 QM9700 or Spectrum-4 SN5600",
    storageSwitchModel: "NVIDIA Spectrum-4 SN5400 (64-port 400G Ethernet)",
    oobSwitchModel: "NVIDIA Spectrum SN2201 (48-port 1G)",
    transceiverType: "NVIDIA LinkX 800G/400G OSFP Transceivers & Copper DACs",
    managementSuite: "OEM BMC / Redfish + NVIDIA Base Command Manager",
    notes: "The entry point into the Grace Blackwell family: 2 fully coherent Grace-Blackwell superchips per 2U node, NVLink-paired to each other. This is distinct from the rack-scale GB200 NVL72 (a single 72-GPU non-blocking NVLink domain spanning an entire liquid-cooled rack) — see the GB200/GB300 NVL72 platforms for that. NVL2 pairs behave like any other 2-GPU NVLink node for sharding purposes."
  },

  // --- AMD Instinct OEM Platforms (8-GPU OAM Universal Baseboard) ---
  {
    id: "amd-mi300x-ubb",
    vendor: "amd",
    name: "AMD Instinct MI300X Platform (8x MI300X 192GB, OEM)",
    shortName: "MI300X OAM (OEM)",
    gpuId: "mi300x",
    formFactor: "8U Rack Chassis (8x OAM on UBB)",
    gpusPerChassis: 8,
    chassisTdpKw: 10.5,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G AMD Pensando Pollara / ConnectX-7, 1 per GPU
    switchPowerKw: 2.5,
    hostCpu: "Dual AMD EPYC 9005 Series",
    systemRam: "2.0-3.0 TB DDR5",
    hostNics: "8x 400G AMD Pensando Pollara 400 AI NICs (1 per GPU) + 2x Storage NICs",
    leafSwitchModel: "51.2T 64x800G Ethernet switch (e.g. Arista 7060X6, Cisco Nexus 9364E-SG2) in 128x400G breakout",
    spineSwitchModel: "51.2T 64x800G Ethernet switch",
    storageSwitchModel: "25.6T Ethernet switch (e.g. 64-port 400G)",
    oobSwitchModel: "48-port 1G Management Switch",
    transceiverType: "400G/800G OSFP Transceivers & DACs",
    managementSuite: "OEM BMC / Redfish + AMD ROCm",
    notes: "Generic OEM 8x MI300X server (Dell XE9680, Supermicro AS-8125GS and similar). 1.5TB HBM3 per node."
  },
  {
    id: "amd-mi325x-ubb",
    vendor: "amd",
    name: "AMD Instinct MI325X Platform (8x MI325X 256GB, OEM)",
    shortName: "MI325X OAM (OEM)",
    gpuId: "mi325x",
    formFactor: "8U Rack Chassis (8x OAM on UBB)",
    gpusPerChassis: 8,
    chassisTdpKw: 12.5,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G AMD Pensando Pollara / ConnectX-7, 1 per GPU
    switchPowerKw: 2.5,
    hostCpu: "Dual AMD EPYC 9005 Series",
    systemRam: "2.0-3.0 TB DDR5",
    hostNics: "8x 400G AMD Pensando Pollara 400 AI NICs (1 per GPU) + 2x Storage NICs",
    leafSwitchModel: "51.2T 64x800G Ethernet switch (e.g. Arista 7060X6, Cisco Nexus 9364E-SG2) in 128x400G breakout",
    spineSwitchModel: "51.2T 64x800G Ethernet switch",
    storageSwitchModel: "25.6T Ethernet switch (e.g. 64-port 400G)",
    oobSwitchModel: "48-port 1G Management Switch",
    transceiverType: "400G/800G OSFP Transceivers & DACs",
    managementSuite: "OEM BMC / Redfish + AMD ROCm",
    notes: "Generic OEM 8x MI325X server. 2TB HBM3e per node for long-context and high-concurrency inference."
  },
  {
    id: "amd-mi355x-ubb",
    vendor: "amd",
    name: "AMD Instinct MI355X Platform (8x MI355X 288GB, OEM)",
    shortName: "MI355X OAM (OEM)",
    gpuId: "mi355x",
    formFactor: "8U Rack Chassis (8x OAM on UBB)",
    gpusPerChassis: 8,
    chassisTdpKw: 14.5,
    chassisHeightRu: 8,
    nicSpeedGbps: 400,         // 400G AMD Pensando Pollara / ConnectX-7, 1 per GPU
    switchPowerKw: 2.5,
    hostCpu: "Dual AMD EPYC 9005 Series",
    systemRam: "2.0-3.0 TB DDR5",
    hostNics: "8x 400G AMD Pensando Pollara 400 AI NICs (1 per GPU) + 2x Storage NICs",
    leafSwitchModel: "51.2T 64x800G Ethernet switch (e.g. Arista 7060X6, Cisco Nexus 9364E-SG2) in 128x400G breakout",
    spineSwitchModel: "51.2T 64x800G Ethernet switch",
    storageSwitchModel: "25.6T Ethernet switch (e.g. 64-port 400G)",
    oobSwitchModel: "48-port 1G Management Switch",
    transceiverType: "400G/800G OSFP Transceivers & DACs",
    managementSuite: "OEM BMC / Redfish + AMD ROCm",
    notes: "Generic OEM 8x MI355X server, typically liquid-cooled. Native FP4/FP6 and 2.3TB HBM3e per node."
  },
];
