from __future__ import annotations

import json
import logging
from typing import Any

from aegismind_core.memory.store import MemoryStore
from aegismind_core.memory.retriever import MemoryRetriever

logger = logging.getLogger(__name__)


class ConversationMemory:
    """Long-term memory for the sovereign agent. Stores all Q&A pairs."""

    def __init__(self, db_path: str = "./storage/memory/memory.db") -> None:
        self.store = MemoryStore(db_path=db_path)
        self.retriever = MemoryRetriever(self.store)

    async def record_conversation(self, user_id: str, tenant_id: str, query: str, response: str, embedder: Any | None = None) -> None:
        query_embedding = None
        if embedder:
            try:
                embedding = await embedder.embed_query(query)
                query_embedding = json.dumps(embedding)
            except Exception:
                pass
        self.store.store(user_id=user_id, tenant_id=tenant_id, query=query, response=response, query_embedding=query_embedding)

    async def retrieve_context(self, query: str, user_id: str, tenant_id: str, embedder: Any, top_k: int = 5) -> str:
        return await self.retriever.retrieve(query, user_id, tenant_id, embedder, top_k)

    def get_history(self, user_id: str, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return self.retriever.get_history(user_id, tenant_id, limit)

    def get_stats(self, user_id: str, tenant_id: str) -> dict[str, int]:
        return self.retriever.get_stats(user_id, tenant_id)

    def clear(self, user_id: str, tenant_id: str) -> None:
        self.retriever.clear(user_id, tenant_id)