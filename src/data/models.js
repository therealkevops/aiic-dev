export const MODEL_PRESETS = [
  {
    id: "llama3-8b",
    name: "Meta LLaMA 3.1 (8B)",
    params: 8.03, // Billion
    layers: 32,
    numHeads: 32,  // Query heads
    kvHeads: 8,    // GQA KV heads
    headDim: 128,
    hidden: 4096,
    intermediate: 14336,
    vocab: 128256,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Llama 3.1 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users, and outputs used to train other models must credit Llama.' },
    recommendedFor: "Local edge serving, lightweight chat, agent loops, fast classification",
    description: "Compact 8-billion parameter model. Fits comfortably on a single GPU for inference."
  },
  {
    id: "llama3-70b",
    name: "Meta LLaMA 3.1 (70B)",
    params: 70.6,
    layers: 80,
    numHeads: 64,  // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 8192,
    intermediate: 28672,
    vocab: 128256,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Llama 3.1 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users.' },
    recommendedFor: "Enterprise flagship reasoning, coding, production customer-facing agents",
    description: "Workhorse 70-billion parameter model. Standard production choice for enterprise AI."
  },
  {
    id: "llama33-70b",
    name: "Meta LLaMA 3.3 (70B)",
    params: 70.6,
    layers: 80,
    numHeads: 64,  // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 8192,
    intermediate: 28672,
    vocab: 128256,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Llama 3.3 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users.' },
    recommendedFor: "Latest enterprise-standard dense deployment; multilingual chat, tool use, long-form reasoning",
    description: "Meta's updated 70B release — identical dense architecture and VRAM footprint to Llama 3.1 70B, with materially improved instruction-following and multilingual quality from refined post-training. Now the default choice for enterprises standardizing on a 70B-class Llama deployment."
  },
  {
    id: "llama3-405b",
    name: "Meta LLaMA 3.1 (405B)",
    params: 405.0,
    layers: 126,
    numHeads: 128, // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 16384,
    intermediate: 53248,
    vocab: 128256,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Llama 3.1 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users.' },
    recommendedFor: "Frontier research, synthetic data generation, distilled model teaching",
    description: "Massive frontier dense model. Requires multi-node clustering with high-speed fabric."
  },
  {
    id: "deepseek-r1-671b",
    name: "DeepSeek V3 / R1 / V3.1 (671B MoE)",
    params: 671.0,
    activeParams: 37.0,
    layers: 61,
    numHeads: 128, // Query heads
    kvHeads: 1,   // MLA: KV compressed to single 512-dim latent (not standard GQA heads)
    headDim: 512, // MLA compressed latent dimension (512 compressed KV + 64 RoPE = 576 dims stored)
    hidden: 7168,
    intermediate: 2048,
    vocab: 129280,
    routedExperts: 256,
    activeExperts: 8,
    sharedExperts: 1,
    P_nonExpert: 17.0, // attention (MLA), 3 dense layers, shared experts, embeddings
    P_routedExperts: 654.0, // 58 MoE layers x 256 experts x 3 x 7168 x 2048
    moeLayers: 58,
    maxContextLength: 131072, // 128k max native context
    isMoe: true,
    license: { name: 'MIT', commercial: 'open' },
    isMla: true,
    recommendedFor: "Frontier mathematical reasoning, competitive programming, deep thinking tasks",
    description: "Mixture-of-Experts (MoE) with 671B total params but only 37B active per token, and Multi-Head Latent Attention for a very small KV cache. V3, R1, R1-0528 and V3.1 share this architecture. Requires high aggregate VRAM (~671GB at FP8)."
  },
  {
    id: "mixtral-8x22b",
    name: "Mistral Mixtral 8x22B (141B MoE)",
    params: 141.0,
    activeParams: 39.0,
    layers: 56,
    numHeads: 48,  // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 6144,
    intermediate: 16384,
    vocab: 32000,
    routedExperts: 8,
    activeExperts: 2,
    sharedExperts: 0,
    P_nonExpert: 5.6, // attention, embeddings, router
    P_routedExperts: 135.4, // 56 layers x 8 experts x 3 x 6144 x 16384
    maxContextLength: 65536,  // 64k max native context for Mixtral 8x22B
    isMoe: true,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "High-throughput multilingual tasks, code generation, reasoning",
    description: "Sparse MoE architecture activating 39B params out of 141B per token."
  },
  {
    id: "qwen25-72b",
    name: "Alibaba Qwen 2.5 (72B)",
    params: 72.7,
    layers: 80,
    numHeads: 64,  // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 8192,
    intermediate: 29568,
    vocab: 152064,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Qwen License', commercial: 'conditional', note: 'Commercial use allowed; a separate Alibaba license is required above 100M monthly active users.' },
    recommendedFor: "Coding, structured JSON output, math, multilingual chat",
    description: "High-performance open-weights dense 72B model with strong coding and math proficiency."
  },
  {
    id: "mistral-large-2",
    name: "Mistral Large 2 (123B)",
    params: 123.0,
    layers: 88,
    numHeads: 96,  // Query heads
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 12288,
    intermediate: 28672,
    vocab: 32768,
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'Mistral Research License', commercial: 'non-commercial', note: 'Research and non-commercial use only; production use requires a commercial license from Mistral AI.' },
    recommendedFor: "Enterprise on-premises flagship: multilingual reasoning, code generation, function calling, RAG",
    description: "Mistral AI's flagship dense model, positioned explicitly for private / on-prem enterprise deployment with strong multilingual (12+ language) and code-generation performance."
  },
  {
    id: "command-r-plus",
    name: "Cohere Command R+ (104B)",
    params: 104.0,
    layers: 64,
    numHeads: 96,  // Query heads (MHA-derived; hidden 12288 / 96 = 128 head_dim)
    kvHeads: 8,    // GQA: 8 KV heads
    headDim: 128,
    hidden: 12288,
    intermediate: 33792,
    vocab: 256000, // Large multilingual tokenizer
    maxContextLength: 131072, // 128k max native context
    isMoe: false,
    license: { name: 'CC-BY-NC 4.0', commercial: 'non-commercial', note: 'Non-commercial use only; production use requires an agreement with Cohere.' },
    recommendedFor: "Enterprise RAG, multi-step tool use / agents, grounded generation with inline citations",
    description: "Cohere's open-weights flagship, purpose-built for enterprise retrieval-augmented generation and tool-use workflows with native grounded-citation support."
  },
  {
    id: "qwen3-32b",
    name: "Alibaba Qwen3 (32B)",
    params: 32.8,
    layers: 64,
    numHeads: 64,
    kvHeads: 8,
    headDim: 128,
    hidden: 5120,
    intermediate: 25600,
    vocab: 151936,
    maxContextLength: 131072, // 32k native, 128k with YaRN rope scaling
    isMoe: false,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Single-GPU enterprise assistant with optional reasoning (thinking) mode, coding, multilingual chat",
    description: "Dense 32B model with switchable thinking / non-thinking modes. Fits on one 80GB+ GPU at FP8. Native window is 32k; 128k requires YaRN rope scaling."
  },
  {
    id: "qwen3-235b-a22b",
    name: "Alibaba Qwen3 235B-A22B (MoE)",
    params: 235.0,
    activeParams: 22.0,
    layers: 94,
    numHeads: 64,
    kvHeads: 4,
    headDim: 128,
    hidden: 4096,
    intermediate: 1536, // per-expert FFN width
    vocab: 151936,
    routedExperts: 128,
    activeExperts: 8,
    sharedExperts: 0,
    P_nonExpert: 8.1,
    P_routedExperts: 226.9,
    maxContextLength: 262144, // 2507 releases: 256k native
    isMoe: true,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Frontier-class open reasoning and agents on a single 8-GPU node",
    description: "128-expert MoE activating 22B of 235B parameters per token. ~235GB at FP8 fits one 8x H100/H200 node. The 2507 Instruct/Thinking releases support a 256k native context."
  },
  {
    id: "qwen3-coder-480b",
    name: "Alibaba Qwen3-Coder 480B-A35B (MoE)",
    params: 480.0,
    activeParams: 35.0,
    layers: 62,
    numHeads: 96,
    kvHeads: 8,
    headDim: 128,
    hidden: 6144,
    intermediate: 2560, // per-expert FFN width
    vocab: 151936,
    routedExperts: 160,
    activeExperts: 8,
    sharedExperts: 0,
    P_nonExpert: 12.0,
    P_routedExperts: 468.0,
    maxContextLength: 262144, // 256k native
    isMoe: true,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Agentic coding / SWE agents over whole repositories",
    description: "Code-specialized MoE (35B active of 480B) trained for agentic coding and tool use, with a 256k native context. ~480GB at FP8 needs a full 8x H200 or B200 node."
  },
  {
    id: "llama4-scout",
    name: "Meta Llama 4 Scout (109B MoE)",
    params: 109.0,
    activeParams: 17.0,
    layers: 48,
    numHeads: 40,
    kvHeads: 8,
    headDim: 128,
    hidden: 5120,
    intermediate: 8192, // per-expert FFN width
    vocab: 202048,
    routedExperts: 16,
    activeExperts: 1,
    sharedExperts: 1,
    P_nonExpert: 12.4,
    P_routedExperts: 96.6,
    localLayers: 36, // 3 of every 4 layers use chunked (8k) attention
    localWindow: 8192,
    maxContextLength: 262144, // model supports up to 10M; capped here to typical serving limits
    isMoe: true,
    license: { name: 'Llama 4 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users.' },
    recommendedFor: "Long-context multimodal assistant on a single node; cost-efficient MoE",
    description: "16-expert MoE (17B active of 109B) with native image input. Three of every four layers use 8k chunked attention, so long-context KV grows mostly from the remaining global layers. Advertised context is 10M tokens; the calculator caps it at 256k."
  },
  {
    id: "llama4-maverick",
    name: "Meta Llama 4 Maverick (400B MoE)",
    params: 400.0,
    activeParams: 17.0,
    layers: 48,
    numHeads: 40,
    kvHeads: 8,
    headDim: 128,
    hidden: 5120,
    intermediate: 8192, // per-expert FFN width
    vocab: 202048,
    routedExperts: 128,
    activeExperts: 1,
    sharedExperts: 1,
    P_nonExpert: 13.5,
    P_routedExperts: 386.5,
    moeLayers: 24, // MoE on alternating layers
    localLayers: 36,
    localWindow: 8192,
    maxContextLength: 262144, // model supports up to 1M; capped here to typical serving limits
    isMoe: true,
    license: { name: 'Llama 4 Community License', commercial: 'conditional', note: 'Commercial use allowed; a separate Meta license is required above 700M monthly active users.' },
    recommendedFor: "High-quality multimodal assistant with low per-token compute",
    description: "128-expert MoE (17B active of 400B) with native image input and chunked local attention on three of every four layers. ~400GB at FP8 fits one 8x H200 node. Advertised context is 1M tokens; the calculator caps it at 256k."
  },
  {
    id: "gpt-oss-120b",
    name: "OpenAI gpt-oss-120b (117B MoE)",
    params: 116.8,
    activeParams: 5.1,
    layers: 36,
    numHeads: 64,
    kvHeads: 8,
    headDim: 64,
    hidden: 2880,
    intermediate: 2880, // per-expert FFN width
    vocab: 201088,
    routedExperts: 128,
    activeExperts: 4,
    sharedExperts: 0,
    P_nonExpert: 2.1,
    P_routedExperts: 114.7,
    localLayers: 18, // alternating 128-token sliding-window and full-attention layers
    localWindow: 128,
    maxContextLength: 131072,
    isMoe: true,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Reasoning and tool-use agents on a single 80GB GPU",
    description: "Reasoning MoE (5.1B active of 117B) released with MXFP4 expert weights (~61GB), so it fits on one 80GB H100. Pick the MXFP4 precision to match the released checkpoint. Half its layers use a 128-token sliding window, keeping the KV cache small."
  },
  {
    id: "gpt-oss-20b",
    name: "OpenAI gpt-oss-20b (21B MoE)",
    params: 20.9,
    activeParams: 3.6,
    layers: 24,
    numHeads: 64,
    kvHeads: 8,
    headDim: 64,
    hidden: 2880,
    intermediate: 2880,
    vocab: 201088,
    routedExperts: 32,
    activeExperts: 4,
    sharedExperts: 0,
    P_nonExpert: 1.8,
    P_routedExperts: 19.1,
    localLayers: 12,
    localWindow: 128,
    maxContextLength: 131072,
    isMoe: true,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Edge / single-card reasoning, low-latency agents",
    description: "Small reasoning MoE (3.6B active of 21B), ~13GB with MXFP4 expert weights. Runs on a single 16GB+ GPU."
  },
  {
    id: "gemma3-27b",
    name: "Google Gemma 3 (27B)",
    params: 27.4,
    layers: 62,
    numHeads: 32,
    kvHeads: 16,
    headDim: 128,
    hidden: 5376,
    intermediate: 21504,
    vocab: 262208,
    localLayers: 52, // 5 local (1,024-token sliding window) layers per global layer
    localWindow: 1024,
    maxContextLength: 131072,
    isMoe: false,
    license: { name: 'Gemma Terms of Use', commercial: 'conditional', note: 'Commercial use allowed subject to the Gemma Prohibited Use Policy; not an OSI open-source license.' },
    recommendedFor: "Single-GPU multimodal assistant, multilingual chat",
    description: "Dense 27B multimodal model. Five of every six layers use a 1,024-token sliding window, so its long-context KV cache is far smaller than a full-attention model of the same size."
  },
  {
    id: "mistral-small-3",
    name: "Mistral Small 3.2 (24B)",
    params: 24.0,
    layers: 40,
    numHeads: 32,
    kvHeads: 8,
    headDim: 128,
    hidden: 5120,
    intermediate: 32768,
    vocab: 131072,
    maxContextLength: 131072,
    isMoe: false,
    license: { name: 'Apache 2.0', commercial: 'open' },
    recommendedFor: "Cost-efficient enterprise chat, function calling, low-latency agents",
    description: "Apache-licensed 24B dense model with vision input and 128k context. Fits on a single 48GB L40S at FP8."
  },
  {
    id: "kimi-k2",
    name: "Moonshot Kimi K2 (1T MoE)",
    params: 1026.0,
    activeParams: 32.0,
    layers: 61,
    numHeads: 64,
    kvHeads: 1,   // MLA (same scheme as DeepSeek V3)
    headDim: 512,
    hidden: 7168,
    intermediate: 2048, // per-expert FFN width
    vocab: 163840,
    routedExperts: 384,
    activeExperts: 8,
    sharedExperts: 1,
    P_nonExpert: 12.0,
    P_routedExperts: 1014.0,
    moeLayers: 60,
    maxContextLength: 262144, // 0905 release: 256k
    isMoe: true,
    isMla: true,
    license: { name: 'Modified MIT', commercial: 'conditional', note: 'MIT terms, plus a UI attribution requirement for products above 100M monthly active users or $20M monthly revenue.' },
    recommendedFor: "Frontier agentic tool use and coding at neo-cloud scale",
    description: "1T-parameter MoE (32B active) using DeepSeek-style MLA. ~1TB at FP8 needs more than one 8x H200 node; fits one 8x B200 node at FP4-class precision."
  },
  {
    id: "custom",
    name: "Custom Model Spec",
    params: 32.0,
    layers: 48,
    numHeads: 32,  // Query heads
    kvHeads: 8,    // GQA KV heads
    headDim: 128,
    hidden: 4096,
    intermediate: 11008,
    vocab: 32000,
    maxContextLength: 131072,
    isMoe: false,
    license: { name: 'Your own', commercial: 'open' },
    recommendedFor: "Custom or in-house proprietary model architecture",
    description: "Configure custom parameter counts, context lengths, and KV head dimensions."
  }
];

export const PRECISION_OPTIONS = [
  {
    id: "fp16",
    name: "FP16 / BF16 (16-bit)",
    bytesPerParam: 2.0,
    kvBytesPerElement: 2.0, // bytes per KV cache element (renamed from kvBytesPerToken for clarity)
    kvBytesPerToken: 2.0,   // kept for backward compat
    isQuantized: false,
    description: "Standard full precision. Maximum output fidelity; requires 2 bytes of VRAM per parameter."
  },
  {
    id: "fp8",
    name: "FP8 (8-bit)",
    bytesPerParam: 1.0,
    kvBytesPerElement: 1.0,
    kvBytesPerToken: 1.0,
    isQuantized: true,
    description: "Industry sweet spot for modern inference (H100/H200/B200). Cuts VRAM in half with negligible accuracy loss."
  },
  {
    id: "nvfp4",
    name: "NVFP4 (4-bit)",
    bytesPerParam: 0.5625,
    kvBytesPerElement: 1.0,
    kvBytesPerToken: 1.0,
    isQuantized: true,
    description: "Blackwell microscopic 4-bit floating point (0.5625 bytes/param including 1-in-16 micro-scaling overhead)."
  },
  {
    id: "mxfp4",
    name: "MXFP4 (4-bit, OCP microscaling)",
    bytesPerParam: 0.53125,
    kvBytesPerElement: 1.0,
    kvBytesPerToken: 1.0,
    isQuantized: true,
    description: "OCP MX 4-bit float: 32 values share one 8-bit scale (4.25 bits/param). gpt-oss ships its expert weights in this format. Native on Blackwell; Hopper runs it through dequantizing kernels."
  },
  {
    id: "int4",
    name: "INT4 AWQ / GPTQ (4-bit)",
    bytesPerParam: 0.53,
    kvBytesPerElement: 1.0, // KV cache kept at FP8/FP16 for accuracy
    kvBytesPerToken: 1.0,   // Usually keep KV cache at FP8 or FP16 for quality
    isQuantized: true,
    description: "Aggressive 4-bit compression (0.53 bytes/param including group scaling and zero-point overhead)."
  }
];
