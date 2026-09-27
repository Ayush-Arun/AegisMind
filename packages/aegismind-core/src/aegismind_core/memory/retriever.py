from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from aegismind_core.memory.store import MemoryStore

logger = logging.getLogger(__name__)


class MemoryRetriever:
    """Retrieves relevant past conversations using semantic similarity."""

    def __init__(self, memory_store: MemoryStore) -> None:
        self.memory_store = memory_store

    async def retrieve(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        embedder: Any,
        top_k: int = 5,
    ) -> str:
        try:
            query_embedding = await embedder.embed_query(query)
            embedding_str = json.dumps(query_embedding)
            results = self.memory_store.search_by_embedding(
                query_embedding=embedding_str,
                user_id=user_id,
                tenant_id=tenant_id,
                top_k=top_k,
            )
        except Exception as exc:
            logger.warning("Memory retrieval by embedding failed: %s", exc)
            results = self.memory_store.search(
                query=query,
                user_id=user_id,
                tenant_id=tenant_id,
                top_k=top_k,
            )

        if not results:
            return ""

        lines = ["\n\n=== PAST CONVERSATION MEMORY ==="]
        lines.append(f"Found {len(results)} previous conversations:")
        for idx, entry in enumerate(results, start=1):
            # Filter out entries containing image paths
            query_filtered = self._filter_image_content(entry["query"])
            response_filtered = self._filter_image_content(entry["response"])
            lines.append(f"\n[{idx}] {entry['created_at']}")
            lines.append(f"  User asked: {query_filtered}")
            lines.append(f"  Assistant answered: {response_filtered[:200]}")
        lines.append("\n=== END PAST CONVERSATION MEMORY ===\n")
        return "\n".join(lines)

    @staticmethod
    def _filter_image_content(text: str) -> str:
        """Remove lines containing image file paths."""
        lines = []
        for line in text.split("\n"):
            if any(ext in line.lower() for ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tiff", ".svg"}):
                continue
            lines.append(line)
        return "\n".join(lines) if lines else text

    async def retrieve_for_prompt(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        embedder: Any,
        top_k: int = 5,
    ) -> str:
        """Retrieve memory and format it as a prompt section."""
        context = await self.retrieve(query, user_id, tenant_id, embedder, top_k)
        if context:
            return context
        return ""

    def store_conversation(
        self,
        user_id: str,
        tenant_id: str,
        query: str,
        response: str,
        embedder: Any | None = None,
        query_embedding: str | None = None,
    ) -> str:
        return self.memory_store.store(
            user_id=user_id,
            tenant_id=tenant_id,
            query=query,
            response=response,
            query_embedding=query_embedding,
        )

    def get_history(self, user_id: str, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return self.memory_store.get_history(user_id, tenant_id, limit)

    def get_stats(self, user_id: str, tenant_id: str) -> dict[str, int]:
        return self.memory_store.get_stats(user_id, tenant_id)

    def clear(self, user_id: str, tenant_id: str) -> None:
        self.memory_store.clear(user_id, tenant_id)