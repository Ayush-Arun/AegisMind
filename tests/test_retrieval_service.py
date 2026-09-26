from __future__ import annotations

import pytest

from aegismind_core.domain.models import Chunk, RetrievalQuery
from aegismind_core.ports.vector_store import VectorStorePort
from aegismind_core.services.retrieval import RetrievalService


@pytest.mark.asyncio
async def test_retrieval_service_dynamic_registry_resolution() -> None:
    service = RetrievalService()
    assert service._vector_store is not None
    assert service._embedder is not None
    assert service._reranker is not None


@pytest.mark.asyncio
async def test_retrieval_service_search_and_overfetching() -> None:
    service = RetrievalService()
    vector_store: VectorStorePort = service._vector_store

    chunks: list[Chunk] = []
    for i in range(10):
        chunks.append(
            Chunk(
                id=f"chunk_{i}",
                document_id=f"doc_{i}",
                content=f"Content for knowledge document {i} with machine learning algorithms",
                chunk_index=0,
                embedding=[1.0 - (i * 0.05)] * 16,
            )
        )
    await vector_store.upsert(chunks)

    query = RetrievalQuery(
        query_text="machine learning algorithms",
        user_id="alice",
        top_k=2,
        overfetch_factor=4.0,
    )

    result = await service.search(query)

    assert result.total_candidates_evaluated == 8
    assert result.authorized_candidates_count == 8
    assert len(result.chunks) == 2


@pytest.mark.asyncio
async def test_retrieval_service_empty_candidates() -> None:
    service = RetrievalService()
    query = RetrievalQuery(
        query_text="empty space query",
        user_id="nobody",
        top_k=3,
        overfetch_factor=3.0,
    )
    result = await service.search(query)
    assert len(result.chunks) == 0
    assert result.total_candidates_evaluated == 0
    assert result.authorized_candidates_count == 0
