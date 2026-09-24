// Guardrails / safety-classifier reference data. These are small(er) LLMs fine-tuned to
// classify a prompt or response against a safety taxonomy (jailbreaks, hate speech, self-harm,
// PII, etc.) rather than generate free-form text -- typically run as an input guard (screens the
// prompt before generation starts) and/or an output guard (screens the response before it's
// returned). Params/base-model figures below are verified public model-card facts.

export const GUARDRAIL_MODELS = [
  {
    id: "llama-guard-3-1b",
    name: "Llama Guard 3 1B",
    vendor: "Meta (open, Llama 3.2 1B based)",
    paramsBillion: 1,
    notes: "On-device/edge-oriented -- the lowest latency and compute cost in the Llama Guard family.",
  },
  {
    id: "llama-guard-3-8b",
    name: "Llama Guard 3 8B",
    vendor: "Meta (open, Llama 3.1 8B based)",
    paramsBillion: 8,
    notes: "14-category MLCommons hazard taxonomy plus a tool/code-interpreter-abuse category; the most widely deployed open guard model.",
  },
  {
    id: "shieldgemma-2b",
    name: "ShieldGemma 2B",
    vendor: "Google (open, Gemma 2 based)",
    paramsBillion: 2,
    notes: "Tuned for low-latency online classification across 4 harm categories (sexual content, dangerous content, hate, harassment).",
  },
  {
    id: "shieldgemma-9b",
    name: "ShieldGemma 9B",
    vendor: "Google (open, Gemma 2 based)",
    paramsBillion: 9,
    notes: "Higher-accuracy variant of ShieldGemma for offline/batch moderation where latency matters less.",
  },
  {
    id: "granite-guardian-3-2b",
    name: "Granite Guardian 3.1 2B",
    vendor: "IBM (open)",
    paramsBillion: 2,
    notes: "Compact risk/jailbreak detector tuned on the IBM AI Risk Atlas taxonomy.",
  },
  {
    id: "granite-guardian-3-8b",
    name: "Granite Guardian 3.1 8B",
    vendor: "IBM (open)",
    paramsBillion: 8,
    notes: "Higher-accuracy risk/jailbreak detection; strong published recall on jailbreak benchmarks (e.g. ToxicChat).",
  },
];

export const DEFAULT_GUARDRAIL_MODEL_ID = "llama-guard-3-8b";
