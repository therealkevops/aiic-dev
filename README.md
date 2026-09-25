# AI Infrastructure Sizing Calculator (`aiic-dev`)

Enterprise-grade AI cluster sizing, network topology planning, and datacenter bill-of-materials (BOM) generator for Private AI Infrastructure.

Built for infrastructure architects and systems engineers designing clusters for frontier LLM inference, fine-tuning, and training.

---

## Features

- **Model Weight & Architecture Modeling**:
  - Dense models (LLaMA 3.1 8B, 70B, 405B, Gemma 2, Mistral).
  - Mixture-of-Experts (MoE) with exact VRAM loading across all expert weights and active parameter decode routing (DeepSeek-V3 / R1, Mixtral 8x7B).
  - Multi-Head Latent Attention (MLA) low-rank KV compression vs standard Grouped-Query Attention (GQA).
  - Precision support: FP16, FP8, INT4 AWQ/GPTQ, and NVFP4 (with BF16 unquantized embedding and lm_head overhead accounting).

- **KV Cache & Memory Optimization**:
  - GQA KV cache sharding across $\min(TP, H_{kv}) \times PP$.
  - MLA latent representation sharding across $PP$ (replicated across $TP$).
  - Automatic prefix caching modeling: global prefix deduplication (1x VRAM residency across streams) vs session-level reuse (per-stream residency, accelerating TTFT).

- **Auto-Sharding Solver**:
  - Dynamically solves optimal Tensor Parallelism (TP), Pipeline Parallelism (PP), and Data Parallelism (DP).
  - Enforces intra-node NVLink bounds for TP ($TP \le 8$), query head divisibility ($H_q \pmod{TP} = 0$), and multi-node pipeline limits ($PP \le 8$).
  - Scales user concurrency across Data Parallelism ($DP$) replicas without inflating intra-model communication.

- **Inference Performance & Latency Engine**:
  - **Prefill (Time to First Token - TTFT)**: Evaluates dense Tensor Core FLOPs, dynamic prompt-length MFU, unidirectional NVLink/PCIe All-Reduce bandwidth, and pipeline latency.
  - **Decode (Time Per Output Token - TPOT)**: Models HBM memory bandwidth saturation ($t_{\text{mem}}$), active parameter FLOPs ($t_{\text{comp}}$), and All-Reduce communication ($t_{\text{comm}}$).
  - **Calibrated** against NVIDIA's published TensorRT-LLM max-load throughput (H100 / H200 / B200 / GB200): ~16% typical error on the fitted points, ~18% on held-out MoE models.

- **Planning & Facilities**:
  - Guided setup: five plain questions produce a starting design, sized on every platform from a vendor with latency targets.
  - Air or liquid cooling, rack power limits, and working back from a facility power budget to the largest workload that fits.
  - Energy and carbon per year and per 1M output tokens.
  - Sensitivity (tornado) of TCO and cost per token, rent vs buy (reserved, on-demand, scaled to use), and year-by-year growth plans with phased purchases and hardware refresh.

- **Training Time & Reliability**:
  - Time to train from 6ND (4ND for LoRA) FLOPs and MFU; GPU failure rate, Young/Daly checkpoint interval, goodput, wall-clock days and a recommended hot-spare node count.

- **Disaggregated Serving (LLM-D)**:
  - Partitions clusters into dedicated Prefill pools (compute-dense) and Decode pools (memory-dense).
  - Transient KV budget sizing for active in-flight prefill batches ($\text{kvBytesPerToken} \times \text{maxBatchedTokens}$).
  - Lossless RoCEv2 KV-cache chunk network transfer over parallel NICs with computation overlap.

- **Datacenter Facilities & BOM**:
  - **Hardware Platforms**: NVIDIA SXM/PCIe server chassis, GB200 / GB300 NVL72 rack-scale systems (72-GPU NVLink domain), Cisco UCS C885A M8, and Cisco UCS X9508 modular chassis.
  - **Rail-Optimized Fabric**: Leaf-spine 2-tier Clos network with 1:1 non-blocking bisection, single-tier leaf bypass ($N_{\text{gpus}} \le 64$), and optical transceiver counts.
  - **Power & Rack Packing**: Bin-packs chassis and switches into standard 42U racks based on RU and power limits ($\text{rackKW}$), with facility total power and cooling overhead via PUE.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/therealkevops/aiic-dev.git
cd aiic-dev

# Install dependencies
npm install

# Run the development server
npm run dev

# Run the test suite
npm test

# Build for production
npm run build
```

---

## Testing & Verification

The sizing formulas and hardware invariants are rigorously tested:

```bash
# Run unit and architectural tests
npm test
```

Test modules cover:
1. Model Weight Memory Calculations
2. KV Cache Memory Architecture & Formulas (GQA, MLA, Prefix Caching)
3. Training Memory, Gradient Checkpointing & ZeRO Sharding
4. Auto-Sharding Solver (`recommendSharding`)
5. Inference Latency & Throughput Engine (Prefill TTFT & Decode TPOT)
6. Disaggregated Serving (LLM-D) & Cisco RoCEv2 Transfer
7. Datacenter BOM, Facilities & Rail-Optimized Network
8. Calibration Test Suite (`tests/calibration.test.js` - throughput vs NVIDIA's published TensorRT-LLM results, fitted and held-out points)

Detailed mathematical documentation and references can be found in [`docs/SIZING_LOGIC_SPEC.md`](docs/SIZING_LOGIC_SPEC.md).

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Math & Sizing Core**: Pure ECMAScript with zero external dependencies
- **Test Runner**: Node.js built-in test runner (`node:test`, `node:assert/strict`)

---

## License

MIT License.
