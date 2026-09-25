import React from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, ChoiceCard, Field, Row, Rows, SectionLabel, SliderField, Tag, ToggleRow } from '../ui';
import { GPU_CATALOG } from '../../data/hardware';
import { GPU_PRICING } from '../../data/pricing';
import { EMBEDDING_MODELS, VECTOR_DB_PLATFORMS } from '../../data/rag';

export function RagTab({ ctx }) {
  const {
    avgChunkTokens, embeddingGpu, embeddingGpuId, embeddingGpuUnitPriceUsd, enableRag, ingestionTargetHours,
    rag, ragQueryQps, selectedEmbeddingModelId, selectedVectorDbId, setAvgChunkTokens, setEmbeddingGpuId,
    setEmbeddingGpuUnitPriceUsd, setEnableRag, setIngestionTargetHours, setRagQueryQps, setSelectedEmbeddingModelId, setSelectedVectorDbId,
    setTextExtractionRatio, textExtractionRatio, vectorDbPlatform,
  } = ctx;
  return (
    <>
      <Card
        icon={Search}
        title="7. RAG Pipeline"
        right={rag.eligible ? <Tag tone="good">{rag.bindingConstraint === 'capacity' ? 'Capacity-bound' : 'Throughput-bound'}</Tag> : <Tag>{enableRag ? 'N/A' : 'Off'}</Tag>}
        className="space-y-4"
      >
        <Banner tone="info" icon={AlertTriangle}>
          RAG adds two real compute-contributing layers on top of LLM serving: an embedding pool that turns the document corpus (and each live query) into vectors, and a vector database serving pool that stores and searches them. Both are new standing infrastructure — their capex and power feed into Cost & TCO, unlike MIG/SLA which only reshape or annotate existing hardware.
        </Banner>

        <ToggleRow
          label="RAG Pipeline Sizing"
          description={enableRag ? 'Sizing embedding compute + vector database against the Document/Vector Corpus set on the Storage tab.' : 'No embedding or vector database infrastructure sized.'}
          checked={enableRag}
          onChange={setEnableRag}
        />

        {enableRag && !rag.eligible && (
          <Banner tone="warn" icon={AlertTriangle}>
            {rag.reason}
          </Banner>
        )}

        {enableRag && rag.eligible && (
          <>
            <SliderField
              label="Text Extraction Ratio:"
              valueLabel={`${(textExtractionRatio * 100).toFixed(0)}%`}
              min="0.05" max="1.0" step="0.05"
              value={textExtractionRatio}
              onChange={(e) => setTextExtractionRatio(Number(e.target.value))}
              marks={['5% (Scanned PDFs / Images)', '20% (Mixed Office Docs)', '100% (Plain Text)']}
              helper={
                <InfoHelper
                  title="Text Extraction Ratio"
                  text="The Document/Vector Corpus size (set on the Storage tab) is raw document storage — PDFs, images, formatting, and embedded media all count toward it, but only extracted text gets embedded. This is the fraction of raw corpus bytes that survive text extraction into embeddable content."
                  whyItMatters="A corpus dominated by scanned PDFs or image-heavy slide decks can have 5-10x less extractable text than its raw size suggests — using the raw size directly would drastically overestimate embedding compute and vector database sizing."
                />
              }
            />

            <SliderField
              label="Average Chunk Size:"
              valueLabel={`${avgChunkTokens} tokens`}
              min="128" max="2048" step="128"
              value={avgChunkTokens}
              onChange={(e) => setAvgChunkTokens(Number(e.target.value))}
              marks={['128 (Fine-Grained)', '512 (Typical)', '2048 (Coarse)']}
              helper={
                <InfoHelper
                  title="Average Chunk Size"
                  text="The token count each document is split into before embedding. Smaller chunks mean more precise retrieval but more chunks (more vectors, more embedding calls) for the same corpus."
                  whyItMatters="Halving chunk size roughly doubles the vector count -- directly doubling vector database capacity needs and embedding ingestion time."
                />
              }
            />

            <Field label="Embedding Model" helper={
              <InfoHelper
                title="Embedding Model"
                text="The model that turns document chunks (and live queries) into vectors. Larger embedding models generally retrieve more accurately but cost proportionally more compute to run at corpus scale."
                whyItMatters="NV-Embed-v2 has ~23x the parameters of BGE-Large/E5-Large -- at the same corpus size and ingestion time target, it needs roughly 23x the embedding GPUs."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {EMBEDDING_MODELS.map((m) => (
                  <ChoiceCard
                    key={m.id}
                    selected={selectedEmbeddingModelId === m.id}
                    onClick={() => setSelectedEmbeddingModelId(m.id)}
                    title={`${m.name} (${m.paramsMillion.toLocaleString()}M params)`}
                    desc={`${m.dims} dims · ${m.maxTokens.toLocaleString()} max tokens · ${m.vendor}`}
                    badge={m.license?.commercial === 'non-commercial' ? <Tag tone="warn">Non-commercial</Tag> : null}
                  />
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Embedding GPU">
                <select
                  value={embeddingGpuId}
                  onChange={(e) => {
                    setEmbeddingGpuId(e.target.value);
                    setEmbeddingGpuUnitPriceUsd(GPU_PRICING[e.target.value]?.estimatedUnitPriceUsd ?? 0);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {GPU_CATALOG.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Embedding GPU — Unit Price (Capex)">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
                  <input type="number" min="0" step="500" value={embeddingGpuUnitPriceUsd}
                    onChange={(e) => setEmbeddingGpuUnitPriceUsd(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-5 pr-2 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
                </div>
              </Field>
            </div>

            <SliderField
              label="Ingestion Time Target:"
              valueLabel={`${ingestionTargetHours} hr${ingestionTargetHours === 1 ? '' : 's'}`}
              min="1" max="72" step="1"
              value={ingestionTargetHours}
              onChange={(e) => setIngestionTargetHours(Number(e.target.value))}
              marks={['1hr (Fast Reindex)', '24hr (Overnight)', '72hr (Relaxed)']}
              helper={
                <InfoHelper
                  title="Ingestion Time Target"
                  text="The wall-clock budget to embed the entire extractable corpus (a full reindex). Sets required embedding throughput: throughput = total corpus embedding FLOPs ÷ this budget."
                  whyItMatters="A tight reindex target directly drives up the embedding GPU count -- a large corpus with a 1-hour target can need far more GPUs than the same corpus with a 24-hour target."
                />
              }
            />

            <Field label="Retrieval Query Rate (QPS)">
              <input type="number" min="0.1" step="0.5" value={ragQueryQps}
                onChange={(e) => setRagQueryQps(Math.max(0.1, Number(e.target.value) || 0.1))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono" />
              <div className="text-[10.5px] text-zinc-500 mt-1">Sustained vector-search queries/sec the pipeline must serve live -- drives both live query-embedding GPU load and vector database throughput sizing.</div>
            </Field>

            <Field label="Vector Database Platform" helper={
              <InfoHelper
                title="Vector Database Platform"
                text="Self-hosted vector search engines. Per-node RAM/QPS/capex figures are illustrative single-node defaults -- real throughput and capacity depend heavily on index type, quantization, and recall target, and can vary 10-20x across published benchmarks for the same engine."
                whyItMatters="Nodes are sized against whichever binds harder: enough RAM to hold the vector index (capacity), or enough query throughput to hit the target QPS (throughput)."
              />
            }>
              <div className="grid grid-cols-1 gap-1.5">
                {VECTOR_DB_PLATFORMS.map((v) => (
                  <ChoiceCard
                    key={v.id}
                    selected={selectedVectorDbId === v.id}
                    onClick={() => setSelectedVectorDbId(v.id)}
                    title={`${v.vendor} — ${v.name}`}
                    desc={`${v.ramGbPerNode} GB RAM/node · ~${v.estimatedQpsPerNode.toLocaleString()} QPS/node · ${v.notes}`}
                  />
                ))}
              </div>
            </Field>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>CORPUS & EMBEDDING</SectionLabel>
              <Rows>
                <Row k="Extractable text" v={`${rag.extractableTextGb.toFixed(0)} GB`} mono={false} />
                <Row k="Vector count (chunks)" v={rag.numChunks.toLocaleString()} tone="accent" />
                <Row k="Ingestion GPUs needed" v={`${rag.ingestionGpusNeeded}x ${embeddingGpu.name}`} tone="accent" />
                <Row k="Actual ingestion time" v={`${rag.actualIngestionTimeHours.toFixed(1)} hrs`} mono={false} />
                <Row k="Live query-embedding GPUs" v={`${rag.queryEmbeddingGpusNeeded}`} mono={false} />
                <Row k="Total embedding GPUs provisioned" v={`${rag.embeddingGpusNeeded}`} tone="good" />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>VECTOR DATABASE</SectionLabel>
              <Rows>
                <Row k="Nodes for capacity" v={`${rag.nodesForCapacity}`} mono={false} />
                <Row k="Nodes for throughput" v={`${rag.nodesForThroughput}`} mono={false} />
                <Row k="Nodes provisioned" v={`${rag.vectorDbNodesNeeded}x ${vectorDbPlatform.name}`} tone="good" />
                <Row k="Binding constraint" v={rag.bindingConstraint === 'throughput' ? 'Throughput' : 'Capacity'} mono={false} />
                <Row k="Total vector DB RAM" v={`${rag.vectorDbRamGb.toLocaleString()} GB`} mono={false} />
              </Rows>
            </div>

            <div className="pt-3 border-t border-zinc-800/70">
              <SectionLabel>RAG INFRASTRUCTURE COST (FEEDS INTO COST & TCO)</SectionLabel>
              <Rows>
                <Row k="Embedding compute capex" v={`$${Math.round(rag.embeddingComputeCapexUsd).toLocaleString()}`} tone="accent" />
                <Row k="Vector database capex" v={`$${Math.round(rag.vectorDbCapexUsd).toLocaleString()}`} tone="accent" />
                <Row k="Total RAG capex" v={`$${Math.round(rag.ragComputeCapexUsd).toLocaleString()}`} tone="good" />
                <Row k="RAG IT power draw" v={`${rag.ragItPowerKw.toFixed(2)} kW`} mono={false} />
              </Rows>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
