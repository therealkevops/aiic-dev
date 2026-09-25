// The Learning-mode curriculum for solutions architects. Each lesson maps to a chapter of the
// Architecture Guide; `ready` lessons have their steps written in lessons.js.
export const CATALOG = [
  { id: 'memory', number: 1, title: 'Why models need so much memory', summary: 'Weights = parameters × bytes per parameter, and why FP8 and FP4 matter.', guideChapter: 'chap-1-memory', minutes: 10 },
  { id: 'kv-cache', number: 2, title: 'The KV cache', summary: 'Why long contexts and many concurrent users fill GPUs faster than the model does.', guideChapter: 'chap-2-kv', minutes: 12 },
  { id: 'sharding', number: 3, title: 'Splitting a model across GPUs', summary: 'Tensor, pipeline and data parallelism, and why NVLink sets the boundary.', guideChapter: 'chap-3-sharding', minutes: 15 },
  { id: 'speed', number: 4, title: 'Speed: prefill and decode', summary: 'Time to first token vs time per token, and which one hardware choices move.', guideChapter: 'chap-8-silicon', minutes: 12 },
  { id: 'traffic', number: 5, title: 'From users to GPUs', summary: "Little's law, utilization and tail latency: turning a user count into capacity.", guideChapter: 'chap-6-queueing', minutes: 12 },
  { id: 'network', number: 6, title: 'The network fabric', summary: 'Rail-optimized leaf/spine, oversubscription and why RDMA matters.', guideChapter: 'chap-5-network', minutes: 12 },
  { id: 'facility', number: 7, title: 'Power, cooling and racks', summary: 'kW per rack, air vs liquid cooling, and designing to a power budget.', guideChapter: 'chap-5-network', minutes: 10 },
  { id: 'training', number: 8, title: 'Training vs inference', summary: 'ZeRO sharding, time to train, checkpoints and failures.', guideChapter: 'chap-7-storage', minutes: 15 },
  { id: 'cost', number: 9, title: 'What it costs', summary: 'Capex, opex, TCO, cost per token, and rent vs buy.', guideChapter: 'chap-9-tco', minutes: 12 },
  { id: 'capstone', number: 10, title: 'Capstone: design it yourself', summary: 'Meet a customer brief on latency, capacity and budget, then take the scored quiz.', guideChapter: 'overview', minutes: 25 },
];
