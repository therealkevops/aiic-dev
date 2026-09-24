// RAG (Retrieval-Augmented Generation) pipeline reference data: embedding models for corpus
// ingestion + query embedding, and self-hosted vector database platforms for retrieval serving.
//
// Embedding model specs (params, dimensions, max tokens) are verified public model-card figures.
// Vector DB per-node throughput/capacity figures vary enormously by index type, quantization,
// and recall target (published benchmarks for the same engine can differ by 10-20x) -- these are
// clearly-labeled illustrative single-node defaults, editable in the UI (same posture as GPU/
// storage pricing), not a vendor benchmark result.

export const EMBEDDING_MODELS = [
  {
    id: "bge-large-en-v1.5",
    name: "BGE-Large-EN v1.5",
    vendor: "BAAI (open, MIT license)",
    paramsMillion: 335,
    dims: 1024,
    maxTokens: 512,
    notes: "Compact, fast, strong English retrieval quality -- a common default for departmental RAG.",
  },
  {
    id: "e5-large-v2",
    name: "E5-Large v2",
    vendor: "Microsoft / intfloat (open, MIT license)",
    paramsMillion: 335,
    dims: 1024,
    maxTokens: 512,
    notes: "BERT-class general-purpose embedding model, similar footprint to BGE-Large.",
  },
  {
    id: "gte-large-en-v1.5",
    name: "GTE-Large-EN v1.5",
    vendor: "Alibaba (open)",
    paramsMillion: 434,
    dims: 1024,
    maxTokens: 8192,
    notes: "Long-context chunking (up to 8k tokens) without switching to a much larger model.",
  },
  {
    id: "nv-embed-v2",
    name: "NV-Embed-v2",
    vendor: "NVIDIA (open, Mistral-7B based)",
    paramsMillion: 7850,
    dims: 4096,
    maxTokens: 32768,
    notes: "Top-tier MTEB accuracy and very long context, at ~23x the compute cost of BGE/E5-class models.",
  },
];

export const DEFAULT_EMBEDDING_MODEL_ID = "bge-large-en-v1.5";

// Illustrative single-node throughput/capacity defaults for common self-hosted vector DB
// platforms. ramGbPerNode is usable working-set RAM for the vector index; estimatedQpsPerNode
// is a moderate-recall HNSW-class ballpark; estimatedUsdPerNodeCapex is a rough dedicated-server
// capex figure. All three are editable in the UI -- real numbers depend heavily on index
// parameters, quantization, and recall target.
export const VECTOR_DB_PLATFORMS = [
  {
    id: "milvus",
    name: "Milvus",
    vendor: "Zilliz (open source)",
    protocol: "gRPC",
    ramGbPerNode: 128,
    estimatedQpsPerNode: 1000,
    estimatedUsdPerNodeCapex: 8000,
    notes: "Distributed architecture with optional GPU-accelerated indexing (IVF_PQ/HNSW on CUDA).",
  },
  {
    id: "qdrant",
    name: "Qdrant",
    vendor: "Qdrant (open source)",
    protocol: "gRPC / REST",
    ramGbPerNode: 64,
    estimatedQpsPerNode: 1200,
    estimatedUsdPerNodeCapex: 6000,
    notes: "Rust-based, strong single-node HNSW throughput and low p50 latency in published benchmarks.",
  },
  {
    id: "weaviate",
    name: "Weaviate",
    vendor: "Weaviate (open source)",
    protocol: "GraphQL / gRPC",
    ramGbPerNode: 128,
    estimatedQpsPerNode: 900,
    estimatedUsdPerNodeCapex: 8000,
    notes: "Built-in hybrid (vector + keyword) search and async indexing.",
  },
  {
    id: "pgvector",
    name: "Postgres + pgvector",
    vendor: "PostgreSQL extension (open source)",
    protocol: "SQL / libpq",
    ramGbPerNode: 256,
    estimatedQpsPerNode: 470,
    estimatedUsdPerNodeCapex: 10000,
    notes: "Runs inside an existing Postgres fleet -- lower per-node QPS than purpose-built engines, but no new operational surface.",
  },
  {
    id: "opensearch-knn",
    name: "OpenSearch k-NN",
    vendor: "OpenSearch (open source)",
    protocol: "REST",
    ramGbPerNode: 128,
    estimatedQpsPerNode: 800,
    estimatedUsdPerNodeCapex: 9000,
    notes: "Vector search alongside existing full-text search infrastructure.",
  },
];

export const DEFAULT_VECTOR_DB_ID = "milvus";
