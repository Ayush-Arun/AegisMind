from __future__ import annotations

import pytest
from aegismind_retrieval.adapters_model import MockEmbedderAdapter, MockRerankerAdapter
from aegismind_retrieval.adapters_vector import MemoryVectorStoreAdapter
from aegismind_retrieval.pipeline import PipelineResult, RetrievalPipeline
from aegismind_types import ACL, Chunk, Principal


@pytest.fixture
def sample_chunks() -> list[Chunk]:
    chunks = []
    # Create 10 chunks across 5 documents in tenant_acme
    for i in range(1, 11):
        doc_num = (i + 1) // 2
        chunks.append(
            Chunk(
                id=f"chunk_{i}",
                document_id=f"doc_{doc_num}",
                index=i,
                content=f"Secret project information regarding quantum security topic {i}",
                embedding=[0.1 * (i % 5)] * 64,
                metadata={
                    "title": f"Document {doc_num} Overview",
                    "uri": f"https://wiki.corp.internal/doc/{doc_num}",
                    "tenant_id": "tenant_acme",
                },
                acl=ACL(is_public=False),
            )
        )
    return chunks


@pytest.mark.asyncio
async def test_sovereign_retrieval_pipeline_lifecycle(
    sample_chunks: list[Chunk],
) -> None:
    # 1. Setup Vector Store, Embedder, Reranker
    vector_store = MemoryVectorStoreAdapter()
    await vector_store.upsert(sample_chunks)

    embedder = MockEmbedderAdapter(dimension=64)
    reranker = MockRerankerAdapter()

    pipeline = RetrievalPipeline(
        vector_store=vector_store,
        embedder=embedder,
        reranker=reranker,
    )

    alice = Principal(
        id="alice",
        type="user",
        tenant_id="tenant_acme",
        attributes={"groups": ["engineering"]},
    )

    # 2. Execute search with top_k=2, overfetch_factor=4.0
    result: PipelineResult = await pipeline.execute(
        query="quantum security",
        principal=alice,
        top_k=2,
        overfetch_factor=4.0,
    )

    # Assertions on pipeline contract
    assert result.query == "quantum security"
    assert result.overfetch_factor == 4.0

    # Overfetch factor 4.0 * top_k 2 = 8 candidates evaluated
    assert result.total_candidates_evaluated == 8
    assert result.authorized_candidates_count == 8

    for res in result.results:
        # Verify deep-linked citations are attached
        assert res.citation is not None
        assert res.citation.chunk_id == res.chunk_id
        assert res.citation.document_id == res.document_id
        assert "wiki.corp.internal" in (res.citation.uri or "")
        assert res.citation.snippet.startswith("Secret project")
        assert res.citation.score > 0.0

    assert len(result.results) <= 2


@pytest.mark.asyncio
async def test_overfetch_factor_bounding(
    sample_chunks: list[Chunk],
) -> None:
    vector_store = MemoryVectorStoreAdapter()
    await vector_store.upsert(sample_chunks)

    pipeline = RetrievalPipeline(
        vector_store=vector_store,
        embedder=MockEmbedderAdapter(dimension=64),
        reranker=MockRerankerAdapter(),
    )

    user = Principal(id="bob", type="user", tenant_id="tenant_acme")

    # If requested factor is 1.0, it should be clamped to 3.0
    res_low = await pipeline.execute(
        query="security",
        principal=user,
        top_k=2,
        overfetch_factor=1.0,
    )
    assert res_low.overfetch_factor == 3.0

    # If requested factor is 10.0, it should be clamped to 5.0
    res_high = await pipeline.execute(
        query="security",
        principal=user,
        top_k=2,
        overfetch_factor=10.0,
    )
    assert res_high.overfetch_factor == 5.0
