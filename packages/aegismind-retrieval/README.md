# aegismind-retrieval

Hybrid retrieval engine implementing dense and sparse search, Reciprocal Rank Fusion (RRF), and local reranking.

## Features
- **Sovereign Retrieval Pipeline**:
  1. Rewrite query if needed.
  2. Embed query with local embedding models.
  3. Hybrid vector search (dense, sparse, RRF).
  4. Contextual token budgeting.
  5. Cross-encoder or lexical reranking.
  6. Maximal Marginal Relevance (MMR) diversity filtering.
  7. Deep-linked citations and audit logging.
- **Reciprocal Rank Fusion**: RRF constant merging dense semantic similarity and sparse lexical scores.
- **Vector Adapters**:
  - `MemoryVectorStoreAdapter`: In-memory vector store with cosine and sparse dot product calculation.
  - `SqliteVectorStoreAdapter`: Local SQLite-backed persistent vector store.
  - `QdrantVectorStoreAdapter`: Qdrant REST client adapter.
- **Model Adapters**:
  - `OllamaEmbedderAdapter`: Local Ollama embeddings.
  - `FastEmbedAdapter`: FastEmbed local ONNX embeddings.
  - `LocalDeterministicEmbedderAdapter`: Fast deterministic embeddings for tests.
  - `MockRerankerAdapter`: Local lexical boost reranker.
