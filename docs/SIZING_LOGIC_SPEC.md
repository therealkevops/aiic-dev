# AI Infrastructure Sizing & Cluster Topology Specification

> **Technical Reference & Mathematical Derivations for Enterprise Private AI Sizing**  
> *Target Environments:* Cisco UCS (C885A, C245, X9508 Modular), Supermicro Enterprise, NVIDIA DGX Platforms, Cisco Nexus Lossless RoCEv2 Fabric, and vLLM / TensorRT-LLM Serving Stacks.

---

## 1. Executive Summary & Design Scope

This document specifies the exact mathematical models, engineering heuristics, and architectural trade-offs implemented in the **Private AI Infrastructure Sizing Calculator** (`src/utils/calculator.js`). 

The sizing engine calculates:
1. **Total Accelerator VRAM Allocation**: Model weights, KV cache, activation memory, optimizer states, and gradient buffers.
2. **Parallelism & Sharding**: Optimal Tensor Parallelism (TP), Pipeline Parallelism (PP), Data Parallelism (DP), and ZeRO stages.
3. **Inference Performance Profile**: Prefill Time to First Token (TTFT) and autoregressive Decode Time Per Output Token (TPOT).
4. **Disaggregated Serving (LLM-D)**: Heterogeneous prefill vs. decode clustering and Cisco Nexus RoCEv2 inter-node KV cache streaming latency.
5. **Physical Datacenter Bill of Materials (BOM)**: Server nodes, modular blade pairs, leaf/spine switches, cabling counts, total rack units (RU), IT power, and facility cooling power under configurable PUE.

---

## 2. Model Weight Memory Sizing

### 2.1 Dense Transformer Models

For standard dense autoregressive transformers (e.g., Meta LLaMA 3.1 8B, 70B, 405B; Alibaba Qwen 2.5 72B), every parameter must reside in GPU High Bandwidth Memory (HBM) during inference and training.

$$\text{Memory}_{\text{weights}} = \frac{P \times 10^9 \times B_{\text{param}} + M_{\text{unquantized\_heads}}}{10^9} \quad [\text{GB}]$$

Where:
* $P$ = Total model parameters (in billions, $10^9$).
* $B_{\text{param}}$ = Effective bytes allocated per parameter based on numerical precision:
  * **FP32 (Single Precision)**: $4.0\text{ bytes}$
  * **FP16 / BF16 (Half / Bfloat16)**: $2.0\text{ bytes}$
  * **FP8 / INT8 (E4M3 / E5M2 / W8A8)**: $1.0\text{ byte}$
  * **NVFP4 (NVIDIA Blackwell 4-bit)**: $0.5625\text{ bytes}$ ($4\text{ bits} + \text{1-in-16 micro-scaling overhead}$)
  * **INT4 AWQ / GPTQ**: $0.53\text{ bytes}$ ($4\text{ bits} + \text{group size 128 scale/zero overhead}$)

#### Unquantized Embedding & LM Head Overhead (S4)
When weights are quantised ($B_{\text{param}} < 2.0$), the token embedding table and final language model projection head (`lm_head`) are retained at full 16-bit precision ($\text{BF16} = 2\text{ bytes}$) in production engines (vLLM, TensorRT-LLM) to prevent logit collapse:

$$M_{\text{unquantized\_heads}} = 2 \times \text{vocab} \times \text{hidden} \times 2 \quad [\text{bytes}]$$

*Documented Sources:*
* **Lin et al. (2023)**: *AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration* ([arXiv:2306.00978](https://arxiv.org/abs/2306.00978)).
* **Frantar et al. (2022)**: *GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers* ([arXiv:2210.17323](https://arxiv.org/abs/2210.17323)).
* **Shoeybi et al. (2019)**: *Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism* ([arXiv:1909.08053](https://arxiv.org/abs/1909.08053)).
* **Meta AI (2024)**: *The Llama 3 Herd of Models* ([arXiv:2407.21783](https://arxiv.org/abs/2407.21783)).

---

### 2.2 Mixture of Experts (MoE) Models

In a Mixture-of-Experts architecture (e.g., DeepSeek-V3 / R1 671B, Mistral Mixtral 8x22B), only a subset of experts are activated per token:
* **DeepSeek R1 / V3**: $671\text{B total parameters}$, $37\text{B active parameters}$ per token ($1\text{ shared expert} + 8\text{ routed experts}$ out of 256).
* **Mixtral 8x22B**: $141\text{B total parameters}$, $39\text{B active parameters}$ per token (Top-2 routing out of 8 experts).

#### Critical Architectural Invariant
While compute throughput (FLOPs) and token generation latency (memory bandwidth) are governed by $P_{\text{active}}$, **all $P_{\text{total}}$ parameters must remain permanently resident in GPU HBM**. Paging expert weights dynamically across PCIe or NVLink during token generation introduces tens of milliseconds of latency, violating real-time SLA thresholds.

$$\text{Memory}_{\text{weights, MoE}} = \frac{P_{\text{total}} \times 10^9 \times B_{\text{param}} + M_{\text{unquantized\_heads}}}{10^9} \quad [\text{GB}]$$

$$\text{Compute Throughput}_{\text{MoE}} \propto P_{\text{active}}$$

*Documented Sources:*
* **DeepSeek-AI (2024)**: *DeepSeek-V3 Technical Report* ([arXiv:2412.19437](https://arxiv.org/abs/2412.19437)).
* **Jiang et al. (2024)**: *Mixtral of Experts* ([arXiv:2401.04088](https://arxiv.org/abs/2401.04088)).

---

## 3. KV Cache Memory Architecture & Mechanics

The Key-Value (KV) cache stores attention key and value vectors from earlier tokens to avoid $O(S^2)$ redundant recomputation during autoregressive generation. At context lengths of $32\text{k}$ to $131\text{k}$ tokens, **KV cache memory often exceeds the model weights themselves**.

### 3.1 Multi-Head Attention (MHA) & Grouped-Query Attention (GQA)

Standard transformer layers project hidden states into $H_q$ query heads and $H_{kv}$ key/value heads of dimension $D_{\text{head}}$.
* **Multi-Head Attention (MHA)**: $H_{kv} = H_q$ (e.g., original LLaMA 1, GPT-3).
* **Grouped-Query Attention (GQA)**: $H_{kv} \ll H_q$ (e.g., LLaMA 3.1 70B uses $H_q = 64, H_{kv} = 8$, an $8\times$ compression factor).

#### Mathematical Formulation
For each token in the context window, a transformer layer stores 1 Key vector and 1 Value vector:

$$\text{Scalar Elements per Layer per Token} = 2 \times H_{kv} \times D_{\text{head}}$$

For a model with $L$ layers:

$$\text{KV Bytes per Token Sequence} = 2 \times L \times H_{kv} \times D_{\text{head}} \times B_{\text{kv\_elem}}$$

For context length $S$ and $C$ concurrent user streams:

$$M_{\text{kv, baseline}} = \frac{2 \times L \times H_{kv} \times D_{\text{head}} \times B_{\text{kv\_elem}} \times S \times C}{10^9} \quad [\text{GB}]$$

Where $B_{\text{kv\_elem}}$ is the KV cache precision:
* **FP16 / BF16**: $2.0\text{ bytes/element}$ (Default in vLLM/TRT-LLM)
* **FP8 (E4M3 / E5M2)**: $1.0\text{ byte/element}$ (Enables $50\%$ KV memory reduction via `--kv-cache-dtype fp8`)
* **INT4 / FP4**: $0.5\text{ bytes/element}$ (Enables $75\%$ KV memory reduction)

*Documented Sources:*
* **Ainslie et al. (2023)**: *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints* ([arXiv:2305.13245](https://arxiv.org/abs/2305.13245)).
* **Kwon et al. (2023)**: *Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM)*, ACM SOSP 2023.

---

### 3.2 DeepSeek Multi-Head Latent Attention (MLA)

DeepSeek V2, V3, and R1 replace standard GQA with **Multi-Head Latent Attention (MLA)**, projecting Key and Value representations into a low-rank compressed latent space:
* Compressed KV latent vector: $d_c = 512$
* Decoupled Rotary Position Embedding (RoPE) key: $d_r = 64$
* Total stored scalars per layer per token: $512 + 64 = 576$ elements.

$$\text{KV Bytes per Token Sequence (MLA)} = L \times (d_c + d_r) \times B_{\text{kv\_elem}} = 61 \times 576 \times B_{\text{kv\_elem}} = 35,136 \times B_{\text{kv\_elem}}$$

#### Comparison: LLaMA 3.1 70B (GQA) vs. DeepSeek R1 (MLA)
* **LLaMA 3 70B (GQA)**: $2 \times 80 \times 8 \times 128 = 163,840\text{ elements/token}$
* **DeepSeek R1 (MLA)**: $61 \times 576 = 35,136\text{ elements/token}$
* **Result**: MLA delivers a **$4.66\times$ reduction in KV cache memory**, allowing DeepSeek R1 to support massive context concurrency that would otherwise cause Out-Of-Memory (OOM) failures under standard GQA.

*Documented Sources:*
* **DeepSeek-AI (2024)**: *DeepSeek-V3 Technical Report*, Section 2.1 (Multi-Head Latent Attention).

---

### 3.3 Automatic Prefix Caching (M4)

In production inference engines (vLLM, SGLang), prompt tokens that are shared across requests (e.g., system instructions, few-shot examples, multi-turn dialogue history, or RAG retrieved documents) are stored once in GPU memory in a radix tree rather than duplicated per user stream.

The caching behavior distinguishes between **global shared prefixes** and **session-level reuse**:
* **Global Prefix Tokens** (`globalPrefixTokens`): Common system prompts or few-shot context shared across distinct user sessions. Stored **once** across all streams in VRAM, yielding multi-stream memory savings:
  $$S_{\text{shared}} = \min(S_{\text{prompt}}, \text{globalPrefixTokens}) \quad [\text{or } S_{\text{prompt}} \times \text{prefixCacheRatio}]$$
  $$S_{\text{private}} = S - S_{\text{shared}}$$
  $$\text{Effective Stored Tokens} = (S_{\text{private}} \times C) + (S_{\text{shared}} \times 1)$$
  $$M_{\text{kv, optimized}} = \frac{\text{BytesPerTokenSeq} \times \text{Effective Stored Tokens}}{10^9} \quad [\text{GB}]$$
  $$\text{VRAM Savings} = M_{\text{kv, baseline}} - M_{\text{kv, optimized}} \quad [\text{GB}]$$

* **Session Reuse Ratio** (`sessionReuseRatio`): Tokens reused within the same conversational stream across turns. Because these tokens belong to individual user sessions, they must be retained per active stream and provide **no cross-user VRAM memory savings**. However, they bypass prefill computation during forward execution, directly reducing Time-to-First-Token (TTFT):
  $$S_{\text{uncached}} = \max(1, S_{\text{prompt}} - S_{\text{shared}} - (S_{\text{prompt}} - S_{\text{shared}}) \times \text{sessionReuseRatio})$$

---

### 3.4 Per-GPU Memory Distribution (S2)

Rather than aggregate cluster-level approximations ($M_{\text{replica}} \le N \times VRAM$), physical execution requires exact per-GPU placement validation:

1. **GQA / MHA Attention**:
   $$TP_{\text{eff}} = \min(TP, H_{kv})$$
   $$kv_{\text{per\_gpu}} = \frac{kv_{\text{total}}}{TP_{\text{eff}} \times PP}$$
   When $TP > H_{kv}$, KV heads are replicated across tensor-parallel ranks, capping the KV sharding divisor at $H_{kv}$.

2. **Multi-Head Latent Attention (MLA)**:
   $$kv_{\text{per\_gpu}} = \frac{kv_{\text{total}}}{PP \times (DP_{\text{attn}} \text{ ? } DP : 1)}$$
   Because the compressed latent representation ($d_c = 512, d_r = 64$) is projected into query heads per rank, the latent is replicated across all TP ranks. Consequently, TP does not divide MLA KV cache memory.

3. **Per-GPU Weights**:
   $$weights_{\text{per\_gpu}} = \frac{W}{TP \times PP} \times \text{CONFIG.ppImbalance}$$
   Where $\text{CONFIG.ppImbalance} = 1.1$ when $PP > 1$ (accounting for 10% memory imbalance across early/late pipeline stages).

*Documented Sources:*
* **Zheng et al. (2024)**: *SGLang: Efficient Execution of Structured Language Model Programs* ([arXiv:2312.07104](https://arxiv.org/abs/2312.07104)).
* **vLLM Documentation**: *Automatic Prefix Caching (APC) Architecture & Memory Layout*.

---

## 4. Activation Memory & Safety Overhead

### 4.1 Inference Activation Memory

During forward inference passes, intermediate activation tensors (residual stream, MLP projections, attention logits) are evaluated per execution step. Layer activations are discarded immediately after forward execution, so activation memory does not scale with model depth $L$:

$$\text{tokensPerStep} = \text{CONFIG.maxBatchedTokens} \quad (\text{default } 8192)$$

$$M_{\text{act}} = \text{tokensPerStep} \times (\text{hidden} + 2 \times \text{intermediate}) \times B_{\text{act}} \times 1.2 + \text{maxNumSeqs} \times \text{vocab} \times 4 \quad [\text{bytes}]$$

Where:
* $B_{\text{act}} = 2\text{ bytes}$ ($\text{CONFIG.B\_act}$, BF16).
* $\text{intermediate}$ and $\text{vocab}$ are explicitly parameterized per model architecture (e.g., LLaMA 3.1 70B uses $\text{intermediate}=28672$ and $\text{vocab}=128256$).
* $1.2$ = Empirical multiplier for FlashAttention scratch buffers and temporary normalizers.
* $4\text{ bytes}$ = FP32 precision for final logits across vocabulary.
* $\text{maxNumSeqs} = C$ (number of concurrent user sequences).
* $\text{CONFIG.runtimeOverheadPerGpu} = 0$ (absorbed into the 10% reserve via $\text{CONFIG.gpuMemUtil} = 0.90$).

### 4.2 Usable VRAM Safety Factor

In production deployments, allocating $100\%$ of nominal GPU VRAM results in unpredictable CUDA out-of-memory errors due to PyTorch caching allocator fragmentation, memory paging limits, and CUDA context allocations.

The calculator enforces a strict **$90\%$ usable factor** (`CONFIG.gpuMemUtil = 0.90`), matching the vLLM production default (`--gpu-memory-utilization 0.90`):

$$VRAM_{\text{usable}} = VRAM_{\text{nominal}} \times \text{CONFIG.gpuMemUtil} = VRAM_{\text{nominal}} \times 0.90$$

* **NVIDIA H100 SXM5 (80 GB nominal)**: **$72.0\text{ GB}$ safe capacity** ($80 \times 0.90$).
* **NVIDIA H200 SXM5 (141 GB nominal)**: **$126.9\text{ GB}$ safe capacity** ($141 \times 0.90$).
* **NVIDIA B200 (180 GB nominal)**: **$162.0\text{ GB}$ safe capacity** ($180 \times 0.90$).

The remaining 10% buffer safely accommodates CUDA driver context, NCCL communication buffers, and allocator heap fragmentation without needing a redundant runtime overhead subtraction.

*Documented Sources:*
* **vLLM Documentation**: *Engine Arguments (`--gpu-memory-utilization`)*, [docs.vllm.ai](https://docs.vllm.ai/en/latest/models/engine_args.html).

---

## 5. Training Memory & ZeRO Optimizer Sharding

For Supervised Fine-Tuning (SFT) and Full Pre-training, memory requirements expand drastically due to optimizer states, gradient tensors, and backward activation storage.

### 5.1 Full Parameter SFT (Mixed Precision with AdamW)

Standard mixed-precision training stores:
1. **Working Weights**: $P \times B_{\text{param}}$ (held in FP16 or FP8).
2. **Gradients**: $P \times 2.0\text{ bytes}$ (held in FP16).
3. **AdamW Optimizer States**:
   * Master weights: $P \times 4.0\text{ bytes}$ (FP32 to prevent underflow during updates).
   * First moment vector ($m$): $P \times 4.0\text{ bytes}$ (FP32).
   * Second moment vector ($v$): $P \times 4.0\text{ bytes}$ (FP32).
   * **Total AdamW Footprint**: $12.0\text{ bytes per parameter}$.

$$\text{Total Training State} = P \times (B_{\text{param}} + 2 + 12) + M_{\text{act}} = P \times (B_{\text{param}} + 14) + M_{\text{act}} \quad [\text{GB}]$$

### 5.2 Training Activation Memory (FlashAttention & Recomputation)

Activation memory during training depends on sequence length $s$, micro-batch size $b$, hidden dimension $h$, activation bytes $B_{\text{act}} = 2$ ($\text{CONFIG.B\_act}$), and the recomputation policy (`CONFIG.recompute` $\in \{\text{'none'}, \text{'selective'}, \text{'full'}\}$):

* **Selective Recomputation** (`CONFIG.recompute = 'selective'`, Megatron-LM / FlashAttention default):
  $$\text{Activation per layer} = 34 \times s \times b \times h \times \frac{B_{\text{act}}}{2}$$
* **Full Recomputation** (`CONFIG.recompute = 'full'`):
  $$\text{Activation per layer} = 2 \times s \times b \times h \times B_{\text{act}}$$
* **No Recomputation** (`CONFIG.recompute = 'none'`):
  $$\text{Activation per layer} = 34 \times s \times b \times h \times B_{\text{act}}$$

Total model activation footprint is summed across all $L$ layers:
$$M_{\text{act}} = \frac{L \times \text{Activation per layer}}{10^9} \quad [\text{GB}]$$

### 5.3 LoRA (Low-Rank Adaptation)

Rather than an arbitrary $1\%$ heuristic, LoRA adapter parameter count is computed explicitly across all target linear projections in the transformer backbone:

$$P_{\text{adapter}} = L \times r \times \sum (d_{\text{in}} + d_{\text{out}})$$

Where $r = \text{CONFIG.loraRank}$ (default $16$), and the linear layers per transformer layer comprise:
* **Attention Projections**:
  * Query ($Q$): $\text{hidden} \to \text{hidden}$ ($d_{\text{in}} + d_{\text{out}} = 2 \times \text{hidden}$)
  * Key ($K$): $\text{hidden} \to d_k$ ($d_{\text{in}} + d_{\text{out}} = \text{hidden} + d_k$, where $d_k = H_{kv} \times D_{\text{head}}$)
  * Value ($V$): $\text{hidden} \to d_k$ ($d_{\text{in}} + d_{\text{out}} = \text{hidden} + d_k$)
  * Output ($O$): $\text{hidden} \to \text{hidden}$ ($d_{\text{in}} + d_{\text{out}} = 2 \times \text{hidden}$)
* **MLP / SwiGLU Projections**:
  * Gate: $\text{hidden} \to \text{intermediate}$ ($d_{\text{in}} + d_{\text{out}} = \text{hidden} + \text{intermediate}$)
  * Up: $\text{hidden} \to \text{intermediate}$ ($d_{\text{in}} + d_{\text{out}} = \text{hidden} + \text{intermediate}$)
  * Down: $\text{intermediate} \to \text{hidden}$ ($d_{\text{in}} + d_{\text{out}} = \text{intermediate} + \text{hidden}$)

For Meta LLaMA 3.1 70B ($L=80, \text{hidden}=8192, \text{intermediate}=28672, r=16$), this yields exactly **$0.2071\text{B adapter parameters}$** ($\approx 0.29\%$ of model parameters).

$$\text{Memory}_{\text{LoRA}} = (P \times B_{\text{param}}) + (P_{\text{adapter}} \times 2\text{ B grads}) + (P_{\text{adapter}} \times 12\text{ B Adam}) + M_{\text{act}} \quad [\text{GB}]$$

The frozen base weight term ($P \times B_{\text{param}}$) is sharded per-GPU using the same rule as Section 3.4 ($weights_{\text{per\_gpu}} = W / (TP \times PP) \times \text{CONFIG.ppImbalance}$) — Pipeline Parallelism still partitions the base model's layers across nodes under LoRA fine-tuning, exactly as it does for full SFT.

### 5.4 ZeRO Sharding Stages & Parallelism Compatibility

Under Data Parallelism ($DP$), ZeRO partitions memory across all $N_{\text{gpus}} = TP \times PP \times DP$:

| ZeRO Stage | Model Weights | Gradients | AdamW Optimizer States |
| :--- | :--- | :--- | :--- |
| **ZeRO-0** (No sharding) | Replicated per DP rank | Replicated per DP rank | Replicated per DP rank |
| **ZeRO-1** | Replicated per DP rank | Replicated per DP rank | **Sharded across the DP group** ($\frac{M_{\text{opt}}}{N_{\text{gpus}}}$) |
| **ZeRO-2** | Replicated per DP rank | **Sharded across the DP group** ($\frac{M_{\text{grad}}}{N_{\text{gpus}}}$) | **Sharded across the DP group** ($\frac{M_{\text{opt}}}{N_{\text{gpus}}}$) |
| **ZeRO-3 / FSDP** | **Sharded across the DP group** ($\frac{M_{\text{weight}}}{N_{\text{gpus}}}$) | **Sharded across the DP group** ($\frac{M_{\text{grad}}}{N_{\text{gpus}}}$) | **Sharded across the DP group** ($\frac{M_{\text{opt}}}{N_{\text{gpus}}}$) |

#### Architectural Pipeline Incompatibility
**ZeRO-2 and ZeRO-3 are strictly incompatible with Pipeline Parallelism ($PP > 1$)**. ZeRO gradient and parameter partitioning rely on synchronous All-Gather and Reduce-Scatter collectives across identical layer representations in the DP group. Pipeline stage boundaries split layers sequentially across time, breaking these collective assumptions. Clusters requiring $PP > 1$ must use ZeRO-1 or reduce $PP=1$.

*Documented Sources:*
* **Korthikanti et al. (2022)**: *Reducing Activation Recomputation in Large Transformer Models*, NVIDIA Megatron-LM ([arXiv:2205.05198](https://arxiv.org/abs/2205.05198)).
* **Rajbhandari et al. (2020)**: *ZeRO: Memory Optimizations Toward Training Trillion Parameter Models*, Microsoft DeepSpeed, SC20 ([arXiv:1910.02054](https://arxiv.org/abs/1910.02054)).
* **Hu et al. (2021)**: *LoRA: Low-Rank Adaptation of Large Language Models* ([arXiv:2106.09685](https://arxiv.org/abs/2106.09685)).

---

## 6. Parallelism Sizing & Auto-Sharding Decision Tree

### 6.1 Parallelism Dimensions
* **Tensor Parallelism (TP)**: Shards individual weight matrices (QKV projections and MLP layers) via Megatron-LM row/column parallel linear transforms. 
  * *Constraint*: Requires an All-Reduce synchronization barrier after every single layer. **Must remain inside the same physical chassis over NVLink** ($TP \le 8$).
* **Pipeline Parallelism (PP)**: Partitions consecutive transformer layers across separate chassis ($L / PP$).
  * *Constraint*: Bridges nodes via high-speed lossless network fabric (Cisco Nexus RoCEv2 or InfiniBand). Introduces pipeline bubble idle time if batch concurrency is insufficient.
* **Data Parallelism (DP)**: Replicates the model across multiple TP $\times$ PP groups to scale concurrent user throughput.

### 6.2 Auto-Sharding Solver Algorithm (S5)

The auto-sharding solver determines optimal TP, PP, and DP allocations based on workload dimensions:

1. **Size TP and PP for Weights + KV Floor**:
   Inference TP and PP are sized against static model weights plus a minimal KV floor of $\text{CONFIG.minKvStreams} = 1$ sequence at context length $S$, plus activation memory:
   $$M_{\text{replica, base}} = M_{\text{weights}} + M_{\text{kv}}(\text{streams}=1, S) + M_{\text{act}}$$
   This ensures model parallelism (TP/PP) is sized purely for model residency, while concurrency scales Data Parallelism ($DP$).

2. **TP Divisibility by Query Heads ($H_q$)**:
   Tensor Parallelism requires dividing the attention query heads evenly across TP ranks. If the candidate intra-node TP divisor does not divide $H_q$, TP is stepped down to the next integer divisor of $H_q$.

3. **Linear Multi-Node Pipeline Parallelism ($PP = neededNodes$)**:
   When $M_{\text{replica, base}} > \text{singleNodeCapacity}$, pipeline stages are allocated linearly without artificial power-of-two rounding:
   $$PP = \lceil M_{\text{replica, base}} / (TP \times VRAM_{\text{usable}}) \rceil$$

4. **Hard Pipeline Ceiling**:
   If $PP > \text{CONFIG.maxPP}$ (default 8), the solver returns a hard error:
   `"Model does not fit; increase GPU memory or quantise"`
   Pipeline parallelism is never silently capped.

5. **Concurrency Scales Data Parallelism ($DP$)**:
   With TP and PP fixed, remaining VRAM per GPU is pooled as replica KV capacity ($kvCapacityPerReplica$). User concurrency $C$ scales the replica count $DP$:
   $$DP = \lceil requiredKvForC / kvCapacityPerReplica \rceil$$

```
# S5 Auto-sharding decision logic:
candidateTp = min(gpusPerChassis, 8)
TP = largest_divisor_of_Hq_le(candidateTp)

if M_replica_base <= VRAM_usable:
    TP = 1, PP = 1
elif M_replica_base <= 2 * VRAM_usable:
    TP = largest_divisor_of_Hq_le(2), PP = 1
elif M_replica_base <= 4 * VRAM_usable:
    TP = largest_divisor_of_Hq_le(4), PP = 1
elif M_replica_base <= (gpusPerChassis * VRAM_usable):
    TP = largest_divisor_of_Hq_le(gpusPerChassis), PP = 1
else:
    TP = largest_divisor_of_Hq_le(gpusPerChassis)
    PP = ceil(M_replica_base / (TP * VRAM_usable))
    if PP > CONFIG.maxPP:
        return Error("Model does not fit; increase GPU memory or quantise")

DP = ceil(requiredKvForC / kvCapacityPerReplica)
```

### 6.3 Pipeline Bubble Idle Time Warning
When $PP > 1$, micro-batches must prime and drain the pipeline. The fraction of idle time is:

$$\text{Bubble Fraction} = \frac{PP - 1}{PP + C - 1}$$

If concurrency $C < PP \times 4$, the calculator alerts the user of compute starvation and recommends increasing concurrency or reducing PP.

*Documented Sources:*
* **Narayanan et al. (2021)**: *Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM*, SC21 ([arXiv:2104.04473](https://arxiv.org/abs/2104.04473)).

---

## 7. Inference Latency & Throughput Engine

Modern inference operates in two fundamentally different compute regimes:

### 7.1 Phase 1: Prefill (Prompt Processing — Compute-Bound)

During prefill, the model evaluates all prompt tokens simultaneously. The matrix multiplications are dense, operating at high arithmetic intensity ($O(S)$ FLOPs per memory byte read).

#### FLOPs Formulation
For uncached prompt tokens $S_{\text{uncached}}$:
* Forward GEMMs: $2 \times P_{\text{active}} \times 10^9$ FLOPs/token.
* Self-Attention: $2 \times L \times \text{attnDim} \times S$ FLOPs/token (where $\text{attnDim} = 576$ for DeepSeek MLA, or $\text{hidden}$ for standard attention).
* Total prompt FLOPs: $\text{FLOPs}_{\text{total}} = (2 \times P_{\text{active}} \times 10^9 + 2 \times L \times \text{attnDim} \times S) \times S_{\text{uncached}}$.

#### Prefill Latency (Time to First Token - TTFT)
Pipeline stages run sequentially for a single request, so compute throughput is bounded strictly by the replica's Tensor Parallel (TP) GPUs:

$$\text{effFlops} = TP \times \text{peakDenseFlops}[\text{precisionCompute}] \times \text{mfuPrefill}$$

* $\text{precisionCompute}$: Uses dense peak table without sparsity. Weight-only INT4 (AWQ/GPTQ) executes compute at FP16. FP8 compute is used only for FP8 / W8A8.
* Dynamic MFU based on prompt length:
  $$\text{mfuPrefill} = \begin{cases} 0.25 & \text{if } S_{\text{uncached}} < 512 \\ 0.40 & \text{if } S_{\text{uncached}} < 2048 \\ 0.50 & \text{if } S_{\text{uncached}} \ge 2048 \end{cases}$$

$$t_{\text{compute}} = \frac{\text{FLOPs}_{\text{total}}}{\text{effFlops}} \quad [\text{seconds}]$$

$$t_{\text{allreduce}} = \begin{cases} L \times 2 \times \left(2 \times \frac{TP-1}{TP}\right) \times \frac{S_{\text{uncached}} \times \text{hidden} \times B_{\text{act}}}{\text{interconnectBwUni}} & \text{if } TP > 1 \\ 0 & \text{if } TP = 1 \end{cases} \quad [\text{seconds}]$$

Where:
* $\text{interconnectBwUni}$: $450\times 10^9\text{ B/s}$ for H100/H200 NVLink 4, $900\times 10^9\text{ B/s}$ for B200 NVLink 5, or $\text{CONFIG.pcieBw} = 50\times 10^9\text{ B/s}$ for PCIe platforms (L40S, C245, X440p).
* $\text{hidden}$ is the model's true hidden dimension (from model config, not derived as $H_q \times D_{\text{head}}$).
* $B_{\text{act}} = 2\text{ bytes}$ (BF16, $\text{CONFIG.B\_act}$).

All latency components are computed internally in seconds (C5):
$$t_{\text{pipeline}} = (PP - 1) \times 0.008 \quad [\text{seconds}]$$
$$t_{\text{kv\_transfer}} = \frac{\text{kvChunkBytes}}{\min(TP, \text{nicsPerNode}) \times \text{fabricBw}} \quad [\text{seconds}]$$

$$\text{TTFT} = t_{\text{compute}} + t_{\text{allreduce}} + t_{\text{pipeline}} + t_{\text{kv\_transfer}} \quad [\text{seconds}]$$
$$\text{TTFT}_{\text{ms}} = \text{TTFT} \times 1000 \quad [\text{ms}]$$

*Documented Sources:*
* **Dao (2023)**: *FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning* ([arXiv:2307.08691](https://arxiv.org/abs/2307.08691)).

---

### 7.2 Phase 2: Decode (Token Generation — Memory Bandwidth Bound)

During decode, generating each token requires reading model weights from HBM and reading accumulated KV cache entries for all active streams. Memory bandwidth, Tensor Core compute, and intra-node All-Reduce communication determine the step duration:

#### Concurrency & Per-Replica Load
Let $C$ be the cluster-wide concurrent streams. The concurrent streams served by each replica is:

$$C_{\text{rep}} = \left\lceil \frac{C}{DP} \right\rceil$$

#### Decode Time Formulation
$$\text{weightBytesRead} = \text{decodeWeightBytes}() \quad [\text{bytes}]$$

For dense models: $\text{weightBytesRead} = P \times B_{\text{param}}$.  
For Mixture-of-Experts (MoE) models (S1):
$$\text{fracTouched} = 1 - \left(1 - \frac{k}{E}\right)^{C_{\text{rep}}}$$
$$\text{weightBytesRead} = \left(P_{\text{nonExpert}} + \frac{P_{\text{routedExperts}}}{EP} \times \text{fracTouched}\right) \times B_{\text{param}}$$

KV cache bytes read per forward step:
$$\text{kvBytesRead} = \text{kvBytesPerToken} \times S_{\text{avg}} \times C_{\text{rep}} \quad [\text{bytes}]$$

Step latency components:
$$t_{\text{mem}} = \frac{\text{weightBytesRead} + \text{kvBytesRead}}{TP \times BW_{\text{mem}} \times \text{CONFIG.bwEfficiency}} \quad (\text{default bwEfficiency } = 0.75)$$

$$t_{\text{comp}} = \frac{2 \times P_{\text{active}} \times C_{\text{rep}}}{TP \times \text{peakDenseFlops} \times \text{CONFIG.mfuDecode}} \quad (\text{default mfuDecode } = 0.4)$$

$$t_{\text{comm}} = \begin{cases} 2 \times L \times \text{CONFIG.allreduceLatency} & \text{if } TP > 1 \quad (\text{default } 15\times 10^{-6}\text{ s}) \\ 0 & \text{if } TP = 1 \end{cases}$$

$$t_{\text{step}} = \max(t_{\text{mem}}, t_{\text{comp}}) + t_{\text{comm}} \quad [\text{seconds}]$$

$$\text{TPOT} = t_{\text{step}} \times 1000 \quad [\text{ms/token}]$$

$$\text{Replica Throughput} = \frac{C_{\text{rep}}}{t_{\text{step}}} \quad [\text{tokens/sec}]$$

$$\text{Cluster Throughput} = \text{Replica Throughput} \times DP \quad [\text{tokens/sec}]$$

#### Memory Bandwidth Reference Values:
* **NVIDIA H100 SXM5**: $3.35\text{ TB/s}$ (HBM3)
* **NVIDIA H200 SXM5**: $4.80\text{ TB/s}$ (HBM3e)
* **NVIDIA B200 SXM6**: $8.00\text{ TB/s}$ (HBM3e)
* **NVIDIA L40S PCIe**: $0.864\text{ TB/s}$ (GDDR6)

*Documented Sources:*
* **Pope et al. (2022)**: *Efficiently Scaling Transformer Inference*, arXiv:2211.05102.
* **NVIDIA Corporation (2024)**: *NVIDIA Hopper & Blackwell Architecture In-Depth Whitepapers*.

---

## 8. Disaggregated Serving (LLM-D) & Cisco RoCEv2 Fabric

Standard colocated serving suffers from **inter-phase interference**: long compute-heavy prefill bursts monopolize Tensor Cores, causing high variance and latency spikes (jitter) in ongoing decode streams. 

**LLM-D (Disaggregated Serving)** partitions the cluster into dedicated Prefill pools and Decode pools:
1. **Prefill Pool**: High compute density (e.g., Cisco C885A with H100). Computes prompt attention and streams the generated KV cache across the fabric. Holds a transient KV budget for active in-flight batched tokens ($\text{kvBytesPerToken} \times \text{CONFIG.maxBatchedTokens}$) rather than persistent user session context.
2. **Decode Pool**: High memory capacity & bandwidth (e.g., Cisco C885A with H200 141GB or B200 192GB). Receives the KV cache and executes autoregressive generation without prefill disruption.

### 8.1 Cisco Nexus Lossless RoCEv2 KV Cache Streaming

The KV cache payload transferred from Prefill to Decode workers is:

$$\text{KV Chunk Size} = \frac{\text{BytesPerTokenSeq} \times S_{\text{prompt}}}{10^9} \quad [\text{GB}]$$

Network transfer executes across parallel NICs per node ($\min(TP, \text{nicsPerNode})$):

$$t_{\text{kv\_transfer, full}} = \frac{\text{promptKvBytes}}{\min(TP, \text{nicsPerNode}) \times \text{fabricBw}} \quad [\text{seconds}]$$

With overlapped KV transfer enabled (`CONFIG.overlapKvTransfer = true`), layers $1$ to $L-1$ transfer concurrently with subsequent layer computations during prefill. Only the final layer's transfer adds sequentially to TTFT:

$$t_{\text{kv\_transfer}} = \frac{t_{\text{kv\_transfer, full}}}{L} \quad [\text{seconds}]$$

#### RoCEv2 Optimization: Impact of FP8 KV Cache
Toggling KV cache precision from FP16 to **FP8 cuts the network transfer payload by $50\%$**, reducing transfer time from $\approx 18\text{ ms}$ to $\approx 9\text{ ms}$ over Cisco Nexus 400G RoCEv2 fabrics and eliminating network transfer bottlenecks.

*Documented Sources:*
* **llm-d project (2025)**: *LLM-D: Disaggregating LLM Inference Serving Architecture*.
* **Zhong et al. (2024)**: *DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving* ([arXiv:2401.09670](https://arxiv.org/abs/2401.09670)).
* **Patel et al. (2023)**: *Splitwise: Efficient Generative LLM Inference using Phase Splitting* ([arXiv:2311.18677](https://arxiv.org/abs/2311.18677)).
* **Cisco Systems (2024)**: *Cisco Validated Design (CVD) - High-Performance AI Fabrics with Cisco Nexus 9000 and RoCEv2*.

---

## 9. Datacenter Infrastructure, Rail-Optimized Network & BOM

### 9.1 Rail-Optimized Leaf-Spine Clos Network

To eliminate cross-rail network congestion during all-reduce collective operations, each GPU in an 8-GPU chassis is wired to an independent leaf switch rail. The fabric uses 64-port switches (`CONFIG.switchPorts = 64`) with 1:1 non-blocking oversubscription (`CONFIG.oversubscription = 1`) and $D = \text{switchPorts} / 2 = 32$ downlink ports per leaf:

* $R = \text{gpusPerChassis}$ (rails per chassis, typically 8 for SXM).
* **Single Tier Bypass**:
  If $N_{\text{gpus}} \le \text{CONFIG.switchPorts}$ (e.g. up to 64 GPUs / 8 chassis on a 64-port leaf):
  $$N_{\text{leaf}} = 1, \quad N_{\text{spine}} = 0, \quad \text{uplinkCables} = 0$$
* **Two-Tier Rail-Optimized Clos**:
  If $N_{\text{gpus}} > \text{CONFIG.switchPorts}$:
  $$N_{\text{leaf}} = R \times \left\lceil \frac{N_{\text{chassis}}}{D} \right\rceil$$
  $$\text{uplinksPerLeaf} = \left\lceil \frac{D}{\text{oversubscription}} \right\rceil$$
  $$N_{\text{spine}} = \left\lceil \frac{N_{\text{leaf}} \times \text{uplinksPerLeaf}}{\text{CONFIG.switchPorts}} \right\rceil$$
  $$\text{uplinkCables} = N_{\text{leaf}} \times \text{uplinksPerLeaf}$$
* **Cabling & Transceivers**:
  $$\text{downlinkCables} = N_{\text{gpus}}$$
  $$\text{fabricCables} = \text{downlinkCables} + \text{uplinkCables}$$
  $$\text{transceivers} = 2 \times (\text{downlinkCables} + \text{uplinkCables})$$
* Platforms using PCIe or modular chassis (Cisco UCS X9508) bypass rail-optimized Clos to use their native fabric-interconnect topology.

### 9.2 Facilities, Power & Rack Bin-Packing (M1, M2)

1. **IT Power & Network Overhead (M1)**:
   $$\text{Power}_{\text{IT}} = (N_{\text{chassis}} \times \text{TDP}_{\text{chassis}}) + \text{Power}_{\text{network}}$$
   $$\text{Power}_{\text{network}} = ((N_{\text{leaf}} + N_{\text{spine}}) \times \text{CONFIG.switchPowerW}) + (\text{transceivers} \times \text{CONFIG.opticW})$$
   Where:
   * $\text{CONFIG.switchPowerW} = 1800\text{ W}$ (default $1.8\text{ kW}$ // verify vs datasheet).
   * $\text{CONFIG.opticW} = 15\text{ W}$ (optical transceiver power consumption).

2. **Facility Total Power & Cooling Overhead (M1)**:
   $$\text{facilityTotalPower} = \text{Power}_{\text{IT}} \times \text{PUE} \quad (\text{Default PUE} = 1.35)$$
   $$\text{coolingOverhead} = \text{Power}_{\text{IT}} \times (\text{PUE} - 1)$$

3. **Rack Bin-Packing (M2)**:
   Rather than aggregate RU/power ceilings, server chassis and switches are bin-packed into standard server racks according to RU height and rack power constraints:
   $$\text{perRack} = \left\lfloor \min\left(\frac{\text{CONFIG.rackRU}}{\text{chassisRU}}, \frac{\text{rackKW} \times 1000}{\text{chassisTDP\_W}}\right) \right\rfloor$$
   $$N_{\text{racks}} = \left\lceil \frac{N_{\text{chassis}}}{\text{perRack}} \right\rceil + \text{networkRacks}$$
   $$\text{networkRacks} = \left\lceil \frac{(N_{\text{leaf}} + N_{\text{spine}}) \times 1\text{ RU}}{\text{CONFIG.rackRU}} \right\rceil \quad (\text{if switches are not placed in-row})$$

   Configured with $\text{CONFIG.rackRU} = 40$ usable RU per 42U rack (2U for PDUs) and user-configurable $\text{rackKW}$ (default $28\text{ kW}$).

*Documented Sources:*
* **Cisco Systems (2024)**: *Cisco Nexus 9000 Series Switches Data Sheets & Architecture Whitepapers*.
* **NVIDIA Corporation (2024)**: *NVIDIA DGX SuperPOD Datacenter Facility Planning Guide*.

---

## 10. Verification Test Suite Matrix

The entire sizing logic specified above is covered by the automated unit testing suite located in `tests/sizing-calculator.test.js`:

| Test Suite Module | Formula / Invariant Verified |
| :--- | :--- |
| `1. Model Weight Memory` | Dense FP16/FP8/INT4 bytes ($P \times B_{\text{param}}$); MoE expert VRAM residency ($P_{\text{total}}$ loaded in HBM). |
| `2. KV Cache Memory` | Standard GQA formula ($2 \times L \times H_{kv} \times D_{\text{head}} \times B$); DeepSeek MLA latent compression ($576\text{ elements}$); Prefix caching deduplication. |
| `3. Training Memory` | LoRA adapter scaling ($1\% \times 14\text{ B}$); Full SFT FP32 AdamW ($12\text{ B/param}$); ZeRO-1/2/3 parameter sharding. |
| `4. Auto-Sharding Solver` | Dynamic decision tree: TP=1 for 8B, TP=2 for 70B FP8, TP=8 for 70B FP16, and PP $\ge 2$ multi-node for 405B. |
| `5. Performance Profile` | Memory bandwidth bound decode TPOT; FlashAttention MFU prefill TTFT with prefix cache reduction. |
| `6. LLM-D Disaggregation` | Zero KV retention on Prefill pool; Decode pool KV bounds; RoCEv2 transfer payload and latency scaling. |
| `7. Datacenter BOM & Network`| Cisco UCS X9508 modular chassis and 6536 Fabric Interconnects; Rail-optimized leaf-spine Clos switches and cabling; Power & Rack density. |

---

*Specification Authors:* AI Systems & Datacenter Infrastructure Architecture Team  
*Version:* 2.1.0  
*Design references:* Cisco Validated Designs (CVD), NVIDIA DGX BasePOD / SuperPOD, vLLM Production Standards.
