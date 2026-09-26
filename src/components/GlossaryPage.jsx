import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, Cpu, Network, Database, Server,
  Share2, Briefcase, Bot, CloudLightning, Timer,
  ChevronRight, ChevronLeft, ChevronDown, Search, Layers, Info,
  HardDrive, Zap, DollarSign, AlertTriangle, Terminal, ShieldCheck, Menu, X
} from 'lucide-react';
import { COMPLIANCE_FRAMEWORKS, CONTROL_DOMAINS, STATUS, evaluateControlDomains } from '../data/security';
import { Banner, Tag, Rows, Row, SectionLabel } from './ui';

// A decision/trade-off callout is just an info Banner with a fixed title -- same visual
// language as every other banner in the app, instead of a second bespoke "callout" style.
function DecisionCallout({ title = 'Architectural Decision', children }) {
  return (
    <Banner tone="info" icon={Info} title={title}>
      {children}
    </Banner>
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
      },
      {
        id: 'chap-10-security',
        title: 'Security, Compliance & Attestation Controls',
        category: 'Core Foundations',
        icon: ShieldCheck,
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
      gpus: '1x NVIDIA H200 (141GB) in a C885A chassis',
      context: '8,192',
      concurrency: '32',
      sharding: 'TP=1, PP=1, DP=1 (Auto)',
      engine: 'vLLM + KServe',
      apc: '40% Cache Ratio',
      promptRatio: '80% Prompt / 20% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB (Envoy/NGINX)',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'software-lb',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'LLaMA 3.3 70B in FP8 needs ~72.7GB for weights (70.6B parameters at 1 byte, with the embedding table and lm_head kept at BF16). The auto-sharding solver always picks the smallest tensor-parallel degree that fits, and a single 141GB H200 (~127GB usable at 90% memory utilization) holds the weights plus the KV cache for all 32 streams, so the result is TP=1 on one GPU of a Cisco C885A chassis -- no NVLink traffic at all. Higher TP (2, 4 or 8 inside the same chassis) remains a valid choice when you want lower per-token latency: it splits each layer across more GPUs, cutting time-per-output-token roughly in proportion, at the cost of more GPUs per replica. What you should not do is stretch TP across chassis (see anti-patterns).',
      memory: 'Enterprise RAG queries are prompt-heavy: typical queries bundle 4 to 8 retrieved document chunks (~6,000 tokens) with a short user question and a brief response (~500 tokens), resulting in an 80/20 prompt-to-generation ratio. Automatic Prefix Caching (APC) is configured at 40% because corporate knowledge bases frequently retrieve overlapping policy documents, system prompts, and common guidelines across different department users. Enabling FP8 KV cache halves each cached element from 2 bytes to 1 byte (LLaMA 70B: 327,680 bytes/token at FP16 vs 163,840 at FP8). With 40% of the prompt shared across streams, the 32 × 8k working set needs ~30GB of FP8 KV, which fits beside the weights on one H200 (~104GB of ~127GB used). At FP16 the same working set would need ~59GB and no longer fit on one GPU.',
      ancillary: 'RAG embeddings are handled by BGE-Large-EN v1.5 on dedicated L40S PCIe GPUs (sized by the calculator to meet the corpus ingestion-time target), paired with a Milvus vector database sized for 8 QPS. Safety is enforced synchronously via Llama Guard 3 8B on both input and output; in the calculator\'s SLA model that adds ~0.7s to time-to-first-token and ~0.9s to end-to-end response time, because the classifier runs serially before and after generation. Storage utilizes VAST Universal Storage configured with 8+3 erasure coding, providing high NFS throughput for model loading while avoiding 3x replication capex. HA/DR uses Multi-AZ so service continues through the loss of one availability zone or power domain. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'The design leans on the H200\'s 141GB: the whole FP8 model plus the KV cache for all 32 × 8k streams fits on one GPU, so no tensor or pipeline parallelism is needed. On an 80GB H100 the 72.7GB of weights leave almost no room for KV, forcing at least TP=2. The cost of TP=1 is per-stream decode speed (~40ms per output token in the calculator); raising TP trades more GPUs for lower latency.',
      modelSelection: 'LLaMA 3.3 70B scores 86.0 on MMLU (0-shot, chain-of-thought, per Meta\'s model card) with strong instruction following, while keeping the identical 70.6B dense architecture of LLaMA 3.1 70B. It is a widely deployed default for enterprise question-answering; grounding answers in retrieved sources, rather than the model choice alone, is what keeps hallucination down.',
      modelAlternatives: [
        {
          name: 'NVIDIA Llama-3.1-Nemotron-70B-Instruct',
          specs: '70.6B Dense, 128k Context, Llama 3.1 Community License',
          pros: 'Strong alignment and helpfulness (Arena-Hard 85.0 at release). A fine-tune of LLaMA 3.1 70B, so it inherits the Llama 3.1 Community License terms rather than escaping them.',
          cons: 'Identical physical memory footprint as LLaMA 3.3 70B, but requires fine-tuned inference sampling parameters (temperature/top-p) to curb excessive verbosity in concise FAQ answers.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense, 128k Context, GQA (8 heads), CC-BY-NC 4.0',
          pros: 'Built specifically for enterprise RAG with native grounded citations and verifiable quote extraction.',
          cons: 'Open weights are licensed CC-BY-NC (non-commercial); production use needs a commercial agreement with Cohere. At FP8 the ~104GB of weights leave only ~20GB of KV room on one H200 (vs ~54GB for LLaMA 3.3), so expect TP=2 or fewer streams per GPU.'
        },
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, 128k Context, GQA (8 heads)',
          pros: 'Superior multilingual retrieval (29+ languages) and structured JSON/tabular extraction capabilities.',
          cons: 'Wider intermediate dimension (29,568 vs 28,672) and larger vocabulary (152k vs 128k) add ~2GB of FP8 weights. KV cache per token is identical (80 layers, 8 KV heads), so concurrency is essentially unchanged.'
        },
        {
          name: 'Mistral Mixtral 8x22B (141B MoE)',
          specs: '141B MoE (39B active), 64k Context',
          pros: 'Less compute per token than a 70B dense model (39B active parameters), which helps decode speed at low batch sizes. Apache 2.0 license.',
          cons: 'All 141B parameters must stay resident (~141GB at FP8), more than one H200 can hold, so it needs TP=2 on H200 (or TP=4 on H100) versus a single GPU for the 70B. At larger batches most experts are touched every step, so the bandwidth advantage narrows.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Inter-Node Tensor Parallelism Trap',
        mistake: 'Configuring TP=16 across two 8-GPU nodes over RoCEv2 or InfiniBand instead of keeping TP=8 inside a single chassis.',
        impact: 'Every transformer layer performs all-reduces on the critical path. Moving them from NVLink (900 GB/s per GPU) to a 400G NIC (~50 GB/s) plus switch hops makes each one many times slower, and decode throughput drops sharply.',
        remediation: 'Keep TP inside one chassis (TP of 8 or less on an 8-GPU NVLink node). Scale concurrency with Data Parallel (DP) replicas across nodes, which do not communicate during inference.'
      },
      {
        title: 'Neglecting Automatic Prefix Caching (APC)',
        mistake: 'Leaving prefix caching disabled when querying shared corporate document repositories.',
        impact: 'Every user query recomputes the shared system prompt and frequently retrieved policy text from scratch, inflating TTFT roughly in proportion to the shared prefix length.',
        remediation: 'Enable Automatic Prefix Caching in vLLM (--enable-prefix-caching). vLLM hashes fixed-size KV blocks and reuses any block whose full token prefix matches, so a shared prefix is computed and stored once. (SGLang implements the same idea with a radix tree.) Put stable content -- system prompt, then retrieved chunks -- at the start of the prompt so prefixes actually match.'
      },
      {
        title: 'Unquantized FP16 KV Cache at Scale',
        mistake: 'Deploying FP8 model weights but retaining FP16 for the Key-Value attention cache.',
        impact: 'At 32 concurrent 8k sessions the FP16 KV cache needs ~59GB instead of ~30GB. Next to 72.7GB of weights that no longer fits on one H200, so the engine either preempts requests at peak load or you need a second GPU.',
        remediation: 'Enable FP8 KV cache (--kv-cache-dtype fp8) to halve KV memory. Accuracy impact is usually small but model-dependent, so validate on your own evaluation set before rollout.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM v0.6+ / KServe',
      commandTitle: 'Production vLLM Headless Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 1 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 8192 \\
  --max-num-seqs 32 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One H200 per replica, matching the calculator (TP=1). --quantization fp8 quantizes the BF16 checkpoint at load time; alternatively serve a pre-quantized FP8 checkpoint. 0.90 matches the calculator\'s usable-memory assumption and leaves 10% for activations and CUDA graphs. Set --tensor-parallel-size 2/4/8 if you need lower per-token latency.'
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
      gpus: '2x NVIDIA H200 (141GB), 1 chassis',
      context: '65,536',
      concurrency: '16',
      sharding: 'TP=2, PP=1, DP=1 (Auto)',
      engine: 'vLLM (Speculative Decoding)',
      apc: '20% Cache Ratio',
      promptRatio: '80% Prompt / 20% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB (Envoy)',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Qwen 2.5 72B at FP8 needs ~75GB of weights. It would fit on a single H200, but serving 16 concurrent 64k-token streams that way takes four one-GPU replicas (4 GPUs), each holding its own copy of the weights. The solver instead picks one TP=2 replica on 2 GPUs: the weights are stored once (~38GB per GPU) and the remaining ~73GB per GPU holds KV cache for all 16 streams. Latency is the tension in this design: a cold 52k-token prompt (80% of a 64k context) takes ~5s to prefill at TP=2 in the calculator, far from the sub-second feel IDE users expect. Real copilots get there two ways: (1) prefix caching, so only the few hundred tokens that changed since the last request are prefilled, and (2) keeping inline completions on short contexts while reserving the full 64k window for chat and refactoring requests. If cold long-context latency matters, turn on latency targets on the Sharding tab; the solver then raises TP (e.g. TP=4 on 4 GPUs gives ~2.8s).',
      memory: 'Coding copilots require massive context (64k tokens) to swallow open file buffers, imported header definitions, and language server protocol (LSP) symbol tables. Qwen 2.5 72B has 80 layers and 8 KV heads, so a full 64k-token sequence needs ~21.5GB of KV at FP16 and ~10.7GB at FP8. Speculative decoding is enabled with a small draft model from the same family (it must share the target\'s tokenizer, e.g. Qwen 2.5 0.5B or 1.5B). Typical speedups are 1.5x to 2x on predictable code, but they depend on the draft acceptance rate and shrink as batch size grows.',
      ancillary: 'Guardrail models are explicitly disabled in this preset. A guard classifier has to read the same long prompt the main model reads, so on 50k-token code contexts it would add seconds, not milliseconds, to every request (even on the RAG preset\'s 8k prompts the calculator adds ~0.7s). RAG uses GTE-Large-EN v1.5, whose 8,192-token input limit lets it embed whole functions or files when needed (the preset sizes 256-token chunks), with a Qdrant vector database at 15 QPS. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Sacrifices safety guardrail filtering and concurrency depth (capped at 16 streams) in order to support 64k context windows on just two GPUs. Cold long-context requests take seconds; the design relies on prefix-cache hits for interactive latency.',
      modelSelection: 'Qwen 2.5 72B Instruct is a strong general model that is also good at code (HumanEval 86.6 per Qwen\'s report) while staying useful for explanations, design discussion and documentation. If the workload is almost entirely code, the smaller Qwen 2.5 Coder 32B (below) scores higher on code benchmarks at less than half the memory.',
      modelAlternatives: [
        {
          name: 'Qwen 2.5 Coder 32B',
          specs: '32.8B Dense, 128k Context, Apache 2.0',
          pros: 'Code-specialized: scores higher than the 72B general model on code benchmarks (HumanEval 92.7 for the Instruct model per Qwen\'s report) at less than half the weight memory (~33GB FP8). KV per token is also smaller (64 layers vs 80), so each GPU holds more concurrent streams.',
          cons: 'Weaker on general knowledge and non-code conversation than the 72B general model.'
        },
        {
          name: 'DeepSeek-Coder-V2 236B (21B active)',
          specs: '236B MoE, 128k Context, MLA Attention',
          pros: 'Strong code completion with fast decode (only 21B active parameters) and a very small KV cache thanks to Multi-Head Latent Attention.',
          cons: '~236GB of FP8 weights need at least two H200s (TP=2) or four H100s per replica. That still fits in one 8-GPU chassis, but MoE serving is more complex to tune than a dense model.'
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
        impact: 'The guard model has to prefill the same long code context before the main model starts, adding serial TTFT overhead that grows with prompt length (hundreds of milliseconds to seconds). Developers notice the lag and turn the assistant off.',
        remediation: 'Bypass inline guardrails for code completion; perform asynchronous post-commit git security and secret scanning instead.'
      },
      {
        title: 'Autoregressive Decoding Without Speculation',
        mistake: 'Relying solely on single-token autoregressive generation for standard programming syntax.',
        impact: 'Predictable boilerplate (brackets, docstrings, imports) is still generated one token at a time at memory-bandwidth-bound speed (~35 tok/s per stream for this 72B model at TP=2 in the calculator).',
        remediation: 'Configure speculative decoding with a small draft model that shares the target\'s tokenizer (e.g. Qwen 2.5 0.5B/1.5B). The draft proposes 4 to 6 tokens and the target verifies them in one pass; on predictable code this commonly gives 1.5x to 2x more tokens per second per stream.'
      },
      {
        title: 'Context Over-Provisioning per Keystroke',
        mistake: 'Re-transmitting the entire 64k codebase buffer on every single autocomplete keystroke without client-side debouncing.',
        impact: 'Overwhelms the serving engine queue and evicts active KV blocks prematurely.',
        remediation: 'Implement ~150ms client-side keystroke debouncing in the IDE plugin, and keep the prompt layout stable (fixed file context first, cursor-local text last) so vLLM\'s automatic prefix caching reuses the unchanged prefix.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Speculative Decoding Engine',
      commandTitle: 'Production Speculative vLLM Service Command',
      command: `vllm serve Qwen/Qwen2.5-72B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 2 \\
  --kv-cache-dtype fp8 \\
  --speculative-config '{"model": "Qwen/Qwen2.5-0.5B-Instruct", "num_speculative_tokens": 5}' \\
  --enable-prefix-caching \\
  --max-model-len 65536 \\
  --max-num-seqs 16 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One TP=2 replica on 2 H200s, matching the calculator. There is no 72B Qwen 2.5 Coder model; the 72B general Instruct model is used here. Qwen 2.5 checkpoints default to a 32k window; enable YaRN rope scaling per the model card to serve 64k. The draft model shares the target\'s tokenizer and adds ~1GB. Older vLLM releases used --speculative-model / --num-speculative-tokens instead of --speculative-config.'
    }
  },
  'ent-customer-support': {
    title: 'Customer Support / Contact Center Agent',
    summary: 'High-concurrency, short-context automated voice/chat contact center scaling to 512 simultaneous caller streams.',
    introduction: [
      'Customer support and contact center automation operate under intense concurrency and cost-per-minute constraints. Unlike internal research tools where a few users submit complex, long-running questions, a contact center cluster must handle hundreds or thousands of simultaneous phone calls or chat inquiries with zero dropped connections and a first token that arrives within a few hundred milliseconds.',
      'Because customer service dialogues are conversational and short (rarely exceeding 4,000 tokens), the architectural priority shifts completely from raw reasoning depth to high-density concurrency. This blueprint intentionally avoids expensive $35k accelerators in favor of cost-efficient PCIe cards and lightweight 8B models, scaling horizontally to deliver hundreds of active streams at minimal infrastructure cost.'
    ],
    specs: {
      model: 'LLaMA 3.1 8B',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C245 M8',
      gpus: '4x NVIDIA L40S PCIe (48GB), 1 chassis',
      context: '4,096',
      concurrency: '512',
      sharding: 'TP=1, PP=1, DP=4 (Auto)',
      engine: 'vLLM + KServe',
      apc: '40% Cache Ratio',
      promptRatio: '50% Prompt / 50% Gen',
      servingArch: 'Colocated Serving',
      protocol: 'Lossless RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 2x',
      hadr: 'Warm Standby',
      ingress: 'Cloud-Managed LB (Auto-scaling)',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'warm-standby',
      ingressEnabled: true,
      ingressTierId: 'cloud-managed-lb',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Contact centers operate on strict cost-per-minute unit economics. High-end SXM HGX platforms ($35k/GPU) destroy business ROI for basic transactional dialog. The preset uses a Cisco UCS C245 server with L40S PCIe GPUs (priced at $8,500/GPU in the calculator). An 8B model at FP8 is only ~9GB, so every L40S runs its own complete copy (TP=1) and the four GPUs act as four independent replicas (DP=4). Because the replicas never talk to each other, the L40S\'s lack of NVLink (it connects over PCIe Gen4 x16, ~32 GB/s each way) does not matter.',
      memory: 'Customer conversations are concise (4k context), with balanced 50/50 prompt/generation splits (caller question vs agent reply). The challenge is pure concurrency: 512 simultaneous active calls. LLaMA 3.1 8B needs 65,536 bytes of FP8 KV per token, so 512 × 4k streams (with 40% of the prompt shared) need ~110GB of KV -- far more than one 48GB card. The calculator therefore replicates the model four times (DP=4): each L40S serves 128 streams with ~28GB of KV beside ~9GB of weights. Per-stream decode is ~100ms/token (~10 tokens/s) at that batch size, which is still faster than speech playback for voice agents.',
      ancillary: 'Safety is mandatory for public-facing dialog; ShieldGemma-2B is selected as an ultra-compact guardrail on its own L40S; in the calculator it adds ~56ms to time-to-first-token and ~112ms end to end (input and output checks). Ingress uses a Cloud-Managed auto-scaling load balancer to absorb bursty call spikes. Storage uses NetApp AFF with 2x replication, prioritizing operational maturity over raw parallel-fs speeds. HA/DR utilizes Warm Standby in a secondary datacenter to minimize idle server costs. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Trades peak reasoning depth (8B vs 70B) and inter-GPU interconnect bandwidth (PCIe vs NVLink) to achieve unmatched density: 512 concurrent conversations at the lowest possible cost-per-stream.',
      modelSelection: 'LLaMA 3.1 8B provides the ideal balance of conversational fluency, intent extraction, and extreme execution speed. At 8B parameters the calculator estimates ~72ms time-to-first-token on L40S for these 2k-token prompts (before guardrail overhead), which suits interactive phone and voice agents.',
      modelAlternatives: [
        {
          name: 'Google Gemma 2 (9B)',
          specs: '9.2B Dense, 8k Context',
          pros: 'Higher MMLU (71.3 for the base model per Google) and good conversational polish for its size.',
          cons: 'Alternates 4k sliding-window and global attention layers; serving engines support it, but check that prefix caching and FP8 KV work with sliding-window layers in your engine version. Released under the Gemma Terms of Use (with a prohibited-use policy), not an OSI license -- have legal review it.'
        },
        {
          name: 'Mistral NeMo 12B',
          specs: '12.2B Dense, 128k Context, Apache 2.0',
          pros: 'Developed with NVIDIA; the Tekken tokenizer (trained on 100+ languages) compresses non-English text more efficiently, which helps multilingual contact centers.',
          cons: '~50% more weight memory and ~25% more KV per token (40 layers vs 32), so each GPU holds roughly 20% to 30% fewer concurrent streams.'
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
        remediation: 'Deploy PCIe servers such as the Cisco C245 M8 with L40S GPUs, one model replica per GPU. GPU capex drops to a fraction (the calculator prices L40S at $8,500 vs $35,000+ for SXM parts) while still meeting interactive latency targets for an 8B model.'
      },
      {
        title: 'Omitting Safety Filter Latency in IVR Voice Loops',
        mistake: 'Running heavy 8B+ guardrails synchronously on continuous bi-directional voice streams.',
        impact: 'An 8B classifier checking both input and output adds hundreds of milliseconds per turn, which callers hear as unnatural pauses.',
        remediation: 'Use a compact guard model (e.g. ShieldGemma-2B, ~56ms added TTFT in the calculator) on its own GPU for synchronous checks, and move heavier policy review to asynchronous post-turn analysis.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Multi-Instance Worker',
      commandTitle: 'Production L40S PCIe Serving Command',
      command: `# One instance per GPU (repeat with CUDA_VISIBLE_DEVICES=1,2,3 and ports 8001-8003)
CUDA_VISIBLE_DEVICES=0 vllm serve meta-llama/Llama-3.1-8B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 1 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 4096 \\
  --max-num-seqs 128 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'Four independent TP=1 replicas per server, matching the calculator (DP=4). L40S (Ada Lovelace) supports FP8 natively. Put the replicas behind a least-connections load balancer so streams spread evenly.'
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
      gpus: '4x NVIDIA H200 (141GB), 1 chassis',
      context: '131,072',
      concurrency: '8',
      sharding: 'TP=1, PP=1, DP=4 (Auto)',
      engine: 'vLLM (Chunked Prefill)',
      apc: '0% Cache Ratio',
      promptRatio: '90% Prompt / 10% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 3x (Compliance)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'software-lb',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Prefill cost grows with prompt length: the linear layers scale linearly with the number of tokens and attention scales quadratically, so a ~118k-token prompt (90% of 131k) is expensive. The solver fits the FP8 70B model plus two full 131k-token sequences on each H200, so it chooses TP=1 with four replicas (DP=4) for 8 concurrent documents. At TP=1 the calculator estimates ~37s to first token for a full-length document -- acceptable for this asynchronous batch workload, but not interactive. If analysts wait on results, raise TP to 4 or 8: prefill time falls roughly in proportion to TP (to well under ten seconds at TP=8), at the cost of more GPUs per replica.',
      memory: 'KV cache at 131,072 tokens is punishing: LLaMA 70B needs 163,840 bytes per token at FP8, so a single full-length sequence holds ~21.5GB of KV (~43GB at FP16). Eight concurrent documents need ~172GB of KV in total, which is why the work is split across four GPUs (two documents each, ~117GB used of ~127GB usable). KV cache offload to storage is enabled so inactive sessions can page out of HBM instead of being recomputed. Automatic Prefix Caching is set to 0% because each contract is unique; only the short shared instruction prompt would ever be reused.',
      ancillary: 'RAG embedding uses Qwen3-Embedding 0.6B, which accepts inputs of up to 32,768 tokens, so long clauses can be embedded without splitting, under a commercial-friendly Apache 2.0 license. For the preset\'s 5TB corpus the calculator sizes 9 L40S GPUs to meet the ingestion window. (NV-Embed-v2 offers similar input length at higher benchmark quality but is licensed CC-BY-NC, non-commercial, and at 7.8B parameters would need over 100 L40S GPUs here.) Storage uses NetApp AFF with 3x replication to satisfy audit retention and immutable-snapshot requirements. Guardrails use Granite Guardian 3 8B; because the guard must also read the ~118k-token prompt, the calculator adds ~13s to time-to-first-token -- consider running it asynchronously or only on outputs for this workload. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Trades interactive concurrency (capped at 8 streams) and prefix cache optimization for maximum context length (131k tokens) and extreme prefill batching throughput.',
      modelSelection: 'LLaMA 3.3 70B supports a native 128k (131,072-token) context, and Meta reports strong long-context retrieval results for this model family. Needle-in-a-haystack recall does not guarantee reasoning across a whole contract, so validate on your own documents. The 70B parameter count is what gives it the capacity to follow nested cross-references, indemnity clauses and financial tables.',
      modelAlternatives: [
        {
          name: 'Mistral Large 2 (123B)',
          specs: '123B Dense, 128k Context',
          pros: 'Strong European-language coverage (French, German, Spanish, Italian) and reliable JSON output.',
          cons: '~123GB of FP8 weights nearly fill one H200 by themselves, so each replica needs TP=2 or more. Released under the Mistral Research License; commercial use requires a separate license from Mistral.'
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
          cons: 'Demands ~34GB more weight memory than the 70B, which leaves too little KV room on one H200 for a 131k-token document (TP=2 needed). Open weights are CC-BY-NC; commercial use needs an agreement with Cohere.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Unchunked 131k Prompt Ingestion Spikes',
        mistake: 'Ingesting a 120,000-token contract in a single monolithic prefill step without chunking.',
        impact: 'Transient activation memory scales with the number of tokens processed in one step, so a 120k-token step can need tens of GB beyond the KV cache and trigger an out-of-memory error even when the KV cache itself fits. It also stalls every other request for the whole prefill.',
        remediation: 'Use chunked prefill with a bounded step size (--max-num-batched-tokens 8192) so long prompts are processed in slices interleaved with other requests. Chunked prefill is on by default in current vLLM releases; older releases need --enable-chunked-prefill.'
      },
      {
        title: 'Assuming High Prefix Cache Reuse Across Unique Filings',
        mistake: 'Sizing physical HBM assuming a 40% APC cache hit ratio on heterogeneous loan portfolios or vendor contracts.',
        impact: 'Every legal contract is completely unique; zero cache hits occur, causing unexpected memory exhaustion and eviction thrashing.',
        remediation: 'Size memory conservatively for 0% APC reuse and, if sessions are revisited, configure KV cache offloading to CPU memory or NVMe (e.g. vLLM with the LMCache connector).'
      },
      {
        title: 'Small Context Embeddings for Complex Contracts',
        mistake: 'Using standard 512-token embedding models (e.g. standard BERT) to index 200-page loan agreements.',
        impact: 'Slices interconnected indemnity and covenant clauses across arbitrary chunk boundaries, destroying cross-clause semantic understanding.',
        remediation: 'Chunk along document structure (section and clause boundaries) and use a long-input embedding model -- Qwen3-Embedding (32k, Apache 2.0, used in this preset), BGE-M3 (8k, MIT) or GTE-Large-EN v1.5 (8k). NV-Embed-v2 (32k) is non-commercial.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Long-Context Engine',
      commandTitle: 'Production Chunked-Prefill Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 1 \\
  --kv-cache-dtype fp8 \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --max-num-seqs 2 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One H200 per replica holding two full-length documents; run four replicas (TP=1, DP=4 as in the calculator). Chunked prefill keeps each step bounded on 100k+ token documents. Use --tensor-parallel-size 4 or 8 instead if time-to-first-token matters more than GPU count.'
    }
  },
  'ent-lora-finetune': {
    title: 'Regulated-Industry LoRA Fine-Tuning',
    summary: 'Compliance-driven in-house domain adaptation on sensitive records, freezing base weights and training low-rank adapters.',
    introduction: [
      'In regulated sectors such as banking, defense, and healthcare, rules like HIPAA and GDPR, sector regulators and data-classification policies tightly restrict where confidential transactions, health records or classified material may be processed. Cloud processing is not always prohibited outright, but many organizations conclude that training on this data must happen on infrastructure they fully control. When a model has to learn internal terminology or proprietary schemas under those constraints, the training runs on-premises.',
      'Full training of a 70B model requires massive multi-node clusters. Low-Rank Adaptation (LoRA) provides an elegant alternative: it freezes the massive base model completely and only trains small low-rank adapter matrices (~0.3% of the parameters at rank 16). This allows an enterprise to fine-tune a flagship 70B model inside a single 8-GPU chassis without needing complex multi-node networking fabrics.'
    ],
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'BF16 Weights / BF16 Grads',
      platform: 'Cisco UCS C885A',
      gpus: '8x NVIDIA H100 (80GB)',
      context: '4,096',
      concurrency: 'Micro-batch 2 (global 8 via grad accumulation)',
      sharding: 'TP=8, PP=1, DP=1',
      engine: 'Megatron-LM / PyTorch FSDP',
      apc: 'N/A (Training Workload)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Training Cluster',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Replicated 3x (Audited)',
      hadr: 'Disabled (Batch Job)',
      ingress: 'Internal Subnet (No Ingress)',
      mlops: 'Disabled (Batch Job)'
    },
    complianceFacts: {
      workloadType: 'training',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: false,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Full-parameter fine-tuning of a 70B model needs ~1,130GB of training state (16 bytes per parameter: BF16 weights and gradients plus FP32 master weights and two AdamW moments), which cannot fit on a single server. LoRA at rank 16 freezes the base model (~141GB at BF16) and trains only ~0.207B adapter parameters -- the figure for adapters on all seven linear projections (q, k, v, o, gate, up, down); adapting only the attention projections would give ~0.066B. The frozen base is too large for one 80GB H100, so it must be split across GPUs: the calculator uses TP=8 inside one Cisco C885A, leaving ~17.6GB of base weights per GPU. Adapter gradients and optimizer states total under 3GB. The whole job fits in one chassis with no inter-node fabric.',
      memory: 'Training uses mixed precision (BF16 base weights and activations, FP32 master weights and AdamW moments for the adapters only). Freezing the base does not shrink activations: backpropagation still has to flow through every layer, so activation memory is the largest per-GPU item. With selective recomputation at 4k context and micro-batch 2, the calculator estimates ~23GB of activations per GPU, for ~41GB used of 72GB usable. Gradient accumulation over 4 steps reaches a global batch of 8.',
      ancillary: 'The preset is set to ZeRO-1, but with a single data-parallel replica (DP=1) there is nothing to shard it across, and the adapter optimizer states are only ~2.5GB anyway; it matters only if you add replicas. Storage uses NetApp AFF with 3x replication for compliance, storing the 5TB training dataset and 3 checkpoint generations. Ingress, RAG, HA/DR, and MLOps validation pools are all disabled as this is an internal batch training cluster with no live-traffic rollout process.',
      tradeoff: 'Trades the ultimate domain plasticity of full-parameter training for the ability to train securely on a single 8-GPU chassis on-prem without crossing external networks.',
      modelSelection: 'LLaMA 3.3 70B is a widely used base for enterprise domain adaptation. Keeping the base weights frozen preserves its general reasoning while the low-rank adapters learn domain terminology and formats.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense, FP16 Base',
          pros: 'Equally viable base checkpoint with identical rank-16 adapter sizing (~0.21B params). Preferred for math, quantitative finance, or Asian languages.',
          cons: 'The larger vocabulary (152k vs 128k) adds ~0.8GB of frozen embedding and output-head weights; adapter size is essentially unchanged. The 72B model uses the Qwen License (commercial use allowed below a large user threshold), not Apache 2.0.'
        },
        {
          name: 'Meta LLaMA 3.1 (8B)',
          specs: '8.0B Dense, FP16 Base',
          pros: 'Dramatically lower training footprint; LoRA fits on a single GPU (one H100 or one L40S at modest batch sizes).',
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
        impact: 'Activation memory scales with micro-batch × sequence length × hidden size × layers, regardless of how few parameters are trainable. Doubling the micro-batch roughly doubles the ~23GB/GPU of activations and runs out of memory on 80GB GPUs.',
        remediation: 'Enable activation checkpointing (selective or full), keep the per-device micro-batch small (2 here), and use gradient accumulation to reach the desired global batch size.'
      },
      {
        title: 'Replicating the Frozen Base with Plain DDP',
        mistake: 'Launching LoRA with plain DistributedDataParallel (or ZeRO-1/2 only) so every GPU holds a full copy of the 70B base model.',
        impact: 'The ~141GB BF16 base does not fit on an 80GB H100, so the job fails at load time. ZeRO-1/2 only partition optimizer states and gradients, which for LoRA are tiny, so they do not help.',
        remediation: 'Shard the frozen base: tensor parallelism (TP=8, as sized here, in Megatron/NeMo) or FSDP / ZeRO-3 in the Hugging Face PEFT stack. Either way each GPU holds ~1/8 of the base. The alternative is QLoRA (4-bit base, ~40GB), at some accuracy and speed cost.'
      },
      {
        title: 'Serving Raw LoRA Adapters at High Concurrency',
        mistake: 'Serving a single production adapter unmerged when there is only ever one adapter in use.',
        impact: 'Every forward pass runs extra low-rank matrix multiplies, costing some throughput and latency for no benefit.',
        remediation: 'With one adapter, merge it into the base weights (PEFT merge_and_unload()) and quantize the merged model for serving. With many adapters (per team or per customer), keep them separate and use multi-LoRA serving (vLLM --enable-lora), which batches requests for different adapters on one shared base model.'
      }
    ],
    engineRecipe: {
      framework: 'PyTorch FSDP / HuggingFace PEFT',
      commandTitle: 'Single-Node LoRA Launch Command',
      command: `torchrun --nproc_per_node=8 train_lora.py \\
  --model_name_or_path meta-llama/Llama-3.3-70B-Instruct \\
  --lora_rank 16 \\
  --lora_alpha 32 \\
  --target_modules q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \\
  --per_device_train_batch_size 2 \\
  --gradient_accumulation_steps 4 \\
  --gradient_checkpointing true \\
  --fsdp "full_shard auto_wrap" \\
  --bf16 true`,
      notes: 'Executes within a single Cisco C885A (8x H100 80GB) node; train_lora.py stands for your Hugging Face Trainer + PEFT script. FSDP full-shard splits the frozen base across the 8 GPUs, which gives the same per-GPU weight memory as the calculator\'s TP=8. Targeting all seven linear projections matches the ~0.207B adapter parameters sized above.'
    }
  },
  'ent-full-finetune': {
    title: 'Full-Parameter Domain Fine-Tuning',
    summary: 'Full Supervised Fine-Tuning (SFT) with ZeRO-3 across a multi-node cluster to build a sovereign foundation checkpoint.',
    introduction: [
      'Adapter-based fine-tuning (LoRA) is effective for teaching a model specialized vocabulary and output formats, but it generally absorbs large amounts of new knowledge less well than updating every weight. When an enterprise or national lab wants to build a sovereign domain foundation model, or continue pretraining on a large domain corpus, full-parameter Supervised Fine-Tuning (SFT) is the usual choice.',
      'Full SFT updates every one of the 70.6 billion parameters. That means holding not just the weights, but also gradients and 12 bytes per parameter of FP32 AdamW state -- ~1,130GB of training state before activations. Sizing this system requires a multi-node cluster (32 GPUs across 4 servers) coupled with DeepSpeed ZeRO-3 memory sharding and a high-speed non-blocking RoCEv2 network fabric.'
    ],
    specs: {
      model: 'LLaMA 3.3 70B',
      precision: 'FP16 Mixed Precision',
      platform: 'Cisco UCS C885A',
      gpus: '32x NVIDIA H100 (4 Nodes x 8 GPUs)',
      context: '4,096',
      concurrency: 'Micro-batch 4 per replica',
      sharding: 'TP=8, PP=1, DP=4 (ZeRO-3)',
      engine: 'DeepSpeed / Megatron-LM',
      apc: 'N/A (Training Workload)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Distributed Training',
      protocol: '400G RoCEv2 (Rail-Optimized)',
      storage: 'VAST Data Universal Storage',
      durability: 'Replicated 3x',
      hadr: 'Disabled (Batch Job)',
      ingress: 'Internal Fabric Only',
      mlops: 'Disabled (Batch Job)'
    },
    complianceFacts: {
      workloadType: 'training',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: false,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Updating all 70.6B parameters requires BF16 weights (~141GB) + BF16 gradients (~141GB) + FP32 AdamW state (master weights and two moments, 12 bytes/param = ~847GB) = ~1,130GB of training state. The preset uses a 4-node cluster (32x H100 80GB): TP=8 inside each node and ZeRO-3 across the four data-parallel replicas, so every GPU holds 1/32 of the state (~35GB). Activations add ~11GB per GPU at micro-batch 4, for ~47GB used of 72GB usable.',
      memory: 'Because ZeRO-3 performs synchronous All-Gather collectives across the network before every layer forward/backward pass, inter-node networking bandwidth is the binding bottleneck. Pipeline Parallelism is kept at PP=1 because DeepSpeed\'s pipeline engine only supports ZeRO stage 0 or 1: partitioning gradients (ZeRO-2) or parameters (ZeRO-3) conflicts with the way pipeline micro-batches accumulate gradients. Frameworks that combine PP with sharding (Megatron-LM\'s distributed optimizer, for example) shard only the optimizer state.',
      ancillary: 'Networking uses a non-blocking 400G RoCEv2 fabric for the all-gather and reduce-scatter traffic. At 32 GPU-facing ports the calculator fits it on a single leaf tier with no spine; a spine layer only becomes necessary once the GPU NIC count outgrows the leaf switches. Checkpoints hold weights plus optimizer state (~990GB; gradients are not saved), so the 60-second write target needs ~16.5 GB/s of sustained write bandwidth, and 5 retained checkpoints need ~5TB beside the 20TB dataset -- which is why VAST Data Universal Storage is used. MLOps rollout validation does not apply to this offline full-parameter training run.',
      tradeoff: 'Demands a 4-node, 32-GPU high-speed RoCEv2 fabric investment to unlock full architectural adaptation across the entire 70B parameter matrix.',
      modelSelection: 'LLaMA 3.3 70B is a strong open-weights base for creating a proprietary corporate model, and full SFT lets every transformer layer adapt to the domain.',
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
          pros: 'Frontier capability, and far fewer FLOPs per training token than a dense model of similar quality (37B active parameters).',
          cons: 'Full fine-tuning requires hundreds of GPUs and multi-million dollar infrastructure beyond typical enterprise private clusters.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Combining Pipeline Parallelism with ZeRO-3',
        mistake: 'Enabling Pipeline Parallelism (PP > 1) together with ZeRO-2 or ZeRO-3 in DeepSpeed.',
        impact: 'DeepSpeed\'s pipeline engine does not support ZeRO-2/3, so the configuration is rejected or has to fall back to ZeRO-1, and the memory plan built on ZeRO-3 no longer holds.',
        remediation: 'Pick one strategy: ZeRO-3/FSDP with PP=1 (as here), or TP + PP with ZeRO-1-style optimizer sharding (e.g. Megatron-LM\'s distributed optimizer).'
      },
      {
        title: 'Oversubscribed Top-of-Rack Network Switches',
        mistake: 'Running multi-node ZeRO-3 across enterprise switches with 3:1 or 2:1 bisection oversubscription.',
        impact: 'The all-gather and reduce-scatter collectives that ZeRO-3 runs for every layer congest the uplinks. On a lossless RoCE fabric this shows up as PFC pause frames and ECN back-off rather than packet loss, but the effect is the same: GPUs wait on the network and Model FLOPs Utilization (MFU) drops sharply.',
        remediation: 'Deploy a dedicated 1:1 non-blocking rail-optimized leaf-spine Clos fabric over 400G RoCEv2 with Priority Flow Control (PFC) and DCQCN enabled.'
      },
      {
        title: 'Slow NFS Checkpoint Storage Stalls',
        mistake: 'Writing the ~1TB checkpoint (weights plus optimizer state) to standard corporate NAS storage.',
        impact: 'At ~1 GB/s, each checkpoint stalls all 32 GPUs for over 15 minutes, which adds up to hours of idle compute per day at typical checkpoint intervals.',
        remediation: 'Provision parallel flash storage (VAST Universal Storage or WekaFS) that sustains ~17 GB/s or more of writes to stay within the 60-second budget, and use asynchronous checkpointing (copy to host memory, then write in the background) where the framework supports it.'
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
      notes: 'Runs across 4x Cisco C885A nodes (32x H100 GPUs) on a 400G RoCEv2 fabric. This DeepSpeed recipe uses pure ZeRO-3 data parallelism over all 32 GPUs; each GPU still holds 1/32 of the training state, the same as the calculator\'s TP=8 × ZeRO-3 over DP=4 layout. Use Megatron-LM or NeMo if you want literal tensor parallelism.'
    }
  },
  'ent-minimal-airgapped': {
    title: 'Minimum-Footprint / Air-Gapped Deployment',
    summary: 'Smallest viable private-AI footprint for tactical SCIF, submarine, or disconnected industrial edge environments.',
    introduction: [
      'The Air-Gapped deployment archetype addresses the absolute extreme of operational isolation: submarines at sea, forward military command posts (SCIFs), nuclear power stations, or remote mine sites where all outbound Internet and cloud connectivity is physically prohibited. In these environments, power, cooling, and rack space are strictly capped.',
      'The engineering mandate is delivering functional, reliable generative AI on a single standard enterprise 2U rack server. By pairing 4-bit AWQ weight quantization with a compact 8B model and lightweight container orchestration, the language model and its conversation memory need only ~7GB of a single 48GB PCIe card. The calculator places the small safety model on a second GPU by default; at this size it could also share the first card.'
    ],
    specs: {
      model: 'LLaMA 3.1 8B',
      precision: 'INT4 AWQ / INT4 KV (modeled)',
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
      ingress: 'Software Reverse Proxy',
      mlops: 'Disabled (Air-gapped)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'software-lb',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Designed for environments where power, rack units, and cooling are strictly constrained. Populated with a single NVIDIA L40S PCIe card (48GB GDDR6, 350W TDP) in a Cisco C245 2U rack server. No NVLink switches, leaf-spine fabric, or secondary nodes are permitted.',
      memory: '4-bit AWQ quantization brings LLaMA 3.1 8B to ~5.8GB: ~3.7GB for the quantized transformer layers plus ~2.1GB for the embedding table and output head, which stay at 16-bit. The preset models an INT4 KV cache (0.5 bytes per element), which only KV-quantizing engines such as llama.cpp offer; vLLM\'s smallest KV type is FP8. At 4 streams × 4k context the KV cache is tiny either way (~0.5GB at INT4, ~1GB at FP8), so total use is ~7GB of the 48GB card. The spare memory can hold more streams, a larger model, or the guard and embedding models.',
      ancillary: 'The orchestrator is plain Docker Engine to avoid Kubernetes control-plane complexity in isolated environments. RAG is disabled in this preset, so the calculator does not size retrieval; if you need it, pgvector inside a local PostgreSQL container adds no new operational surface. Guardrails use Llama Guard 3 1B, which the calculator places on its own GPU (adding ~45ms to time-to-first-token); at ~3GB in BF16 it can share the main L40S instead. Storage uses local Ceph/S3 object storage with 2x replication. MLOps validation pools are disabled in this air-gapped, single-node deployment.',
      tradeoff: 'Sacrifices high concurrency and bleeding-edge model intelligence for complete air-gapped sovereignty on a single standard enterprise server.',
      modelSelection: 'LLaMA 3.1 8B at INT4 AWQ needs ~6GB and typically keeps most of its 16-bit benchmark accuracy (published results for 8B models usually show a drop of one to a few points; validate on your own tasks). That makes it a capable default for constrained edge hardware.',
      modelAlternatives: [
        {
          name: 'Microsoft Phi-4 Mini (3.8B)',
          specs: '3.8B Dense, 128k Context, MIT License',
          pros: 'Strong reasoning for its size; at INT4 it needs roughly 3GB (its 200k-token embedding table stays 16-bit), small enough for ruggedized laptops or vehicle hardware.',
          cons: 'Smaller broad world-knowledge memory than 8B models.'
        },
        {
          name: 'Alibaba Qwen 2.5 (7B)',
          specs: '7.6B Dense, Apache 2.0',
          pros: 'Fully permissive open-source license with no commercial user caps (avoiding Meta 700M active user terms).',
          cons: 'Similar weight footprint to LLaMA 3.1 8B at INT4 (~5-6GB including its 16-bit embeddings), though its KV cache per token is under half the size (28 layers, 4 KV heads).'
        },
        {
          name: 'Google Gemma 2 (2B)',
          specs: '2.6B Dense, Gemma Terms of Use',
          pros: 'Ultralight footprint (~2GB at INT4), suited to low-power devices and IoT appliances. Note the Gemma Terms of Use are not an OSI open-source license.',
          cons: 'Limited multi-step logical deduction and complex instruction following.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Kubernetes Overhead on Tactical Edge Hardware',
        mistake: 'Deploying a full enterprise Kubernetes control plane on a single standalone 2U server in an air-gapped environment.',
        impact: 'The control plane (etcd, API server, controllers) and add-ons take several GB of RAM and CPU cores, and add failure modes that are hard to debug without external support or telemetry.',
        remediation: 'Deploy via plain Docker Engine or systemd-managed containers. If you need Kubernetes APIs, use a lightweight single-node distribution such as k3s.'
      },
      {
        title: 'Unquantized Heavy Embeddings on Edge Silicon',
        mistake: 'Pairing an INT4-quantized LLM with an unquantized 7B embedding model that requires 14GB of VRAM.',
        impact: 'The embedding model takes ~15GB of the 48GB card and competes with the LLM for compute, so ingestion jobs slow down interactive chat.',
        remediation: 'Use compact embedding models (e.g. BGE-Small or all-MiniLM-L6-v2) running on host CPU or quantized to INT8.'
      },
      {
        title: 'Spinning Rust / Slow SATA Boot Latency',
        mistake: 'Storing model weights on mechanical hard drives or networked SATA shares in disconnected sites.',
        impact: 'Model loading after a power cycle becomes disk-bound, stretching service recovery to many minutes.',
        remediation: 'Store models on direct-attached NVMe SSDs so the ~6GB of weights loads in seconds. Expect total vLLM startup of tens of seconds to a few minutes (CUDA graph capture and warm-up); --enforce-eager shortens startup at some throughput cost.'
      }
    ],
    engineRecipe: {
      framework: 'Docker + vLLM Edge Runtime',
      commandTitle: 'Single-GPU Air-Gapped Docker Launch',
      command: `# Image transferred on approved media: docker load -i vllm-openai-<version>.tar
docker run -d --gpus '"device=0"' \\
  -p 8000:8000 \\
  -e HF_HUB_OFFLINE=1 \\
  -v /opt/models/llama-3.1-8b-instruct-awq-int4:/model \\
  vllm/vllm-openai:<pinned-version> \\
  --model /model \\
  --quantization awq_marlin \\
  --kv-cache-dtype fp8 \\
  --max-model-len 4096 \\
  --max-num-seqs 8 \\
  --gpu-memory-utilization 0.85`,
      notes: 'Runs on one L40S in a single Cisco C245 M8 server, fully disconnected. Pin an exact image version rather than :latest -- an air-gapped site cannot pull updates, so the image has to be vetted and loaded from a tarball. vLLM has no INT4 KV cache; FP8 is the smallest option and costs only ~0.5GB more here. awq_marlin is vLLM\'s faster AWQ kernel on Ampere and newer GPUs.'
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
      gpus: '4x NVIDIA H200 (141GB), 1 chassis',
      context: '32,768',
      concurrency: '64',
      sharding: 'TP=2, PP=1, DP=2 (Auto)',
      engine: 'vLLM (Speculative Decoding)',
      apc: '60% Cache Ratio',
      promptRatio: '40% Prompt / 60% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'API Gateway (Kong/Apigee class)',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'api-gateway',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Multi-step agent loops emit extensive hidden reasoning tokens before executing tool calls. The prompt/generation split is inverted: 40% prompt, 60% generation. This heavy autoregressive decode phase is memory-bandwidth bound, which is why H200 (4.8 TB/s HBM3e) is used. The FP8 70B model would fit on one GPU, but seven one-GPU replicas would each hold a copy of the weights; two TP=2 replicas (4 GPUs in one Cisco C885A) hold the same 64 concurrent agents with the weights stored twice instead of six times. The calculator estimates ~0.5s to first token and ~52ms per output token (~19 tokens/s per agent) at that batch size, or ~28ms with the preset\'s speculative decoding (1B draft, 60% acceptance).',
      memory: 'Agent workflows maintain constant system instructions, API function descriptions, and JSON schemas across all turns. Automatic Prefix Caching (APC) is configured at 60%: the shared tool catalog and instructions are computed and stored once and reused by every agent turn, saving both memory and prefill time. Speculative decoding is enabled because JSON and bracket syntax is highly predictable; gains depend on the draft acceptance rate and shrink at high batch sizes.',
      ancillary: 'Ingress employs an enterprise API Gateway (Kong/Apigee class) with rate-limiting, mTLS authentication, and token quota enforcement. RAG uses Qdrant (10 QPS) with BGE-Large embeddings. Guardrails enforce both input prompt sanitization and output tool-execution safety via Llama Guard 3 8B. Because the guard reads the full 32k-token context, the calculator adds ~1.4s to time-to-first-token and ~3.6s end to end -- per agent step, so consider checking only tool-call outputs or using a smaller guard model. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Prioritizes high prefix caching hit rates and memory bandwidth over raw batch throughput, optimizing for multi-turn agent response latency.',
      modelSelection: 'LLaMA 3.3 70B has solid function-calling ability (Meta reports 77.3 on BFCL v2) and follows JSON schemas and parameter types well. No model is perfectly reliable here, so pair it with schema-constrained decoding (see anti-patterns) rather than trusting the prompt alone.',
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
          specs: '104B Dense, Native Tool-Use API, CC-BY-NC 4.0',
          pros: 'Trained specifically for multi-step tool use and grounded answers.',
          cons: 'Requires ~34GB more weight memory in FP8, reducing concurrent agent streams per GPU. Open weights are non-commercial; production use needs a Cohere agreement.'
        },
        {
          name: 'Mistral Large 2 (123B)',
          specs: '123B Dense, Native Function Calling, Mistral Research License',
          pros: 'Strong native function calling across complex multi-step tool graphs.',
          cons: 'Higher compute and memory per step (TP=2 on H200 per replica). Commercial use requires a license from Mistral.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Ignoring Prefix Caching on Function Catalogs',
        mistake: 'Re-transmitting 3,000+ tokens of static JSON API schemas on every turn without prefix caching enabled.',
        impact: 'Every agent step re-prefills the whole schema block, adding hundreds of milliseconds per step on a 70B model -- and agents take many steps per task.',
        remediation: 'Enable Automatic Prefix Caching in vLLM (--enable-prefix-caching) and keep the tool catalog byte-identical and at the start of the prompt, so its KV blocks are computed once and reused across turns and agents.'
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
        remediation: 'A tool-call parser (--tool-call-parser llama3_json) only extracts calls from free-form output; it does not force validity. To guarantee schema-valid arguments, use structured outputs / guided decoding against the tool\'s JSON schema (in vLLM, tool_choice="required" or a named function enables this), and still validate server-side.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Tool-Calling Engine',
      commandTitle: 'Production Tool-Calling Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 2 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --enable-auto-tool-choice \\
  --tool-call-parser llama3_json \\
  --max-model-len 32768 \\
  --max-num-seqs 32 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'Two TP=2 replicas on 4 H200s, matching the calculator. With tool_choice="auto" the parser extracts calls from the model\'s text, so malformed calls are still possible; request tool_choice="required" or a named tool when the next step must be a valid call.'
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
      gpus: '6x NVIDIA H200 (141GB), 1 chassis',
      context: '131,072',
      concurrency: '24',
      sharding: 'TP=2, PP=1, DP=3 (Auto)',
      engine: 'vLLM + Chunked Prefill',
      apc: '50% Cache Ratio',
      promptRatio: '35% Prompt / 65% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'Software LB',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'software-lb',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Autonomous coding agents maintain multi-hour stateful sessions while reading stack traces, running unit tests, and rewriting files. Context window expands continuously toward 131k tokens. Qwen 2.5 72B at FP8 (~75GB) would fit on one H200 with room for two long sessions (12 one-GPU replicas for 24 agents), but three TP=2 replicas do the job on 6 GPUs in one Cisco C885A: each replica stores the weights once across two GPUs and uses the rest for eight sessions\' KV. The calculator estimates ~3.8s to first token when a turn has to prefill a large new block (for example a long test log); turns that mostly extend a cached history are much faster.',
      memory: 'A full 131k-token session needs ~21.5GB of KV at FP8 (Qwen 2.5 72B: 80 layers × 8 KV heads × 128 dims × 2 for K and V = 163,840 bytes per token), double that at FP16. The preset uses FP8 KV and enables KV cache offload to VAST storage, so dormant agent sessions can be paged out while external test suites run. The 50% APC ratio reflects the stable repository context and history reused across iterations.',
      ancillary: 'RAG uses GTE-Large-EN v1.5 with 256-token chunking and Qdrant (12 QPS) for fast semantic symbol retrieval. Ingress uses Envoy software load balancing. Guardrails (Llama Guard 3 8B) are active for code security and secret leakage prevention; on these long contexts the calculator adds ~5s to time-to-first-token and ~14s end to end per turn, so many teams check only the final patch and shell commands instead. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Relies on 141GB HBM3e GPUs and KV offload to tolerate multi-hour 131k-token sessions without dropping concurrent developer sessions, trading some time-to-first-token on large new context for a small GPU count.',
      modelSelection: 'Qwen 2.5 72B is a capable open model for agentic coding and handles long codebase contexts well during multi-file editing. SWE-bench Verified results depend heavily on the agent harness (tools, retries, test feedback), so benchmark the model inside your own harness before committing.',
      modelAlternatives: [
        {
          name: 'Qwen 2.5 Coder 32B',
          specs: '32.8B Dense, 128k Context',
          pros: 'Faster token generation and ~20% less KV per token (64 layers vs 80), plus less than half the weights, so more concurrent agents fit per GPU.',
          cons: 'Slightly less comprehensive multi-file architecture refactoring compared to 72B.'
        },
        {
          name: 'DeepSeek R1 / V3 (671B MoE)',
          specs: '671B MoE (37B active)',
          pros: 'Exceptional competitive programming and bug localization reasoning via chain-of-thought.',
          cons: '~671GB of FP8 weights need a full 8-GPU H200 or B200 node per replica (vs one H200 for the 72B), and its long reasoning traces add many output tokens per step.'
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
        impact: 'Ties up ~21.5GB of HBM per full-length session (FP8 KV) during idle periods, preventing other engineers\' agents from starting.',
        remediation: 'Configure KV cache offloading to CPU memory or NVMe (e.g. vLLM with the LMCache connector) so dormant sessions page out during external test execution and reload instead of being recomputed.'
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
  --quantization fp8 \\
  --tensor-parallel-size 2 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --max-num-seqs 8 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'Three TP=2 replicas on 6 H200s, matching the calculator. Qwen 2.5 checkpoints default to a 32k window; enable YaRN rope scaling (factor 4) per the model card to reach 131k. Chunked prefill keeps long diffs and logs from stalling other sessions.'
    }
  },
  'ent-agent-deep-research': {
    title: 'Deep Research / Multi-Hop Web Agent',
    summary: 'Iterative multi-source investigation scraping and synthesizing tens of raw web sources with low cache reuse.',
    introduction: [
      'Deep research agents conduct multi-hop investigations into complex technical, market, or legal subjects by iteratively searching the web, reading long raw HTML pages, and refining queries based on initial findings. Unlike traditional search that returns blue links, a research agent actively crawls dozens of primary sources and synthesizes a comprehensive briefing.',
      'Architecturally, this workload is dominated by heavy prefill computing with virtually zero prefix cache reuse: every web page scraped introduces unpredictable, novel text. Because the model must evaluate source credibility, resolve factual contradictions, and compose a coherent multi-page report, this archetype favors a large dense model (100B+ parameters) paired with large context memory.'
    ],
    specs: {
      model: 'Mistral Large 2 (123B)',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C885A',
      gpus: '4x NVIDIA H200 (141GB), 1 chassis',
      context: '131,072',
      concurrency: '16',
      sharding: 'TP=4, PP=1, DP=1 (Auto)',
      engine: 'vLLM (Chunked Prefill)',
      apc: '15% Cache Ratio (Low Reuse)',
      promptRatio: '85% Prompt / 15% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Multi-AZ (High Availability)',
      ingress: 'API Gateway',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-az',
      ingressEnabled: true,
      ingressTierId: 'api-gateway',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Deep research requires strong reasoning to synthesize conflicting source material, so Mistral Large 2 (123B dense) is used. At FP8 its weights need ~124GB, more than one H200 can hold alongside any KV cache. The smallest fitting layout (TP=2) would need four replicas -- 8 GPUs -- for 16 long sessions; a single TP=4 replica on 4 GPUs stores the weights once (~31GB per GPU) and leaves ~83GB per GPU for KV, serving all 16 sessions with ~12GB per GPU still free. Prefill of a ~111k-token prompt takes ~14s at TP=4 in the calculator; higher TP or latency targets shorten it.',
      memory: 'Web research is prefill-dominated (85% prompt, 15% synthesis). Mistral Large 2 has 88 layers and 8 KV heads, so a full 131k-token session holds ~23.6GB of FP8 KV. Because each search hop pulls in new, unpredictable pages, Automatic Prefix Caching is set to only 15% (mostly the system prompt and earlier turns). Chunked prefill (on by default in current vLLM) keeps 100k-token web dumps from stalling other sessions\' decode.',
      ancillary: 'RAG uses Qwen3-Embedding 0.6B (32k-token inputs, Apache 2.0) with 1,024-token chunks backed by Milvus; for the preset\'s 3TB corpus the calculator sizes 15 L40S GPUs to meet the ingestion window. (NV-Embed-v2 would add quality but is non-commercial and ~13x the compute.) Storage uses VAST Universal with 8+3 erasure coding. Granite Guardian 3 8B checks inputs and outputs for harm and groundedness; on 111k-token prompts it adds ~12s to time-to-first-token in the calculator. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Employs a frontier 123B model with low cache hit rates, prioritizing multi-source synthesis quality over high stream concurrency.',
      modelSelection: 'Mistral Large 2 (123B) has the capacity to synthesize conflicting source material, resolve ambiguity, and write long, structured reports. Licensing matters here: the open weights are released under the Mistral Research License, which does not permit commercial production use without a separate commercial license from Mistral.',
      modelAlternatives: [
        {
          name: 'DeepSeek R1 (671B MoE)',
          specs: '671B MoE (37B active)',
          pros: 'Explicit chain-of-thought reasoning that helps surface subtle correlations and contradictions across documents. MIT license.',
          cons: '~671GB of FP8 weights need a full 8-GPU H200 or B200 node per replica, and long reasoning traces add many output tokens per query.'
        },
        {
          name: 'Meta LLaMA 3.1 (405B)',
          specs: '405B Dense, 128k Context',
          pros: 'Frontier open dense model with unmatched encyclopedic world knowledge and synthesis depth.',
          cons: '~405GB of FP8 weights fit in one 8x H200 node (TP=8), but that is a whole node per replica, and every token reads ~3.3x more weights than the 123B model, so throughput per GPU is roughly a third.'
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
        impact: 'Markup can make up most of the tokens on a typical page, filling the context window with noise and multiplying prefill time and cost.',
        remediation: 'Sanitize all scraped web content with an HTML-to-markdown text extractor (e.g. Trafilatura or readability-lxml) prior to LLM ingest.'
      },
      {
        title: 'Monolithic Prefill of 100k+ Web Dumps',
        mistake: 'Ingesting 100,000+ tokens of scraped articles in a single unchunked forward prefill step.',
        impact: 'Transient activation memory scales with tokens per step and can exhaust the little headroom left, while the long step stalls every other session\'s decode.',
        remediation: 'Use chunked prefill with a bounded step (--max-num-batched-tokens 8192). It is on by default in current vLLM; older releases need --enable-chunked-prefill.'
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
  --quantization fp8 \\
  --tensor-parallel-size 4 \\
  --kv-cache-dtype fp8 \\
  --enable-chunked-prefill \\
  --max-num-batched-tokens 8192 \\
  --max-model-len 131072 \\
  --max-num-seqs 16 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One TP=4 replica on 4 H200s holding 16 long sessions, matching the calculator. Check the Mistral Research License before production use.'
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
      model: 'LLaMA 3.1 8B (Worker Swarm)',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Cisco UCS C245 M8',
      gpus: '14x NVIDIA L40S PCIe across 4 chassis',
      context: '8,192',
      concurrency: '1,024 (Swarm Concurrency)',
      sharding: 'TP=1, PP=1, DP=14 (Auto)',
      engine: 'vLLM + Ray Core',
      apc: '50% Cache Ratio',
      promptRatio: '50% Prompt / 50% Gen',
      servingArch: 'Distributed Worker Pool',
      protocol: 'Lossless RoCEv2',
      storage: 'VAST Data Universal Storage',
      durability: 'Replicated 2x',
      hadr: 'Warm Standby',
      ingress: 'API Gateway (High-throughput)',
      mlops: 'Canary Release (10% Traffic)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'warm-standby',
      ingressEnabled: true,
      ingressTierId: 'api-gateway',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'In planner-worker architectures the worker swarm, not the planner, drives most of the infrastructure. Each worker call is small and independent, so the 8B model runs at TP=1 and the pool scales purely by replication: the calculator needs 14 L40S GPUs (DP=14, spread over four Cisco C245 chassis) to hold the KV cache for 1,024 concurrent 8k-token workers while keeping a 5% memory margin. The case for L40S is cost per GB of memory, not speed: at the calculator\'s prices 14 L40S cost less in GPU capex than the 4 H200s that would hold similar KV, and TP=1 workers never use NVLink, so paying for it buys nothing. H200s would, however, give each worker faster decode.',
      memory: 'Worker tasks are concise (8k context) with 50% prefix caching (shared role instructions). LLaMA 3.1 8B needs 65,536 bytes of FP8 KV per token, so auto-DP sizes the replica count by KV capacity: each L40S ends up serving ~73 streams with ~30GB of KV beside ~9GB of weights.',
      ancillary: 'Orchestration runs on Ray cluster management. Ingress requires an enterprise API Gateway to manage the sudden burst of 1,000+ internal micro-agent requests. Llama Guard 3 8B screens worker traffic on three dedicated GPUs, adding ~0.45s to time-to-first-token per call in the calculator; for purely internal subtasks, guarding only the planner\'s external inputs and final outputs is often enough. Storage uses VAST with a 30-second model load target to support dynamic worker autoscaling. New model versions roll out via a Canary Release validating against 10% of live traffic before full promotion.',
      tradeoff: 'Decouples orchestration into a two-tier hardware strategy: cheap, dense L40S GPUs handle the 1,024-worker swarm, leaving complex planning to an isolated high-end instance.',
      modelSelection: 'LLaMA 3.1 8B handles high-volume, simple subtasks (summarize a snippet, extract a date, validate an email) well. At ~74 streams per L40S the calculator estimates ~115ms per output token (~9 tokens/s per worker) but ~9,000 tokens/s across the pool: the design deliberately trades per-worker speed for aggregate throughput.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (7B)',
          specs: '7.6B Dense, Apache 2.0',
          pros: 'Competitive with LLaMA 3.1 8B on tool calling, math and structured extraction, and its KV cache is under half the size per token (28 layers, 4 KV heads), so each GPU holds roughly twice as many workers.',
          cons: 'Similar weight size and decode speed.'
        },
        {
          name: 'Microsoft Phi-3.5 Mini (3.8B)',
          specs: '3.8B Dense, 128k Context',
          pros: 'Half the weights of an 8B model, so less compute per token.',
          cons: 'No grouped-query attention (32 KV heads), so its KV cache is ~3x larger per token than LLaMA 3.1 8B. For a KV-bound swarm like this one it fits fewer concurrent workers per GPU, not more. Smaller knowledge base.'
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
        impact: 'Pays for NVLink bandwidth and SXM-class compute that independent TP=1 workers never use; the swarm is bound by memory capacity, which PCIe cards supply more cheaply per GB.',
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
        impact: 'The same role prompt is prefilled again for each of the 1,000 dispatches, wasting compute and adding queue latency.',
        remediation: 'Standardize worker prompt headers (byte-identical, at the start of the prompt) and enable Automatic Prefix Caching so each role definition is computed once per replica and reused.'
      }
    ],
    engineRecipe: {
      framework: 'Ray Core + vLLM Worker Pool',
      commandTitle: 'Production Swarm Worker Daemon Command',
      command: `vllm serve meta-llama/Llama-3.1-8B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 1 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 8192 \\
  --max-num-seqs 74 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One instance per L40S (TP=1), fourteen in total (DP=14 as in the calculator). Ray workers call the local instance on each node; bound the planner\'s fan-out to the pool\'s ~1,000-stream capacity.'
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
      gpus: '2x NVIDIA H200 (141GB), 1 chassis',
      context: '16,384',
      concurrency: '48',
      sharding: 'TP=2, PP=1, DP=1 (Auto)',
      engine: 'vLLM + KServe',
      apc: '30% Cache Ratio',
      promptRatio: '60% Prompt / 40% Gen',
      servingArch: 'Colocated Serving',
      protocol: '400G RoCEv2',
      storage: 'NetApp AFF A-Series',
      durability: 'Erasure Coded (8+3)',
      hadr: 'Disabled (Internal Tool)',
      ingress: 'Disabled (Internal Tool)',
      mlops: 'Disabled (Internal Tool)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: false,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Generating production SQL over 50-table schemas requires 70B-class reasoning to prevent hallucinated joins and syntax errors. The FP8 70B model fits on one H200, but three one-GPU replicas would be needed for 48 analysts; a single TP=2 replica on 2 GPUs stores the weights once and serves all 48 from the freed memory. The calculator estimates ~0.6s to first token and ~42ms per output token.',
      memory: '16k context window comfortably holds DDL table schemas, column foreign-key relationships, and sample query rows. 30% APC ratio caches the enterprise data catalog schema across iterative user query refinements.',
      ancillary: 'Storage uses NetApp AFF with 8+3 erasure coding. Guardrails are disabled because database access is governed strictly by relational database row-level security (RLS) and database permissions rather than LLM text filters. MLOps validation pools are disabled as this internal tool has no live-traffic rollout process.',
      tradeoff: 'Balances schema context capacity (16k) and 48-stream concurrency against a two-GPU footprint.',
      modelSelection: 'LLaMA 3.3 70B demonstrates deep semantic comprehension of SQL joins, subqueries, dialect specifics (PostgreSQL, Snowflake, BigQuery), and schema ambiguity, preventing costly Cartesian products.',
      modelAlternatives: [
        {
          name: 'Alibaba Qwen 2.5 (72B)',
          specs: '72.7B Dense',
          pros: 'Strong text-to-SQL results (the Qwen 2.5 family reports competitive Spider and BIRD scores) and good handling of CTEs and nested subqueries.',
          cons: '~2GB more FP8 weights; identical KV cache per token. Qwen License rather than Apache 2.0 for the 72B.'
        },
        {
          name: 'Defog SQLCoder (70B)',
          specs: '70B Dense (CodeLlama-70B base), SQL Specialist',
          pros: 'Fine-tuned specifically for text-to-SQL; at release it outperformed general models of its time on Defog\'s SQL evaluation.',
          cons: 'An early-2024 alpha built on CodeLlama; newer general models have largely caught up. Weak at explaining findings conversationally to non-technical users.'
        },
        {
          name: 'Cohere Command R+ (104B)',
          specs: '104B Dense, CC-BY-NC 4.0',
          pros: 'Strong RAG grounding for looking up table metadata and column descriptions, with citations back to data dictionaries.',
          cons: '~104GB of FP8 weights (TP=2 per replica on H200). Open weights are non-commercial; production use needs a Cohere agreement.'
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
        impact: 'Every turn re-prefills ~10k tokens of unchanged schema -- on the order of a second of extra latency per turn for a 70B model at TP=1 -- and burns GPU time that could serve other analysts.',
        remediation: 'Enable Automatic Prefix Caching in vLLM (--enable-prefix-caching) and put the schema first in the prompt, byte-identical across requests, so it is computed once per replica and shared by all analysts.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM SQL Specialist Runtime',
      commandTitle: 'Production Text-to-SQL Serving Command',
      command: `vllm serve meta-llama/Llama-3.3-70B-Instruct \\
  --quantization fp8 \\
  --tensor-parallel-size 2 \\
  --kv-cache-dtype fp8 \\
  --enable-prefix-caching \\
  --max-model-len 16384 \\
  --max-num-seqs 48 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One TP=2 replica on 2 H200s, matching the calculator. Prefix caching keeps the warehouse schema resident so repeated questions skip its prefill.'
    }
  },
  'neo-frontier-pretrain': {
    title: 'Frontier Pretraining Run (1,000+ GPUs)',
    summary: 'Hyperscale foundation model pretraining run for a 405B dense model across liquid-cooled Blackwell clusters on InfiniBand.',
    introduction: [
      'Frontier pretraining represents the absolute peak of AI systems engineering: training a 400B+ parameter foundation model from scratch across thousands of tightly synchronized accelerators running continuously for months. At this hyperscale, hardware faults are a daily statistical reality, and any networking bottleneck or storage delay can stall thousands of GPUs, wasting millions of dollars in idle compute.',
      'Sizing a 1,000+ GPU cluster demands non-blocking Quantum-2 InfiniBand networks with full bisection bandwidth, liquid or high-density air cooling for ~1,000W Blackwell B200 GPUs (~14.3kW per 8-GPU chassis) at a Power Usage Effectiveness (PUE) of 1.15, and parallel NVMe storage filesystems capable of saving multi-terabyte checkpoints in under three minutes without pausing backpropagation.'
    ],
    specs: {
      model: 'LLaMA 3.1 405B Dense',
      precision: 'BF16 Mixed Precision (ZeRO-3)',
      platform: 'NVIDIA HGX B200',
      gpus: '1,024 GPUs (128 Chassis x 8 GPUs)',
      context: '8,192',
      concurrency: 'Micro-batch 4 per replica',
      sharding: 'TP=8, PP=1, DP=128 (ZeRO-3)',
      engine: 'Megatron-LM / PyTorch FSDP',
      apc: 'N/A (Pretraining)',
      promptRatio: '80% Prompt / 20% Target',
      servingArch: 'Distributed Pretraining',
      protocol: '3.2 Tbps Quantum-2 InfiniBand',
      storage: 'WekaFS NVMe Parallel Filesystem',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Disabled (Checkpoint Resume)',
      ingress: 'Internal Compute Fabric',
      mlops: 'Disabled (Checkpoint Resume)'
    },
    complianceFacts: {
      workloadType: 'training',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: false,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Pretraining a 405B model from scratch is enormously expensive: Meta reports ~3.8 × 10²⁵ FLOPs for LLaMA 3.1 405B on ~15.6T tokens, run on up to 16,384 H100s. This preset uses 1,024 NVIDIA B200 GPUs (180GB HBM3e, 8.0 TB/s) across 128 HGX chassis, with TP=8 inside each chassis over NVLink 5 (1.8 TB/s per GPU) and DP=128 across chassis with ZeRO-3 sharding over a 400G-per-GPU (3.2 Tbps per node) Quantum-2 InfiniBand fabric. For scale: at ~2.25 PFLOPs dense BF16 per B200 and ~40% MFU, a full 3.8 × 10²⁵ FLOP run would take well over a year on 1,024 GPUs, so a cluster this size suits continued pretraining, smaller models or shorter token budgets rather than a from-scratch 405B run. The calculator\'s training-time estimate for the preset\'s 15T tokens is ~458 compute days and ~483 wall-clock days: with a GPU failure every ~49 hours across 1,024 GPUs, checkpoint and restart losses leave ~95% goodput. Finishing in about 70 days would take ~8,192 GPUs.',
      memory: 'Mixed-precision training state for 405B is ~6,480GB (16 bytes per parameter: BF16 weights and gradients plus FP32 master weights and AdamW moments). Sharded across all 1,024 GPUs (TP=8 × ZeRO-3 over DP=128), each GPU holds ~6.3GB of state; the calculator adds ~2.2GB of activations per GPU at micro-batch 4 with selective recomputation, for ~8.6GB used. That leaves plenty of room to raise the micro-batch or drop activation recomputation for speed.',
      ancillary: 'A checkpoint holds weights plus optimizer state (~5.7TB; gradients are not saved), so the 180-second write target needs ~31.5 GB/s of sustained write bandwidth -- hence a WekaFS NVMe parallel filesystem, which also has to stream the 2PB dataset. Asynchronous checkpointing (copy to host memory, write in the background) shortens the actual GPU stall further. 10+4 erasure coding tolerates four simultaneous drive or node failures at 1.4x raw overhead. Facility design assumes PUE 1.15 and $150/kW-month colocation. Instead of HA/DR, the preset reserves ~2% spare nodes so a failed node can be swapped and the job resumed from the last checkpoint. MLOps rollout validation does not apply to pretraining.',
      tradeoff: 'Pure compute density and full network bisection bandwidth. The architecture is optimized for sustained Model FLOPs Utilization; well-tuned large dense runs typically land around 35% to 45% MFU.',
      modelSelection: 'LLaMA 3.1 405B is the largest widely used open-weights dense model (405B parameters, 126 layers, 16,384 hidden dimension, 128 query heads with 8 KV heads), so it is the reference architecture for this preset. Training at 1,024+ GPU scale requires full-bisection InfiniBand and a parallel filesystem.',
      modelAlternatives: [
        {
          name: 'NVIDIA Nemotron-4 340B (Base / Instruct)',
          specs: '340B Dense, 96 Layers, 18,432 Hidden, 8 GQA Heads',
          pros: 'Purpose-built for synthetic data generation. The NVIDIA Open Model License permits commercial use, including using outputs to train other models.',
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
          pros: 'A dense architecture between 70B and 405B, useful as an intermediate scale.',
          cons: 'Weights are released under the Mistral Research License, which restricts commercial use; as a from-scratch architecture it offers no advantage over a LLaMA-style design of the same size.'
        }
      ]
    },
    antiPatterns: [
      {
        title: 'Silent Optical Transceiver Degradation',
        mistake: 'Operating 1,024 GPUs across 8,000+ optical transceivers without proactive BER (Bit Error Rate) telemetry.',
        impact: 'A degraded optical link causes retransmissions and link flaps that slow every collective to the speed of the worst link and eventually trigger NCCL timeouts that crash the job, losing all work since the last checkpoint.',
        remediation: 'Monitor link error counters continuously with fabric management telemetry (NVIDIA UFM for InfiniBand), run pre-flight health checks before each launch, and drain nodes with degrading links before they fail mid-run.'
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
        remediation: 'Use the 180GB of B200 memory to keep PP small (PP=1 here), and when PP is needed use enough micro-batches plus an interleaved 1F1B schedule to keep the bubble low.'
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
  --group-query-attention \\
  --num-query-groups 8 \\
  --ffn-hidden-size 53248 \\
  --seq-length 8192 \\
  --micro-batch-size 4 \\
  --global-batch-size 2048 \\
  --use-distributed-optimizer \\
  --bf16`,
      notes: 'Executes across 128 HGX B200 nodes (1,024 GPUs) on Quantum-2 InfiniBand, 400G per GPU. Global batch 2048 = micro-batch 4 × DP 128 × 4 gradient-accumulation steps. Megatron\'s distributed optimizer shards optimizer state across data-parallel ranks (ZeRO-1 style); the calculator\'s ZeRO-3 figure corresponds to also sharding parameters and gradients, as PyTorch FSDP or Megatron FSDP do. Tokenizer and data flags are omitted.'
    }
  },
  'neo-maas-inference': {
    title: 'Model-as-a-Service Inference at Scale',
    summary: 'Public API hosting DeepSeek R1 671B MoE for 4,000+ concurrent streams backed by MLA and Edge CDN.',
    introduction: [
      'Operating a public Model-as-a-Service (MaaS) API—hosting open-weights frontier models like DeepSeek R1 for thousands of paying third-party tenants—is governed by razor-thin unit economics and unpredictable burst traffic. Operators cannot afford the high compute overhead of traditional dense models when competing on pennies per million tokens.',
      'This blueprint utilizes DeepSeek R1\'s sparse Mixture-of-Experts (MoE) architecture: while all 671 billion weights remain resident in memory, only 37 billion active parameters compute on any single token. Combined with Multi-Head Latent Attention (MLA), which stores ~4.7x less KV per token than a LLaMA-70B-class model, the architecture serves over 4,000 concurrent streams at a low cost per token.'
    ],
    specs: {
      model: 'DeepSeek R1 671B MoE',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'NVIDIA HGX B200',
      gpus: '512x B200 (64 chassis × 8)',
      context: '32,768',
      concurrency: '4,096 Concurrent Streams',
      sharding: 'TP=8, PP=1, DP=64 (Auto)',
      engine: 'TensorRT-LLM + Ray',
      apc: '10% Cache Ratio',
      promptRatio: '70% Prompt / 30% Gen',
      servingArch: 'Colocated Multi-Tenant Cluster',
      protocol: 'InfiniBand, 2:1 oversubscribed',
      storage: 'WekaFS NVMe Parallel Filesystem',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Multi-Site Active-Active',
      ingress: 'Global CDN Edge Network',
      mlops: 'Blue/Green Cutover (Full Duplicate Pool)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: true,
      haDrTierId: 'multi-site-active-active',
      ingressEnabled: true,
      ingressTierId: 'cdn-edge',
      guardrailsEnabled: true,
      migEnabled: false,
      mlopsEnabled: true,
      mlopsStrategyId: 'blue-green-cutover',
    },
    rationale: {
      silicon: 'DeepSeek R1 has 671B total parameters but only 37B active per token. At FP8 all ~671GB of weights must stay resident in HBM. An HGX B200 node offers 8 × 180GB = 1,440GB (~1,296GB usable), so one replica fits in a single 8-GPU chassis at TP=8 with no pipeline parallelism. With the default 5% memory margin the calculator scales to 4,096 streams with 64 replicas (512 GPUs, 64 per replica). Replicas do not exchange traffic during inference, which is why a 2:1 oversubscribed fabric is acceptable here when it would not be for training. At this scale, wide expert parallelism (Sharding tab: spread each replica over 2-4 chassis) frees much more memory per GPU for KV cache and can cut the GPU count substantially, at the cost of all-to-all traffic that needs a non-blocking fabric.',
      memory: 'Multi-Head Latent Attention (MLA) is what makes 4,096 concurrent streams practical. It caches a 512-element compressed latent plus a 64-element positional key per token per layer (576 elements), so DeepSeek R1 needs 35,136 bytes per token at FP8 across 61 layers -- ~4.7x less than LLaMA 70B\'s GQA cache (163,840 bytes). A 32k-token stream therefore needs ~1.2GB of KV instead of ~5.4GB.',
      ancillary: 'Ingress uses a Global CDN Edge network to terminate TLS and TCP handshakes at edge PoPs close to users worldwide, slashing initial connection overhead. Storage uses WekaFS with a 60-second model-load target so a replaced or rescheduled node is serving again quickly. HA/DR uses Multi-Site Active-Active so the service survives the loss of a whole site. Llama Guard 3 8B screens tenant traffic on its own pool (96 GPUs in the calculator) and adds ~2.5s to time-to-first-token on 23k-token prompts, a large share of the SLA budget for an API product. Model updates use a Blue/Green Cutover, validating a full-scale duplicate pool before an instant traffic flip -- the partial-rollout risk of a canary is unacceptable for a multi-tenant MaaS platform serving thousands of API consumers.',
      tradeoff: 'Accepts massive cluster VRAM commitment (holding 671B weights per replica) to unlock the low per-token compute and cost of a sparse MoE model.',
      modelSelection: 'DeepSeek R1 / V3 changed open-model serving economics: with 37B of its 671B parameters active per token, it needs roughly a tenth of the per-token compute of a 405B dense model while offering frontier-class reasoning. Its weights are MIT-licensed.',
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
          cons: 'Lower math and reasoning scores than DeepSeek R1, and a shorter 64k context.'
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
        remediation: 'Use expert parallelism with load balancing: replicate hot experts on additional GPUs (e.g. DeepSeek\'s EPLB approach) and monitor per-expert load. Dropping tokens is a training-time technique and degrades output quality if used in serving.'
      },
      {
        title: 'Serving Sparse MoE at Low Batch Concurrency',
        mistake: 'Operating DeepSeek 671B at low concurrency (batch sizes < 8).',
        impact: 'Every decode step still streams the active experts\' weights from HBM; at low batch sizes that cost is spread over few tokens, so arithmetic intensity is poor and cost per token is high.',
        remediation: 'Aggregate incoming traffic via continuous batching, maintaining sustained batch sizes >= 64 per replica to amortize expert weight loads.'
      },
      {
        title: 'Caching Decompressed MLA Keys and Values',
        mistake: 'Running DeepSeek on an engine or attention backend without native MLA support, so it caches fully expanded per-head keys and values.',
        impact: 'The KV cache grows many times larger than the 576-element latent, erasing MLA\'s memory advantage and causing out-of-memory errors at long contexts or high concurrency.',
        remediation: 'Use an engine with native MLA kernels (e.g. FlashMLA in vLLM/SGLang, or TensorRT-LLM) that store only the compressed latent and absorb the up-projections into the attention computation.'
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
  --max-num-seqs 64 \\
  --gpu-memory-utilization 0.90 \\
  --port 8000`,
      notes: 'One 8x B200 node per replica (TP=8, PP=1); run 64 replicas to match the calculator (4,096 streams = 64 per replica). The preset\'s engine is TensorRT-LLM; the vLLM command is shown because it is shorter, and the sizing is the same.'
    }
  },
  'neo-llmd-disaggregated': {
    title: 'Disaggregated Serving Showcase (LLM-D)',
    summary: 'Heterogeneous split: Compute-dense B200 prefill pool streaming KV cache over RoCEv2 to a memory-dense H200 decode pool.',
    introduction: [
      'Disaggregated Serving (LLM-D) is the most advanced inference topology in modern AI datacenters. In traditional shared servers, prompt processing ("Prefill") and token generation ("Decode") compete for the exact same GPU resources. When a large prompt arrives, it monopolizes the compute cores—causing noticeable stutter and latency spikes for ongoing users.',
      'LLM-D physically splits the cluster into two heterogeneous pools: compute-heavy Blackwell B200 nodes process incoming prompts, then stream the resulting Key-Value memory across a lossless 400G RoCEv2 network to memory-heavy Hopper H200 nodes that handle token generation. Separating the phases removes prefill-decode interference, so decode latency stays far more predictable, at the cost of moving KV over the network.'
    ],
    specs: {
      model: 'LLaMA 3.1 405B Dense',
      precision: 'FP8 Weights / FP8 KV',
      platform: 'Heterogeneous: B200 + H200',
      gpus: '4x B200 Prefill Nodes (32 GPUs) + 14x H200 Decode Nodes (112 GPUs)',
      context: '32,768',
      concurrency: '1,024 Streams',
      sharding: 'Prefill 8 × TP=4 / Decode 14 × TP=8 (auto-sized)',
      engine: 'vLLM (LLM-D Disaggregated Engine)',
      apc: '20% Cache Ratio',
      promptRatio: '70% Prompt / 30% Gen',
      servingArch: 'LLM-D Disaggregated',
      protocol: 'Cisco Nexus 400G RoCEv2',
      storage: 'WekaFS NVMe All-Flash',
      durability: 'Erasure Coded (10+4)',
      hadr: 'Disabled (Architecture Showcase)',
      ingress: 'Disabled (Architecture Showcase)',
      mlops: 'Disabled (Architecture Showcase)'
    },
    complianceFacts: {
      workloadType: 'inference',
      haDrEnabled: false,
      haDrTierId: 'multi-az',
      ingressEnabled: false,
      ingressTierId: 'software-lb',
      guardrailsEnabled: false,
      migEnabled: false,
      mlopsEnabled: false,
      mlopsStrategyId: 'canary-release',
    },
    rationale: {
      silicon: 'Colocated serving causes phase interference: a long prompt occupies the GPUs for its whole prefill, stalling token generation for everyone else on that replica. LLM-D splits the cluster into two hardware tiers, each made of independent instances: (1) Prefill pool on NVIDIA B200 -- ~410GB of FP8 weights fit on four 180GB GPUs with room to spare, so each instance is TP=4 and the calculator needs 8 instances (4 nodes) to keep up with ~2.6 new 23k-token prompts per second at 65% utilization, each taking ~2.2s to prefill. (2) Decode pool on NVIDIA H200 -- the weights need TP=8 on 141GB GPUs, and holding the KV cache for 1,024 concurrent 32k-token users takes 14 instances (14 nodes, 1,974GB of HBM3e). Both pool sizes are solved automatically from the workload; you can switch to manual node counts on the Serving Stack tab.',
      memory: 'Prefill nodes maintain zero persistent KV cache—they generate the attention vectors for the prompt and immediately stream the KV chunk across the network. Decode nodes hold the persistent KV cache across the full 32k context window.',
      ancillary: 'Networking is the critical system bus: a lossless 400G RoCEv2 fabric streams the KV cache directly from prefill to decode GPUs via RDMA. Overlapped KV transfer is enabled, transmitting each layer\'s KV while the next layer computes. FP8 KV halves the payload: a ~23k-token prompt (70% of 32k) produces ~5.9GB of KV for LLaMA 405B, which takes ~33ms to send over a TP=4 prefill instance\'s four 400G NICs, and with per-layer overlap only ~0.26ms of that remains on the critical path in the calculator. MLOps validation pools are disabled for this architecture showcase.',
      tradeoff: 'Introduces network-dependent KV streaming and two pools to size and balance, in exchange for isolating compute-bound prefill from memory-bound decode, which gives much steadier decode latency at scale.',
      modelSelection: 'LLaMA 3.1 405B shows where disaggregation pays off most: in colocated serving, a long 405B prefill occupies the GPUs for a long time and stalls decode for every other stream. Splitting into B200 prefill and H200 decode pools removes that interference.',
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
        impact: 'Without lossless configuration, bursts overflow switch buffers; RoCE reacts badly to loss (go-back-N retransmission), and misconfigured PFC can cause pause storms, turning a millisecond-scale transfer into long stalls.',
        remediation: 'Deploy a dedicated lossless RoCEv2 fabric with Cisco Nexus 9000 switches enforcing DCQCN congestion control and hardware ECN.'
      },
      {
        title: 'Sequential (Non-Overlapped) KV Cache Transfer',
        mistake: 'Waiting for all 126 transformer layers of prefill compute to finish before starting KV network transmission.',
        impact: 'The whole transfer (~33ms for a 23k-token FP8 prompt over a TP=4 instance\'s four 400G NICs, twice that at FP16) lands on the critical path of every request, eroding the latency advantage of disaggregation.',
        remediation: 'Enable layer-by-layer overlapped KV transfer, pipelining RDMA transfer of layer l concurrently with GPU computation of layer l+1.'
      },
      {
        title: 'Prefill-to-Decode Sizing Mismatch',
        mistake: 'Over-provisioning decode nodes while under-provisioning prefill nodes without dynamic routing.',
        impact: 'Prefill nodes hit 100% saturation and queue incoming requests, while expensive decode GPUs sit idle waiting for KV tokens.',
        remediation: 'Size prefill from the prompt arrival rate and decode from the KV cache of all concurrent streams -- the calculator does this automatically (this preset lands at 4 prefill : 14 decode nodes) -- and use a router that can shift capacity between pools as the traffic mix changes.'
      }
    ],
    engineRecipe: {
      framework: 'vLLM Disaggregated Serving Architecture (LLM-D)',
      commandTitle: 'Production LLM-D Node Launch Commands',
      command: `# 1. Prefill worker (B200 node) -- produces KV and sends it over RDMA
vllm serve meta-llama/Llama-3.1-405B-Instruct-FP8 \\
  --tensor-parallel-size 4 \\
  --kv-cache-dtype fp8 \\
  --kv-transfer-config '{"kv_connector":"NixlConnector","kv_role":"kv_both"}' \\
  --port 8000

# 2. Decode worker (H200 node) -- receives KV and generates tokens
vllm serve meta-llama/Llama-3.1-405B-Instruct-FP8 \\
  --tensor-parallel-size 8 \\
  --kv-cache-dtype fp8 \\
  --kv-transfer-config '{"kv_connector":"NixlConnector","kv_role":"kv_both"}' \\
  --port 8001

# 3. A disaggregation-aware router (e.g. the llm-d inference scheduler)
#    sends each request to a prefill worker, then to a decode worker.`,
      notes: 'Illustrative: vLLM\'s disaggregated-serving flags have changed across releases, so follow the llm-d / vLLM docs for your version. Run 8 prefill instances (TP=4, two per B200 node) and 14 decode instances (TP=8, one per H200 node) to match the calculator. NIXL moves KV blocks GPU-to-GPU over RDMA (RoCEv2 or InfiniBand).'
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
          Memory_weights = [ (P × 10⁹ − N_head) × B_param + N_head × 2 ] / 10⁹ [GB],  N_head = 2 × vocab × hidden (quantized precisions only)
        </div>
        <p>
          Where <span className="font-mono text-sky-400">B_param</span> is governed by numerical precision:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>FP16 / BF16 (16-bit):</strong> 2.0 bytes/parameter. Baseline gold standard for training and unquantized inference.</li>
          <li><strong>FP8 (8-bit, usually E4M3 for inference):</strong> 1.0 byte/parameter. Halves weight memory; for large models the benchmark loss is typically small (often well under a point), but check your own evaluations. Native FP8 Tensor Cores need Hopper, Ada Lovelace (L40S) or Blackwell.</li>
          <li><strong>NVFP4 (NVIDIA Blackwell 4-bit):</strong> 0.5625 bytes/parameter (4-bit values plus one 8-bit scale per block of 16 = 4.5 bits). Native acceleration requires Blackwell.</li>
          <li><strong>MXFP4 (OCP microscaling 4-bit):</strong> ~0.53 bytes/parameter (4-bit values plus one 8-bit scale per block of 32 = 4.25 bits). The format gpt-oss ships its expert weights in; native on Blackwell and MI355X, emulated through 16-bit math elsewhere.</li>
          <li><strong>INT4 (AWQ / GPTQ):</strong> ~0.53 bytes/parameter (4-bit values plus a 16-bit scale and zero-point per group of 128 ≈ 4.25 bits). Weight-only: activations stay 16-bit, so INT4 mainly saves memory and speeds up memory-bound decode.</li>
        </ul>
        <DecisionCallout title="Unquantized Embedding & LM Head Overhead">
          Common quantization recipes (AWQ, GPTQ, most FP8 checkpoints) leave the token embedding table and the output projection (<span className="font-mono">lm_head</span>) at 16-bit, because quantizing them costs accuracy and saves comparatively little. The calculator therefore prices those <span className="font-mono">2 × vocab × hidden</span> parameters at 2 bytes each and the rest at the quantized rate. For LLaMA 3.1 8B (128k vocabulary × 4,096 hidden) that is ~2.1GB -- over a third of its INT4 footprint -- which is why small models shrink less than the headline bit-width suggests.
        </DecisionCallout>
        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">Mixture of Experts (MoE) Memory Residency</h3>
        <p>
          In MoE models like DeepSeek-V3 or Mixtral, only a small subset of parameter "experts" are active during the generation of any single token. For example, DeepSeek R1 has 671B total parameters, but only routes 37B active parameters per token.
        </p>
        <p>
          While compute per token scales with the 37B active parameters, <strong>all 671B parameters must stay resident in GPU memory</strong>, because different tokens in a batch route to different experts and every expert is used within a few steps. Some engines can offload experts to CPU memory, but fetching them over PCIe makes decode many times slower, so production serving sizes HBM for the full parameter count.
        </p>
      </div>
    )
  },
  'chap-2-kv': {
    title: 'KV Cache & Attention Mechanics',
    subtitle: 'Grouped-Query Attention (GQA), Multi-Head Latent Attention (MLA), and Automatic Prefix Caching.',
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
          The leading 2 is for keys and values. For LLaMA 3.1/3.3 70B (80 layers, 8 KV heads, 128 dims) that is 327,680 bytes per token at FP16 or 163,840 at FP8 -- ~21.5GB for one 131k-token sequence at FP8. MLA models replace the per-head term with the latent width: <span className="font-mono">KV_bytes_per_token = L × (d_c + d_r) × B_kv_elem</span>.
        </p>
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
            This stores only 576 elements per token per layer (61 layers for DeepSeek R1/V3), or 35,136 bytes per token at FP8 -- <strong>~4.7x less KV than a LLaMA 70B-class GQA model</strong> at the same precision.
          </li>
        </ul>
        <p>
          Some newer models only attend to a recent window on most layers: Gemma 3 uses a 1,024-token sliding window on five of every six layers, gpt-oss a 128-token window on every other layer, and Llama 4 an 8k chunked window on three of every four. Those layers never cache more than their window, so the calculator counts each one as <span className="font-mono">min(1, window / context)</span> of a layer. At long contexts this cuts KV memory several-fold compared with a full-attention model of the same size.
        </p>
        <DecisionCallout title="Automatic Prefix Caching (APC)">
          APC reuses KV blocks for identical prompt prefixes. vLLM hashes fixed-size blocks of tokens (each block&apos;s hash covers everything before it), while SGLang organizes the same idea as a radix tree; either way, a system prompt, few-shot examples or shared document shared by many requests is computed and stored <em>once</em>. Reuse only works for an exact prefix match, so put stable content first. The calculator models the APC ratio as the fraction of each prompt that is stored once for all streams; the rest is stored per stream. Reusing a single user&apos;s own chat history does not save memory across users, but it does skip that history&apos;s prefill on later turns, cutting TTFT.
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
            <span className="text-sky-400 font-semibold block mb-1">Tensor Parallel (TP)</span>
            Shards the matrix multiplies within each layer. Two all-reduces per layer, so keep it inside an NVLink domain (TP ≤ 8 on 8-GPU nodes). Cuts per-token latency.
          </div>
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="text-amber-400 font-semibold block mb-1">Pipeline Parallel (PP)</span>
            Partitions layers across chassis (L / PP). Bridges over network fabric. Introduces bubble idle time.
          </div>
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="text-emerald-400 font-semibold block mb-1">Data Parallel (DP)</span>
            Replicates the model to split concurrent streams. Replicas don&apos;t communicate during inference -- the main lever for scaling to thousands of users.
          </div>
        </div>
        <p>
          The calculator's auto-sharding solver executes the following deterministic logic:
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-300">
          <li>Estimates one replica&apos;s base memory: weights + the KV cache for a single full-length stream + activations (for training: weights, gradients, optimizer state and activations).</li>
          <li>Finds the <strong>smallest</strong> TP from 1, 2, 4, 8 whose GPUs hold that base within 90% of their memory (the usable-memory factor, matching vLLM&apos;s default <span className="font-mono">--gpu-memory-utilization 0.90</span>) minus the memory headroom margin (default 5%), stepping down if TP doesn&apos;t divide the query heads (<span className="font-mono">H_q</span>).</li>
          <li>If the replica exceeds a whole chassis, sets TP to the chassis size (8) and adds pipeline stages across nodes (<span className="font-mono">PP = ceil(ReplicaMemory / NodeCapacity)</span>, max 8).</li>
          <li>For inference, the memory left on each replica&apos;s GPUs becomes its KV capacity, and DP is the number of replicas needed to hold the KV for all concurrent streams (<span className="font-mono">DP ≈ ceil(RequiredKV / ReplicaKVCapacity)</span>).</li>
          <li>For inference on NVLink platforms, it then repeats step 4 with every larger in-chassis TP and keeps the layout with the <strong>fewest total GPUs</strong> (ties go to the smaller TP). PCIe-only GPUs keep the smallest TP, because their all-reduces would cross PCIe.</li>
          <li>If latency targets are on, it searches larger TP and more replicas for the cheapest layout that meets both the time-to-first-token and time-per-output-token targets, or reports the closest layout and why the targets are out of reach.</li>
        </ol>
        <DecisionCallout title="Smallest TP vs. Fewest GPUs">
          The smallest TP that fits is not always the cheapest layout. Each TP=1 replica stores a full copy of the weights, so six one-GPU replicas of a 70B FP8 model hold ~440GB of duplicate weights; two TP=2 replicas hold the same streams on four GPUs because the weights are stored only twice. That is why several presets come out at TP=2 or TP=4 even though the model fits on one H200. Larger TP also cuts latency: TP=4 splits each layer&apos;s work (and weight reads) across four GPUs, cutting time-to-first-token and time-per-output-token roughly 3-4x per stream. Two caveats: TP beyond the number of KV heads no longer shrinks the per-GPU KV cache, and on PCIe platforms without NVLink (e.g. L40S) TP all-reduces cross PCIe, so the solver keeps TP low there.
        </DecisionCallout>
        <DecisionCallout title="Wide Expert Parallelism for MoE Models">
          For MoE models you can spread each replica across several chassis. Attention and shared weights stay tensor-parallel inside each chassis, each chassis serves its own share of the streams, and the routed experts are divided across every GPU in the group. Per-GPU weight memory falls sharply, leaving room for KV cache, and models larger than one chassis (e.g. Kimi K2 on H200) no longer need pipeline stages. The cost is an all-to-all exchange at every MoE layer, which the calculator adds to time per output token and which needs a non-blocking fabric.
        </DecisionCallout>
        <DecisionCallout title="Pipeline Bubble Fraction Warning">
          When PP &gt; 1, pipeline stages must fill and drain, leaving GPUs idle: Bubble ≈ (PP − 1) / (m + PP − 1), where m is the number of micro-batches (or concurrent requests) in flight. The calculator warns when concurrency is below 4 × PP.
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
        <DecisionCallout title="How the Calculator Sizes Each Pool">
          Each pool is a set of independent instances. An instance uses the smallest TP that holds the weights with at least a quarter of memory left for KV cache; adding nodes adds instances, not pipeline stages. The decode pool gets the fewest nodes whose instances hold the KV cache for every concurrent stream. The prefill pool gets enough instances to keep up with the prompt arrival rate: each instance processes roughly one prompt per time-to-first-token, and requests arrive at the traffic rate you enter (or, in concurrency mode, concurrency divided by the time each request takes). Instances are then sized to run at the SLA tab&apos;s target utilization. You can switch to manual node counts on the Serving Stack tab.
        </DecisionCallout>
        <DecisionCallout title="Lossless RoCEv2 KV Cache Streaming">
          Under LLM-D, the network becomes the system bus: each request&apos;s prompt KV must move from a prefill GPU to a decode GPU. The calculator estimates the full transfer as prompt KV bytes ÷ (NICs in parallel × 400 Gb/s × 90% efficiency). With overlapped transfer, each layer&apos;s KV is sent while the next layer computes, so only about one layer&apos;s share (1/L of the total) adds to TTFT. Example: a 23k-token LLaMA 405B prompt is ~5.9GB of FP8 KV, ~33ms over a TP=4 prefill instance&apos;s four 400G NICs, of which ~0.26ms stays exposed with overlap. FP16 KV doubles both figures. The fabric must be lossless (PFC and ECN/DCQCN tuned) on switches such as Cisco Nexus 9000, or retransmissions quickly dominate.
        </DecisionCallout>
      </div>
    )
  },
  'chap-5-network': {
    title: 'Rail-Optimized Clos & Facilities Bin-Packing',
    subtitle: 'Non-blocking leaf-spine fabrics, power density, RU bin-packing, and PUE cooling overhead.',
    introduction: 'Building an enterprise AI cluster is as much an exercise in electrical and thermal engineering as it is in software. Standard corporate datacenters connect servers to shared top-of-rack switches—a design that immediately causes network congestion when hundreds of GPUs attempt to synchronize their calculations simultaneously. AI clusters instead deploy "Rail-Optimized" leaf-spine networks, establishing dedicated non-blocking communication highways for each accelerator. Furthermore, because an 8-GPU HGX H100/H200 chassis draws ~10.2 kW and an HGX B200 ~14.3 kW, rack density is usually limited by power and cooling rather than rack units, and facility power by Power Usage Effectiveness (PUE).',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Standard enterprise top-of-rack (ToR) designs are usually oversubscribed and mix traffic, which causes congestion during multi-node collectives.
          AI training fabrics use a <strong>Rail-Optimized Leaf-Spine Clos</strong> architecture:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li>Each GPU in an 8-GPU chassis is cabled to an independent leaf switch rail (Rail 1 through Rail 8).</li>
          <li>All "GPU 1" adapters across all servers terminate on Leaf 1; all "GPU 2" adapters terminate on Leaf 2.</li>
          <li>Collectives between same-rank GPUs on different servers need only one switch hop; traffic that must change rails is moved over NVLink inside the server first (NCCL&apos;s PXN) or crosses the spine.</li>
        </ul>
        <p>
          The calculator sizes one GPU-facing NIC port per GPU on 64-port leaf switches. At 1:1 (non-blocking) each leaf splits its ports evenly between GPUs and spine uplinks; small clusters fit on a single leaf tier with no spine at all. The <strong>oversubscription ratio</strong> in the Network Fabric section lets you trade bisection bandwidth for fewer spine switches (2:1 halves the uplinks). That is usually fine for inference, where data-parallel replicas barely talk to each other, but it slows training collectives that span leaves.
        </p>
        <p>
          Facilities sizing bin-packs server chassis into 42U racks with 40U usable (the rest goes to top-of-rack switching, patch panels and cable management) and a per-rack power limit, whichever binds first. The Facility &amp; Power tab sets the cooling type and that limit: air cooling defaults to 28 kW per rack and PUE 1.35, liquid cooling to 80 kW and PUE 1.15, and both stay editable. Rack-scale systems (GB200/GB300 NVL72) come as their own liquid-cooled rack; the calculator warns if they are paired with air cooling, or if a single server draws more than a rack can supply. Total facility power is IT load × PUE (default 1.35), which adds cooling and power-distribution overhead.
        </p>
        <DecisionCallout title="Working Back From a Power Budget">
          Many sites have a fixed power allocation rather than a fixed workload. Turn on <em>Size against a facility power budget</em> and enter the kW available: the calculator re-sizes the whole design (GPUs, network, storage and every enabled add-on, at PUE) and searches for the largest demand -- concurrent streams, peak-hour users, requests per second, or training replicas -- that fits. For training it also shows the time to train at that size.
        </DecisionCallout>
        <DecisionCallout title="Energy and Carbon per Token">
          Annual energy is facility power × 8,760 hours; emissions are energy × your grid&apos;s carbon intensity (the US average is about 0.37 kg CO₂/kWh per EPA eGRID 2022; use your utility&apos;s figure). Energy per 1M output tokens is shown at full load and at your utilization: a cluster at 50% utilization uses about twice the energy per token, because it draws power around the clock. All figures use nameplate power, so they are upper bounds.
        </DecisionCallout>
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
          P(Wait &gt; t) = C(c, a) × e^(−c × μ × (1 − ρ) × t)
        </div>
        <p>
          Here <span className="font-mono text-sky-400">c</span> is the number of concurrent slots per replica, <span className="font-mono text-sky-400">μ</span> the service rate of one slot (1 / (TTFT + output tokens × TPOT)), <span className="font-mono text-sky-400">ρ</span> the target utilization (default 70%), and <span className="font-mono text-sky-400">C(c, a)</span> the Erlang C probability that a request has to wait at all. Mean wait scales with 1 / (1 − ρ), so it rises steeply as utilization approaches 100%: going from 80% to 90% roughly doubles it, and 95% doubles it again. That is why production clusters are sized for headroom rather than 100% utilization.
        </p>
        <DecisionCallout title="Sizing from Traffic Instead of Concurrency">
          If you know request rates rather than concurrent streams, choose <em>Size by: Peak traffic</em> on the Workload tab and enter requests per second (or active users × requests per user per hour). By Little&apos;s law, the requests in flight equal the arrival rate times how long each request is served (prefill plus its whole answer); dividing by the target utilization above gives the concurrency to size for. Because larger batches decode more slowly, the calculator iterates until the two agree, then runs the queueing model at the utilization that traffic actually produces. A &quot;request&quot; is one full use of the context window, so for agents it is a whole task or session.
        </DecisionCallout>
        <DecisionCallout title="Scope of Queueing: TTFT vs TPOT">
          Queueing delay adds to Time-to-First-Token (TTFT) while a request waits for an execution slot. Once it is running, Time Per Output Token (TPOT) depends on memory bandwidth, compute and the batch size -- and the calculator already sizes TPOT at the full concurrency target, so a queue does not slow it further. Guardrail checks and ingress hops are modeled separately as fixed latency added before the queue (input checks, gateway) and after generation (output checks); they shift every percentile of the end-to-end response time by the same amount.
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

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">1. Distributed Training Checkpoint Write-Time Budgets</h3>
        <p>
          During pretraining or full fine-tuning, the job periodically saves its state to persistent storage.
          The checkpoint contains one logical copy of the model weights plus the optimizer state:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Checkpoint_Size_TB = (Weights_bytes + Optimizer_bytes) / 10¹²
        </div>
        <p>
          Gradients are transient and not saved. With mixed-precision AdamW that is ~2 bytes/parameter of BF16 weights plus 12 bytes/parameter of FP32 master weights and moments -- ~14 bytes/parameter, whatever the ZeRO stage. Data-parallel replicas don&apos;t multiply the size: ZeRO or FSDP only changes how the one copy is split, which lets every rank write its shard in parallel.
          To keep GPUs from stalling in I/O wait, cluster architects set a <strong>write-time budget</strong> (typically 60 to 180 seconds):
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_Write_Throughput (GB/s) = (Checkpoint_Size_TB × 1000) / Write_Time_Budget_Seconds
        </div>
        <DecisionCallout title="The Checkpoint Stall Trap">
          A 405B model checkpoint is ~5.7TB. If the storage tier sustains only 20 GB/s of writes, 1,024 GPUs sit idle for ~285 seconds per checkpoint; at $3.50/GPU-hour that is ~$280 of idle compute each time, or ~$6,700 a day at hourly checkpoints. Meeting a 180-second budget needs ~32 GB/s. Asynchronous checkpointing (copy to host memory, then write in the background) shortens the stall further but still needs the write bandwidth to finish before the next checkpoint.
        </DecisionCallout>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">Time to Train, Failures &amp; Goodput</h3>
        <p>
          Checkpoints exist because large jobs fail. The calculator estimates training time from the compute a run needs (about 6 × parameters × tokens FLOPs for full training, 4 × for LoRA, counting active parameters for MoE) divided by the cluster&apos;s sustained throughput (peak × MFU, 40% by default). It then applies a failure model: each GPU fails on average once every 50,000 hours (the rate Meta reported for Llama 3 pretraining), so a 16,384-GPU job is interrupted about every 3 hours.
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Checkpoint_Interval ≈ √(2 × Checkpoint_Write_Time × Job_MTBF)  (Young/Daly)<br />
          Goodput = 1 − Write_Time / (Interval + Write_Time) − (Interval / 2 + Restart_Time) / Job_MTBF
        </div>
        <p>
          Each failure loses, on average, half an interval of work plus the restart time. Goodput turns compute days into wall-clock days, and the calculator recommends enough hot-spare nodes to cover failed nodes waiting for repair (48 hours by default) at 97.5% confidence. Faster checkpoint storage shortens the write time, which permits more frequent checkpoints and raises goodput. This is why the storage sizing above matters for large clusters.
        </p>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">2. Inference KV Cache NVMe Offloading Mechanics</h3>
        <p>
          In massive long-context reasoning models (32k to 128k context) or multi-tenant agent platforms, GPU HBM is often overwhelmed by inactive session KV caches. 
          Inference engines support hierarchical KV offloading to local high-speed NVMe or ultra-low-latency network flash (NVMe-oF):
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_KV_Offload_Throughput (GB/s) = (Cluster_Gen_Tok_Per_Sec × Real_Bytes_Per_Token_KV) / 10⁹
        </div>
        <p>
          This is the sustained bandwidth to page conversation KV blocks out to storage and back without slowing token generation.
          Offload also changes GPU sizing: when many open sessions sit idle (an agent waiting on a tool, a user reading), only the share actively generating needs its KV on the GPU. The Storage tab sets that share; GPUs are sized for the active sessions, and the offload tier holds every session&apos;s KV plus the same again as paging room. Engines implement offload through connectors such as LMCache (vLLM) or tiered KV caches in TensorRT-LLM and SGLang.
        </p>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">3. Storage Durability Overheads: Erasure Coding vs 3x Replication</h3>
        <p>
          Storage capacity must account for fault tolerance and hardware durability. While raw physical flash drives are purchased, 
          usable storage capacity is dictated by the durability scheme:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>2x Replication:</strong> Two full copies of every byte (factor 2.0, 50% efficiency). Survives one failure; common for scratch and cache tiers.</li>
          <li><strong>3x Replication:</strong> Three full copies (factor 3.0, 33.3% efficiency). Simple and fast to rebuild, but 300TB of raw flash for every 100TB usable.</li>
          <li><strong>Erasure Coding (8+3):</strong> 8 data and 3 parity chunks. Survives any 3 simultaneous drive or node failures at 11/8 = 1.375× overhead (72.7% efficiency).</li>
          <li><strong>Erasure Coding (10+4):</strong> 10 data and 4 parity chunks. Survives any 4 simultaneous failures at 14/10 = 1.4× overhead (71.4% efficiency); suits very large drive counts where concurrent failures are more likely.</li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Required_Raw_Capacity_TB = Required_Usable_Capacity_TB × Replication_Factor
        </div>
      </div>
    )
  },
  'chap-8-silicon': {
    title: 'Silicon & Accelerator Architecture Guide',
    subtitle: 'H100, H200, B200, GB200 NVL72, L40S, and MI300X physical memory, bandwidth, and compute trade-offs, plus benchmark calibration.',
    introduction: 'Selecting the right accelerator for an enterprise AI deployment is often reduced to a single metric: peak TFLOPs. However, in production generative AI, compute throughput is only half the story. Large language models operate in two distinct physical regimes: the compute-bound prefill phase (matrix-matrix multiplication) and the memory-bandwidth-bound decode phase (matrix-vector multiplication). An accelerator with astronomical FLOPS but inadequate memory bandwidth will starve its Tensor Cores during token generation, delivering dismal tokens-per-second per dollar. Understanding the architectural differences between NVIDIA Hopper, Blackwell, Ada Lovelace, and AMD Instinct silicon is critical to preventing costly hardware mismatches.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Every generative AI workload shifts dynamically between two physical execution bounds:
        </p>
        <ul className="list-disc pl-5 space-y-3 text-zinc-300 text-sm">
          <li>
            <strong>Prefill Phase (Prompt Ingest):</strong> Compute-bound. The GPU processes thousands of input tokens at once using dense matrix-matrix multiplications (GEMM). Each weight read from memory is reused for every token in the step, so arithmetic intensity grows with the number of tokens processed and saturates the Tensor Cores.
          </li>
          <li>
            <strong>Decode Phase (Token Generation):</strong> Memory-bandwidth bound. Each stream emits one token per step, so the math is closer to matrix-vector (GEMV). All weights (~70GB for a 70B FP8 model) are read from HBM on <em>every step</em>, and at batch size 1 that is ~2 FLOPs per parameter per byte-sized FP8 weight -- about 2 FLOPs/byte (1 at FP16). Batching many streams raises intensity, because one weight read serves every stream in the batch.
          </li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Decode_Tok_Per_Sec_Single_Stream ≤ (HBM_Bandwidth_TBps × TP) / Model_Weight_Memory_TB
        </div>
        <p className="text-sm text-zinc-400">
          This is an upper bound (e.g. H200: 4.8 TB/s ÷ ~72GB ≈ 66 tokens/s for a 70B FP8 model at TP=1). The calculator applies ~75% bandwidth efficiency to weight reads and adds KV reads at ~45% efficiency (paged attention kernels reach a lower share of peak bandwidth than streaming weights). KV reads grow with context length and batch size, and at large batches they dominate each step.
        </p>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">Accelerator Comparison Matrix</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-900 text-zinc-400 uppercase text-[11px] tracking-wide">
              <tr>
                <th className="p-3">Accelerator</th>
                <th className="p-3">HBM Capacity</th>
                <th className="p-3">Memory Bandwidth</th>
                <th className="p-3">Interconnect</th>
                <th className="p-3">TDP</th>
                <th className="p-3">Ideal Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA H100 SXM5</td>
                <td className="p-3 text-zinc-300">80 GB HBM3</td>
                <td className="p-3 text-zinc-300">3.35 TB/s</td>
                <td className="p-3 text-zinc-400">900 GB/s NVLink 4</td>
                <td className="p-3 text-zinc-400">700W</td>
                <td className="p-3 text-zinc-400">Enterprise training &amp; standard context inference</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA H200 SXM5</td>
                <td className="p-3 text-zinc-300">141 GB HBM3e</td>
                <td className="p-3 text-zinc-300">4.80 TB/s (+43%)</td>
                <td className="p-3 text-zinc-400">900 GB/s NVLink 4</td>
                <td className="p-3 text-zinc-400">700W</td>
                <td className="p-3 text-zinc-400">Long-context 70B serving &amp; multi-stream RAG</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA B200 (Blackwell)</td>
                <td className="p-3 text-zinc-300">180 GB HBM3e (HGX B200; 192 GB physical)</td>
                <td className="p-3 text-zinc-300">8.00 TB/s (+138%)</td>
                <td className="p-3 text-zinc-400">1,800 GB/s NVLink 5</td>
                <td className="p-3 text-zinc-400">1000W</td>
                <td className="p-3 text-zinc-400">Frontier pretraining, NVFP4 inference, MoE models</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA B300 (Blackwell Ultra)</td>
                <td className="p-3 text-zinc-300">288 GB HBM3e</td>
                <td className="p-3 text-zinc-300">8.00 TB/s</td>
                <td className="p-3 text-zinc-400">1,800 GB/s NVLink 5</td>
                <td className="p-3 text-zinc-400">~1,100W</td>
                <td className="p-3 text-zinc-400">Reasoning inference, trillion-parameter MoE serving (~1.5x B200 FP4)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA GB200 NVL72</td>
                <td className="p-3 text-zinc-300">186 GB HBM3e per GPU</td>
                <td className="p-3 text-zinc-300">8.00 TB/s</td>
                <td className="p-3 text-zinc-400">1,800 GB/s NVLink 5 across all 72 GPUs in the rack</td>
                <td className="p-3 text-zinc-400">~120 kW per rack (liquid)</td>
                <td className="p-3 text-zinc-400">Wide expert parallelism and trillion-parameter MoE serving inside one NVLink domain</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA GB300 NVL72</td>
                <td className="p-3 text-zinc-300">288 GB HBM3e per GPU</td>
                <td className="p-3 text-zinc-300">8.00 TB/s</td>
                <td className="p-3 text-zinc-400">1,800 GB/s NVLink 5 across all 72 GPUs in the rack</td>
                <td className="p-3 text-zinc-400">~135 kW per rack (liquid)</td>
                <td className="p-3 text-zinc-400">Long-context reasoning at rack scale (~1.5x GB200 FP4)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA RTX PRO 6000 Blackwell Server</td>
                <td className="p-3 text-zinc-300">96 GB GDDR7</td>
                <td className="p-3 text-zinc-300">1.6 TB/s</td>
                <td className="p-3 text-zinc-400">PCIe Gen5 x16, no NVLink</td>
                <td className="p-3 text-zinc-400">600W</td>
                <td className="p-3 text-zinc-400">Air-cooled enterprise inference where each model fits on one card; L40S successor</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA A100 SXM4</td>
                <td className="p-3 text-zinc-300">80 GB HBM2e</td>
                <td className="p-3 text-zinc-300">2.04 TB/s</td>
                <td className="p-3 text-zinc-400">600 GB/s NVLink 3</td>
                <td className="p-3 text-zinc-400">400W</td>
                <td className="p-3 text-zinc-400">Installed-base training &amp; inference (no FP8)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA H100 NVL (PCIe)</td>
                <td className="p-3 text-zinc-300">94 GB HBM3</td>
                <td className="p-3 text-zinc-300">3.9 TB/s</td>
                <td className="p-3 text-zinc-400">600 GB/s NVLink bridge (pairs) + PCIe Gen5</td>
                <td className="p-3 text-zinc-400">350–400W</td>
                <td className="p-3 text-zinc-400">HBM-class inference in standard PCIe servers</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">NVIDIA L40S (PCIe)</td>
                <td className="p-3 text-zinc-300">48 GB GDDR6</td>
                <td className="p-3 text-zinc-300">0.864 TB/s (~4x lower than H100)</td>
                <td className="p-3 text-zinc-400">PCIe Gen4 x16 (32 GB/s each way), no NVLink</td>
                <td className="p-3 text-zinc-400">350W</td>
                <td className="p-3 text-zinc-400">Vector embeddings, vision encoders, 8B models</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">AMD Instinct MI300X</td>
                <td className="p-3 text-zinc-300">192 GB HBM3</td>
                <td className="p-3 text-zinc-300">5.30 TB/s</td>
                <td className="p-3 text-zinc-400">896 GB/s Infinity Fabric</td>
                <td className="p-3 text-zinc-400">750W</td>
                <td className="p-3 text-zinc-400">Single-GPU 70B FP16 &amp; large-model inference (ROCm: vLLM / SGLang)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">AMD Instinct MI325X</td>
                <td className="p-3 text-zinc-300">256 GB HBM3e</td>
                <td className="p-3 text-zinc-300">6.0 TB/s</td>
                <td className="p-3 text-zinc-400">896 GB/s Infinity Fabric</td>
                <td className="p-3 text-zinc-400">1000W</td>
                <td className="p-3 text-zinc-400">MI300X compute with more KV capacity per GPU</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-zinc-200">AMD Instinct MI355X</td>
                <td className="p-3 text-zinc-300">288 GB HBM3e</td>
                <td className="p-3 text-zinc-300">8.0 TB/s</td>
                <td className="p-3 text-zinc-400">~1,075 GB/s Infinity Fabric</td>
                <td className="p-3 text-zinc-400">1400W (liquid)</td>
                <td className="p-3 text-zinc-400">Native FP4/FP6 inference and training</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DecisionCallout title="Rack-Scale NVLink (GB200 / GB300 NVL72)">
          An NVL72 rack joins 72 GPUs in one NVLink domain, so the calculator treats the rack as a single 72-GPU chassis. A replica that fits on 8 GPUs still uses TP of 8 or less, because all-reduce cost grows with TP; one too large for 8 GPUs grows TP to 16, 32 or 64 inside the rack instead of adding pipeline stages across the network, and the latency solver may try TP=16 to cut time per token. Expert-parallel all-to-all traffic stays on NVLink for as long as the whole replica fits in the rack, instead of crossing the InfiniBand or Ethernet NICs. The rack is bought whole, so capex, power and space are charged for all 72 GPUs even when the workload needs fewer; the calculator warns when most of a rack would sit idle. Scale-out networking uses 8 NIC rails per rack, not one per GPU.
        </DecisionCallout>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">Calibration Against Published Benchmarks</h3>
        <p className="text-sm">
          The performance model is analytical, so its efficiency factors are checked against measured results. The reference is NVIDIA&apos;s published TensorRT-LLM throughput table (
          <a className="text-sky-400 hover:underline" href="https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/developer-guide/perf-overview.md" target="_blank" rel="noreferrer">TensorRT-LLM Performance Overview</a>
          ): output tokens per second per GPU at maximum load, on DGX H100, DGX H200, DGX B200 and GB200 NVL72. The test suite reproduces each run by filling the GPUs with the largest batch that fits and charging each request its prefill plus its share of decode steps. Three factors were fitted to Llama 3.3 70B and gpt-oss: KV-cache reads at 45% of HBM bandwidth, MoE expert layers at 40% of dense MFU, and FP4 GEMMs at 75% of the FP4 peak.
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-900 text-zinc-400 uppercase text-[11px] tracking-wide">
              <tr>
                <th className="p-3">Model &amp; GPUs</th>
                <th className="p-3">ISL / OSL</th>
                <th className="p-3">Published tok/s/GPU</th>
                <th className="p-3">Calculator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 font-mono">
              <tr><td className="p-3 font-sans text-zinc-200">Llama 3.3 70B FP8, 2× H200</td><td className="p-3">1000 / 1000</td><td className="p-3">2,587</td><td className="p-3">2,644 (+2%)</td></tr>
              <tr><td className="p-3 font-sans text-zinc-200">Llama 3.3 70B FP8, 2× H200</td><td className="p-3">1024 / 8192</td><td className="p-3">2,009</td><td className="p-3">1,894 (−6%)</td></tr>
              <tr><td className="p-3 font-sans text-zinc-200">Llama 3.3 70B FP8, 2× H100</td><td className="p-3">8192 / 1024</td><td className="p-3">398</td><td className="p-3">339 (−15%)</td></tr>
              <tr><td className="p-3 font-sans text-zinc-200">Llama 3.3 70B NVFP4, 1× B200</td><td className="p-3">1000 / 1000</td><td className="p-3">6,920</td><td className="p-3">7,388 (+7%)</td></tr>
              <tr><td className="p-3 font-sans text-zinc-200">Llama 3.3 70B NVFP4, 1× GB200</td><td className="p-3">1000 / 1000</td><td className="p-3">7,769</td><td className="p-3">7,725 (−1%)</td></tr>
              <tr><td className="p-3 font-sans text-zinc-200">gpt-oss-120b, 1× H200</td><td className="p-3">8192 / 1024</td><td className="p-3">1,828</td><td className="p-3">1,775 (−3%)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-zinc-400">
          Across all 20 fitted points the typical error is ~16% (dense Llama: within 16% everywhere). Ten held-out points for Qwen3-235B, DeepSeek R1 and Llama 4 Maverick, which were not used for fitting, come in at ~18% typical error. Known gaps: very small-active MoE models at huge batches on Blackwell are over-predicted by up to ~1.7x (real servers cap the batch and pay per-step scheduling costs), and Llama 4&apos;s chunked attention is under-predicted at long prompts. Treat throughput figures as planning estimates within roughly ±25%, and benchmark your own engine configuration before committing to a purchase.
        </p>

        <DecisionCallout title="Speculative Decoding: Trading Spare Compute for Speed">
          Because decode leaves the Tensor Cores mostly idle at small batch sizes, a small drafter can propose k tokens and the target model can check all of them in one pass that reads the weights once. If each proposal is accepted with probability α, a pass yields (1 − α^(k+1)) / (1 − α) tokens on average -- about 2.3 at α = 0.6 and k = 4. The calculator charges the verify pass for its k + 1 positions, the k drafter steps and a per-step overhead, which gives roughly 1.8x faster decode at low batch with α = 0.6. As batch size grows, decode becomes compute-bound, the extra verification work stops paying for itself, and the calculator (like serving engines) stops applying it.
        </DecisionCallout>
        <DecisionCallout title="The L40S PCIe Inference Fallacy">
          Procurement teams are drawn to the L40S: it has strong FP8 Tensor throughput and costs far less than an H100. But its GDDR6 delivers 864 GB/s -- almost 4x less than H100 SXM5 (3,350 GB/s) -- and it has no NVLink, so multi-GPU tensor parallelism runs over PCIe. Splitting a 70B model across L40S cards gives slow decode and PCIe-bound all-reduces. Use L40S where each model fits on one card: embeddings (BGE-Large), vision encoders (CLIP), guard models and 8B-class LLMs, as the customer-support, swarm and air-gapped presets do.
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

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">1. CapEx Breakdown &amp; Hardware Amortization</h3>
        <p>
          Total initial acquisition cost aggregates three physical subsystems:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>Compute Nodes:</strong> GPU server chassis (e.g. 8x H200 SXM5 systems with dual host CPUs and 2TB host RAM).</li>
          <li><strong>Networking Fabric:</strong> Leaf and spine switches, host NICs (e.g. 8x 400G ConnectX-7 per node), optics and out-of-band management, priced as a percentage of compute capex (default 15%).</li>
          <li><strong>Storage Tier:</strong> The provisioned raw capacity (after the durability multiplier) × $/TB raw.</li>
          <li><strong>Add-on pools:</strong> RAG embedding and vector-DB nodes, guardrail GPUs, ingress, HA/DR standby capacity, MLOps validation pools and training spare nodes, each sized on its own tab.</li>
        </ul>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Monthly_Amortized_CapEx = Total_CapEx / (TCO_Years × 12)
        </div>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">2. OpEx: Power, Cooling PUE, Colocation &amp; Software</h3>
        <p>
          Operating an AI datacenter incurs continuous facilities and operational fees:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Owned DC: Annual_Power_Cost = IT_Power_kW × PUE × 8,760 hrs × Rate_per_kWh (default $0.12)<br />
          Colocation: Annual_Power_Cost = IT_Power_kW × Rate_per_kW_month × 12 (default $150)
        </div>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>Power Usage Effectiveness (PUE):</strong> Total facility power divided by IT equipment power. Industry surveys put the average around 1.5 to 1.6; modern purpose-built and liquid-cooled facilities reach 1.1 to 1.3. A PUE of 1.35 means every 10 kW of IT load needs another 3.5 kW for cooling and power-distribution losses. In an owned datacenter you pay for that overhead directly.</li>
          <li><strong>Colocation:</strong> Billed per kW of IT load per month (typically $150 to $250), with the provider&apos;s cooling overhead built into the rate, so the calculator does not apply PUE again.</li>
          <li><strong>Enterprise Software Licenses (optional):</strong> NVIDIA AI Enterprise at ~$4,500/GPU/year list, covering supported containers (NIM, Triton, TensorRT-LLM), security patches and enterprise support.</li>
          <li><strong>Hardware Support:</strong> Maintenance contracts (e.g. Cisco Smart Net Total Care) as a percentage of capex per year, default 15%; adjust to your quoted rate.</li>
          <li><strong>Ingress opex:</strong> Egress bandwidth and managed load-balancer or CDN fees from the Ingress tab.</li>
        </ul>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">3. What the Calculator Reports</h3>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong>TCO</strong> = Total CapEx + Annual OpEx × TCO years (default 3).</li>
          <li><strong>Effective $/GPU-hour</strong> = TCO ÷ (GPUs × 8,760 × years), assuming the hardware is available around the clock.</li>
          <li><strong>Cloud comparison</strong> = GPUs × your dedicated-cloud $/GPU-hour × 8,760 × years -- renting the same GPU count, not paying per token.</li>
          <li><strong>Break-even</strong> = CapEx ÷ (monthly cloud rental − monthly on-prem OpEx). If on-prem OpEx alone exceeds the rental, there is no break-even.</li>
          <li><strong>Cost per 1M tokens</strong> (inference) at a utilization you set, and the same requests priced on a per-token API -- see below.</li>
        </ul>
        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">4. Unit Economics: Cost per 1M Tokens</h3>
        <p>
          The Cost &amp; TCO tab converts monthly cost into an effective <strong>cost per 1 million tokens</strong> at a utilization you choose (the share of hours the cluster runs at its sized load). It compares the serving cluster alone -- GPUs, fabric, power, support and licensing -- because RAG, guardrails, storage and HA/DR are usually still needed alongside an API; the fully loaded figure is shown as well. Reasoning tokens count as output tokens, as API providers bill them:
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-sky-300">
          Cost_per_1M_Tokens = [ Fully_Loaded_Monthly_TCO / (Monthly_Tokens_Generated) ] × 1,000,000
        </div>
        <p>
          Where <span className="font-mono text-sky-400">Monthly_Tokens_Generated = Cluster_Tok_Per_Sec × 3,600 × 730 × Duty_Cycle</span>, using the cluster throughput from the calculator&apos;s inference performance profile and the utilization you set. The break-even utilization is where owning and the API cost the same for the same requests; above 100% the API is cheaper at any load.
        </p>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">5. Rent vs. Buy</h3>
        <p>
          The Planning tab compares owning with three ways of renting the same GPUs over the TCO horizon: reserved capacity (a committed-use discount off the on-demand rate, 35% by default), on-demand around the clock, and, for inference, on-demand scaled to your utilization (assuming perfect autoscaling). Storage and add-on pools are charged at their owned cost on every line, so only the GPU servers differ.
        </p>
        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">6. Sensitivity: What Moves the Cost</h3>
        <p>
          Each uncertain input (GPU price, electricity or colocation rate, PUE, support, network adder, context length, demand and, for cost per token, utilization) is moved down and up by a stated swing while everything else is held, and the whole design is re-sized. The tornado chart ranks inputs by how far they move TCO or cost per 1M tokens, which shows where a firmer quote or a better traffic estimate matters most. Because sizing moves in whole servers, some changes have no effect until they cross a server boundary.
        </p>
        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">7. Growth Over Time</h3>
        <p>
          With <em>Plan capacity year by year</em> on, each year of the TCO horizon is sized for that year&apos;s demand (growing at the rate you set). A year&apos;s capex is the increase in the whole design over the previous year&apos;s, at that year&apos;s GPU price; a refresh year buys the whole design again. The plan is compared with buying the final year&apos;s capacity on day one: phasing avoids paying early for capacity that sits idle, and gains further if GPU prices fall.
        </p>

        <DecisionCallout title="The Public Cloud Break-Even Crossover">
          Per-token APIs win for light or bursty traffic: you pay nothing while idle, whereas owned hardware costs the same whether it is busy or not. As sustained utilization rises, the fixed cost is spread over more tokens and on-prem cost per token falls roughly in proportion to the duty cycle, so there is a crossover point. Where it lands depends on your model size, throughput, hardware prices and the API price you would otherwise pay, and API prices for open models have fallen quickly -- so enter current prices rather than relying on rules of thumb. On-prem also brings data control and no per-token markup (raw egress bandwidth still costs money; see the Ingress &amp; Edge tab).
        </DecisionCallout>
      </div>
    )
  },
  'chap-10-security': {
    title: 'Security, Compliance & Attestation Controls',
    subtitle: 'How the architectural choices this calculator already sizes map onto common compliance-framework control domains -- and where this tool stops.',
    introduction: 'Every enterprise or regulated deployment eventually has to answer "does this architecture satisfy SOC 2 / HIPAA / PCI-DSS / FedRAMP / ISO 27001 / GDPR?" This calculator cannot answer that question directly -- certification requires audited policies, procedures, and evidence that no sizing tool can produce. What it can do is show, honestly, which control domains a given hardware/software configuration already addresses (because a tab in this calculator sizes it), which it only partially addresses, and which are explicit gaps or entirely out of scope. Treat this chapter as a starting checklist for a conversation with your compliance and security teams, not as a substitute for one.',
    content: (
      <div className="space-y-6 text-[15px] text-zinc-300 leading-relaxed">
        <p>
          Seven control domains recur across the frameworks most private-AI deployments care about. Each one is tied to a specific tab
          in this calculator (or explicitly marked out of scope), so a preset's posture is <strong>derived</strong> from the same
          configuration already sized elsewhere -- not a separate, hand-maintained claim that could drift out of sync.
        </p>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-900 text-zinc-400 uppercase text-[11px] tracking-wide">
              <tr>
                <th className="p-3">Control Domain</th>
                <th className="p-3">What It Evaluates</th>
                <th className="p-3">Sized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {CONTROL_DOMAINS.map((d) => (
                <tr key={d.id}>
                  <td className="p-3 font-semibold text-zinc-200">{d.name}</td>
                  <td className="p-3 text-zinc-400">{d.description}</td>
                  <td className="p-3 text-sky-400">{d.calculatorTieIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">1. Frameworks Referenced</h3>
        <p>
          This chapter's checklists reference six commonly-encountered frameworks by name so the mapping is concrete, not to claim
          certification against any of them:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMPLIANCE_FRAMEWORKS.map((f) => (
            <div key={f.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
              <span className="font-semibold text-zinc-200 block">{f.name}</span>
              <span className="text-zinc-400">{f.focus}</span>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-zinc-100 mt-6 mb-2">2. Posture Levels</h3>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300 text-sm">
          <li><strong className="text-emerald-400">Strong:</strong> the currently-selected configuration directly addresses this control domain.</li>
          <li><strong className="text-amber-400">Partial:</strong> a component is sized, but it doesn't fully satisfy the control on its own (e.g. a load balancer terminates TLS but doesn't enforce API-level auth).</li>
          <li><strong className="text-red-400">Gap:</strong> nothing in the current configuration addresses this control domain -- it would need to be added, either by enabling an existing tab (MIG, Guardrails, Ingress, HA/DR, MLOps) or by a layer outside this calculator entirely.</li>
          <li><strong className="text-zinc-400">Not applicable:</strong> the control domain doesn't apply to this workload shape (e.g. tenant isolation for a single offline training job).</li>
          <li><strong className="text-zinc-500">Out of scope:</strong> this calculator does not size the control at all, regardless of configuration (encryption is the only domain in this category today).</li>
        </ul>

        <DecisionCallout title="A Sizing Tool Is Not an Auditor">
          Every preset's compliance checklist in this guide is generated from the same enable/disable flags and tier selections already visible in the calculator's own tabs -- HA/DR tier, ingress tier, guardrails on/off, MIG on/off, MLOps strategy. It reflects architectural capability, not certified compliance: encryption, key management, IAM policy, audit-log retention, and dozens of other procedural controls that real certifications require are entirely outside what any hardware sizing calculator can verify.
        </DecisionCallout>
      </div>
    )
  }
};

const STATUS_STYLES = {
  [STATUS.STRONG]: { label: 'Strong', tone: 'good' },
  [STATUS.PARTIAL]: { label: 'Partial', tone: 'warn' },
  [STATUS.GAP]: { label: 'Gap', tone: 'danger' },
  [STATUS.NOT_APPLICABLE]: { label: 'N/A', tone: 'neutral' },
  [STATUS.OUT_OF_SCOPE]: { label: 'Out of Scope', tone: 'neutral' },
};

function ComplianceChecklist({ facts }) {
  const results = evaluateControlDomains(facts);
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-zinc-900 text-zinc-400 uppercase text-[11px] tracking-wide">
          <tr>
            <th className="p-3">Control Domain</th>
            <th className="p-3">Status</th>
            <th className="p-3">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {results.map((r) => {
            const domain = CONTROL_DOMAINS.find(d => d.id === r.domainId);
            const style = STATUS_STYLES[r.status] || STATUS_STYLES[STATUS.GAP];
            return (
              <tr key={r.domainId}>
                <td className="p-3 align-top font-semibold text-zinc-200 whitespace-nowrap">{domain?.name || r.domainId}</td>
                <td className="p-3 align-top"><Tag tone={style.tone} mono={false}>{style.label}</Tag></td>
                <td className="p-3 align-top text-zinc-400">{r.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────── MAIN COMPONENT ────────────────────────────────

export function GlossaryPage({ onBack, initialDocId }) {
  const [activeDocId, setActiveDocId] = useState(initialDocId || 'overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Collapsible section groups state (default all open)
  const [collapsedGroups, setCollapsedGroups] = useState({});
  // Below lg the chapter list is a slide-out menu.
  const [chaptersOpen, setChaptersOpen] = useState(false);
  useEffect(() => {
    if (!chaptersOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setChaptersOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chaptersOpen]);

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
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden">
      {/* Top Header */}
      <header className="px-3 sm:px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 shrink-0 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-2.5 py-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back<span className="hidden sm:inline">&nbsp;to Calculator</span>
          </button>
          <div className="hidden sm:block h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-zinc-100 min-w-0">
            <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-sm font-semibold tracking-tight truncate"><span className="lg:hidden">Architecture guide</span><span className="hidden lg:inline">AI Infrastructure Architecture Documentation</span></span>
          </div>
        </div>
        <button
          type="button"
          data-testid="open-chapters"
          onClick={() => setChaptersOpen(true)}
          className="lg:hidden shrink-0 h-10 inline-flex items-center gap-1.5 px-3 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-zinc-200 cursor-pointer"
        >
          <Menu className="w-4 h-4" /> Chapters
        </button>
      </header>

      {/* Main Hub Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Documentation Navigation Sidebar */}
        {chaptersOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setChaptersOpen(false)} />}
        <aside
          data-testid="chapter-list"
          className={`${chaptersOpen ? 'fixed inset-y-0 left-0 z-40 flex w-[min(20rem,85vw)] pb-[env(safe-area-inset-bottom)]' : 'hidden'} lg:static lg:z-auto lg:flex lg:w-72 shrink-0 bg-zinc-900 lg:bg-zinc-900/95 border-r border-zinc-800 flex-col h-full overflow-hidden`}
        >
          <div className="lg:hidden flex items-center justify-between px-3 pt-3">
            <span className="text-sm font-semibold text-white">Chapters</span>
            <button type="button" onClick={() => setChaptersOpen(false)} aria-label="Close chapters" className="w-10 h-10 -mr-2 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Search Bar */}
          <div className="p-3 border-b border-zinc-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search architecture docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 lg:py-1.5 text-base lg:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Navigation Links Grouped with Collapsible Headers */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.id]);
              return (
                <div key={group.id} className="select-none">
                  {/* Collapsible Section Header Button */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 uppercase tracking-wider rounded transition cursor-pointer group"
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
                            data-testid={`doc-${item.id}`}
                            onClick={() => { setActiveDocId(item.id); setChaptersOpen(false); }}
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
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-4 sm:mb-6 min-w-0">
              <span className="hidden sm:inline">Docs</span>
              <ChevronRight className="hidden sm:block w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-zinc-400 shrink-0">{currentDoc.category}</span>
              <ChevronRight className="hidden sm:block w-3 h-3 text-zinc-600 shrink-0" />
              <span className="hidden sm:inline text-sky-400 font-medium truncate">{currentDoc.title}</span>
            </div>

            {/* Document Content Rendering */}
            {activeDocId === 'overview' ? (
              <div>
                <div className="mb-6 pb-4 border-b border-zinc-800">
                  <h1 className="text-xl font-semibold text-white tracking-tight mb-3">
                    Enterprise AI Architecture &amp; Sizing Reference
                  </h1>
                  <p className="text-sm text-zinc-300 leading-relaxed mb-3">
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
                  <p className="text-sm text-zinc-400 leading-relaxed mt-3">
                    Learning the field? <strong className="text-zinc-200">Learning mode</strong> (switch in the header) is a ten-lesson path for
                    solutions architects: each lesson works on a real design with the same engine, shows the math, and links to the chapter here
                    that goes deeper; it ends with a design brief and a scored quiz.
                    New to the calculator? <strong className="text-zinc-200">Guided setup</strong> in Advanced mode asks five plain questions
                    (what it will do, how many people use it, how long the documents are, whether it must be air-gapped, and the vendor and budget),
                    sizes every platform from that vendor with latency targets on, and recommends the lowest-cost design that meets them.
                    Every setting stays editable afterwards.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  <div
                    onClick={() => setActiveDocId('chap-1-memory')}
                    className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">Core Foundations</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                      Deep-dive into silicon memory sizing, KV cache attention mechanics, rail-optimized Clos networks, Erlang C queueing, storage durability math, accelerator comparisons, and TCO unit economics.
                    </p>
                    <span className="text-xs text-sky-400 font-medium flex items-center gap-1">
                      Explore Foundations <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>

                  <div
                    onClick={() => setActiveDocId('ent-rag-assistant')}
                    className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Briefcase className="w-4 h-4 text-sky-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">Workload Presets Guide</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                      Exhaustive architectural specifications, model selection rationales, and alternative comparisons for all 15 presets.
                    </p>
                    <span className="text-xs text-sky-400 font-medium flex items-center gap-1">
                      Browse Presets <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-100">How This Documentation Works</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Use the collapsible left navigation sidebar to browse or search any specific chapter or preset blueprint.
                    Each page is an independent architectural document detailing:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-300">
                    <li><strong>Explanatory Foundation:</strong> Clear systems engineering introductions framing the operational challenge before technical data.</li>
                    <li><strong>Silicon &amp; Sharding Topology:</strong> Why specific GPUs and sharding parameters (TP/PP/DP) were chosen.</li>
                    <li><strong>Context &amp; KV Cache Dynamics:</strong> How context length and prefix caching ratios govern physical memory capacity.</li>
                    <li><strong>Ancillary Infrastructure:</strong> How RAG vector databases, safety guardrails, storage tiers, and HA/DR are integrated.</li>
                    <li><strong>Model Selection &amp; Alternatives:</strong> In-depth comparative evaluation of the primary model vs. 2–3 factual alternatives with parameter metrics and trade-offs.</li>
                    <li><strong>Binding Constraints &amp; Trade-offs:</strong> What engineering compromises were made for that workload.</li>
                    <li><strong>Calculator-consistent figures:</strong> GPU counts, sharding, memory and latency figures quoted on preset pages are what the calculator produces when that preset is loaded. The auto-solver chooses the layout with the fewest GPUs (which is often TP=2 or TP=4 rather than the smallest TP that fits) and can optionally size for latency targets -- see <em>Sharding &amp; Auto-Parallelism Logic</em>.</li>
                    <li><strong>Point in time:</strong> Model benchmarks, licenses and engine flags change quickly. Figures cite the vendor&apos;s own reports where given; confirm license terms and CLI flags against current documentation before deploying.</li>
                  </ul>
                </div>
              </div>
            ) : currentDoc.type === 'core' ? (
              <div>
                {/* Core Foundation Chapter */}
                <div className="mb-5 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <currentDoc.icon className="w-4 h-4 text-sky-400" />
                    <h1 className="text-lg font-semibold text-white tracking-tight">
                      {CORE_CONTENT[activeDocId]?.title || currentDoc.title}
                    </h1>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {CORE_CONTENT[activeDocId]?.subtitle}
                  </p>
                </div>

                {/* Explanatory Lead Introduction */}
                {CORE_CONTENT[activeDocId]?.introduction && (
                  <div className="mb-5">
                    <Banner tone="info" icon={Info}>
                      {CORE_CONTENT[activeDocId]?.introduction}
                    </Banner>
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
                      <div className="mb-5 pb-4 border-b border-zinc-800">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Tag tone="neutral" mono={false}>{currentDoc.category.toUpperCase()}</Tag>
                          <span className="text-xs font-mono text-zinc-500">preset_id: {activeDocId}</span>
                        </div>
                        <h1 className="text-lg font-semibold text-white tracking-tight mb-1.5">{preset.title}</h1>
                        <p className="text-sm text-sky-400 font-medium mb-3">{preset.summary}</p>

                        {/* Explanatory Blueprint Introduction */}
                        {preset.introduction && (
                          <div className="text-sm text-zinc-300 leading-relaxed space-y-3 pt-2">
                            {Array.isArray(preset.introduction) ? (
                              preset.introduction.map((para, i) => <p key={i}>{para}</p>)
                            ) : (
                              <p>{preset.introduction}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Specs Grid */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
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
                        <div>
                          <span className="text-zinc-500 block text-[11px] uppercase font-mono">MLOps Rollout Strategy</span>
                          <span className="font-semibold text-zinc-200">{preset.specs.mlops}</span>
                        </div>
                      </div>

                      {/* Rationales */}
                      <div className="space-y-6 text-[14px] text-zinc-300 leading-relaxed">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-sky-400" />
                            1. Why this Silicon &amp; Sharding Topology?
                          </h3>
                          <p>{preset.rationale.silicon}</p>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                            <Database className="w-4 h-4 text-sky-400" />
                            2. Memory, KV Cache &amp; Context Dynamics
                          </h3>
                          <p>{preset.rationale.memory}</p>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                            <Network className="w-4 h-4 text-sky-400" />
                            3. Ancillary Subsystems: RAG, Guardrails, Storage &amp; HA/DR
                          </h3>
                          <p>{preset.rationale.ancillary}</p>
                        </div>

                        {/* Model Selection & Alternatives Evaluation */}
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            4. Model Selection &amp; Alternative Architectures
                          </h3>
                          <p className="mb-4">{preset.rationale.modelSelection}</p>

                          {preset.rationale.modelAlternatives && (
                            <div className="space-y-2 mt-3">
                              <SectionLabel>Architectural Alternatives Comparison</SectionLabel>
                              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead className="bg-zinc-900 text-zinc-400 uppercase text-[11px] tracking-wide">
                                    <tr>
                                      <th className="p-3">Model</th>
                                      <th className="p-3">When to Choose</th>
                                      <th className="p-3">Trade-off vs Default</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/70">
                                    {preset.rationale.modelAlternatives.map((alt, idx) => (
                                      <tr key={idx}>
                                        <td className="p-3 align-top">
                                          <span className="font-semibold text-zinc-200 block">{alt.name}</span>
                                          <span className="font-mono text-zinc-500 text-[11px]">{alt.specs}</span>
                                        </td>
                                        <td className="p-3 align-top text-zinc-400">{alt.pros}</td>
                                        <td className="p-3 align-top text-zinc-400">{alt.cons}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Security & Compliance Posture */}
                        {preset.complianceFacts && (
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-sky-400" />
                              5. Security &amp; Compliance Posture
                            </h3>
                            <p className="mb-4 text-zinc-400 text-sm">
                              Derived from this preset's own HA/DR, Ingress, Guardrails, MIG, and MLOps configuration -- see{' '}
                              <span className="text-sky-400">Security, Compliance &amp; Attestation Controls</span> for what each posture level means and where this calculator's coverage stops.
                            </p>
                            <ComplianceChecklist facts={preset.complianceFacts} />
                          </div>
                        )}

                        {/* Common Anti-Patterns & Failure Modes */}
                        {preset.antiPatterns && preset.antiPatterns.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              6. Common Anti-Patterns &amp; &quot;What Breaks First&quot;
                            </h3>
                            <div className="divide-y divide-zinc-800/70 border-t border-b border-zinc-800/70">
                              {preset.antiPatterns.map((item, idx) => (
                                <div key={idx} className="py-3 pl-3 border-l-2 border-amber-700/60 text-xs space-y-1">
                                  <span className="font-semibold text-amber-400 text-sm block">{item.title}</span>
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
                            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-sky-400" />
                              7. Production Engine Launch Recipe ({preset.engineRecipe.framework})
                            </h3>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-xs">
                              <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                                <span className="text-zinc-400 font-mono text-[11px]">{preset.engineRecipe.commandTitle || 'Production CLI Flags'}</span>
                                <Tag tone="accent">{preset.engineRecipe.framework}</Tag>
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
            <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center justify-between gap-4">
              {prevDoc ? (
                <button
                  onClick={() => setActiveDocId(prevDoc.id)}
                  className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition text-left cursor-pointer group max-w-[45%]"
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
                  className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition text-right cursor-pointer group max-w-[45%] ml-auto"
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
