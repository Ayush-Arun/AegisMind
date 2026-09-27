from __future__ import annotations

import logging
from typing import Any

from aegismind_core.domain.models import Chunk, RetrievalQuery, RetrievalResult, ScoredChunk
from aegismind_core.ports.embedder import EmbedderPort
from aegismind_core.ports.reranker import RerankerPort
from aegismind_core.ports.vector_store import VectorStorePort
from aegismind_core.registry import resolve_adapter

logger = logging.getLogger(__name__)


class RetrievalService:
    """Core retrieval service for local sovereign search.

    The retrieval pipeline executes in stages:
    1. Query embedding generation.
    2. Candidate chunks retrieval from vector storage.
    3. Reranking candidates to deliver final top_k results.
    """

    def __init__(
        self,
        vector_store: VectorStorePort | None = None,
        embedder: EmbedderPort | None = None,
        reranker: RerankerPort | None = None,
        vector_store_adapter_name: str | None = None,
        embedder_adapter_name: str | None = None,
        reranker_adapter_name: str | None = None,
        adapter_kwargs: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        kwargs = adapter_kwargs or {}

        if vector_store is not None:
            self._vector_store = vector_store
        else:
            name = vector_store_adapter_name or "memory"
            adapter_cls = resolve_adapter("vector_store", name)
            self._vector_store = adapter_cls(**kwargs.get("vector_store", {}))

        if embedder is not None:
            self._embedder = embedder
        else:
            name = embedder_adapter_name or "mock"
            adapter_cls = resolve_adapter("embedder", name)
            self._embedder = adapter_cls(**kwargs.get("embedder", {}))

        if reranker is not None:
            self._reranker = reranker
        else:
            name = reranker_adapter_name or "mock"
            adapter_cls = resolve_adapter("reranker", name)
            self._reranker = adapter_cls(**kwargs.get("reranker", {}))

        logger.info(
            "Initialized RetrievalService: vector=%s, embedder=%s, reranker=%s",
            type(self._vector_store).__name__,
            type(self._embedder).__name__,
            type(self._reranker).__name__,
        )

    async def search(self, query: RetrievalQuery) -> RetrievalResult:
        """Execute local sovereign retrieval pipeline.

        Args:
            query: RetrievalQuery containing query text, caller identity, and constraints.

        Returns:
            RetrievalResult containing reranked chunks and evaluation metrics.
        """
        logger.info(
            "Executing retrieval for user '%s', query '%s', top_k=%d",
            query.user_id,
            query.query_text,
            query.top_k,
        )

        # 1. Embed query
        query_vector = await self._embedder.embed_query(query.query_text)

        # 2. Overfetch candidate chunks
        overfetch_factor = max(3.0, min(5.0, query.overfetch_factor))
        candidates_to_fetch = int(query.top_k * overfetch_factor)

        candidates = await self._vector_store.search(
            query_embedding=query_vector,
            limit=candidates_to_fetch,
            metadata_filter=query.metadata_filter,
        )

        total_evaluated = len(candidates)
        logger.debug(
            "Fetched %d initial candidates (target overfetch=%d)",
            total_evaluated,
            candidates_to_fetch,
        )

        if not candidates:
            return RetrievalResult(
                query_text=query.query_text,
                chunks=[],
                total_candidates_evaluated=0,
                authorized_candidates_count=0,
            )

        # 3. Rerank candidates to desired top_k
        try:
            reranked = await self._reranker.rerank(
                query=query.query_text,
                candidates=candidates,
                top_k=query.top_k,
            )
        except TypeError:
            reranked = await self._reranker.rerank(  # type: ignore[call-arg]
                query=query.query_text,
                candidates=candidates,
                top_n=query.top_k,
            )

        def _to_scored_chunk(sc: Any) -> ScoredChunk:
            if isinstance(sc, ScoredChunk):
                return sc
            c = getattr(sc, "chunk", None)
            if isinstance(c, Chunk):
                return ScoredChunk(chunk=c, score=sc.score)
            if c is not None:
                return ScoredChunk(
                    chunk=Chunk(
                        id=c.id,
                        document_id=c.document_id,
                        content=c.content,
                        chunk_index=getattr(c, "index", getattr(c, "chunk_index", 0)),
                        embedding=getattr(c, "embedding", None),
                        metadata=getattr(c, "metadata", {}),
                    ),
                    score=sc.score,
                )
            return ScoredChunk(chunk=sc, score=1.0)

        return RetrievalResult(
            query_text=query.query_text,
            chunks=[_to_scored_chunk(sc) for sc in reranked],
            total_candidates_evaluated=total_evaluated,
            authorized_candidates_count=total_evaluated,
        )
