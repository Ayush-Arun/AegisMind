from __future__ import annotations

from aegismind_retrieval.adapters_local_embed import (
    FastEmbedAdapter,
    LocalDeterministicEmbedderAdapter,
    OllamaEmbedderAdapter,
)
from aegismind_retrieval.adapters_model import (
    LLMQueryRewriterAdapter,
    MockEmbedderAdapter,
    MockQueryRewriterAdapter,
    MockRerankerAdapter,
    OllamaQueryRewriterAdapter,
)
from aegismind_retrieval.adapters_sqlite_vector import SqliteVectorStoreAdapter
from aegismind_retrieval.adapters_vector import (
    MemoryVectorStoreAdapter,
    QdrantVectorStoreAdapter,
)
from aegismind_retrieval.mmr import DEFAULT_LAMBDA_MULT, maximal_marginal_relevance
from aegismind_retrieval.pipeline import PipelineResult, RetrievalPipeline
from aegismind_retrieval.ports import (
    EmbedderPort,
    QueryRewriterPort,
    RerankerPort,
    ScoredChunk,
    TelemetryPort,
    VectorStorePort,
)
from aegismind_retrieval.rrf import RRF_DEFAULT_K, fuse_dense_sparse, reciprocal_rank_fusion
from aegismind_retrieval.telemetry import NoOpTelemetryAdapter

__all__ = [
    "DEFAULT_LAMBDA_MULT",
    "NoOpTelemetryAdapter",
    "RRF_DEFAULT_K",
    "EmbedderPort",
    "FastEmbedAdapter",
    "LLMQueryRewriterAdapter",
    "LocalDeterministicEmbedderAdapter",
    "MemoryVectorStoreAdapter",
    "MockEmbedderAdapter",
    "MockQueryRewriterAdapter",
    "MockRerankerAdapter",
    "OllamaEmbedderAdapter",
    "OllamaQueryRewriterAdapter",
    "PipelineResult",
    "QdrantVectorStoreAdapter",
    "QueryRewriterPort",
    "RerankerPort",
    "RetrievalPipeline",
    "ScoredChunk",
    "SqliteVectorStoreAdapter",
    "TelemetryPort",
    "VectorStorePort",
    "fuse_dense_sparse",
    "maximal_marginal_relevance",
    "reciprocal_rank_fusion",
]
