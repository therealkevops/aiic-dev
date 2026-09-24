import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, Cpu, Network, Database, Server,
  Share2, Briefcase, Bot, CloudLightning, Timer,
  ChevronRight, ChevronLeft, ChevronDown, Search, Layers, Info,
  HardDrive, Zap, DollarSign, AlertTriangle, Terminal
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
      },
      {
        id: 'chap-7-storage',
        title: 'Storage Architecture & Durability Math',
        category: 'Core Foundations',
        icon: HardDrive,
        type: 'core',
      },
      {
        id: 'chap-8-silicon',
        title: 'Silicon & Accelerator Guide (Hopper vs Blackwell vs AMD)',
        category: 'Core Foundations',
        icon: Zap,
        type: 'core',
      },
      {
        id: 'chap-9-tco',
        title: 'TCO & Unit Economics Modeling',
        category: 'Core Foundations',
        icon: DollarSign,
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
    summary: 'The flagship architecture for enterprise internal question-answering over private repositories (SharePoint, Confluence, Jira).',
    introduction: [
      'The Departmental RAG Assistant is the universal first step for enterprise private AI. Rather than retraining or fine-tuning an expensive model on proprietary data, this architecture pairs a powerful 70B foundation model with a semantic vector search engine. When an employee asks a question, the vector database retrieves the most relevant paragraphs from corporate policies, wikis, or engineering manuals, and prompts the LLM to synthesize an accurate answer with direct source citations.',
      'The core architectural challenge is handling prompt-heavy context windows. Because multiple retrieved document excerpts must be fed into the model with every query, input processing (the "prefill" phase) accounts for roughly 80% of total token volume. The system must maintain sufficient GPU memory to hold the model weights while leaving ample headroom for concurrent 8,192-token prompt contexts without spilling into costly multi-node configurations.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB (Envoy/NGINX)'
    },
    rationale: {
      silicon: 'LLaMA 3.3 70B in FP8 precision consumes ~70GB of raw weight memory. Sized across 8x H200 SXM5 GPUs on a Cisco C885A server with NVLink, each GPU holds just 8.75GB of weights. This leaves over 118GB of usable HBM per GPU dedicated exclusively to KV cache and batch activations. Tensor Parallelism is kept at TP=8 to remain strictly inside the single chassis NVLink domain, avoiding catastrophic Ethernet All-Reduce latency.',
      memory: 'Enterprise RAG queries are prompt-heavy: typical queries bundle 4 to 8 retrieved document chunks (~6,000 tokens) with a short user question and a brief response (~500 tokens), resulting in an 80/20 prompt-to-generation ratio. Automatic Prefix Caching (APC) is configured at 40% because corporate knowledge bases frequently retrieve overlapping policy documents, system prompts, and common guidelines across different department users. Enabling FP8 KV cache halves per-token memory from 2 bytes to 1 byte, allowing 32 concurrent 8k sessions to fit on a single node without spilling into multi-node pipeline parallelism.',
      ancillary: 'RAG embeddings are handled by BGE-Large-EN v1.5 on dedicated L40S PCIe GPUs, pairing with Milvus vector database sized for 8 QPS. Safety is enforced synchronously via Llama-Guard-3 8B. Storage utilizes VAST Universal Storage configured with 8+3 erasure coding, providing high NFS throughput for model loading while avoiding 3x replication capex. HA/DR uses Multi-AZ to guarantee continuous service across datacenter power failures.',
      tradeoff: 'The architecture deliberately accepts higher GPU VRAM headroom (H200 141GB vs H100 80GB) to guarantee that all 32 concurrent 8k streams fit on a single physical node (PP=1). Adding Pipeline Parallelism to split across two H100 nodes would introduce inter-node bubble latency and double the server footprint.',
      modelSelection: 'LLaMA 3.3 70B delivers an MMLU benchmark of 88.6% and state-of-the-art instruction following while retaining the identical 70.6B dense footprint of LLaMA 3.1. It is the gold standard for enterprise question-answering where factual hallucination must be minimized.',
      modelAlternatives: [
        {
          name: 'NVIDIA Llama-3.1-Nemotron-70B-Instruct',
          specs: '70.6B Dense, 128k Context, NVIDIA Open Model License',
          pros: 'Top-tier alignment and helpfulness (Arena-Hard ~85.0). The NVIDIA Open Model License explicitly permits using outputs for synthetic data generation and knowledge distillation without Meta competition restrictions.',
          cons: 'Identical physical memory footprint as LLaMA 3.3 70B, but requires fine-tuned inference sampling parameters (temperature/top-p) to curb excessive verbosity in concise FAQ answers.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense, 128k Context, GQA (8 heads)',
          pros: 'Built specifically for enterprise RAG with native grounded citations and verifiable quote extraction.',
          cons: 'At FP8, weights consume ~104GB (vs 70GB for LLaMA 3.3), reducing concurrent 8k context KV cache slots by ~35% on the same hardware.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, 128k Context, GQA (8 heads)',
          pros: 'Superior multilingual retrieval (29+ languages) and structured JSON/tabular extraction capabilities.',
          cons: 'Wider intermediate dimension (29,568 vs 28,672) and larger vocabulary (152k vs 128k) consume ~3.5GB more VRAM for identical context.'
        },
        {
          name: 'Mistral Mixtral 8x22B (141B MoE)',
          specs: '141B MoE (39B active), 64k Context',
          pros: 'Delivers ~1.8x faster decode token throughput due to sparse expert routing (only 39B active parameters).',
          cons: 'All 141B parameters must remain resident in VRAM (~141GB in FP8), leaving very little KV headroom on 80GB GPUs and mandating H200s.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Inter-Node Tensor Parallelism Trap',
        mistake: 'Configuring TP=16 across two 8-GPU nodes over RoCEv2 or InfiniBand instead of keeping TP=8 inside a single chassis.',
        impact: 'Forward-pass All-Reduce latency explodes from 15μs (over NVLink) to 400μs+ over network switches, causing decode token throughput to collapse by up to 70%.',
        remediation: 'Keep Tensor Parallelism strictly at TP=8 within the NVLink domain. Scale cluster concurrency horizontally using Data Parallel (DP) replicas across nodes.'
      },
      {
        title: 'Neglecting Automatic Prefix Caching (APC)',
        mistake: 'Leaving prefix caching disabled when querying shared corporate document repositories.',
        impact: 'Every user query forces a redundant full re-computation of the 4,000+ token corporate policy headers and system prompts, inflating TTFT by 3x to 5x.',
        remediation: 'Enable Radix Tree prefix caching in vLLM (--enable-prefix-caching). Memory is allocated once and reused across all concurrent employee sessions.'
      },
      {
        title: 'Unquantized FP16 KV Cache at Scale',
        mistake: 'Deploying FP8 model weights but retaining FP16 for the Key-Value attention cache.',
        impact: 'At 32 concurrent 8k context sessions, the FP16 KV cache consumes over 65GB of VRAM per GPU, causing sudden Out-of-Memory (OOM) request aborts during peak hours.',
        remediation: 'Enable FP8 KV cache (--kv-cache-dtype fp8) to cut per-token memory footprint by 50% without measurable retrieval accuracy degradation.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM v0.6+ / KServe',
      commandTitle: 'Production vLLM Headless Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 8192 \\
  --max-num-seqs 64 \\
  --gpu-memory-utilization 0.92 \\
  --port 8000`,
      notes: 'Requires 8x H200 SXM5 GPUs with NVLink. Allocates 92% of HBM to weights and KV cache, reserving 8% for PyTorch activation spikes.'
    }
  },
  'ent-coding-copilot': {
    title: 'Coding Copilot / Dev Assistant',
    summary: 'Sub-second autocomplete and whole-repository reasoning for internal software engineering teams.',
    introduction: [
      'Developer coding assistants live directly inside integrated development environments (IDEs) like VS Code or JetBrains, providing inline code completions, docstring generation, and automated refactoring suggestions. The defining characteristic of this workload is extreme latency sensitivity: software engineers type at human typing cadence, and any completion lag greater than 400 milliseconds feels sluggish and breaks workflow.',
      'To provide contextually accurate completions, the model must read entire file buffers, open tabs, and imported libraries—driving context requirements up to 65,536 tokens. Sizing this infrastructure requires solving a critical tension: sustaining high token generation speeds (via speculative decoding) across vast repository contexts without exhausting accelerator memory.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB (Envoy)'
    },
    rationale: {
      silicon: 'Developers cannot tolerate typing lag; target TTFT must remain under 400ms for inline completions. Qwen 2.5 72B is chosen for state-of-the-art coding and syntax comprehension. Sized across 8x H200 GPUs on high-bandwidth NVLink 4 (900 GB/s bidirectional), maximizing memory bandwidth to drive token generation speed.',
      memory: 'Coding copilots require massive context (64k tokens) to swallow open file buffers, imported header definitions, and language server protocol (LSP) symbol tables. At 64k tokens per stream, a single FP16 KV cache sequence consumes 16GB of VRAM! Enforcing FP8 KV cache drops this to 8GB per stream. Speculative decoding is explicitly enabled using a lightweight draft model (e.g. Qwen 2.5 1.5B), accelerating token generation velocity by 1.6x to 2.0x for repetitive code syntax.',
      ancillary: 'Guardrail models are explicitly disabled in this preset. Running an 8B input/output safety guardrail on every autocomplete keystroke introduces an unacceptable 30-60ms latency penalty. RAG utilizes GTE-Large-EN v1.5 with 8,192 max tokens chunking (critical for preserving entire code functions intact) and Qdrant vector database (15 QPS).',
      tradeoff: 'Sacrifices safety guardrail filtering and concurrency depth (capped at 16 streams) in order to support massive 64k context windows with speculative decoding speed.',
      modelSelection: 'Qwen 2.5 72B leads open-weights coding evaluations (HumanEval 86.6%, EvalPlus, LiveCodeBench), rivaling frontier proprietary models. It demonstrates exceptional long-context multi-file repository understanding and strict adherence to programming language syntax.',
      modelAlternatives: [
        {
          name: 'Qwen 2.5 Coder 32B',
          specs: '32.8B Dense, 128k Context, Apache 2.0',
          pros: 'Scores within 2.5% of the 72B model on HumanEval (84.1%) at less than half the VRAM footprint (~33GB FP8). Allows scaling to 4x higher developer concurrency.',
          cons: 'Slightly less nuanced architectural refactoring and edge-case bug localization across large codebases compared to 72B.'
        },
        {
          name: 'DeepSeek-Coder-V2 236B (21B active)',
          specs: '236B MoE, 128k Context, MLA Attention',
          pros: 'State-of-the-art code completion with blazing decode speeds due to only 21B active parameters and Multi-Head Latent Attention compression.',
          cons: '236B total parameters require ~240GB VRAM in FP8, requiring multi-node setups that complicate private on-prem deployment.'
        },
        {
          name: 'Meta LLaMA 3.3 70B',
          specs: '70.6B Dense, 128k Context',
          pros: 'Strong general reasoning and English documentation comprehension.',
          cons: 'Slightly lower accuracy on lower-resource programming languages (Go, Rust, Scala) and strict AST schema compliance compared to Qwen 2.5.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Synchronous Safety Guardrails in the Typing Path',
        mistake: 'Routing every single keystroke autocomplete through an auxiliary 8B safety model (e.g. Llama-Guard).',
        impact: 'Adds 50ms to 90ms of serial TTFT overhead. Developers immediately notice the typing latency lag and disable the assistant in IDE settings.',
        remediation: 'Bypass inline guardrails for code completion; perform asynchronous post-commit git security and secret scanning instead.'
      },
      {
        title: 'Autoregressive Decoding Without Speculation',
        mistake: 'Relying solely on single-token autoregressive generation for standard programming syntax.',
        impact: 'Emitting boilerplates like boilerplate brackets, docstrings, and imports runs at memory-bandwidth-bound speeds (~40 tok/s), causing sluggish inline suggestions.',
        remediation: 'Configure speculative decoding with a matching small draft model (Qwen 2.5-Coder 1.5B). Generates 4 to 6 candidate tokens in parallel, boosting throughput to 75+ tok/s.'
      },
      {
        title: 'Context Over-Provisioning per Keystroke',
        mistake: 'Re-transmitting the entire 64k codebase buffer on every single autocomplete keystroke without client-side debouncing.',
        impact: 'Overwhelms the serving engine queue and evicts active KV blocks prematurely.',
        remediation: 'Implement 150ms client-side keystroke debouncing in the IDE plugin, coupled with vLLM Radix attention prefix caching.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Speculative Decoding Engine',
      commandTitle: 'Production Speculative vLLM Service Command',
      command: `vllm serve Qwen/Qwen2.5-Coder-72B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --speculative-model Qwen/Qwen2.5-Coder-1.5B-Instruct \\
  --num-speculative-tokens 5 \\
  --enable-prefix-caching \\
  --max-model-len 65536 \\
  --gpu-memory-utilization 0.94 \\
  --port 8000`,
      notes: 'Draft model (1.5B) is colocated on GPU 0-7 alongside the 72B target model, adding negligible memory while delivering 1.7x token speedup.'
    }
  },
  'ent-customer-support': {
    title: 'Customer Support / Contact Center Agent',
    summary: 'High-concurrency, short-context automated voice/chat contact center scaling to 512 simultaneous caller streams.',
    introduction: [
      'Customer support and contact center automation operate under intense concurrency and cost-per-minute constraints. Unlike internal research tools where a few users submit complex, long-running questions, a contact center cluster must handle hundreds or thousands of simultaneous phone calls or chat inquiries with zero dropped connections and predictable sub-100ms response times.',
      'Because customer service dialogues are conversational and short (rarely exceeding 4,000 tokens), the architectural priority shifts completely from raw reasoning depth to high-density concurrency. This blueprint intentionally avoids expensive $35k accelerators in favor of cost-efficient PCIe cards and lightweight 8B models, scaling horizontally to deliver hundreds of active streams at minimal infrastructure cost.'
    ],
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
      tradeoff: 'Trades peak reasoning depth (8B vs 70B) and inter-GPU interconnect bandwidth (PCIe vs NVLink) to achieve unmatched density: 512 concurrent conversations at the lowest possible cost-per-stream.',
      modelSelection: 'LLaMA 3.1 8B provides the ideal balance of conversational fluency, intent extraction, and extreme execution speed. At 8B parameters, it achieves sub-100ms TTFT on PCIe hardware, critical for interactive phone/voice agents.',
      modelAlternatives: [
        {
          name: 'Google Gemma 2 (9B)',
          specs: '9.2B Dense, 8k Context',
          pros: 'Achieves higher raw MMLU reasoning (71.3%) and conversational polish than LLaMA 3 8B.',
          cons: 'Uses alternating sliding window attention (4k window) which complicates prefix caching engines like vLLM. Licensing terms impose restrictions on some telecom deployments.'
        },
        {
          name: 'Mistral NeMo 12B',
          specs: '12.2B Dense, 128k Context, Apache 2.0',
          pros: 'Developed with NVIDIA; features a modern Tekken tokenizer with superior multilingual coverage across 80+ languages.',
          cons: '12B parameter footprint takes ~50% more VRAM, reducing maximum concurrent caller streams per node by ~30%.'
        },
        {
          name: 'Microsoft Phi-4 (14B)',
          specs: '14.7B Dense, 16k Context',
          pros: 'Exceptional synthetic-data reasoning and policy compliance for customer validation.',
          cons: 'Compute cost per token is ~1.75x higher than 8B, increasing cost-per-minute for high-QPS transactional call routing.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Single-Instance Concurrency Saturation',
        mistake: 'Directing 512 concurrent caller streams to a single server instance without horizontal Data Parallel partitioning.',
        impact: 'Once GPU memory fills, requests queue up past the Erlang C inflection point, spiking TTFT to 15+ seconds and causing caller hang-ups.',
        remediation: 'Partition traffic across multiple DP worker nodes behind an Envoy or NGINX load balancer enforcing active stream rate limits.'
      },
      {
        title: 'Sizing Premium HGX SXM Silicon for 8B Workloads',
        mistake: 'Purchasing 8x H100 SXM5 servers ($300k+) to host conversational 8B customer support models.',
        impact: 'Destroys contact center unit economics. The memory bandwidth of SXM is wasted on short transactional conversational turns.',
        remediation: 'Deploy high-density Cisco C245 M8 servers with 4x L40S PCIe GPUs, saving 60% in CapEx while easily satisfying sub-100ms streaming targets.'
      },
      {
        title: 'Omitting Safety Filter Latency in IVR Voice Loops',
        mistake: 'Running heavy 8B+ guardrails synchronously on continuous bi-directional voice streams.',
        impact: 'Introduces audible 200ms pauses between caller sentences, breaking realistic conversational flow.',
        remediation: 'Deploy ultra-compact Guardrail models (e.g. ShieldGemma-2B) on dedicated PCIe slices with asynchronous post-turn red-teaming.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Multi-Instance Worker',
      commandTitle: 'Production L40S PCIe Serving Command',
      command: `vllm serve meta-llama/Meta-Llama-3-8B-Instruct \\
  --tensor-parallel-size 4 \\
  --kv-cache-dtype fp8 \\
  --max-model-len 4096 \\
  --max-num-seqs 128 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'Runs across 4x L40S PCIe GPUs per server. Scale horizontally by deploying N replica nodes behind an Envoy round-robin balancer.'
    }
  },
  'ent-document-analysis': {
    title: 'Document / Contract Analysis (Legal & Financial)',
    summary: 'Asynchronous, prefill-heavy ingestion of 200+ page contracts, 10-K financial filings, and regulatory disclosures at full 131k context.',
    introduction: [
      'Document and Contract Analysis represents the deep-batch processing frontier for enterprise AI. Legal teams, compliance departments, and investment analysts must ingest massive 200-page loan agreements, bond indentures, regulatory filings, or discovery briefs into an LLM in a single pass—often spanning over 100,000 tokens.',
      'Unlike conversational chatbots where human speed is the metric, this workload is asynchronous and prefill-dominated: the prompt represents 90% of the token workload. The primary engineering bottleneck is the sheer volume of memory required to store the Key-Value (KV) cache for a 131k-token prompt. Sizing this infrastructure requires massive High Bandwidth Memory (H200 141GB) and intelligent offloading to storage to prevent cluster crashes.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: '131k context prefill creates astronomical compute requirements ($O(S)$ matrix operations on 131,072 tokens). Cisco C885A with 8x H200 SXM5 delivers the dense FP8 Tensor Core throughput required to parse a 100k-token contract in under 3 seconds.',
      memory: 'KV cache at 131,072 tokens is punishing: even in FP8, a single sequence requires ~13.1GB of KV cache VRAM! 8 active concurrent streams consume over 104GB of VRAM solely for KV storage. KV Cache Offload to enterprise storage is enabled to allow inactive historical documents to page out of HBM. Automatic Prefix Caching is set to 0% because each corporate contract or loan dossier is completely unique, eliminating radix tree prefix reuse.',
      ancillary: 'RAG embedding requires NV-Embed-v2, an open 7.8B model with native 32,768 token chunk support, avoiding loss of semantic context across complex 50-page legal clauses. Storage requires NetApp AFF with 3x replication to satisfy enterprise regulatory audit compliance and immutable snapshot mandates. Guardrails utilize Granite Guardian 3 8B.',
      tradeoff: 'Trades interactive concurrency (capped at 8 streams) and prefix cache optimization for maximum context length (131k tokens) and extreme prefill batching throughput.',
      modelSelection: 'LLaMA 3.3 70B possesses native 131k context support with verified Needle In A Haystack retrieval fidelity (>99%). Its deep parameter capacity is essential for interpreting nested cross-references, indemnity liabilities, and financial tables.',
      modelAlternatives: [
        {
          name: 'Mistral Large 2 (123B)',
          specs: '123B Dense, 128k Context',
          pros: 'Industry-leading European multilingual legal parsing (French, German, Spanish civil codes) and strict JSON compliance.',
          cons: '123B weights require ~125GB VRAM in FP8, leaving tighter KV cache margins on single-node systems than 70B.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, 128k Context',
          pros: 'Exceptional financial table parsing and structured tabular data extraction from balance sheets.',
          cons: 'Slightly less extensive training on Western common-law legal corpora compared to LLaMA 3.3.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense, 128k Context',
          pros: 'Designed specifically for document ground truth and RAG citations, minimizing hallucinated contract interpretations.',
          cons: 'Demands ~34GB more weight VRAM than 70B, reducing batch concurrency on an 8-GPU node.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Unchunked 131k Prompt Ingestion Spikes',
        mistake: 'Ingesting a 120,000-token contract in a single monolithic prefill step without chunking.',
        impact: 'Transient activation memory spikes by over 35GB on GPU 0, triggering an instantaneous CUDA OOM crash even when static KV cache fits.',
        remediation: 'Enable Chunked Prefill (--enable-chunked-prefill) with a bounded batch size (--max-num-batched-tokens 8192) to process prompt chunks smoothly.'
      },
      {
        title: 'Assuming High Prefix Cache Reuse Across Unique Filings',
        mistake: 'Sizing physical HBM assuming a 40% APC cache hit ratio on heterogeneous loan portfolios or vendor contracts.',
        impact: 'Every legal contract is completely unique; zero cache hits occur, causing unexpected memory exhaustion and eviction thrashing.',
        remediation: 'Size memory conservatively for 0% APC reuse and configure hierarchical KV cache offloading to NVMe flash storage.'
      },
      {
        title: 'Small Context Embeddings for Complex Contracts',
        mistake: 'Using standard 512-token embedding models (e.g. standard BERT) to index 200-page loan agreements.',
        impact: 'Slices interconnected indemnity and covenant clauses across arbitrary chunk boundaries, destroying cross-clause semantic understanding.',
        remediation: 'Use long-context embedding models such as NV-Embed-v2 with native 32k chunk capacity to preserve complete contract sections.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Long-Context Engine',
      commandTitle: 'Production Chunked-Prefill Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --gpu-memory-utilization 0.95 \\
  --port 8000`,
      notes: 'Requires 8x H200 (141GB) SXM5 GPUs. Enforces chunked prefill to prevent activation OOM spikes on 100k+ token documents.'
    }
  },
  'ent-lora-finetune': {
    title: 'Regulated-Industry LoRA Fine-Tuning',
    summary: 'Compliance-driven in-house domain adaptation on sensitive records, freezing base weights and training low-rank adapters.',
    introduction: [
      'In highly regulated sectors such as banking, defense, and healthcare, data privacy regulations (HIPAA, GDPR, FedRAMP High) strictly forbid transmitting confidential customer transactions, electronic health records, or classified intel to external cloud APIs. When organizations require an AI model to master internal terminology or proprietary schemas, the training must happen strictly on-premises.',
      'Full training of a 70B model requires massive multi-node clusters. Low-Rank Adaptation (LoRA) provides an elegant alternative: it freezes the massive base model completely and only updates a small mathematical adapter layer (under 1% of total parameters). This allows an enterprise to fine-tune a flagship 70B model inside a single 8-GPU chassis without needing complex multi-node networking fabrics.'
    ],
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
      tradeoff: 'Trades the ultimate domain plasticity of full-parameter training for the ability to train securely on a single 8-GPU chassis on-prem without crossing external networks.',
      modelSelection: 'LLaMA 3.3 70B is the gold-standard base foundation for enterprise NLP domain adaptation. Freezing base weights at FP16 preserves core reasoning while allowing lightweight low-rank adapters to learn domain taxonomies.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, FP16 Base',
          pros: 'Equally viable base checkpoint with identical rank-16 adapter sizing (~0.21B params). Preferred for math, quantitative finance, or Asian languages.',
          cons: 'Slightly larger vocabulary table (152k vs 128k) adds ~0.8GB to embedding adapter states.'
        },
        {
          name: 'Meta LLaMA 3.1 (8B)',
          specs: '8.0B Dense, FP16 Base',
          pros: 'Dramatically lower training footprint; can be fine-tuned via LoRA on a single GPU (1x H100 or 2x L40S).',
          cons: '8B models cannot match 70B-class complex few-shot generalization or multi-step domain reasoning.'
        },
        {
          name: 'Mistral NeMo 12B',
          specs: '12.2B Dense, Apache 2.0',
          pros: 'Fully permissive open-source license avoiding Meta commercial threshold restrictions, easily fine-tuned on 1-2 GPUs.',
          cons: 'Moderate reasoning capacity compared to a 70B foundation checkpoint.'
        },
        {
          name: 'NVIDIA Llama-3.1-Nemotron-70B-Reward',
          specs: '70.6B Reward Model, SteerLM / Bradley-Terry',
          pros: 'Serves as an on-prem automated judge to score and filter fine-tuning training pairs for DPO/RLHF alignment loops on private corporate data.',
          cons: 'Trained specifically for sequence scoring and response ranking rather than autoregressive text generation.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Activation Memory Underestimation in LoRA',
        mistake: 'Assuming that because rank-16 adapter weights are only ~200MB, micro-batch sizes can be increased arbitrarily without memory consequences.',
        impact: 'During backpropagation, forward activations for all 70B parameters must be retained in memory, triggering instant CUDA OOM on 80GB GPUs.',
        remediation: 'Enable selective activation checkpointing and cap per-device micro-batch size to 2, using gradient accumulation to reach desired global batch sizes.'
      },
      {
        title: 'ZeRO-3 Misconfiguration on Single-Node LoRA',
        mistake: 'Enabling DeepSpeed ZeRO-3 parameter sharding on a single 8-GPU chassis running LoRA.',
        impact: 'ZeRO-3 shards frozen base weights across GPUs and constantly performs redundant All-Gather collectives across NVLink, adding 30% to 40% training latency for zero memory gain.',
        remediation: 'Keep base model weights unsharded across GPUs and use ZeRO-1 strictly to partition adapter optimizer states.'
      },
      {
        title: 'Serving Raw LoRA Adapters at High Concurrency',
        mistake: 'Deploying unfused LoRA adapters alongside base models in production inference engines with dozens of concurrent users.',
        impact: 'Dynamic adapter GEMM routing introduces runtime kernel launch overhead, degrading token generation throughput by 20%.',
        remediation: 'Fuse trained adapter weights directly into the base model weights (merge_and_unload()) and export as a unified FP8 checkpoint before deployment.'
      }
    ],
    engineRecipe: {
      framework: 'PyTorch FSDP / HuggingFace PEFT',
      commandTitle: 'Single-Node LoRA Launch Command',
      command: `torchrun --nproc_per_node=8 train_lora.py \\
  --model_name_or_path meta-llama/Llama-3.3-70B-Instruct \\
  --lora_rank 16 \\
  --lora_alpha 32 \\
  --target_modules q_proj,k_proj,v_proj,o_proj \\
  --per_device_train_batch_size 2 \\
  --gradient_accumulation_steps 4 \\
  --gradient_checkpointing true \\
  --bf16 true`,
      notes: 'Executes within a single Cisco C885A (8x H100 80GB) node. Base weights remain frozen; only low-rank matrices are optimized.'
    }
  },
  'ent-full-finetune': {
    title: 'Full-Parameter Domain Fine-Tuning',
    summary: 'Full Supervised Fine-Tuning (SFT) with ZeRO-3 across a multi-node cluster to build a sovereign foundation checkpoint.',
    introduction: [
      'While adapter-based fine-tuning (LoRA) is effective for teaching a model specialized vocabularies, it cannot fundamentally alter the model\'s underlying reasoning habits or overwrite base pretraining knowledge. When an enterprise or national lab intends to build a truly sovereign domain foundation model, full-parameter Supervised Fine-Tuning (SFT) is mandatory.',
      'Full SFT updates every single weight across all 70 billion parameters. This requires storing not just the weights, but also gradients and 12-byte AdamW optimizer states—creating a staggering 1,120GB memory footprint. Sizing this system requires a multi-node cluster (32 GPUs across 4 servers) coupled with DeepSpeed ZeRO-3 memory sharding and a high-speed non-blocking RoCEv2 network fabric.'
    ],
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
      tradeoff: 'Demands a 4-node, 32-GPU high-speed RoCEv2 fabric investment to unlock full architectural adaptation across the entire 70B parameter matrix.',
      modelSelection: 'LLaMA 3.3 70B provides the highest open-weights baseline quality for creating a proprietary corporate foundation model, allowing fundamental representation updates across all transformer layers.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, FP16 ZeRO-3',
          pros: 'Direct 1:1 drop-in replacement with identical 4-node sharding mechanics, offering stronger baseline mathematical and coding representations.',
          cons: 'Slightly higher memory for embedding layer gradients due to 152k vocabulary.'
        },
        {
          name: 'Mistral Mixtral 8x22B (141B MoE)',
          specs: '141B Sparse MoE (39B active)',
          pros: 'Sparse execution computes fewer FLOPs per token during forward/backward training passes.',
          cons: 'Dynamic expert routing introduces load-balancing stragglers and communication skew during synchronous multi-node backpropagation.'
        },
        {
          name: 'DeepSeek-V3 (671B MoE)',
          specs: '671B MoE, 37B active',
          pros: 'Frontier capability; revolutionary training efficiency if cluster scale is massive.',
          cons: 'Full fine-tuning requires hundreds of GPUs and multi-million dollar infrastructure beyond typical enterprise private clusters.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Combining Pipeline Parallelism with ZeRO-3',
        mistake: 'Enabling Pipeline Parallelism (PP > 1) simultaneously with ZeRO-3 parameter partitioning.',
        impact: 'Pipeline stage idle bubbles mathematically conflict with ZeRO-3 dynamic tensor re-partitioning, triggering synchronization deadlocks and severe training stalls.',
        remediation: 'Lock Pipeline Parallelism strictly to PP=1. Use pure Data Parallelism with ZeRO-3 across all 32 GPUs.'
      },
      {
        title: 'Oversubscribed Top-of-Rack Network Switches',
        mistake: 'Running multi-node ZeRO-3 across enterprise switches with 3:1 or 2:1 bisection oversubscription.',
        impact: 'All-Gather and Reduce-Scatter collectives before every layer choke on packet loss, dropping effective Model FLOP Utilization (MFU) from 45% down to under 18%.',
        remediation: 'Deploy a dedicated 1:1 non-blocking rail-optimized leaf-spine Clos fabric over 400G RoCEv2 with Priority Flow Control (PFC) and DCQCN enabled.'
      },
      {
        title: 'Slow NFS Checkpoint Storage Stalls',
        mistake: 'Dumping full 1.12TB uncompressed model states to standard corporate NAS storage.',
        impact: 'The 32-GPU cluster sits frozen in I/O wait states for 20+ minutes every checkpoint interval, burning thousands of dollars of idle compute time.',
        remediation: 'Provision parallel flash storage (VAST Universal Storage or WekaFS) capable of absorbing >= 20 GB/s write throughput to keep checkpoint stalls under 60 seconds.'
      }
    ],
    engineRecipe: {
      framework: 'DeepSpeed ZeRO-3 Distributed Runner',
      commandTitle: 'Multi-Node ZeRO-3 SFT Launch Command',
      command: `deepspeed --hostfile /etc/hosts/cluster_nodes \\
  train_sft_70b.py \\
  --deepspeed deepspeed_zero3_config.json \\
  --model_name_or_path meta-llama/Llama-3.3-70B-Instruct \\
  --per_device_train_batch_size 4 \\
  --gradient_accumulation_steps 2 \\
  --zero_stage 3 \\
  --bf16 true`,
      notes: 'Runs across 4x Cisco C885A nodes (32x H100 GPUs) interconnected via 400G RoCEv2 rail-optimized leaf-spine fabric.'
    }
  },
  'ent-minimal-airgapped': {
    title: 'Minimum-Footprint / Air-Gapped Deployment',
    summary: 'Smallest viable private-AI footprint for tactical SCIF, submarine, or disconnected industrial edge environments.',
    introduction: [
      'The Air-Gapped deployment archetype addresses the absolute extreme of operational isolation: submarines at sea, forward military command posts (SCIFs), nuclear power stations, or remote mine sites where all outbound Internet and cloud connectivity is physically prohibited. In these environments, power, cooling, and rack space are strictly capped.',
      'The engineering mandate is delivering functional, reliable generative AI on a single standard enterprise 2U rack server. By pairing aggressive 4-bit AWQ weight quantization with a compact 8B model and lightweight container orchestration, the entire infrastructure footprint—including model weights, conversation memory, local vector search, and safety filters—executes within a single 48GB PCIe card.'
    ],
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
      tradeoff: 'Sacrifices high concurrency and bleeding-edge model intelligence for complete air-gapped sovereignty on a single standard enterprise server.',
      modelSelection: 'LLaMA 3.1 8B at INT4 AWQ quantizes down to ~4.5GB VRAM while retaining over 96% of its FP16 reasoning benchmarks, making it the most capable model that comfortably operates on constrained edge hardware.',
      modelAlternatives: [
        {
          name: 'Microsoft Phi-4 Mini (3.8B)',
          specs: '3.8B Dense, 128k Context, MIT License',
          pros: 'Extremely dense reasoning for its size; at INT4 it takes only ~2.2GB VRAM, allowing deployment on ruggedized laptops or vehicle hardware.',
          cons: 'Smaller broad world-knowledge memory than 8B models.'
        },
        {
          name: 'Alibaba Qwen 2.5 (7B)',
          specs: '7.6B Dense, Apache 2.0',
          pros: 'Fully permissive open-source license with no commercial user caps (avoiding Meta 700M active user terms).',
          cons: 'Similar VRAM footprint to LLaMA 3 8B (~4.3GB INT4) with nearly identical hardware requirements.'
        },
        {
          name: 'Google Gemma 2 (2B)',
          specs: '2.6B Dense, Apache 2.0',
          pros: 'Ultralight footprint (<1.8GB INT4), ideal for low-power tactical drones or IoT appliances.',
          cons: 'Limited multi-step logical deduction and complex instruction following.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Kubernetes Overhead on Tactical Edge Hardware',
        mistake: 'Deploying a full enterprise Kubernetes control plane on a single standalone 2U server in an air-gapped environment.',
        impact: 'K8s etcd and daemonsets consume 16GB+ of host RAM and precious CPU cores, creating fragile failure modes without cloud telemetry.',
        remediation: 'Deploy via plain Docker Engine or standalone systemd containers; store state in local PostgreSQL with pgvector.'
      },
      {
        title: 'Unquantized Heavy Embeddings on Edge Silicon',
        mistake: 'Pairing an INT4-quantized LLM with an unquantized 7B embedding model that requires 14GB of VRAM.',
        impact: 'The embedding model steals memory needed by the LLM KV cache, limiting concurrency to a single user stream.',
        remediation: 'Use compact embedding models (e.g. BGE-Small or all-MiniLM-L6-v2) running on host CPU or quantized to INT8.'
      },
      {
        title: 'Spinning Rust / Slow SATA Boot Latency',
        mistake: 'Storing model weights on mechanical hard drives or networked SATA shares in disconnected sites.',
        impact: 'Container cold-start and model weight loading take 15+ minutes after power cycles or tactical reboot sequences.',
        remediation: 'Store all INT4 AWQ models on direct-attached NVMe PCIe Gen4/5 SSDs for sub-5-second container initialization.'
      }
    ],
    engineRecipe: {
      framework: 'Docker + vLLM Edge Runtime',
      commandTitle: 'Single-GPU Air-Gapped Docker Launch',
      command: `docker run -d --gpus all \\
  -p 8000:8000 \\
  -v /opt/models/llama-3-8b-awq:/model \\
  vllm/vllm-openai:latest \\
  --model /model \\
  --quantization awq \\
  --kv-cache-dtype int4 \\
  --max-model-len 4096 \\
  --max-num-seqs 8 \\
  --gpu-memory-utilization 0.85`,
      notes: 'Runs inside a single Cisco C245 M8 server on 1x L40S PCIe GPU. Completely disconnected from external networks.'
    }
  },
  'ent-agent-tool-use': {
    title: 'Multi-Step Tool-Use / Function-Calling Agent',
    summary: 'Autonomous agent execution loops continually calling APIs, validating schemas, and reasoning across multi-turn workflows.',
    introduction: [
      'Tool-use and function-calling agents represent the evolutionary shift from passive conversational chatbots to active software workers. Rather than simply responding to questions, an agent operates in an autonomous loop: evaluating user intent, examining a catalog of available API functions (e.g. querying Salesforce, reading SQL databases, or dispatching webhooks), executing tool calls, and analyzing the results to decide the next action.',
      'From an infrastructure perspective, this workload features two unique characteristics. First, the prompt-to-generation ratio is inverted: agents generate extensive hidden reasoning tokens before outputting a brief tool call. Second, the system prompt and tool definitions remain identical across dozens of turns—making Automatic Prefix Caching (APC) in GPU memory the primary lever for keeping compute latency and costs low.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Hardware API Gateway (Kong/Apigee)'
    },
    rationale: {
      silicon: 'Multi-step agent loops emit extensive hidden reasoning tokens before executing tool calls. The prompt/generation split is inverted: 40% prompt, 60% generation. This heavy autoregressive decode phase is strictly memory-bandwidth bound. Cisco C885A with 8x H200 delivers 4.8 TB/s HBM3e bandwidth per GPU, keeping decode velocity above 45 tokens/second.',
      memory: 'Agent workflows maintain constant system instructions, API function descriptions, and JSON schemas across all turns. Automatic Prefix Caching (APC) is configured at 60%, yielding massive VRAM savings by caching the shared tool catalog in a radix tree. Speculative decoding is enabled to accelerate repetitive JSON and code bracket syntax generation by 1.8x.',
      ancillary: 'Ingress employs an enterprise API Gateway (Kong/Apigee class) with rate-limiting, mTLS authentication, and token quota enforcement. RAG uses Qdrant (10 QPS) with BGE-Large embeddings. Guardrails enforce both input prompt sanitization and output tool-execution safety via Llama-Guard-3 8B.',
      tradeoff: 'Prioritizes high prefix caching hit rates and memory bandwidth over raw batch throughput, optimizing for multi-turn agent response latency.',
      modelSelection: 'LLaMA 3.3 70B scores near the top of the Berkeley Function Calling Leaderboard (BFCL). It demonstrates rigid adherence to JSON output schemas, parameter types, and API calling syntax without dropping required fields.',
      modelAlternatives: [
        {
          name: 'NVIDIA Llama-3.1-Nemotron-70B-Instruct',
          specs: '70.6B Dense, 128k Context, SteerLM Aligned',
          pros: 'Exceptional system prompt adherence and multi-turn constraint stability across deep agent reasoning trees. High reliability in tool output parsing.',
          cons: 'Same VRAM footprint as LLaMA 3.3 70B; can generate more conversational chain-of-thought tokens unless prompt tokens are strictly constrained.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, 128k Context',
          pros: 'Exceptional tool-calling reliability; often outperforms LLaMA on complex nested JSON arguments and error-recovery re-prompts.',
          cons: 'Slightly higher intermediate dimension and memory footprint.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense, Native Tool-Use API',
          pros: 'Designed from the ground up for multi-step tool execution with built-in multi-turn tool verification.',
          cons: 'Requires ~34GB more weight memory in FP8, reducing concurrent agent stream capacity.'
        },
        {
          name: 'Mistral Large 2 (123B)',
          specs: '123B Dense, Native Function Calling',
          pros: 'High tool reliability across complex enterprise ERP/CRM APIs and multi-step tool graphs.',
          cons: 'Higher compute and memory requirements per forward step.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Ignoring Radix Prefix Caching on Function Catalogs',
        mistake: 'Re-transmitting 3,000+ tokens of static JSON API schemas on every turn without prefix caching enabled.',
        impact: 'Every tool-call evaluation forces a full prompt re-prefill, adding 200ms to 400ms of unnecessary latency per action step.',
        remediation: 'Enable Radix Tree prefix caching in vLLM (--enable-prefix-caching). Tool schemas are cached once and reused across all agent turns.'
      },
      {
        title: 'Unbounded Tool Return Scratchpad Accumulation',
        mistake: 'Injecting raw, verbose 10k-token JSON API responses directly into conversation history without client-side pruning.',
        impact: 'The context window balloons to 32k tokens in just 3 turns, quickly exhausting GPU KV cache and triggering request eviction.',
        remediation: 'Implement client-side JSON sanitization to extract only relevant fields, capping tool return payloads to <= 1,000 tokens.'
      },
      {
        title: 'Unguided JSON Generation Crashes',
        mistake: 'Relying purely on natural-language system prompts to generate JSON tool calls without constrained decoding.',
        impact: 'The model occasionally emits preamble text or malformed JSON brackets, causing the downstream API client to crash.',
        remediation: 'Utilize constrained grammars or native function-calling parsers (--tool-call-parser llama3_json) to guarantee valid JSON.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Tool-Calling Engine',
      commandTitle: 'Production Tool-Calling Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --enable-auto-tool-choice \\
  --tool-call-parser llama3_json \\
  --max-model-len 32768 \\
  --max-num-seqs 64 \\
  --gpu-memory-utilization 0.92 \\
  --port 8000`,
      notes: 'Requires 8x H200 (141GB) SXM5 GPUs. Native JSON tool parser guarantees 100% schema-compliant API dispatches.'
    }
  },
  'ent-agent-swe': {
    title: 'Autonomous Coding / SWE Agent',
    summary: 'Long-running, stateful agent sessions running edit-compile-test loops over whole repositories with context expanding to 131k.',
    introduction: [
      'Autonomous Software Engineering (SWE) agents represent the most context-intensive workload in enterprise computing. Unlike inline coding copilots that suggest single lines of code, an autonomous SWE agent is assigned complex software issues: analyzing a git repository, reproducing a bug, modifying multiple files, running test suites, and inspecting compiler outputs.',
      'Because these agent sessions remain active for minutes or hours, terminal outputs and git diffs accumulate continuously, causing conversation context to balloon toward 131,072 tokens. Sizing this infrastructure requires massive GPU memory to prevent active sessions from running out of memory (OOM), combined with NVMe storage offloading to hibernate dormant agent sessions while long unit test suites run.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB'
    },
    rationale: {
      silicon: 'Autonomous coding agents maintain multi-hour stateful sessions while reading stack traces, running unit tests, and rewriting files. Context window expands continuously toward 131k tokens. Populated with 8x H200 SXM5 GPUs (1,128GB aggregate VRAM) on Cisco C885A to hold long-context KV states without constant CPU paging.',
      memory: 'At 131k context, KV cache footprint threatens cluster stability. The calculator enforces FP8 KV cache and enables KV Cache Offload to VAST NVMe storage, allowing dormant agent sessions to hibernate during external test suite execution. 50% APC ratio captures static codebase state across iterative compiler runs.',
      ancillary: 'RAG uses GTE-Large-EN v1.5 with 256-token chunking and Qdrant (12 QPS) for fast semantic symbol retrieval. Ingress uses Envoy software load balancing. Guardrails are active for code security and secret leakage prevention.',
      tradeoff: 'Requires massive 141GB HBM3e GPUs and NVMe KV offload to tolerate multi-hour 131k context ballooning without dropping concurrent developer sessions.',
      modelSelection: 'Qwen 2.5 72B achieves top-tier results on SWE-bench Verified (surpassing 40% with modern agent harnesses). It handles long codebase contexts with high precision during multi-file editing and automated debugging.',
      modelAlternatives: [
        {
          name: 'Qwen 2.5 Coder 32B',
          specs: '32.8B Dense, 128k Context',
          pros: 'Faster token generation and lower KV cache memory. Allows running multiple parallel coding agent swarms on the same hardware.',
          cons: 'Slightly less comprehensive multi-file architecture refactoring compared to 72B.'
        },
        {
          name: 'DeepSeek R1 / V3 (671B MoE)',
          specs: '671B MoE (37B active)',
          pros: 'Exceptional competitive programming and bug localization reasoning via chain-of-thought.',
          cons: '671B memory footprint requires massive aggregate memory across multi-node clusters.'
        },
        {
          name: 'Meta LLaMA 3.3 70B',
          specs: '70.6B Dense, 128k Context',
          pros: 'Strong code reasoning and high general documentation capability.',
          cons: 'Slightly lags Qwen on multi-language syntax and long AST symbol resolution.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Holding GPU Memory During Unit Test Runs',
        mistake: 'Leaving 131k token KV cache resident in HBM while the agent sits idle waiting for external compilation or test execution.',
        impact: 'Ties up 26GB+ of VRAM per session during non-inference idle periods, preventing other software engineers from launching tasks.',
        remediation: 'Configure hierarchical KV cache offloading to NVMe flash storage, allowing dormant agent sessions to page out during external test execution.'
      },
      {
        title: 'Single-Turn Context Reset in Debug Loops',
        mistake: 'Resetting the context window between compiler test failures to save memory.',
        impact: 'The agent loses previous debugging hypotheses and test traces, entering infinite loops repeating the identical failed patch.',
        remediation: 'Maintain a 64k to 131k context window with chunked prefill to preserve complete historical debug and patch iteration context.'
      },
      {
        title: 'Unsandboxed Code Execution in Inference Space',
        mistake: 'Running agent-generated bash commands in the same execution environment as the vLLM serving container.',
        impact: 'A malformed agent command can consume host CPU/RAM or corrupt model weight directories.',
        remediation: 'Isolate all compiler and bash test runs inside ephemeral microVMs (Firecracker) or gVisor sandboxes.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Stateful SWE Runtime',
      commandTitle: 'Production Long-Context SWE Command',
      command: `vllm serve Qwen/Qwen2.5-72B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --gpu-memory-utilization 0.95 \\
  --port 8000`,
      notes: 'Requires 8x H200 SXM5 GPUs. Enforces 8k chunked prefill to prevent activation OOM spikes across multi-file code diffs.'
    }
  },
  'ent-agent-deep-research': {
    title: 'Deep Research / Multi-Hop Web Agent',
    summary: 'Iterative multi-source investigation scraping and synthesizing tens of raw web sources with low cache reuse.',
    introduction: [
      'Deep research agents conduct multi-hop investigations into complex technical, market, or legal subjects by iteratively searching the web, reading long raw HTML pages, and refining queries based on initial findings. Unlike traditional search that returns blue links, a research agent actively crawls dozens of primary sources and synthesizes a comprehensive briefing.',
      'Architecturally, this workload is dominated by heavy prefill computing with virtually zero prefix cache reuse: every web page scraped introduces unpredictable, novel text. Because the model must evaluate source credibility, resolve factual contradictions, and compose a coherent multi-page report, this archetype demands a flagship 123B+ parameter dense model paired with large context memory.'
    ],
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
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'API Gateway'
    },
    rationale: {
      silicon: 'Deep research requires top-tier reasoning to synthesize conflicting source material. Mistral Large 2 (123B dense parameters) is chosen. At FP8, 123B weights require ~125GB VRAM. Distributed across 8x H200 GPUs (15.6GB/GPU weights), leaving over 110GB per GPU for the immense 131k prompt prefill activations.',
      memory: 'Web research is prefill-dominated (85% prompt, 15% synthesis). Because each search hop scrapes new, unpredictable web URLs, Automatic Prefix Caching drops to 15% (only the base system prompt is reused). Chunked prefill is mandatory to prevent massive 100k-token web dumps from stalling active decode streams.',
      ancillary: 'RAG uses NV-Embed-v2 (Mistral-7B based) with 1,024-token chunking to maintain semantic coherence across long web articles, backed by Milvus. Storage uses VAST Universal with 8+3 erasure coding. Granite Guardian 3 8B enforces input/output hallucination and safety validation.',
      tradeoff: 'Employs a frontier 123B model with low cache hit rates, prioritizing multi-source synthesis quality over high stream concurrency.',
      modelSelection: 'Mistral Large 2 (123B) provides the high intellectual capacity needed to synthesize conflicting source material, resolve ambiguity, and write authoritative, publication-grade research reports.',
      modelAlternatives: [
        {
          name: 'DeepSeek R1 (671B MoE)',
          specs: '671B MoE (37B active)',
          pros: 'Revolutionary "chain-of-thought" deep reasoning; uncovers subtle correlations and contradictions across disparate documents.',
          cons: '671B weight footprint requires multi-node or B200 deployment.'
        },
        {
          name: 'Meta LLaMA 3.1 (405B)',
          specs: '405B Dense, 128k Context',
          pros: 'Frontier open dense model with unmatched encyclopedic world knowledge and synthesis depth.',
          cons: 'Requires 4 to 8 nodes in FP8, making it cost-prohibitive for internal departmental research loops.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, 128k Context',
          pros: 'Lower memory footprint, faster prefill processing of web scrapes.',
          cons: 'Slightly less depth on long, unstructured essay and multi-source report synthesis compared to 123B+.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Injecting Raw Unfiltered HTML DOM Noise',
        mistake: 'Passing raw web scrapes (including script tags, tracking pixels, and CSS) directly into the 131k context window.',
        impact: 'Wastes up to 80% of prompt tokens on useless markup, forcing early context eviction and slowing prefill ingestion by 5x.',
        remediation: 'Sanitize all scraped web content with an HTML-to-markdown text extractor (e.g. Trafilatura or readability-lxml) prior to LLM ingest.'
      },
      {
        title: 'Monolithic Prefill of 100k+ Web Dumps',
        mistake: 'Ingesting 100,000+ tokens of scraped articles in a single unchunked forward prefill step.',
        impact: 'Triggers transient activation memory spikes that cause sudden CUDA OOMs and stalls concurrent research streams.',
        remediation: 'Enable Chunked Prefill (--enable-chunked-prefill) with a bounded 8k batch limit to smooth memory allocation.'
      },
      {
        title: 'Assuming High Cache Hit Ratios on Web Research',
        mistake: 'Sizing cluster memory expecting a 50% prefix cache reuse on unpredictable multi-hop web searches.',
        impact: 'Novel web pages yield near-zero prefix reuse, causing unexpected memory pressure and queuing delays.',
        remediation: 'Size memory conservatively assuming <= 15% prefix reuse, scaling Data Parallelism to absorb true raw token prefill volume.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Deep Research Engine',
      commandTitle: 'Production Frontier 123B Serving Command',
      command: `vllm serve mistralai/Mistral-Large-Instruct-2407 \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --gpu-memory-utilization 0.94 \\
  --port 8000`,
      notes: 'Requires 8x H200 (141GB) SXM5 GPUs. Chunked prefill guarantees stable 131k prompt processing across unstructured web research reports.'
    }
  },
  'ent-agent-multi-orchestration': {
    title: 'Multi-Agent Orchestration (Planner + Worker Swarm)',
    summary: 'A hierarchical orchestration pattern fanning sub-tasks out to 1,000+ lightweight workers executing in parallel.',
    introduction: [
      'Multi-agent swarm orchestration organizes enterprise AI into an executive hierarchy. An intelligent "Planner" agent analyzes a complex business request (e.g. processing an insurance portfolio), breaks it down into hundreds of discrete subtasks, and dispatches them simultaneously to a swarm of lightweight "Worker" agents executing micro-tasks.',
      'In this architecture, infrastructure sizing is completely inverted. While the central planner requires deep reasoning, the worker swarm accounts for 95% of aggregate hardware demand due to extreme concurrency. Sizing this system focuses on maximizing worker density: deploying cost-efficient PCIe GPUs running small 8B models across distributed Ray execution clusters.'
    ],
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
      tradeoff: 'Decouples orchestration into a two-tier hardware strategy: cheap, dense L40S GPUs handle the 1,024-worker swarm, leaving complex planning to an isolated high-end instance.',
      modelSelection: 'LLaMA 3.1 8B provides sub-20ms per token decode speeds for high-volume, simple subtasks (summarize snippet, extract date, validate email), enabling massive swarm concurrency via Ray.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (7B)',
          specs: '7.6B Dense, Apache 2.0',
          pros: 'Matches or exceeds LLaMA 3 8B on tool-calling, math, and structured output extraction sub-tasks.',
          cons: 'Similar execution speed and memory requirements.'
        },
        {
          name: 'Microsoft Phi-3.5 Mini (3.8B)',
          specs: '3.8B Dense, 128k Context',
          pros: 'Ultra-fast inference velocity; allows hosting 2x the concurrent worker instances per GPU compared to 8B.',
          cons: 'Smaller knowledge base for diverse worker assignments.'
        },
        {
          name: 'Meta LLaMA 3.3 70B (as Planner)',
          specs: '70.6B Dense, 128k Context',
          pros: 'In a complete hierarchical architecture, LLaMA 3.3 70B operates as the central Planner node, coordinating the 8B worker swarm.',
          cons: 'Too expensive to use for the 1,024-worker fan-out execution pool.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Hosting Worker Swarms on Premium HGX SXM Silicon',
        mistake: 'Provisioning multi-million dollar 8x H100 SXM servers for a 1,000+ worker swarm executing basic validation tasks.',
        impact: 'Wastes 80% of accelerator investment on unneeded inter-GPU NVLink bandwidth for independent 8B worker tasks.',
        remediation: 'Deploy high-density Cisco C245 PCIe servers running independent TP=1 worker instances, horizontally orchestrated via Ray Core.'
      },
      {
        title: 'Unthrottled Swarm Fan-Out Burst Floods',
        mistake: 'Dispatching 1,000 subtasks simultaneously from the Planner without client-side semaphore queue management.',
        impact: 'Crashes ingress API gateways and triggers connection timeouts across distributed worker nodes.',
        remediation: 'Implement bounded concurrency pools in Ray or Celery, matching dispatch rates to provisioned Data Parallel replica capacity.'
      },
      {
        title: 'Redundant Ingestion of Worker Role Prompts',
        mistake: 'Sending full 1,000-token role instructions with every micro-worker dispatch without prefix caching.',
        impact: 'Multiplies compute prefill volume by 1,000x across the cluster, inflating cluster electricity and queue latency.',
        remediation: 'Standardize worker prompt headers and enable Radix Tree caching so role definitions are cached once per worker GPU.'
      }
    ],
    engineRecipe: {
      framework: 'Ray Core + vLLM Worker Pool',
      commandTitle: 'Production Swarm Worker Daemon Command',
      command: `vllm serve meta-llama/Meta-Llama-3-8B-Instruct \\
  --tensor-parallel-size 1 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 8192 \\
  --max-num-seqs 64 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'Runs at TP=1 on individual L40S PCIe GPUs. Ray workers connect locally over localhost:8000 on each distributed node.'
    }
  },
  'ent-agent-sql-analysis': {
    title: 'Data / SQL Analysis Agent',
    summary: 'Iterative natural-language-to-SQL refinement over enterprise data warehouse schemas (Snowflake, BigQuery).',
    introduction: [
      'The Data and SQL Analysis agent bridges business users and enterprise data warehouses. Rather than requiring analysts to write manual SQL queries, the agent accepts natural-language questions, inspects relational table schemas, identifies foreign key relationships, constructs the query, executes it, and formats the output into executive charts and summaries.',
      'The primary failure mode in text-to-SQL is subtle logical hallucination: generating queries with missing join conditions, incorrect group-bys, or invalid date filters that yield misleading numbers or trigger runaway cloud database compute bills. Preventing this demands a high-parameter 70B model with a 16k context window to ingest rich catalog metadata, table descriptions, and foreign key definitions.'
    ],
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
      hadr: 'Disabled (Internal Tool)',
      ingress: 'Disabled (Internal Tool)'
    },
    rationale: {
      silicon: 'Generating production SQL over 50-table schemas requires 70B-class reasoning to prevent hallucinated joins and syntax errors. Cisco C885A with 8x H200 provides the necessary TP=8 NVLink fabric to deliver snappy query synthesis for 48 concurrent business analysts.',
      memory: '16k context window comfortably holds DDL table schemas, column foreign-key relationships, and sample query rows. 30% APC ratio caches the enterprise data catalog schema across iterative user query refinements.',
      ancillary: 'Storage uses NetApp AFF with 8+3 erasure coding. Guardrails are disabled because database access is governed strictly by relational database row-level security (RLS) and database permissions rather than LLM text filters.',
      tradeoff: 'Balances schema context capacity (16k) and 48-stream concurrency against a single-node H200 footprint.',
      modelSelection: 'LLaMA 3.3 70B demonstrates deep semantic comprehension of SQL joins, subqueries, dialect specifics (PostgreSQL, Snowflake, BigQuery), and schema ambiguity, preventing costly Cartesian products.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense',
          pros: 'Industry-leading scores on Spider and BIRD text-to-SQL benchmarks, particularly adept at complex recursive CTEs and nested subqueries.',
          cons: 'Slightly higher memory consumption.'
        },
        {
          name: 'Defog SQLCoder (70B)',
          specs: '70B Dense, Fine-Tuned SQL Specialist',
          pros: 'Fine-tuned explicitly on enterprise SQL databases; outperforms generic models on complex database syntax.',
          cons: 'Lacks general conversational capability for explaining analytical findings to non-technical business users.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense',
          pros: 'Strong RAG grounding for looking up table metadata and column descriptions, with verifiable citation back to data dictionaries.',
          cons: 'Requires 104GB FP8 weight VRAM.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Omitting Relational Constraints and Foreign Keys from Schema',
        mistake: 'Providing only raw table names and column names to the LLM without explicit primary/foreign key relationships.',
        impact: 'The model hallucinates join paths across unrelated tables, generating invalid SQL queries or cross-joins that stall database compute.',
        remediation: 'Provide rich DDL schemas with explicit constraint definitions and enum dictionaries in the 16k context window.'
      },
      {
        title: 'Direct Execution Against Production Transactional Databases',
        mistake: 'Executing LLM-generated SQL queries directly against production OLTP database clusters.',
        impact: 'A query with a missing WHERE filter or unindexed table scan can lock production database tables and cause user-facing service outages.',
        remediation: 'Route all agent queries strictly to a read-only analytics replica with query timeout caps (e.g. 15s) and row return limits.'
      },
      {
        title: 'Re-transmitting Schemas on Every Turn Without APC',
        mistake: 'Sending 10,000 tokens of enterprise data catalog schemas on every single conversation turn without prefix caching.',
        impact: 'Forces constant re-prefill of static schemas, inflating query response latency by 3x.',
        remediation: 'Enable Radix Tree prefix caching in vLLM so the corporate database schema is cached once and shared across all business analysts.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM SQL Specialist Runtime',
      commandTitle: 'Production Text-to-SQL Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 16384 \\
  --max-num-seqs 64 \\
  --gpu-memory-utilization 0.92 \\
  --port 8000`,
      notes: 'Requires 8x H200 SXM5 GPUs. High prefix caching ratio retains complex corporate data warehouse schemas in VRAM.'
    }
  },
  'neo-frontier-pretrain': {
    title: 'Frontier Pretraining Run (1,000+ GPUs)',
    summary: 'Hyperscale foundation model pretraining run for a 405B dense model across liquid-cooled Blackwell clusters on InfiniBand.',
    introduction: [
      'Frontier pretraining represents the absolute peak of AI systems engineering: training a 400B+ parameter foundation model from scratch across thousands of tightly synchronized accelerators running continuously for months. At this hyperscale, hardware faults are a daily statistical reality, and any networking bottleneck or storage delay can stall thousands of GPUs, wasting millions of dollars in idle compute.',
      'Sizing a 1,000+ GPU cluster demands non-blocking Quantum-2 InfiniBand networks with full bisection bandwidth, advanced liquid cooling to manage 1,200W+ Blackwell chips at a Power Usage Effectiveness (PUE) of 1.15, and parallel NVMe storage filesystems capable of saving multi-terabyte checkpoints in under three minutes without pausing backpropagation.'
    ],
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
      tradeoff: 'Pure, uncompromised compute density and network bisection bandwidth. The entire architecture is optimized for sustained Model FLOPs Utilization (MFU > 45%) across 1,000+ GPUs.',
      modelSelection: 'LLaMA 3.1 405B is the premier open-weights dense flagship model in existence (405.0B parameters, 126 layers, 16,384 hidden dimension). Training at 1,024+ GPU scale requires massive InfiniBand bisection and WekaFS parallel storage.',
      modelAlternatives: [
        {
          name: 'NVIDIA Nemotron-4 340B (Base / Instruct)',
          specs: '340B Dense, 96 Layers, 18,432 Hidden, 8 GQA Heads',
          pros: 'Purpose-built for enterprise Synthetic Data Generation (SDG). Fully permissive NVIDIA Open Model License allows commercial distillation into proprietary domain models.',
          cons: 'Requires ~340GB VRAM at FP8 (680GB at FP16). Shorter native context (4k base) requires context-extension RoPE fine-tuning if used for long documents.'
        },
        {
          name: 'DeepSeek-V3 (671B MoE)',
          specs: '671B Total, 37B Active per Token',
          pros: 'Drastically lower training compute (O(P_active)) for equivalent or superior benchmark reasoning. Highly attractive for neo-clouds seeking frontier capabilities with lower energy costs.',
          cons: 'Dynamic expert all-to-all communication requires sophisticated NCCL collective tuning.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense',
          pros: 'Much faster pretraining completion time and lower cluster failure surface on a 1,024-GPU fabric.',
          cons: 'Lower absolute frontier ceiling compared to 405B+ models.'
        },
        {
          name: 'Mistral Large 2 (123B)',
          specs: '123B Dense, 128k Context',
          pros: 'Intermediate dense pretraining milestone between 70B and 405B.',
          cons: 'Requires custom architecture pipeline tuning.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Silent Optical Transceiver Degradation',
        mistake: 'Operating 1,024 GPUs across 8,000+ optical transceivers without proactive BER (Bit Error Rate) telemetry.',
        impact: 'A single degraded optical link drops packets intermittently, causing NCCL All-Reduce timeouts or gradient NaN spikes that invalidate days of training.',
        remediation: 'Deploy automated fabric telemetry (NVIDIA SHARP / NetQ) to quarantine degraded links and reboot nodes prior to job launch.'
      },
      {
        title: 'Synchronous Storage Incast During Checkpoints',
        mistake: 'Triggering simultaneous unthrottled checkpoint writes across all 1,024 GPUs to a single storage target.',
        impact: 'Creates network switch buffer overflow, triggering PFC pause storms that freeze the entire training fabric.',
        remediation: 'Stagger checkpoint writes across Data Parallel ranks and deploy parallel filesystems (WekaFS) with kernel-bypass RDMA storage clients.'
      },
      {
        title: 'Excessive Pipeline Bubbles on Dense 405B',
        mistake: 'Configuring deep Pipeline Parallelism (PP=8 or PP=16) with small micro-batch sizes.',
        impact: 'The pipeline bubble idle time fraction (PP - 1) / (PP + num_microbatches - 1) exceeds 25%, idling hundreds of GPUs.',
        remediation: 'Leverage 180GB Blackwell B200 memory to minimize PP stages (PP <= 2) and utilize 1F1B interleaved pipeline schedules.'
      }
    ],
    engineRecipe: {
      framework: 'Megatron-LM / NeMo Framework 2.0',
      commandTitle: '1,024-GPU Distributed Pretraining Command',
      command: `torchrun --nproc_per_node=8 --nnodes=128 \\
  --rdzv_id=pretrain_405b \\
  --rdzv_backend=c10d \\
  --rdzv_endpoint=head-node.cluster.local:29500 \\
  pretrain_gpt.py \\
  --tensor-model-parallel-size 8 \\
  --pipeline-model-parallel-size 1 \\
  --num-layers 126 \\
  --hidden-size 16384 \\
  --num-attention-heads 128 \\
  --seq-length 8192 \\
  --micro-batch-size 4 \\
  --global-batch-size 2048 \\
  --bf16`,
      notes: 'Executes across 128x HGX B200 nodes (1,024 GPUs) connected via 3.2 Tbps Quantum-2 InfiniBand. All-Flash WekaFS stores checkpoints.'
    }
  },
  'neo-maas-inference': {
    title: 'Model-as-a-Service Inference at Scale',
    summary: 'Public API hosting DeepSeek R1 671B MoE for 4,000+ concurrent streams backed by MLA and Edge CDN.',
    introduction: [
      'Operating a public Model-as-a-Service (MaaS) API—hosting open-weights frontier models like DeepSeek R1 for thousands of paying third-party tenants—is governed by razor-thin unit economics and unpredictable burst traffic. Operators cannot afford the high compute overhead of traditional dense models when competing on pennies per million tokens.',
      'This blueprint utilizes DeepSeek R1\'s sparse Mixture-of-Experts (MoE) architecture: while all 671 billion weights remain resident in memory, only 37 billion active parameters compute on any single token. Combined with Multi-Head Latent Attention (MLA) which compresses the KV cache footprint by 4.66x, the architecture serves over 4,000 concurrent streams at unprecedented operational margins.'
    ],
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
      tradeoff: 'Accepts massive cluster VRAM commitment (holding 671B weights per replica) to unlock the revolutionary token economics and low per-token compute of DeepSeek MoE.',
      modelSelection: 'DeepSeek R1 / V3 revolutionizes public Model-as-a-Service economics. With 671B total weights and 37B active parameters, it provides frontier reasoning at 1/5th the compute cost of dense models.',
      modelAlternatives: [
        {
          name: 'Meta LLaMA 3.1 (405B Dense)',
          specs: '405B Dense, 128k Context',
          pros: 'Pure dense architecture with zero routing uncertainty.',
          cons: 'Every token computes all 405B parameters, demanding ~10x more compute per token and resulting in significantly higher public API cost-per-token.'
        },
        {
          name: 'Mistral Mixtral 8x22B (141B MoE)',
          specs: '141B Total, 39B Active',
          pros: 'Smaller MoE footprint that can be deployed on smaller regional clusters.',
          cons: 'Lower mathematical reasoning and complex instruction-following than DeepSeek R1.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense',
          pros: 'Dense, highly reliable fallback for MaaS providers with lower VRAM barrier.',
          cons: 'Lacks DeepSeek R1 breakthrough chain-of-thought mathematical reasoning.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'MoE Expert Imbalance & Straggler Latency',
        mistake: 'Allowing popular prompt topics to route 80% of tokens to a narrow set of "hot" experts.',
        impact: 'GPUs hosting the hot experts become severely overloaded while other GPUs sit idle, causing synchronous All-to-All collective latency spikes.',
        remediation: 'Deploy dynamic token dropping and expert load-balancing routing thresholds in the inference serving engine.'
      },
      {
        title: 'Serving Sparse MoE at Low Batch Concurrency',
        mistake: 'Operating DeepSeek 671B at low concurrency (batch sizes < 8).',
        impact: 'Because 37B weights must still be transferred from HBM to compute cores for each token, low batch sizes deliver terrible arithmetic intensity and high token cost.',
        remediation: 'Aggregate incoming traffic via continuous batching, maintaining sustained batch sizes >= 64 per replica to amortize expert weight loads.'
      },
      {
        title: 'Decompressing MLA Latents into VRAM',
        mistake: 'Decompressing Multi-Head Latent Attention Key/Value vectors into full multi-head representations in GPU memory before attention computation.',
        impact: 'Instantly destroys the 4.66x memory savings of MLA, causing unexpected OOM memory crashes under long contexts.',
        remediation: 'Utilize native fused MLA FlashAttention kernels that compute matrix multiplications directly inside the 576-element latent space.'
      }
    ],
    engineRecipe: {
      framework: 'TensorRT-LLM / vLLM MoE Runtime',
      commandTitle: 'Production DeepSeek R1 MoE Serving Command',
      command: `vllm serve deepseek-ai/DeepSeek-R1 \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --trust-remote-code \\
  --max-model-len 32768 \\
  --max-num-seqs 256 \\
  --gpu-memory-utilization 0.95 \\
  --port 8000`,
      notes: 'Requires 8x B200 (180GB) SXM GPUs. Full 671B MoE model fits inside a single 8-GPU chassis (TP=8, PP=1).'
    }
  },
  'neo-llmd-disaggregated': {
    title: 'Disaggregated Serving Showcase (LLM-D)',
    summary: 'Heterogeneous split: Compute-dense B200 prefill pool streaming KV cache over RoCEv2 to a memory-dense H200 decode pool.',
    introduction: [
      'Disaggregated Serving (LLM-D) is the most advanced inference topology in modern AI datacenters. In traditional shared servers, prompt processing ("Prefill") and token generation ("Decode") compete for the exact same GPU resources. When a large prompt arrives, it monopolizes the compute cores—causing noticeable stutter and latency spikes for ongoing users.',
      'LLM-D physically splits the cluster into two heterogeneous pools: compute-heavy Blackwell B200 nodes crunch incoming prompts in milliseconds, then stream the resulting Key-Value memory across a lossless 400G RoCEv2 network to memory-heavy Hopper H200 nodes that handle token generation. This architecture eliminates phase interference and delivers completely predictable, jitter-free latency SLAs.'
    ],
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
      hadr: 'Disabled (Architecture Showcase)',
      ingress: 'Disabled (Architecture Showcase)'
    },
    rationale: {
      silicon: 'Colocated serving causes severe phase interference: a sudden 32k prompt floods the Tensor Cores, stalling active token generation for ongoing users. LLM-D completely physically decouples the cluster into two distinct hardware tiers: (1) Prefill Pool: 2x NVIDIA B200 nodes delivering extreme dense FP8 Tensor FLOPs to process prompts in milliseconds. (2) Decode Pool: 8x NVIDIA H200 nodes delivering massive aggregate HBM3e capacity (9,024GB) and bandwidth to host and generate tokens for 1,024 concurrent users without jitter.',
      memory: 'Prefill nodes maintain zero persistent KV cache—they generate the attention vectors for the prompt and immediately stream the KV chunk across the network. Decode nodes hold the persistent KV cache across the full 32k context window.',
      ancillary: 'Networking is the critical system bus: Cisco Nexus 9000 400G RoCEv2 fabric streams the KV cache directly between prefill and decode GPUs via RDMA. Overlapped KV transfer is enabled, transmitting layers 1 to L-1 concurrently with compute. FP8 KV cache cuts network transfer payload by 50%, reducing transfer latency to under 9ms.',
      tradeoff: 'Introduces network-dependent KV streaming complexity in exchange for total isolation of compute and memory, delivering perfectly stable decode latency and near-zero jitter SLAs at massive scale.',
      modelSelection: 'LLaMA 3.1 405B demonstrates the peak utility of LLM-D. In colocated serving, a 405B dense prompt prefill consumes immense Tensor Core FLOPs, completely stalling decode streams. Decoupling into B200 prefill and H200 decode achieves total SLA stabilization.',
      modelAlternatives: [
        {
          name: 'DeepSeek-V3 / R1 (671B MoE)',
          specs: '671B MoE (37B active), MLA',
          pros: 'Disaggregated serving is also transformative for DeepSeek MoE, routing bursty 37B-expert prefill computation to B200 nodes while streaming low-rank MLA KV latents across RoCEv2.',
          cons: 'Requires specialized MoE all-to-all communication dispatching across the prefill pool.'
        },
        {
          name: 'Meta LLaMA 3.3 (70B)',
          specs: '70.6B Dense, 128k Context',
          pros: 'Validates LLM-D on a smaller cluster footprint (e.g. 1 prefill node and 2 decode nodes).',
          cons: 'Phase interference latency penalty is less dramatic than on 405B.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Lossy Ethernet KV Transfer & PFC Deadlocks',
        mistake: 'Streaming gigabytes of KV cache chunks over unconfigured, standard enterprise Ethernet switches.',
        impact: 'Buffer oversubscription causes packet drops and PFC pause storms, turning a 9ms RDMA transfer into a 500ms network timeout stall.',
        remediation: 'Deploy a dedicated lossless RoCEv2 fabric with Cisco Nexus 9000 switches enforcing DCQCN congestion control and hardware ECN.'
      },
      {
        title: 'Sequential (Non-Overlapped) KV Cache Transfer',
        mistake: 'Waiting for all 126 transformer layers of prefill compute to finish before starting KV network transmission.',
        impact: 'Adds 20ms to 40ms of dead latency to every user request, eroding the latency advantages of disaggregation.',
        remediation: 'Enable layer-by-layer overlapped KV transfer, pipelining RDMA transfer of layer l concurrently with GPU computation of layer l+1.'
      },
      {
        title: 'Prefill-to-Decode Sizing Mismatch',
        mistake: 'Over-provisioning decode nodes while under-provisioning prefill nodes without dynamic routing.',
        impact: 'Prefill nodes hit 100% saturation and queue incoming requests, while expensive decode GPUs sit idle waiting for KV tokens.',
        remediation: 'Use the calculator to balance the exact prefill-to-decode node ratio (typically 1:4 to 1:6 for 70/30 prompt/gen workloads).'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Disaggregated Serving Architecture (LLM-D)',
      commandTitle: 'Production LLM-D Node Launch Commands',
      command: `# 1. Launch Prefill Worker (Blackwell B200):
vllm serve meta-llama/Llama-3.1-405B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --kv-transfer-role prefill \\
  --kv-transfer-protocol rocev2 \\
  --kv-transfer-endpoint 10.0.1.50:9000 \\
  --port 8000

# 2. Launch Decode Worker (Hopper H200):
vllm serve meta-llama/Llama-3.1-405B-Instruct \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --kv-transfer-role decode \\
  --kv-transfer-protocol rocev2 \\
  --kv-transfer-endpoint 10.0.1.50:9000 \\
  --port 8001`,
      notes: 'Prefill nodes process input prompts in milliseconds on B200 and stream KV latents over 400G RoCEv2 to H200 decode workers.'
    }
  }
};

const CORE_CONTENT = {
  'chap-1-memory': {
    title: 'Model Weights & Precision Math',
    subtitle: 'Silicon memory bounds, numerical datatypes, and unquantized head overhead.',
    introduction: 'When sizing an AI cluster, the very first physical constraint you encounter is accelerator memory capacity. Before a model can process a single token or serve a single user, its entire parameter matrix must reside in GPU High Bandwidth Memory (HBM). If a model requires 140GB of memory and your GPU only has 80GB, the system simply cannot boot without multi-GPU sharding or precision compression. Understanding how parameter counts translate into physical gigabytes—and how precision formats like FP16, FP8, and INT4 trade memory space against mathematical accuracy—is the foundational calculation of all AI hardware sizing.',
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
    introduction: 'While model weights occupy a static, fixed footprint in GPU memory, conversation memory is completely dynamic and elastic. Large language models generate text autoregressively (one word at a time); to keep the conversation coherent, they store mathematical representations of all previous words in a buffer called the Key-Value (KV) cache. For short queries, this cache is negligible. But at enterprise context lengths (32k to 128k tokens) across dozens of concurrent users, the KV cache rapidly outgrows the model itself—frequently causing sudden Out-of-Memory (OOM) cluster crashes.',
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
    introduction: 'Modern frontier AI models and high-concurrency workloads rarely fit within the memory boundaries of a single accelerator. To run enterprise models at scale, the workload must be sharded across a cluster along three orthogonal dimensions: splitting the matrix calculations of an individual layer across GPUs within a server (Tensor Parallelism), distributing consecutive layers across servers in a rack (Pipeline Parallelism), or duplicating the model across servers to absorb more simultaneous users (Data Parallelism). The golden rule of sharding is latency minimization: operations requiring intense synchronization must stay on copper NVLink inside a chassis, while looser synchronization can cross network fabrics.',
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
    introduction: 'Serving an AI model involves two fundamentally conflicting computational phases: reading the incoming prompt (the "Prefill" phase) and generating the output tokens one by one (the "Decode" phase). Prefill is compute-bound, saturating GPU Tensor Cores with dense matrix operations. Decode is memory-bound, requiring huge High Bandwidth Memory throughput to read weights for every single token produced. When both phases share the same GPUs, an incoming 50-page document monopolizes the cores, introducing severe latency jitter for ongoing users. Disaggregated Serving (LLM-D) physically separates these pools, passing conversation states across high-speed 400G network fabrics.',
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
    introduction: 'Building an enterprise AI cluster is as much an exercise in electrical and thermal engineering as it is in software. Standard corporate datacenters connect servers to shared top-of-rack switches—a design that immediately causes network congestion when hundreds of GPUs attempt to synchronize their calculations simultaneously. AI clusters instead deploy "Rail-Optimized" leaf-spine networks, establishing dedicated non-blocking communication highways for each accelerator. Furthermore, because AI server chassis draw upwards of 10.2 kW each, physical rack density is governed strictly by thermal cooling boundaries and Power Usage Effectiveness (PUE).',
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
    introduction: 'In developer lab testing with a single user, response times appear snappy and predictable. But in real-world enterprise production with hundreds of users arriving at random intervals, requests inevitably queue up waiting for available GPU memory slots. Relying purely on average latency (p50) is dangerously deceptive: a cluster with an average response time of 1 second can leave 5% of users waiting 15 seconds during peak business hours. By modeling request arrival and execution through classical M/M/c (Erlang C) queueing theory, systems architects can pinpoint the exact utilization threshold where queueing times explode.',
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
  },
  'chap-7-storage': {
    title: 'Storage Architecture for AI & Durability Math',
    subtitle: 'Checkpoint write-time budgets, KV cache NVMe offloading, and raw vs usable durability multipliers.',
    introduction: 'In distributed AI training and high-scale inference, compute clusters cannot operate in isolation from persistent storage. High-performance GPUs crunch numbers at terabytes per second, but during model checkpointing, dataset pre-fetching, or KV cache swapping, the entire cluster is at the mercy of the storage fabric. Sizing storage for AI is not simply a matter of buying enough terabytes of disk space; it is a dual-dimensional constraint governed by burst write throughput and continuous read IOPS. If storage write bandwidth is under-provisioned, a 1,024-GPU cluster will sit completely idle for tens of minutes every hour waiting for checkpoint dumps to finish, burning thousands of dollars of idle compute.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          AI storage infrastructure operates under a fundamental dual constraint: <strong>Capacity (TB) vs Throughput (GB/s)</strong>.
          The provisioned Rack Units (RU) and storage enclosures must satisfy whichever requirement is larger:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Provisioned_RU = max( ⌈Required_Capacity_TB / RU_Capacity_TB⌉, ⌈Required_Throughput_GBs / RU_Throughput_GBs⌉ )
        </div>
        <p>
          High-density archival tiers (e.g. Ceph bulk object) deliver massive capacity per RU but limited bandwidth, 
          whereas parallel file systems (e.g. WekaFS, VAST Data Universal Storage, DDN Lustre) maximize sustained GB/s per RU 
          to absorb intense GPU bursts.
        </p>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">1. Distributed Training Checkpoint Write-Time Budgets</h3>
        <p>
          During frontier pretraining or full fine-tuning, every GPU periodically dumps its active state to persistent storage. 
          The checkpoint payload contains model weights plus optimizer states:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Checkpoint_Size_TB = [ (Weights_bytes + Optimizer_bytes) × DataParallel_Replicas ] / 10¹²
        </div>
        <p>
          Gradients are transient and discarded between steps, but FP32 Adam optimizer states add massive overhead:
          12 bytes/parameter in ZeRO-1/ZeRO-2 or 16 bytes/parameter in un-sharded DistributedDataParallel (DDP). 
          To prevent GPUs from sitting stalled in an I/O wait state, cluster architects establish a strict <strong>write-time budget</strong> (typically 60 to 180 seconds):
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_Write_Throughput (GB/s) = (Checkpoint_Size_TB × 1000) / Write_Time_Budget_Seconds
        </div>
        <DecisionCallout title="The Checkpoint Stall Trap">
          If a 1,024-GPU cluster generates a 40TB checkpoint dump and your storage tier only sustains 20 GB/s write throughput, the cluster hangs for 2,000 seconds (33.3 minutes). At an effective operating cost of $3.50/GPU-hour, each checkpoint dump burns nearly $2,000 in wasted idle compute. Sizing storage throughput to keep checkpoint stalls under 2 minutes is paramount.
        </DecisionCallout>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">2. Inference KV Cache NVMe Offloading Mechanics</h3>
        <p>
          In massive long-context reasoning models (32k to 128k context) or multi-tenant agent platforms, GPU HBM is often overwhelmed by inactive session KV caches. 
          Inference engines support hierarchical KV offloading to local high-speed NVMe or ultra-low-latency network flash (NVMe-oF):
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_KV_Offload_Throughput (GB/s) = (Cluster_Gen_Tok_Per_Sec × Real_Bytes_Per_Token_KV) / 10⁹
        </div>
        <p>
          This offload throughput represents the sustained streaming bandwidth required to page inactive conversation KV blocks to storage 
          without dropping token emission speeds below interactive user thresholds.
        </p>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">3. Storage Durability Overheads: Erasure Coding vs 3x Replication</h3>
        <p>
          Storage capacity must account for fault tolerance and hardware durability. While raw physical flash drives are purchased, 
          usable storage capacity is dictated by the durability scheme:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>3x Replication:</strong> Retains 3 full copies of every byte. Replication factor = 3.0. Simple to manage but forces enterprise buyers to purchase 300TB of raw flash for every 100TB of usable data (33.3% storage efficiency).</li>
          <li><strong>Erasure Coding (8+3 scheme):</strong> Splits data across 8 data chunks and 3 parity chunks. Tolerates the simultaneous loss of any 3 drives or storage nodes with an overhead multiplier of only 11/8 = 1.375× (72.7% storage efficiency).</li>
          <li><strong>Erasure Coding (16+2 scheme):</strong> Splits across 16 data chunks and 2 parity chunks. Overhead multiplier of 18/16 = 1.125× (88.9% efficiency), suited for ultra-dense petabyte-scale archives.</li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_Raw_Capacity_TB = Required_Usable_Capacity_TB × Replication_Factor
        </div>
      </div>
    )
  },
  'chap-8-silicon': {
    title: 'Silicon & Accelerator Architecture Guide',
    subtitle: 'H100, H200, B200, L40S, and MI300X physical memory, bandwidth, and compute trade-offs.',
    introduction: 'Selecting the right accelerator for an enterprise AI deployment is often reduced to a single metric: peak TFLOPs. However, in production generative AI, compute throughput is only half the story. Large language models operate in two distinct physical regimes: the compute-bound prefill phase (matrix-matrix multiplication) and the memory-bandwidth-bound decode phase (matrix-vector multiplication). An accelerator with astronomical FLOPS but inadequate memory bandwidth will starve its Tensor Cores during token generation, delivering dismal tokens-per-second per dollar. Understanding the architectural differences between NVIDIA Hopper, Blackwell, Ada Lovelace, and AMD Instinct silicon is critical to preventing costly hardware mismatches.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Every generative AI workload shifts dynamically between two physical execution bounds:
        </p>
        <ul className="list-disc pl-5 space-y-3 text-zinc-300 text-sm">
          <li>
            <strong>Prefill Phase (Prompt Ingest):</strong> Compute-bound. The GPU digests thousands of input tokens simultaneously using dense General Matrix Multiplications (GEMM). Arithmetic intensity is high (~ContextLength FLOPs/byte), fully saturating Tensor Cores.
          </li>
          <li>
            <strong>Decode Phase (Token Generation):</strong> Memory-bandwidth bound. The model emits one token per stream at a time using General Matrix-Vector operations (GEMV). The entire parameter matrix (~70GB for 70B FP8) must be fetched from HBM into the chip for <em>every single generated token</em>. Arithmetic intensity drops to ~1 FLOP/byte.
          </li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Decode_Tok_Per_Sec_Single_Stream ≈ Accelerator_HBM_Bandwidth_TBps / Model_Weight_Memory_TB
        </div>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">Accelerator Comparison Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-zinc-800 rounded-lg">
            <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[11px]">
              <tr>
                <th className="p-3 border-b border-zinc-800">Accelerator</th>
                <th className="p-3 border-b border-zinc-800">HBM Capacity</th>
                <th className="p-3 border-b border-zinc-800">Memory Bandwidth</th>
                <th className="p-3 border-b border-zinc-800">Interconnect</th>
                <th className="p-3 border-b border-zinc-800">TDP (Watts)</th>
                <th className="p-3 border-b border-zinc-800">Ideal Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-mono text-zinc-300">
              <tr className="hover:bg-zinc-900/40">
                <td className="p-3 font-semibold text-white">NVIDIA H100 SXM5</td>
                <td className="p-3 text-sky-400">80 GB HBM3</td>
                <td className="p-3">3.35 TB/s</td>
                <td className="p-3">900 GB/s NVLink 4</td>
                <td className="p-3">700W</td>
                <td className="p-3 font-sans text-xs text-zinc-300">Enterprise training &amp; standard context inference</td>
              </tr>
              <tr className="hover:bg-zinc-900/40">
                <td className="p-3 font-semibold text-white">NVIDIA H200 SXM5</td>
                <td className="p-3 text-emerald-400 font-bold">141 GB HBM3e</td>
                <td className="p-3 text-emerald-400 font-bold">4.80 TB/s (+43%)</td>
                <td className="p-3">900 GB/s NVLink 4</td>
                <td className="p-3">700W</td>
                <td className="p-3 font-sans text-xs text-zinc-300">Long-context 70B serving &amp; multi-stream RAG</td>
              </tr>
              <tr className="hover:bg-zinc-900/40">
                <td className="p-3 font-semibold text-white">NVIDIA B200 (Blackwell)</td>
                <td className="p-3 text-purple-400 font-bold">192 GB HBM3e</td>
                <td className="p-3 text-purple-400 font-bold">8.00 TB/s (+138%)</td>
                <td className="p-3 text-purple-400">1,800 GB/s NVLink 5</td>
                <td className="p-3 text-amber-400">1000W</td>
                <td className="p-3 font-sans text-xs text-zinc-300">Frontier pretraining, NVFP4 inference, MoE models</td>
              </tr>
              <tr className="hover:bg-zinc-900/40">
                <td className="p-3 font-semibold text-white">NVIDIA L40S (PCIe)</td>
                <td className="p-3 text-amber-400">48 GB GDDR6</td>
                <td className="p-3 text-red-400 font-bold">0.864 TB/s (4x lower)</td>
                <td className="p-3 text-red-400">PCIe Gen5 (64 GB/s)</td>
                <td className="p-3">350W</td>
                <td className="p-3 font-sans text-xs text-zinc-300">Vector embeddings, vision encoders, 8B models</td>
              </tr>
              <tr className="hover:bg-zinc-900/40">
                <td className="p-3 font-semibold text-white">AMD Instinct MI300X</td>
                <td className="p-3 text-sky-400 font-bold">192 GB HBM3</td>
                <td className="p-3 text-sky-400 font-bold">5.30 TB/s</td>
                <td className="p-3">896 GB/s Infinity Fabric</td>
                <td className="p-3">750W</td>
                <td className="p-3 font-sans text-xs text-zinc-300">Single-node 70B FP16 &amp; dense MoE inference</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DecisionCallout title="The L40S PCIe Inference Fallacy">
          Hardware procurement teams often look at the L40S: it has impressive FP8 Tensor TFLOPs and costs significantly less than an H100. However, the L40S uses GDDR6 memory with only 864 GB/s bandwidth—almost 4x slower than H100 SXM5 (3,350 GB/s)—and lacks NVLink. Attempting to run 70B parameter models across L40S cards yields painful decode token latencies and severe inter-card PCIe communication bottlenecks. Reserve L40S for compute-bound embeddings (BGE-Large), vision encoders (CLIP), or small 8B models.
        </DecisionCallout>
      </div>
    )
  },
  'chap-9-tco': {
    title: 'TCO & Unit Economics Modeling',
    subtitle: 'CapEx depreciation, OpEx power & cooling, cost per 1M tokens, and cloud API break-even.',
    introduction: 'Building an internal AI cluster requires executive approval that hinges on total cost of ownership (TCO) and unit economics. Sizing infrastructure is not just a technical hardware exercise; it represents a major multi-million-dollar capital commitment that must be justified against public cloud API pricing (such as OpenAI, Anthropic, or AWS Bedrock). A comprehensive TCO model must synthesize three financial pillars: capital equipment depreciation across servers, storage, and networking; operational expenditures including datacenter floor space, enterprise software licenses, and electrical power with cooling overhead (PUE); and the ultimate unit metric of generative AI: fully loaded cost per one million tokens.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Calculating the True Cost of AI Infrastructure requires decomposing costs into <strong>Amortized Capital Expenditures (CapEx)</strong> 
          and <strong>Ongoing Operational Expenditures (OpEx)</strong> over an enterprise hardware lifecycle (typically 3 to 5 years).
        </p>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">1. CapEx Breakdown &amp; Hardware Amortization</h3>
        <p>
          Total initial acquisition cost aggregates three physical subsystems:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>Compute Nodes:</strong> GPU server chassis (e.g. 8x H200 SXM5 systems with dual host CPUs and 2TB host RAM).</li>
          <li><strong>Networking Fabric:</strong> 1:1 non-blocking leaf and spine switches, host NICs (e.g. 8x 400G RoCEv2 CX-7 per node), and active optical cables (AOCs). Calculated as an infrastructure network adder percentage (default 15%).</li>
          <li><strong>Storage Tier:</strong> Dedicated parallel flash NVMe-oF enclosures sized for capacity and throughput.</li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Monthly_Amortized_CapEx = Total_CapEx / (TCO_Years × 12)
        </div>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">2. OpEx: Power, Cooling PUE, Colocation &amp; Software</h3>
        <p>
          Operating an AI datacenter incurs continuous facilities and operational fees:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Monthly_Power_Cost = Total_IT_Power_kW × PUE × 730 hrs/month × Rate_per_kWh
        </div>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>Power Usage Effectiveness (PUE):</strong> Total facility power divided by IT equipment power. A modern datacenter averages PUE 1.25 to 1.35; older enterprise datacenters operate near 1.5 to 1.7. A PUE of 1.35 means for every 10 kW of GPU compute, 3.5 kW is consumed by chillers and HVAC cooling.</li>
          <li><strong>Colocation / Rack Footprint:</strong> Datacenter floor space and conditioned power delivery, typically billed at $150 to $250 per kW/month.</li>
          <li><strong>Enterprise Software Licenses:</strong> NVIDIA AI Enterprise (NVAIE) support ($4,500/GPU/year) providing certified vLLM/TRT-LLM containers, security patches, and 24/7 engineering SLA.</li>
          <li><strong>Vendor Hardware Support:</strong> Mission-critical 4-hour on-site maintenance (e.g. Cisco SMARTnet at 10–12% of hardware CapEx annually).</li>
        </ul>

        <h3 className="text-xl font-bold text-white mt-8 mb-3">3. Unit Economics: Fully Loaded Cost per 1M Tokens</h3>
        <p>
          To compare on-premise infrastructure against cloud APIs, total monthly cost (CapEx + OpEx) is converted into an effective <strong>cost per 1 million tokens</strong>:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Cost_per_1M_Tokens = [ Fully_Loaded_Monthly_TCO / (Monthly_Tokens_Generated) ] × 1,000,000
        </div>
        <p>
          Where <span className="font-mono text-sky-400">Monthly_Tokens_Generated = Cluster_Tok_Per_Sec × 3600 × 730 × Target_Duty_Cycle</span>.
        </p>

        <DecisionCallout title="The Public Cloud Break-Even Crossover">
          Public cloud APIs for 70B+ models charge ~$2.50 to $10.00 per 1M tokens. For intermittent, unpredictable traffic (duty cycle &lt; 10%), public cloud APIs are financially superior because you pay zero idle amortized cost. However, once an enterprise reaches sustained utilization (&gt; 25% duty cycle or &ge; 16 continuous concurrent streams), an on-premise 8x H200 cluster slashes unit token costs to <strong>$0.25 to $0.65 per 1M tokens</strong>—yielding a 75% to 90% TCO reduction alongside guaranteed data privacy and no per-token API markup on egress (raw bandwidth costs still apply — see the Ingress &amp; Edge sizing tab).
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
                  <p className="text-base text-zinc-300 leading-relaxed mb-4">
                    Welcome to the technical documentation hub for the AI Infrastructure Sizing Calculator. 
                    This resource bridges the gap between high-level artificial intelligence strategy and low-level datacenter systems engineering. 
                    Deploying generative AI inside an enterprise is fundamentally governed by physical silicon laws: High Bandwidth Memory (HBM) capacity, 
                    lossless networking bisection bandwidth, electrical power delivery, and cooling thresholds.
                  </p>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Whether you are sizing a private departmental assistant or an entire multi-megawatt neo-cloud facility, 
                    this guide explains the mechanical trade-offs between model parameter scale, context memory retention, sharding strategies, 
                    and disaster recovery across 15 production use-case blueprints.
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
                      Deep-dive into silicon memory sizing, KV cache attention mechanics, rail-optimized Clos networks, Erlang C queueing, storage durability math, accelerator comparisons, and TCO unit economics.
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
                      Exhaustive architectural specifications, model selection rationales, and alternative comparisons for all 15 presets.
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
                    <li><strong>Explanatory Foundation:</strong> Clear systems engineering introductions framing the operational challenge before technical data.</li>
                    <li><strong>Silicon &amp; Sharding Topology:</strong> Why specific GPUs and sharding parameters (TP/PP/DP) were chosen.</li>
                    <li><strong>Context &amp; KV Cache Dynamics:</strong> How context length and prefix caching ratios govern physical memory capacity.</li>
                    <li><strong>Ancillary Infrastructure:</strong> How RAG vector databases, safety guardrails, storage tiers, and HA/DR are integrated.</li>
                    <li><strong>Model Selection &amp; Alternatives:</strong> In-depth comparative evaluation of the primary model vs. 2–3 factual alternatives with parameter metrics and trade-offs.</li>
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

                {/* Explanatory Lead Introduction */}
                {CORE_CONTENT[activeDocId]?.introduction && (
                  <div className="bg-sky-950/20 border border-sky-800/40 rounded-xl p-5 mb-8 text-zinc-200 text-[14.5px] leading-relaxed flex items-start gap-3.5">
                    <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <p>{CORE_CONTENT[activeDocId]?.introduction}</p>
                  </div>
                )}

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
                        <p className="text-sm text-sky-400 font-medium mb-4">{preset.summary}</p>
                        
                        {/* Explanatory Blueprint Introduction */}
                        {preset.introduction && (
                          <div className="text-[14.5px] text-zinc-300 leading-relaxed space-y-3 pt-2">
                            {Array.isArray(preset.introduction) ? (
                              preset.introduction.map((para, i) => <p key={i}>{para}</p>)
                            ) : (
                              <p>{preset.introduction}</p>
                            )}
                          </div>
                        )}
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
                      <div className="space-y-8 text-[15px] text-zinc-300 leading-relaxed">
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

                        {/* Model Selection & Alternatives Evaluation */}
                        <div>
                          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            4. Model Selection &amp; Alternative Architectures
                          </h3>
                          <p className="mb-4">{preset.rationale.modelSelection}</p>

                          {preset.rationale.modelAlternatives && (
                            <div className="space-y-3 mt-4">
                              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold block">
                                Architectural Alternatives Comparison:
                              </span>
                              <div className="grid grid-cols-1 gap-3">
                                {preset.rationale.modelAlternatives.map((alt, idx) => (
                                  <div key={idx} className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-zinc-800/60">
                                      <strong className="text-sky-300 font-semibold text-sm">{alt.name}</strong>
                                      <span className="font-mono text-zinc-400 text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded">{alt.specs}</span>
                                    </div>
                                    <div>
                                      <strong className="text-emerald-400 font-medium">When to choose: </strong>
                                      <span className="text-zinc-300 leading-relaxed">{alt.pros}</span>
                                    </div>
                                    <div>
                                      <strong className="text-amber-400 font-medium">Trade-off vs Default: </strong>
                                      <span className="text-zinc-400 leading-relaxed">{alt.cons}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Common Anti-Patterns & Failure Modes */}
                        {preset.antiPatterns && preset.antiPatterns.length > 0 && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              5. Common Anti-Patterns &amp; &quot;What Breaks First&quot;
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                              {preset.antiPatterns.map((item, idx) => (
                                <div key={idx} className="p-4 bg-amber-950/15 border border-amber-800/40 rounded-xl text-xs space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-amber-300 text-sm">{item.title}</span>
                                  </div>
                                  <p className="text-zinc-300 leading-relaxed"><strong className="text-zinc-400">The Anti-Pattern: </strong>{item.mistake}</p>
                                  <p className="text-zinc-400 leading-relaxed"><strong className="text-amber-400">The Failure Mode: </strong>{item.impact}</p>
                                  <p className="text-zinc-300 leading-relaxed"><strong className="text-emerald-400">Production Fix: </strong>{item.remediation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Production Engine Launch Recipe */}
                        {preset.engineRecipe && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-sky-400" />
                              6. Production Engine Launch Recipe ({preset.engineRecipe.framework})
                            </h3>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-xs">
                              <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span className="text-zinc-400 font-mono text-[11px]">{preset.engineRecipe.commandTitle || 'Production CLI Flags'}</span>
                                <Badge variant="sky">{preset.engineRecipe.framework}</Badge>
                              </div>
                              <pre className="p-4 font-mono text-sky-300 bg-zinc-950/60 overflow-x-auto whitespace-pre text-[12px] leading-relaxed">
                                {preset.engineRecipe.command}
                              </pre>
                              {preset.engineRecipe.notes && (
                                <div className="px-4 py-2.5 bg-zinc-900/60 border-t border-zinc-800/60 text-zinc-400 text-[11px] leading-relaxed">
                                  <strong className="text-zinc-300">Operational Note: </strong>{preset.engineRecipe.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

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
