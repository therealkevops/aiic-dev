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
    recommendedFor: "Frontier research, synthetic data generation, distilled model teaching",
    description: "Massive frontier dense model. Requires multi-node clustering with high-speed fabric."
  },
  {
    id: "deepseek-r1-671b",
    name: "DeepSeek R1 / V3 (671B MoE)",
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
    P_nonExpert: 61.0, // approx
    P_routedExperts: 610.0, // approx
    maxContextLength: 131072, // 128k max native context
    isMoe: true,
    isMla: true,
    recommendedFor: "Frontier mathematical reasoning, competitive programming, deep thinking tasks",
    description: "Mixture-of-Experts (MoE) with 671B total params but only 37B active per token. Requires high aggregate VRAM."
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
    P_nonExpert: 13.0, // approx
    P_routedExperts: 128.0, // approx
    maxContextLength: 65536,  // 64k max native context for Mixtral 8x22B
    isMoe: true,
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
    recommendedFor: "Enterprise RAG, multi-step tool use / agents, grounded generation with inline citations",
    description: "Cohere's open-weights flagship, purpose-built for enterprise retrieval-augmented generation and tool-use workflows with native grounded-citation support."
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
    id: "int4",
    name: "INT4 AWQ / GPTQ (4-bit)",
    bytesPerParam: 0.53,
    kvBytesPerElement: 1.0, // KV cache kept at FP8/FP16 for accuracy
    kvBytesPerToken: 1.0,   // Usually keep KV cache at FP8 or FP16 for quality
    isQuantized: true,
    description: "Aggressive 4-bit compression (0.53 bytes/param including group scaling and zero-point overhead)."
  }
];
