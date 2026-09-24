import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';

function GlossaryCard({ term, definition, impact }) {
  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="font-semibold text-zinc-100 text-sm mb-1.5">{term}</div>
      <p className="text-zinc-400 text-[13px] leading-relaxed mb-2">{definition}</p>
      {impact && (
        <div className="text-zinc-400 text-[12px] pt-2 border-t border-zinc-800/80">
          <strong className="text-sky-400 font-medium">Impact: </strong>{impact}
        </div>
      )}
    </div>
  );
}

const ENTRIES = [
  {
    term: 'Cisco (UCS & Supermicro) vs. NVIDIA DGX',
    definition: 'Cisco solutions offer compute flexibility: native Cisco UCS servers (AMD EPYC) and Supermicro HGX servers (Intel Xeon + up to 8TB RAM), both unified on Cisco Nexus deep-buffer RoCEv2 switches and Intersight. NVIDIA DGX provides turnkey SuperPOD reference clusters direct from NVIDIA.',
    impact: 'Cisco gives enterprise network control and multi-vendor compute choice; DGX is turnkey pure-play AI supercomputing.',
  },
  {
    term: 'Tensor Parallelism (TP)',
    definition: 'Divides each matrix math calculation across a group of GPUs simultaneously. Because GPUs must communicate after every token, it must remain on high-speed NVLink.',
    impact: 'Keep TP ≤ 8 (single node). Crossing standard network cables causes massive latency slowdowns.',
  },
  {
    term: 'Pipeline Parallelism (PP)',
    definition: 'Distributes consecutive layers of a giant model across separate server chassis (Node 1 does layers 1-40, Node 2 does 41-80).',
    impact: 'Used when a model exceeds 1 node. TP is maxed out inside the node, and PP bridges the nodes.',
  },
  {
    term: 'Lossless RoCEv2 (Nexus AI Fabric)',
    definition: 'AI clusters synchronize at barrier steps. If a single network packet is dropped, all GPUs sit idle waiting for a retransmission.',
    impact: 'Cisco Nexus 9000 Cloud Scale ASICs provide deep packet buffers and smart ECN to eliminate packet drops without needing InfiniBand.',
  },
  {
    term: 'KV Cache Memory',
    definition: "Remembers earlier words in a chat so the model doesn't recompute them. Scales directly with context window length and the number of active users.",
    impact: 'Long context (32k–128k) eats more memory than the model weights! Choose high-VRAM GPUs like H200.',
  },
  {
    term: 'Rail-Optimized Leaf-Spine',
    definition: 'Each GPU in a server is cabled to an independent leaf switch rail, preventing inter-GPU traffic jams.',
    impact: 'Delivers 1:1 non-blocking throughput across nodes without communication contention.',
  },
];

export function GlossaryPage({ onBack }) {
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden">
      <header className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-2.5 py-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to calculator
        </button>
        <div className="flex items-center gap-2 text-zinc-100">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold">Architectural Decision Guide &amp; Glossary</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <p className="text-[13px] text-zinc-400 leading-relaxed max-w-2xl">
            Plain-English explanations of the terms and trade-offs behind this calculator's sizing decisions.
            This is a living reference, not the sizing output itself — see the calculator for your workload's results.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ENTRIES.map((e) => <GlossaryCard key={e.term} {...e} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
