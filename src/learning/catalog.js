// The Learning-mode curriculum for solutions architects. Each lesson maps to a chapter of the
// Architecture Guide. The core path (1-10) builds up a design in order and ends with the
// capstone; the production topics (11-14) extend it and can be taken in any order after it.
export const CATALOG = [
  { id: 'memory', number: 1, track: 'core', title: 'Why models need so much memory', summary: 'Weights = parameters × bytes per parameter, and why FP8 and FP4 matter.', guideChapter: 'chap-1-memory', minutes: 10 },
  { id: 'kv-cache', number: 2, track: 'core', title: 'The KV cache', summary: 'Why long contexts and many concurrent users fill GPUs faster than the model does.', guideChapter: 'chap-2-kv', minutes: 12 },
  { id: 'sharding', number: 3, track: 'core', title: 'Splitting a model across GPUs', summary: 'Tensor, pipeline and data parallelism, and why NVLink sets the boundary.', guideChapter: 'chap-3-sharding', minutes: 15 },
  { id: 'speed', number: 4, track: 'core', title: 'Speed: prefill and decode', summary: 'Time to first token vs time per token, and which one hardware choices move.', guideChapter: 'chap-8-silicon', minutes: 12 },
  { id: 'traffic', number: 5, track: 'core', title: 'From users to GPUs', summary: "Little's law, utilization and tail latency: turning a user count into capacity.", guideChapter: 'chap-6-queueing', minutes: 12 },
  { id: 'network', number: 6, track: 'core', title: 'The network fabric', summary: 'Rail-optimized leaf/spine, oversubscription and why RDMA matters.', guideChapter: 'chap-5-network', minutes: 12 },
  { id: 'facility', number: 7, track: 'core', title: 'Power, cooling and racks', summary: 'kW per rack, air vs liquid cooling, and designing to a power budget.', guideChapter: 'chap-5-network', minutes: 10 },
  { id: 'training', number: 8, track: 'core', title: 'Training vs inference', summary: 'ZeRO sharding, time to train, checkpoints and failures.', guideChapter: 'chap-7-storage', minutes: 15 },
  { id: 'cost', number: 9, track: 'core', title: 'What it costs', summary: 'Capex, opex, TCO, cost per token, and rent vs buy.', guideChapter: 'chap-9-tco', minutes: 12 },
  { id: 'capstone', number: 10, track: 'core', title: 'Capstone: design it yourself', summary: 'Meet a customer brief on latency, capacity and budget, then take the scored quiz.', guideChapter: 'overview', minutes: 25 },
  { id: 'rag', number: 11, track: 'production', title: 'RAG: documents and vector search', summary: 'Chunks, embeddings and vector-database memory: sizing retrieval for a document corpus.', guideChapter: 'chap-11-production', minutes: 12 },
  { id: 'serving', number: 12, track: 'production', title: 'Serving software: speculative decoding and disaggregation', summary: 'Getting more tokens from the same GPUs, and when splitting prefill from decode pays off.', guideChapter: 'chap-4-llmd', minutes: 12 },
  { id: 'guardrails', number: 13, track: 'production', title: 'Guardrails: safety models in the request path', summary: 'Sizing the classifier pool and the latency it adds to every request.', guideChapter: 'chap-11-production', minutes: 10 },
  { id: 'resilience', number: 14, track: 'production', title: 'High availability and disaster recovery', summary: 'RTO, RPO and what each resilience tier adds to capex and power.', guideChapter: 'chap-11-production', minutes: 10 },
];

export const CORE = CATALOG.filter(l => l.track === 'core');
export const PRODUCTION = CATALOG.filter(l => l.track === 'production');

/** "Lesson 3 of 10" for the core path, "Production topic 2 of 4" after it. */
export function lessonPosition(meta) {
  return meta.track === 'core'
    ? `Lesson ${meta.number} of ${CORE.length}`
    : `Production topic ${PRODUCTION.indexOf(meta) + 1} of ${PRODUCTION.length}`;
}
