import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, Cpu, Network, Database, Server,
  Share2, Briefcase, Bot, CloudLightning, Timer,
  ChevronRight, ChevronLeft, ChevronDown, Search, Layers
} from 'lucide-react';

function Badge({ children, variant = 'sky' }) {
  const styles = {
    sky: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
    zinc: 'bg-zinc-800/70 text-zinc-300 border-zinc-700/60',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    purple: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${styles[variant] || styles.sky}`}>
      {children}
    </span>
  );
}

function DecisionCallout({ title = 'Architectural Decision', children }) {
  return (
    <div className="my-6 flex gap-3.5 items-start bg-sky-950/20 border-l-[3px] border-sky-500 py-4 px-5 text-[14px] rounded-r-lg">
      <div className="space-y-1">
        <span className="text-sky-400 font-semibold text-xs tracking-wider uppercase block">{title}</span>
        <div className="text-zinc-200 leading-relaxed text-[13.5px]">{children}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────── DOCUMENT CATALOG ────────────────────────────────

const DOC_GROUPS = [
  {
    id: 'group-getting-started',
    title: 'GETTING STARTED',
    items: [
      {
        id: 'overview',
        title: 'Architecture Hub Overview',
        category: 'Getting Started',
        icon: BookOpen,
        type: 'guide',
      }
    ]
  },
  {
    id: 'group-core-foundations',
    title: 'CORE FOUNDATIONS',
    items: [
      {
        id: 'chap-1-memory',
        title: 'Model Weights & Precision Math',
        category: 'Core Foundations',
        icon: Cpu,
        type: 'core',
      },
      {
        id: 'chap-2-kv',
        title: 'KV Cache & Attention Mechanics',
        category: 'Core Foundations',
        icon: Database,
        type: 'core',
      },
      {
        id: 'chap-3-sharding',
        title: 'Sharding & Auto-Parallelism Logic',
        category: 'Core Foundations',
        icon: Share2,
        type: 'core',
      },
      {
        id: 'chap-4-llmd',
        title: 'Disaggregated Serving (LLM-D) & RoCEv2',
        category: 'Core Foundations',
        icon: Server,
        type: 'core',
      },
      {
        id: 'chap-5-network',
        title: 'Rail-Optimized Clos & Facilities',
        category: 'Core Foundations',
        icon: Network,
        type: 'core',
      },
      {
        id: 'chap-6-queueing',
        title: 'SLA Tail Latency & Erlang C Queueing',
        category: 'Core Foundations',
        icon: Timer,
        type: 'core',
      }
    ]
  },
  {
    id: 'group-enterprise-presets',
    title: 'ENTERPRISE PRESETS',
    items: [
      {
        id: 'ent-rag-assistant',
        title: 'Departmental RAG Assistant',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-coding-copilot',
        title: 'Coding Copilot / Dev Assistant',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-customer-support',
        title: 'Customer Support Contact Center',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-document-analysis',
        title: 'Document / Contract Analysis',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-lora-finetune',
        title: 'Regulated LoRA Fine-Tuning',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-full-finetune',
        title: 'Full-Parameter Domain Fine-Tuning',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      },
      {
        id: 'ent-minimal-airgapped',
        title: 'Air-Gapped / Tactical Footprint',
        category: 'Enterprise Presets',
        icon: Briefcase,
        type: 'preset',
      }
    ]
  },
  {
    id: 'group-agentic-presets',
    title: 'AGENTIC PRESETS',
    items: [
      {
        id: 'ent-agent-tool-use',
        title: 'Multi-Step Tool-Use Agent',
        category: 'Agentic Presets',
        icon: Bot,
        type: 'preset',
      },
      {
        id: 'ent-agent-swe',
        title: 'Autonomous Coding / SWE Agent',
        category: 'Agentic Presets',
        icon: Bot,
        type: 'preset',
      },
      {
        id: 'ent-agent-deep-research',
        title: 'Deep Research / Web Agent',
        category: 'Agentic Presets',
        icon: Bot,
        type: 'preset',
      },
      {
        id: 'ent-agent-multi-orchestration',
        title: 'Multi-Agent Swarm Orchestration',
        category: 'Agentic Presets',
        icon: Bot,
        type: 'preset',
      },
      {
        id: 'ent-agent-sql-analysis',
        title: 'Data & SQL Analysis Agent',
        category: 'Agentic Presets',
        icon: Bot,
        type: 'preset',
      }
    ]
  },
  {
    id: 'group-neocloud-presets',
    title: 'NEO-CLOUD PRESETS',
    items: [
      {
        id: 'neo-frontier-pretrain',
        title: 'Frontier Pretraining (1k+ GPUs)',
        category: 'Neo-Cloud Presets',
        icon: CloudLightning,
        type: 'preset',
      },
      {
        id: 'neo-maas-inference',
        title: 'Model-as-a-Service at Scale',
        category: 'Neo-Cloud Presets',
        icon: CloudLightning,
        type: 'preset',
      },
      {
        id: 'neo-llmd-disaggregated',
        title: 'Disaggregated Serving Showcase',
        category: 'Neo-Cloud Presets',
        icon: CloudLightning,
        type: 'preset',
      }
    ]
  }
];

// Flat list for Next / Prev navigation
const ALL_DOC_ITEMS = DOC_GROUPS.flatMap(g => g.items);

// ──────────────────────────────── DOCUMENT CONTENT ────────────────────────────────

const PRESET_CONTENT = {
  'ent-rag-assistant': {
    title: 'Departmental RAG / Knowledge Assistant',
    summary: 'A 70B-class dense model serving internal question-answering over enterprise repositories (SharePoint, Confluence, Jira). The universal baseline for corporate private-AI deployment.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '8,192',
      concurrency: '32',
      sharding: 'TP=8, PP=1, DP=1 (Auto)',
      engine: 'vLLM + KServe',
      apc: '40% Cache Ratio',
      promptRatio: '80% Prompt / 20% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'Software LB (Envoy/NGINX)'
    },
    rationale: {
      silicon: 'LLaMA 3.3 70B in FP8 precision consumes ~70GB of raw weight memory. Sized across 8x H200 SXM5 GPUs on a Cisco C885A server with NVLink, each GPU holds just 8.75GB of weights. This leaves over 118GB of usable HBM per GPU dedicated exclusively to KV cache and batch activations. Tensor Parallelism is kept at TP=8 to remain strictly inside the single chassis NVLink domain, avoiding catastrophic Ethernet All-Reduce latency.',
      memory: 'Enterprise RAG queries are prompt-heavy: typical queries bundle 4 to 8 retrieved document chunks (~6,000 tokens) with a short user question and a brief response (~500 tokens), resulting in an 80/20 prompt-to-generation ratio. Automatic Prefix Caching (APC) is configured at 40% because corporate knowledge bases frequently retrieve overlapping policy documents, system prompts, and common guidelines across different department users. Enabling FP8 KV cache halves per-token memory from 2 bytes to 1 byte, allowing 32 concurrent 8k sessions to fit on a single node without spilling into multi-node pipeline parallelism.',
      ancillary: 'RAG embeddings are handled by BGE-Large-EN v1.5 on dedicated L40S PCIe GPUs, pairing with Milvus vector database sized for 8 QPS. Safety is enforced synchronously via Llama-Guard-3 8B. Storage utilizes VAST Universal Storage configured with 8+3 erasure coding, providing high NFS throughput for model loading while avoiding 3x replication capex. HA/DR uses Multi-AZ to guarantee continuous service across datacenter power failures.',
      tradeoff: 'The architecture deliberately accepts higher GPU VRAM headroom (H200 141GB vs H100 80GB) to guarantee that all 32 concurrent 8k streams fit on a single physical node (PP=1). Adding Pipeline Parallelism to split across two H100 nodes would introduce inter-node bubble latency and double the server footprint.'
    }
  },
  'ent-coding-copilot': {
    title: 'Coding Copilot / Dev Assistant',
    summary: 'Sub-second autocomplete and whole-repository reasoning for software engineering teams. Prioritizes ultra-low Time-to-First-Token (TTFT) and high decode velocity.',
    specs: {
      model: 'Qwen 2.5 72B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '65,536',
      concurrency: '16',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM (Speculative Decoding)',
      apc: '20% Cache Ratio',
      promptRatio: '80% Prompt / 20% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'Software LB (Envoy)'
    },
    rationale: {
      silicon: 'Developers cannot tolerate typing lag; target TTFT must remain under 400ms for inline completions. Qwen 2.5 72B is chosen for state-of-the-art coding and syntax comprehension. Sized across 8x H200 GPUs on high-bandwidth NVLink 4 (900 GB/s bidirectional), maximizing memory bandwidth to drive token generation speed.',
      memory: 'Coding copilots require massive context (64k tokens) to swallow open file buffers, imported header definitions, and language server protocol (LSP) symbol tables. At 64k tokens per stream, a single FP16 KV cache sequence consumes 16GB of VRAM! Enforcing FP8 KV cache drops this to 8GB per stream. Speculative decoding is explicitly enabled using a lightweight draft model (e.g. Qwen 2.5 1.5B), accelerating token generation velocity by 1.6x to 2.0x for repetitive code syntax.',
      ancillary: 'Guardrail models are explicitly disabled in this preset. Running an 8B input/output safety guardrail on every autocomplete keystroke introduces an unacceptable 30-60ms latency penalty. RAG utilizes GTE-Large-EN v1.5 with 8,192 max tokens chunking (critical for preserving entire code functions intact) and Qdrant vector database (15 QPS).',
      tradeoff: 'Sacrifices safety guardrail filtering and concurrency depth (capped at 16 streams) in order to support massive 64k context windows with speculative decoding speed.'
    }
  },
  'ent-customer-support': {
    title: 'Customer Support / Contact Center Agent',
    summary: 'High-concurrency, short-context automated voice/chat contact center. Scales to 512 simultaneous caller streams at minimum cost-per-stream.',
    specs: {
      model: 'LLaMA 3 8B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C245 M8',
      gpus: '4x NVIDIA L40S PCIe (48GB)',
      context: '4,096',
      concurrency: '512',
      sharding: 'TP=4 (per node) + Massive DP',
      engine: 'vLLM + KServe',
      apc: '40% Cache Ratio',
      promptRatio: '50% Prompt / 50% Gen',
      servingArch: 'Colocated Serving',
      protocol: 'Lossless RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 2x',
      hadr: 'Warm Standby',
      ingress: 'Cloud-Managed LB (Auto-scaling)'
    },
    rationale: {
      silicon: 'Contact centers operate on strict cost-per-minute unit economics. High-end SXM HGX platforms ($35k/GPU) destroy business ROI for basic transactional dialog. The calculator selects commodity Cisco UCS C245 servers populated with 4x L40S PCIe GPUs ($8,500/GPU). L40S lacks NVLink, but with an 8B model at TP=4, PCIe Gen5 bus bandwidth (64 GB/s) is sufficient for small tensor matrices.',
      memory: 'Customer conversations are concise (4k context), with balanced 50/50 prompt/generation splits (caller question vs agent reply). The challenge is pure concurrency: 512 simultaneous active calls. 512 streams of 4k context would instantly overflow a single node. The calculator deploys Data Parallelism (DP), replicating the model across multiple nodes. Each replica handles an isolated fraction of active streams, dividing per-GPU KV cache pressure.',
      ancillary: 'Safety is mandatory for public-facing dialog; ShieldGemma-2B is selected as an ultra-compact guardrail running on auxiliary L40S slices. Ingress uses a Cloud-Managed auto-scaling load balancer to absorb bursty call spikes. Storage uses NetApp AFF with 2x replication, prioritizing operational maturity over raw parallel-fs speeds. HA/DR utilizes Warm Standby in a secondary datacenter to minimize idle server costs.',
      tradeoff: 'Trades peak reasoning depth (8B vs 70B) and inter-GPU interconnect bandwidth (PCIe vs NVLink) to achieve unmatched density: 512 concurrent conversations at the lowest possible cost-per-stream.'
    }
  },
  'ent-document-analysis': {
    title: 'Document / Contract Analysis (Legal & Financial)',
    summary: 'Asynchronous, prefill-heavy ingestion of 200+ page contracts, 10-K financial filings, and regulatory disclosures at full 131k context.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '131,072',
      concurrency: '8',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM (Chunked Prefill)',
      apc: '0% Cache Ratio',
      promptRatio: '90% Prompt / 10% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 3x (Compliance)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: '131k context prefill creates astronomical compute requirements ($O(S)$ matrix operations on 131,072 tokens). Cisco C885A with 8x H200 SXM5 delivers the dense FP8 Tensor Core throughput required to parse a 100k-token contract in under 3 seconds.',
      memory: 'KV cache at 131,072 tokens is punishing: even in FP8, a single sequence requires ~13.1GB of KV cache VRAM! 8 active concurrent streams consume over 104GB of VRAM solely for KV storage. KV Cache Offload to enterprise storage is enabled to allow inactive historical documents to page out of HBM. Automatic Prefix Caching is set to 0% because each corporate contract or loan dossier is completely unique, eliminating radix tree prefix reuse.',
      ancillary: 'RAG embedding requires NV-Embed-v2, an open 7.8B model with native 32,768 token chunk support, avoiding loss of semantic context across complex 50-page legal clauses. Storage requires NetApp AFF with 3x replication to satisfy enterprise regulatory audit compliance and immutable snapshot mandates. Guardrails utilize Granite Guardian 3 8B.',
      tradeoff: 'Trades interactive concurrency (capped at 8 streams) and prefix cache optimization for maximum context length (131k tokens) and extreme prefill batching throughput.'
    }
  },
  'ent-lora-finetune': {
    title: 'Regulated-Industry LoRA Fine-Tuning',
    summary: 'Compliance-driven in-house domain adaptation on sensitive proprietary records. Freezes base weights and updates low-rank adapter matrices.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP16 Weights / FP16 Grads',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H100 (80GB)',
      context: '4,096',
      concurrency: '8 (Batch Size)',
      sharding: 'TP=8, PP=1, DP=1 (ZeRO-1)',
      engine: 'Megatron-LM / PyTorch FSDP',
      apc: 'N/A (Training Workload)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Training Cluster',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 3x (Audited)',
      hadr: 'Disabled (Batch Job)',
      ingress: 'Internal Subnet (No Ingress)'
    },
    rationale: {
      silicon: 'Full-parameter fine-tuning of a 70B model requires 1,120GB of memory (weights + gradients + 12-byte AdamW optimizer states), which cannot fit on a single server. LoRA (Low-Rank Adaptation with rank $r=16$) freezes the 70B base model (140GB at FP16) and only trains 0.207B adapter parameters. Sized across 8x H100 80GB SXM5 GPUs on a Cisco C885A, the frozen base model shards to 17.5GB per GPU. Adapter optimizer states and gradients take less than 3GB total. The entire training job runs inside one physical node!',
      memory: 'Training requires mixed precision (FP16 base weights, FP16 gradients, FP32 master weights for adapter layers). Recomputation is set to selective activation recomputation, keeping activation memory under 8GB per GPU at context length 4k and micro-batch size 2.',
      ancillary: 'ZeRO-1 shards the small AdamW optimizer states across data-parallel ranks. Storage uses NetApp AFF with 3x replication for compliance, storing the 5TB training dataset and 3 checkpoint generations. Ingress, RAG, and HA/DR are disabled as this is an internal batch training cluster.',
      tradeoff: 'Trades the ultimate domain plasticity of full-parameter training for the ability to train securely on a single 8-GPU chassis on-prem without crossing external networks.'
    }
  },
  'ent-full-finetune': {
    title: 'Full-Parameter Domain Fine-Tuning',
    summary: 'Full Supervised Fine-Tuning (SFT) with ZeRO-3 across a multi-node cluster to build a sovereign, proprietary foundation checkpoint.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP16 Mixed Precision',
      platform: 'Cisco UCS C885A',
      gpus: '32x NVIDIA H100 (4 Nodes x 8 GPUs)',
      context: '4,096',
      concurrency: '8 (Micro-batch 4)',
      sharding: 'TP=8, PP=1, DP=4 (ZeRO-3)',
      engine: 'DeepSpeed / Megatron-LM',
      apc: 'N/A (Training Workload)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Distributed Training',
      protocol: '400G RoCEv2 (Rail-Optimized)',
      storage: 'VAST Data Universal Storage',
      durability: 'Replicated 3x',
      hadr: 'Disabled (Batch Job)',
      ingress: 'Internal Fabric Only'
    },
    rationale: {
      silicon: 'Updating all 70B parameters requires storing: FP16 model weights (140GB) + FP16 gradients (140GB) + FP32 AdamW optimizer states ($12 \\text{ bytes/param} = 840\\text{GB}$) = 1,120GB total training state! The calculator configures a 4-node cluster (32x H100 80GB GPUs). ZeRO-3 parameter sharding partitions weights, gradients, and optimizer states across all 32 GPUs, reducing per-GPU memory to just 35GB ($1120 / 32$), fitting safely within the 80GB H100 envelope alongside backward activations.',
      memory: 'Because ZeRO-3 performs synchronous All-Gather collectives across the network before every layer forward/backward pass, inter-node networking bandwidth is the binding bottleneck. Pipeline Parallelism is explicitly locked to PP=1 because ZeRO-2 and ZeRO-3 are mathematically incompatible with pipeline stage bubbles.',
      ancillary: 'Networking demands a 2-Tier Rail-Optimized leaf-spine Clos fabric over 400G Cisco Nexus 9000 switches to handle non-blocking All-Gather and Reduce-Scatter operations. Storage uses VAST Data Universal Storage to sustain 60-second checkpoint write bursts across a 20TB dataset.',
      tradeoff: 'Demands a 4-node, 32-GPU high-speed RoCEv2 fabric investment to unlock full architectural adaptation across the entire 70B parameter matrix.'
    }
  },
  'ent-minimal-airgapped': {
    title: 'Minimum-Footprint / Air-Gapped Deployment',
    summary: 'Tactical SCIF, submarine, or disconnected industrial facility. Operates on a single commodity 2U PCIe server with zero external internet dependencies.',
    specs: {
      model: 'LLaMA 3 8B',
      precision: 'INT4 AWQ / INT4 KV',
      platform: 'Cisco UCS C245 M8',
      gpus: '1x NVIDIA L40S PCIe (48GB)',
      context: '4,096',
      concurrency: '4',
      sharding: 'TP=1, PP=1, DP=1',
      engine: 'vLLM + Docker Engine',
      apc: '0% Cache Ratio',
      promptRatio: '80% Prompt / 20% Gen',
      servingArch: 'Single-Node Edge',
      protocol: 'Internal Bus (PCIe)',
      storage: 'Ceph Bulk Object Storage',
      durability: 'Replicated 2x',
      hadr: 'Disabled (Air-gapped)',
      ingress: 'Software Reverse Proxy'
    },
    rationale: {
      silicon: 'Designed for environments where power, rack units, and cooling are strictly constrained. Populated with a single NVIDIA L40S PCIe card (48GB GDDR6, 350W TDP) in a Cisco C245 2U rack server. No NVLink switches, leaf-spine fabric, or secondary nodes are permitted.',
      memory: 'Aggressive 4-bit AWQ weight quantization compresses LLaMA 3 8B to just ~4.5GB VRAM. 4-bit INT4 KV cache reduces per-token memory to 0.5 bytes. At 4 concurrent streams and 4k context, total memory consumption remains under 12GB, fitting effortlessly inside the 48GB GDDR6 memory pool with massive room for Linux OS and vector indices.',
      ancillary: 'The orchestrator is plain Docker Engine to eliminate Kubernetes control-plane complexity in isolated environments. Vector database is pgvector running as an extension inside an existing local PostgreSQL container, introducing zero new operational surfaces. Guardrails use Llama-Guard-3 1B on CPU/GPU. Storage uses local Ceph/S3 object storage with 2x replication.',
      tradeoff: 'Sacrifices high concurrency and bleeding-edge model intelligence for complete air-gapped sovereignty on a single standard enterprise server.'
    }
  },
  'ent-agent-tool-use': {
    title: 'Multi-Step Tool-Use / Function-Calling Agent',
    summary: 'Cyclic agent loop continually executing API tool calls, JSON schema validation, and multi-turn reasoning steps. High output volume and massive prefix reuse.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '32,768',
      concurrency: '64',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM (Speculative Decoding)',
      apc: '60% Cache Ratio',
      promptRatio: '40% Prompt / 60% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'Hardware API Gateway (Kong/Apigee)'
    },
    rationale: {
      silicon: 'Multi-step agent loops emit extensive hidden reasoning tokens before executing tool calls. The prompt/generation split is inverted: 40% prompt, 60% generation. This heavy autoregressive decode phase is strictly memory-bandwidth bound. Cisco C885A with 8x H200 delivers 4.8 TB/s HBM3e bandwidth per GPU, keeping decode velocity above 45 tokens/second.',
      memory: 'Agent workflows maintain constant system instructions, API function descriptions, and JSON schemas across all turns. Automatic Prefix Caching (APC) is configured at 60%, yielding massive VRAM savings by caching the shared tool catalog in a radix tree. Speculative decoding is enabled to accelerate repetitive JSON and code bracket syntax generation by 1.8x.',
      ancillary: 'Ingress employs an enterprise API Gateway (Kong/Apigee class) with rate-limiting, mTLS authentication, and token quota enforcement. RAG uses Qdrant (10 QPS) with BGE-Large embeddings. Guardrails enforce both input prompt sanitization and output tool-execution safety via Llama-Guard-3 8B.',
      tradeoff: 'Prioritizes high prefix caching hit rates and memory bandwidth over raw batch throughput, optimizing for multi-turn agent response latency.'
    }
  },
  'ent-agent-swe': {
    title: 'Autonomous Coding / SWE Agent',
    summary: 'Autonomous software engineering agent running edit-compile-test loops over whole repositories. Long-lived sessions with context ballooning to 131k tokens.',
    specs: {
      model: 'Qwen 2.5 72B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '131,072',
      concurrency: '24',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM + Chunked Prefill',
      apc: '50% Cache Ratio',
      promptRatio: '35% Prompt / 65% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: 'Autonomous coding agents maintain multi-hour stateful sessions while reading stack traces, running unit tests, and rewriting files. Context window expands continuously toward 131k tokens. Populated with 8x H200 SXM5 GPUs (1,128GB aggregate VRAM) on Cisco C885A to hold long-context KV states without constant CPU paging.',
      memory: 'At 131k context, KV cache footprint threatens cluster stability. The calculator enforces FP8 KV cache and enables KV Cache Offload to VAST NVMe storage, allowing dormant agent sessions to hibernate during external test suite execution. 50% APC ratio captures static codebase state across iterative compiler runs.',
      ancillary: 'RAG uses GTE-Large-EN v1.5 with 256-token chunking and Qdrant (12 QPS) for fast semantic symbol retrieval. Ingress uses Envoy software load balancing. Guardrails are active for code security and secret leakage prevention.',
      tradeoff: 'Requires massive 141GB HBM3e GPUs and NVMe KV offload to tolerate multi-hour 131k context ballooning without dropping concurrent developer sessions.'
    }
  },
  'ent-agent-deep-research': {
    title: 'Deep Research / Multi-Hop Web Agent',
    summary: 'Iterative search-read-synthesize research loop. Ingests tens of raw scraped web documents per step with ballooning context and negligible cache reuse.',
    specs: {
      model: 'Mistral Large 2 (123B)',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '131,072',
      concurrency: '16',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM (Chunked Prefill)',
      apc: '15% Cache Ratio (Low Reuse)',
      promptRatio: '85% Prompt / 15% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (Active-Active)',
      ingress: 'API Gateway'
    },
    rationale: {
      silicon: 'Deep research requires top-tier reasoning to synthesize conflicting source material. Mistral Large 2 (123B dense parameters) is chosen. At FP8, 123B weights require ~125GB VRAM. Distributed across 8x H200 GPUs (15.6GB/GPU weights), leaving over 110GB per GPU for the immense 131k prompt prefill activations.',
      memory: 'Web research is prefill-dominated (85% prompt, 15% synthesis). Because each search hop scrapes new, unpredictable web URLs, Automatic Prefix Caching drops to 15% (only the base system prompt is reused). Chunked prefill is mandatory to prevent massive 100k-token web dumps from stalling active decode streams.',
      ancillary: 'RAG uses NV-Embed-v2 (Mistral-7B based) with 1,024-token chunking to maintain semantic coherence across long web articles, backed by Milvus. Storage uses VAST Universal with 8+3 erasure coding. Granite Guardian 3 8B enforces input/output hallucination and safety validation.',
      tradeoff: 'Employs a frontier 123B model with low cache hit rates, prioritizing multi-source synthesis quality over high stream concurrency.'
    }
  },
  'ent-agent-multi-orchestration': {
    title: 'Multi-Agent Orchestration (Planner + Worker Swarm)',
    summary: 'Hierarchical multi-agent pattern: a central Planner fans sub-tasks out to a swarm of 1,000+ lightweight workers executing micro-tasks concurrently.',
    specs: {
      model: 'LLaMA 3 8B (Worker Swarm)',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C245 M8',
      gpus: 'Multiple Nodes x 4x L40S PCIe',
      context: '8,192',
      concurrency: '1,024 (Swarm Concurrency)',
      sharding: 'TP=1 + Massive Auto-DP',
      engine: 'vLLM + Ray Core',
      apc: '50% Cache Ratio',
      promptRatio: '50% Prompt / 50% Gen',
      servingArch: 'Distributed Worker Pool',
      protocol: 'Lossless RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Replicated 2x',
      hadr: 'Warm Standby',
      ingress: 'API Gateway (High-throughput)'
    },
    rationale: {
      silicon: 'In planner-worker architectures, the worker swarm (not the planner) dictates 95% of datacenter infrastructure sizing. Sizing for 1,024 concurrent worker calls using $35k H100s would require millions in capex. The calculator provisions cost-effective Cisco C245 servers with L40S PCIe GPUs, running the workers at TP=1 and scaling horizontally via Ray Core and Data Parallelism (DP).',
      memory: 'Worker tasks are concise (8k context) with moderate 50% prefix caching (shared agent role instructions). Auto-DP scales the replica count to ensure that each worker GPU handles only 32 to 64 streams, preventing memory starvation.',
      ancillary: 'Orchestration runs on Ray cluster management. Ingress requires an enterprise API Gateway to manage the sudden burst of 1,000+ internal micro-agent requests. Storage uses VAST with fast model load times (30 seconds) to facilitate dynamic worker autoscaling.',
      tradeoff: 'Decouples orchestration into a two-tier hardware strategy: cheap, dense L40S GPUs handle the 1,024-worker swarm, leaving complex planning to an isolated high-end instance.'
    }
  },
  'ent-agent-sql-analysis': {
    title: 'Data / SQL Analysis Agent',
    summary: 'Iterative natural-language-to-SQL agent refining queries across corporate data warehouse schemas and evaluating tabular query results.',
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H200 (141GB)',
      context: '16,384',
      concurrency: '48',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'vLLM + KServe',
      apc: '30% Cache Ratio',
      promptRatio: '60% Prompt / 40% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: 'Generating production SQL over 50-table schemas requires 70B-class reasoning to prevent hallucinated joins and syntax errors. Cisco C885A with 8x H200 provides the necessary TP=8 NVLink fabric to deliver snappy query synthesis for 48 concurrent business analysts.',
      memory: '16k context window comfortably holds DDL table schemas, column foreign-key relationships, and sample query rows. 30% APC ratio caches the enterprise data catalog schema across iterative user query refinements.',
      ancillary: 'Storage uses NetApp AFF with 8+3 erasure coding. Guardrails are disabled because database access is governed strictly by relational database row-level security (RLS) and database permissions rather than LLM text filters.',
      tradeoff: 'Balances schema context capacity (16k) and 48-stream concurrency against a single-node H200 footprint.'
    }
  },
  'neo-frontier-pretrain': {
    title: 'Frontier Pretraining Run (1,000+ GPUs)',
    summary: 'Hyperscale foundation model pretraining run for a 405B dense model. High-density liquid-cooled Blackwell B200 clusters on InfiniBand.',
    specs: {
      model: 'LLaMA 3 405B Dense',
      precision: 'FP16 Precision (ZeRO-3)',
      platform: 'NVIDIA HGX B200',
      gpus: '1,024 GPUs (128 Chassis x 8 GPUs)',
      context: '8,192',
      concurrency: '8 per rank (Micro-batch 4)',
      sharding: 'TP=8, PP=1, DP=128 (ZeRO-3)',
      engine: 'Megatron-LM / PyTorch FSDP',
      apc: 'N/A (Pretraining)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Distributed Pretraining',
      protocol: '3.2 Tbps Quantum-2 InfiniBand',
      storage: 'WekaFS NVMe Parallel Filesystem',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Disabled (Checkpoint Resume)',
      ingress: 'Internal Compute Fabric'
    },
    rationale: {
      silicon: 'Pretraining a 405B frontier model from scratch requires $10^{25}$ FLOPs. Populated with 1,024 NVIDIA Blackwell B200 GPUs (180GB HBM3e, 8.0 TB/s bandwidth) across 128 HGX chassis. Intra-node TP is set to TP=8 across 1.8 TB/s NVLink 5. Inter-node scaling uses DP=128 with ZeRO-3 parameter sharding over 3.2 Tbps Quantum-2 InfiniBand fabrics.',
      memory: 'Full FP16 pretraining state for 405B requires ~6,480GB of memory (weights + gradients + optimizer states). Distributed across 1,024 GPUs, each GPU holds just 6.3GB of model state, leaving over 150GB of HBM3e for massive batch activation tensors and FlashAttention-3 buffers.',
      ancillary: 'Storage demands WekaFS NVMe All-Flash parallel filesystem, delivering tens of terabytes/sec of aggregate write bandwidth to flush multi-terabyte checkpoints in under 180 seconds without stalling the training run. Erasure coding 10+4 provides maximum resilience across thousands of NVMe drives. Facility design assumes high-density liquid cooling with PUE of 1.15 and $150/kW colocation economics.',
      tradeoff: 'Pure, uncompromised compute density and network bisection bandwidth. The entire architecture is optimized for sustained Model FLOPs Utilization (MFU > 45%) across 1,000+ GPUs.'
    }
  },
  'neo-maas-inference': {
    title: 'Model-as-a-Service Inference at Scale',
    summary: 'Public API hosting DeepSeek R1 671B Mixture-of-Experts. Extreme concurrency (4,096 streams) backed by Multi-Head Latent Attention and Edge CDN.',
    specs: {
      model: 'DeepSeek R1 671B MoE',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'NVIDIA HGX B200',
      gpus: 'Multi-Node B200 Cluster (Auto-DP)',
      context: '32,768',
      concurrency: '4,096 Concurrent Streams',
      sharding: 'TP=8, PP=1, Massive Auto-DP',
      engine: 'TensorRT-LLM + Ray',
      apc: '10% Cache Ratio',
      promptRatio: '70% Prompt / 30% Gen',
      servingArch: 'Colocated Multi-Tenant Cluster',
      protocol: 'InfiniBand / RoCEv2',
      storage: 'WekaFS NVMe Parallel Filesystem',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Multi-Site Active-Active',
      ingress: 'Global CDN Edge Network'
    },
    rationale: {
      silicon: 'DeepSeek R1 MoE has 671B total parameters, but only 37B active parameters per token. At FP8, all 671GB of weights must remain resident in HBM. Deployed on NVIDIA HGX B200 nodes (180GB VRAM per GPU). Because TP=8 provides 1,440GB of VRAM per node, the entire 671B model fits comfortably on a single 8-GPU chassis, eliminating the need for high-latency Pipeline Parallelism (PP=1)!',
      memory: 'DeepSeek Multi-Head Latent Attention (MLA) is the secret weapon for 4,096 concurrency. By compressing KV representations into a 576-element latent space, MLA achieves a 4.66x memory reduction compared to standard GQA. 4,096 concurrent 32k streams can be served with a fraction of the Data Parallel replicas that a standard model would require.',
      ancillary: 'Ingress uses a Global CDN Edge network to terminate TLS and TCP handshakes at edge PoPs close to users worldwide, slashing initial connection overhead. Storage uses WekaFS for rapid sub-60-second node recovery. HA/DR uses Multi-Site Active-Active to guarantee five-nines availability across geographic regions.',
      tradeoff: 'Accepts massive cluster VRAM commitment (holding 671B weights per replica) to unlock the revolutionary token economics and low per-token compute of DeepSeek MoE.'
    }
  },
  'neo-llmd-disaggregated': {
    title: 'Disaggregated Serving Showcase (LLM-D)',
    summary: 'Heterogeneous disaggregated inference for LLaMA 3 405B: Compute-dense B200 Prefill pool streaming KV cache over RoCEv2 to a memory-dense H200 Decode pool.',
    specs: {
      model: 'LLaMA 3 405B Dense',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Heterogeneous: B200 + H200',
      gpus: '2x B200 Prefill Nodes + 8x H200 Decode Nodes',
      context: '32,768',
      concurrency: '1,024 Streams',
      sharding: 'TP=8 Prefill / TP=8 Decode',
      engine: 'vLLM (LLM-D Disaggregated Engine)',
      apc: '20% Cache Ratio',
      promptRatio: '70% Prompt / 30% Gen',
      servingArch: 'LLM-D Disaggregated',
      protocol: 'Cisco Nexus 400G RoCEv2',
      storage: 'WekaFS NVMe All-Flash',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Multi-AZ',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: 'Colocated serving causes severe phase interference: a sudden 32k prompt floods the Tensor Cores, stalling active token generation for ongoing users. LLM-D completely physically decouples the cluster into two distinct hardware tiers: (1) Prefill Pool: 2x NVIDIA B200 nodes delivering extreme dense FP8 Tensor FLOPs to process prompts in milliseconds. (2) Decode Pool: 8x NVIDIA H200 nodes delivering massive aggregate HBM3e capacity (9,024GB) and bandwidth to host and generate tokens for 1,024 concurrent users without jitter.',
      memory: 'Prefill nodes maintain zero persistent KV cache—they generate the attention vectors for the prompt and immediately stream the KV chunk across the network. Decode nodes hold the persistent KV cache across the full 32k context window.',
      ancillary: 'Networking is the critical system bus: Cisco Nexus 9000 400G RoCEv2 fabric streams the KV cache directly between prefill and decode GPUs via RDMA. Overlapped KV transfer is enabled, transmitting layers 1 to L-1 concurrently with compute. FP8 KV cache cuts network transfer payload by 50%, reducing transfer latency to under 9ms.',
      tradeoff: 'Introduces network-dependent KV streaming complexity in exchange for total isolation of compute and memory, delivering perfectly stable decode latency and near-zero jitter SLAs at massive scale.'
    }
  }
};

const CORE_CONTENT = {
  'chap-1-memory': {
    title: 'Model Weights & Precision Math',
    subtitle: 'Silicon memory bounds, numerical datatypes, and unquantized head overhead.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          In generative AI, accelerator High Bandwidth Memory (HBM) is the supreme binding constraint. 
          For any dense autoregressive transformer, every single parameter must remain resident in physical VRAM during inference:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Memory_weights = (P × 10⁹ × B_param + M_unquantized_heads) / 10⁹ [GB]
        </div>
        <p>
          Where <span className="font-mono text-sky-400">B_param</span> is governed by numerical precision:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>FP16 / BF16 (16-bit):</strong> 2.0 bytes/parameter. Baseline gold standard for training and unquantized inference.</li>
          <li><strong>FP8 (8-bit E4M3 / E5M2):</strong> 1.0 byte/parameter. Slashes model weight memory by exactly 50% with near-zero loss in MMLU reasoning benchmarks.</li>
          <li><strong>NVFP4 (NVIDIA Blackwell 4-bit):</strong> 0.5625 bytes/parameter (4 bits + 1-in-16 micro-scaling factor overhead).</li>
          <li><strong>INT4 (AWQ / GPTQ):</strong> 0.53 bytes/parameter (4 bits + group size 128 scale/zero overhead).</li>
        </ul>
        <DecisionCallout title="Unquantized Embedding & LM Head Overhead">
          Production inference engines (vLLM, TensorRT-LLM) retain the token embedding table and final language model projection head (<span className="font-mono">lm_head</span>) at full 16-bit precision (BF16 = 2 bytes) even when weights are quantized. This prevents catastrophic logit collapse, adding <span className="font-mono">2 × vocab × hidden × 2 bytes</span> of unquantized memory to every model.
        </DecisionCallout>
        <h3 className="text-xl font-bold text-white mt-8 mb-3">Mixture of Experts (MoE) Memory Residency</h3>
        <p>
          In MoE models like DeepSeek-V3 or Mixtral, only a small subset of parameter "experts" are active during the generation of any single token. For example, DeepSeek R1 has 671B total parameters, but only routes 37B active parameters per token.
        </p>
        <p>
          While compute throughput scales based on the 37B active parameters, <strong>ALL 671B parameters must remain permanently resident in GPU HBM</strong>. Dynamically paging weights across NVLink or PCIe during token generation introduces unacceptable multi-second latency spikes.
        </p>
      </div>
    )
  },
  'chap-2-kv': {
    title: 'KV Cache & Attention Mechanics',
    subtitle: 'Grouped-Query Attention (GQA), Multi-Head Latent Attention (MLA), and Radix Tree Prefix Caching.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          The Key-Value (KV) cache stores past token representations so the model does not recompute attention for historical tokens. 
          At long contexts (32k to 131k), <strong>the KV cache memory easily eclipses the model weights themselves</strong>.
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          KV_bytes_per_seq = 2 × L × H_kv × D_head × B_kv_elem × ContextLength
        </div>
        <p>
          Modern architectures combat this memory explosion through two distinct attention mechanisms:
        </p>
        <ul className="list-disc pl-5 space-y-3 text-zinc-300 text-sm">
          <li>
            <strong>Grouped-Query Attention (GQA):</strong> Shares a small number of Key/Value heads (<span className="font-mono">H_kv</span>) across many Query heads (<span className="font-mono">H_q</span>). 
            For example, LLaMA 3.1 70B uses <span className="font-mono">H_q = 64, H_kv = 8</span>, achieving an 8x reduction in KV cache memory compared to multi-head attention.
          </li>
          <li>
            <strong>Multi-Head Latent Attention (MLA):</strong> Pioneered by DeepSeek, MLA projects Key and Value vectors into a low-rank compressed latent space (<span className="font-mono">d_c = 512, d_r = 64</span>). 
            This stores only 576 elements per token per layer, delivering an astonishing <strong>4.66x reduction in KV cache memory</strong> compared to standard 70B GQA!
          </li>
        </ul>
        <DecisionCallout title="Automatic Prefix Caching (APC) Radix Trees">
          APC structures VRAM as a radix tree. Global system prompts, few-shot examples, and RAG contexts shared across requests are stored <em>once</em> in VRAM across all streams. Session-level chat history does not save multi-user VRAM, but skips prefill compute to drop TTFT to near-zero on subsequent turns.
        </DecisionCallout>
      </div>
    )
  },
  'chap-3-sharding': {
    title: 'Sharding & Auto-Parallelism Logic',
    subtitle: 'Tensor Parallelism, Pipeline Parallelism, Data Parallelism, and the Auto-Sharding solver algorithm.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          When a model and its KV cache exceed the capacity of a single GPU, the workload must be sharded across three orthogonal dimensions:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono my-4">
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="text-sky-400 font-bold block mb-1">Tensor Parallel (TP)</span>
            Shards matrix GEMMs within a layer. All-Reduce after EVERY layer. Must remain on NVLink (TP ≤ 8).
          </div>
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="text-amber-400 font-bold block mb-1">Pipeline Parallel (PP)</span>
            Partitions layers across chassis (L / PP). Bridges over network fabric. Introduces bubble idle time.
          </div>
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="text-emerald-400 font-bold block mb-1">Data Parallel (DP)</span>
            Replicates model to split concurrent streams. The true lever for scaling concurrency to thousands of users.
          </div>
        </div>
        <p>
          The calculator's auto-sharding solver executes the following deterministic logic:
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-300">
          <li>Sizes TP and PP strictly against static weights + a minimal 1-stream KV floor.</li>
          <li>Ensures TP divides the attention query heads (<span className="font-mono">H_q</span>) cleanly.</li>
          <li>If the replica exceeds single-node usable VRAM (90% utilization limit), sets TP=8 and scales Pipeline Parallelism linearly (<span className="font-mono">PP = ceil(ReplicaMemory / NodeCapacity)</span>).</li>
          <li>Remaining VRAM on each GPU is pooled into replica KV capacity, and concurrency scales Data Parallelism (<span className="font-mono">DP = ceil(RequiredKV / ReplicaCapacity)</span>).</li>
        </ol>
        <DecisionCallout title="Pipeline Bubble Fraction Warning">
          When PP &gt; 1, pipeline stages must prime and drain, leading to bubble idle time: Bubble = (PP - 1) / (PP + Concurrency - 1). If user concurrency is too low, GPUs sit idle waiting for activation handoffs.
        </DecisionCallout>
      </div>
    )
  },
  'chap-4-llmd': {
    title: 'Disaggregated Serving (LLM-D) & RoCEv2 Fabric',
    subtitle: 'Decoupling compute-bound prefill from memory-bound decode over lossless RDMA fabrics.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          In traditional colocated serving, prefill and decode phases run on the same GPUs. 
          When a long 32k prompt arrives, it monopolizes the Tensor Cores, causing high latency spikes (jitter) for all ongoing decode streams.
        </p>
        <p>
          <strong>Disaggregated Serving (LLM-D)</strong> physically splits the cluster into dedicated Prefill and Decode pools:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>Prefill Pool:</strong> Optimized for compute density (FLOPs). Evaluates prompt attention and immediately streams the generated KV cache across the fabric. Retains zero persistent user KV cache.</li>
          <li><strong>Decode Pool:</strong> Optimized for memory bandwidth and VRAM capacity. Receives the KV cache and executes autoregressive generation without disruption.</li>
        </ul>
        <DecisionCallout title="Cisco Nexus Lossless RoCEv2 KV Cache Streaming">
          Under LLM-D, the network becomes the system bus. Streaming KV cache across nodes requires transferring hundreds of megabytes in milliseconds. Overlapped KV transfer enables layers 1 to L-1 to stream concurrently during prefill, leaving only the final layer to add sequentially to TTFT. Toggling KV cache to FP8 halves the network payload, cutting transfer time over 400G Cisco Nexus RoCEv2 fabrics from 18ms to 9ms.
        </DecisionCallout>
      </div>
    )
  },
  'chap-5-network': {
    title: 'Rail-Optimized Clos & Facilities Bin-Packing',
    subtitle: 'Non-blocking leaf-spine fabrics, power density, RU bin-packing, and PUE cooling overhead.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Standard enterprise top-of-rack (ToR) switching causes massive congestion during multi-node All-Reduce collectives. 
          AI fabrics deploy a <strong>Rail-Optimized Leaf-Spine Clos</strong> architecture:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li>Each GPU in an 8-GPU chassis is cabled to an independent leaf switch rail (Rail 1 through Rail 8).</li>
          <li>All "GPU 1" adapters across all servers terminate on Leaf 1; all "GPU 2" adapters terminate on Leaf 2.</li>
          <li>Cross-node All-Reduce communication flows along dedicated non-blocking horizontal rails without inter-GPU contention.</li>
        </ul>
        <p>
          Datacenter facilities sizing enforces exact bin-packing of server chassis into standard 42U racks (40U usable, 2U for PDUs) based on both physical RU height and maximum rack thermal limits (e.g. 28 kW/rack). Total facility power is evaluated using Power Usage Effectiveness (PUE, default 1.35), calculating both IT load and cooling overhead.
        </p>
      </div>
    )
  },
  'chap-6-queueing': {
    title: 'SLA Tail Latency & Erlang C Queueing',
    subtitle: 'Queueing theory, target utilization inflection, and the physical decoupling of TTFT from TPOT.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Serving benchmarks often report average (p50) latency, but real-world SLAs are governed by tail latency (p95 / p99). 
          The calculator incorporates an exact <strong>M/M/c queueing model (Erlang C)</strong> to model request contention:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          W(t) = P(Wait &gt; 0) × e^(-c × μ × (1 - ρ) × t)
        </div>
        <p>
          Where <span className="font-mono text-sky-400">ρ</span> is target cluster utilization. As utilization exceeds 85%, request queueing wait times grow exponentially.
        </p>
        <DecisionCallout title="Scope of Queueing: TTFT vs TPOT">
          Queueing delays apply <em>strictly to Time-to-First-Token (TTFT)</em> while a request waits for an execution slot. Once a request enters forward execution and allocates its KV cache, Time Per Output Token (TPOT) is determined purely by physical memory bandwidth and Tensor Core compute—decode speed does not degrade from waiting queues.
        </DecisionCallout>
      </div>
    )
  }
};

// ──────────────────────────────── MAIN COMPONENT ────────────────────────────────

export function GlossaryPage({ onBack }) {
  const [activeDocId, setActiveDocId] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Collapsible section groups state (default all open)
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Automatically expand group containing active document
  useEffect(() => {
    const parentGroup = DOC_GROUPS.find(g => g.items.some(i => i.id === activeDocId));
    if (parentGroup && collapsedGroups[parentGroup.id]) {
      setCollapsedGroups(prev => ({ ...prev, [parentGroup.id]: false }));
    }
  }, [activeDocId]);

  // Find current document and index
  const currentIndex = ALL_DOC_ITEMS.findIndex(d => d.id === activeDocId);
  const currentDoc = ALL_DOC_ITEMS[currentIndex] || ALL_DOC_ITEMS[0];
  const prevDoc = currentIndex > 0 ? ALL_DOC_ITEMS[currentIndex - 1] : null;
  const nextDoc = currentIndex < ALL_DOC_ITEMS.length - 1 ? ALL_DOC_ITEMS[currentIndex + 1] : null;

  // Filtered documents by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return DOC_GROUPS;
    const q = searchQuery.toLowerCase();
    return DOC_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.category.toLowerCase().includes(q)
      )
    })).filter(group => group.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden selection:bg-sky-500/30">
      {/* Top Header */}
      <header className="px-6 py-3.5 bg-zinc-950/90 backdrop-blur-lg border-b border-zinc-800/80 shrink-0 flex items-center justify-between z-20 sticky top-0 shadow-md shadow-black/40">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-2.5 py-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Calculator
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-zinc-100">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold tracking-tight">AI Infrastructure Architecture Documentation</span>
          </div>
        </div>

      </header>

      {/* Main Hub Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Documentation Navigation Sidebar */}
        <aside className="w-72 shrink-0 bg-zinc-950/70 border-r border-zinc-800/80 flex flex-col h-full overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-zinc-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search architecture docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Navigation Links Grouped with Collapsible Headers */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.id]);
              return (
                <div key={group.id} className="select-none">
                  {/* Collapsible Section Header Button */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-wider rounded transition cursor-pointer group"
                  >
                    <span>{group.title}</span>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-transform">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>

                  {/* Section Document Links */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-0.5 pl-1 border-l border-zinc-800/50 ml-1.5">
                      {group.items.map((item) => {
                        const isActive = activeDocId === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveDocId(item.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                              isActive
                                ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-zinc-500'}`} />
                            <span className="truncate">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Right Active Document Pane */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-4xl mx-auto">
            
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-6">
              <span>Docs</span>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-zinc-400">{currentDoc.category}</span>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-sky-400 font-medium">{currentDoc.title}</span>
            </div>

            {/* Document Content Rendering */}
            {activeDocId === 'overview' ? (
              <div>
                <div className="mb-10 pb-8 border-b border-zinc-800">
                  <h1 className="text-4xl font-extrabold text-white tracking-tight mb-4">
                    Enterprise AI Architecture &amp; Sizing Reference
                  </h1>
                  <p className="text-base text-zinc-400 leading-relaxed">
                    This documentation hub specifies the mathematical formulations, physical hardware constraints, 
                    and architectural trade-offs driving the Private AI Infrastructure Calculator. 
                    Explore the core silicon foundations or jump straight into the blueprint rationales for all 15 use-case presets.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                  <div 
                    onClick={() => setActiveDocId('chap-1-memory')}
                    className="p-5 bg-zinc-900/70 border border-zinc-800 hover:border-sky-500/50 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <Cpu className="w-5 h-5 text-sky-400" />
                      <h3 className="font-semibold text-zinc-100 group-hover:text-sky-300 transition">Core Foundations</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      Deep-dive into silicon memory sizing, KV cache attention mechanics, rail-optimized leaf-spine Clos networks, and Erlang C queueing theory.
                    </p>
                    <span className="text-xs text-sky-400 font-medium flex items-center gap-1">
                      Explore Foundations <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>

                  <div 
                    onClick={() => setActiveDocId('ent-rag-assistant')}
                    className="p-5 bg-zinc-900/70 border border-zinc-800 hover:border-sky-500/50 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <Briefcase className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-semibold text-zinc-100 group-hover:text-emerald-300 transition">Workload Presets Guide</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      Exhaustive architectural specifications and engineering rationales for all 15 presets across Enterprise, Agentic, and Neo-cloud archetypes.
                    </p>
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      Browse Presets <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white">How This Documentation Works</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Use the collapsible left navigation sidebar to browse or search any specific chapter or preset blueprint. 
                    Each page is an independent architectural document detailing:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-300">
                    <li><strong>Silicon &amp; Sharding Topology:</strong> Why specific GPUs and sharding parameters (TP/PP/DP) were chosen.</li>
                    <li><strong>Context &amp; KV Cache Dynamics:</strong> How context length and prefix caching ratios govern physical memory capacity.</li>
                    <li><strong>Ancillary Infrastructure:</strong> How RAG vector databases, safety guardrails, storage tiers, and HA/DR are integrated.</li>
                    <li><strong>Binding Constraints &amp; Trade-offs:</strong> What engineering compromises were made for that workload.</li>
                  </ul>
                </div>
              </div>
            ) : currentDoc.type === 'core' ? (
              <div>
                {/* Core Foundation Chapter */}
                <div className="mb-8 pb-6 border-b border-zinc-800">
                  <div className="flex items-center gap-3 mb-2">
                    <currentDoc.icon className="w-7 h-7 text-sky-400" />
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                      {CORE_CONTENT[activeDocId]?.title || currentDoc.title}
                    </h1>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {CORE_CONTENT[activeDocId]?.subtitle}
                  </p>
                </div>

                <div>
                  {CORE_CONTENT[activeDocId]?.content}
                </div>
              </div>
            ) : (
              <div>
                {/* Preset Blueprint Page */}
                {(() => {
                  const preset = PRESET_CONTENT[activeDocId];
                  if (!preset) return <p className="text-zinc-400">Blueprint not found.</p>;
                  return (
                    <div>
                      <div className="mb-8 pb-6 border-b border-zinc-800">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="purple">{currentDoc.category.toUpperCase()}</Badge>
                          <span className="text-xs font-mono text-zinc-500">preset_id: {activeDocId}</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">{preset.title}</h1>
                        <p className="text-sm text-zinc-400 leading-relaxed">{preset.summary}</p>
                      </div>

                      {/* Specs Grid */}
                      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Model / Precision</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.model}</span>
                          <span className="text-sky-400 block font-mono text-[11px]">{preset.specs.precision}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Platform / Hardware</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.platform}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.gpus}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Context &amp; Concurrency</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.context} tokens</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.concurrency} streams</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Sharding Strategy</span>
                          <span className="font-semibold text-zinc-200 font-mono">{preset.specs.sharding}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.engine}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Prefix Caching (APC)</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.apc}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">Prompt: {preset.specs.promptRatio}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Serving Topology</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.servingArch}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.protocol}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">Storage Tier</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.storage}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.durability}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">HA / DR &amp; Ingress</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.hadr}</span>
                          <span className="text-zinc-400 block font-mono text-[11px]">{preset.specs.ingress}</span>
                        </div>
                      </div>

                      {/* Rationales */}
                      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
                        <div>
                          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-sky-400" />
                            1. Why this Silicon &amp; Sharding Topology?
                          </h3>
                          <p>{preset.rationale.silicon}</p>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                            <Database className="w-4 h-4 text-sky-400" />
                            2. Memory, KV Cache &amp; Context Dynamics
                          </h3>
                          <p>{preset.rationale.memory}</p>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                            <Network className="w-4 h-4 text-sky-400" />
                            3. Ancillary Subsystems: RAG, Guardrails, Storage &amp; HA/DR
                          </h3>
                          <p>{preset.rationale.ancillary}</p>
                        </div>

                        <DecisionCallout title="Key Binding Constraint &amp; Trade-Off">
                          {preset.rationale.tradeoff}
                        </DecisionCallout>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Next / Previous Pagination Footer */}
            <div className="mt-16 pt-8 border-t border-zinc-800 flex items-center justify-between gap-4">
              {prevDoc ? (
                <button
                  onClick={() => setActiveDocId(prevDoc.id)}
                  className="flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition text-left cursor-pointer group max-w-[45%]"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 transition shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Previous</span>
                    <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition truncate block">
                      {prevDoc.title}
                    </span>
                  </div>
                </button>
              ) : <div />}

              {nextDoc ? (
                <button
                  onClick={() => setActiveDocId(nextDoc.id)}
                  className="flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition text-right cursor-pointer group max-w-[45%] ml-auto"
                >
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Next</span>
                    <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition truncate block">
                      {nextDoc.title}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 transition shrink-0" />
                </button>
              ) : <div />}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
