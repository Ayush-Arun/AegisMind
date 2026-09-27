from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any, Optional

import sqlite3

logger = logging.getLogger(__name__)


class MemoryStore:
    """Persistent SQLite-backed conversation memory store."""

    def __init__(self, db_path: str = "./storage/memory/memory.db") -> None:
        self.db_path = db_path
        import os
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    tenant_id TEXT NOT NULL,
                    query TEXT NOT NULL,
                    response TEXT NOT NULL,
                    query_embedding TEXT,
                    created_at TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
                CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
            """)
        logger.info("Memory database initialized at %s", self.db_path)

    def store(self, user_id: str, tenant_id: str, query: str, response: str, query_embedding: Optional[str] = None, metadata: dict[str, Any] | None = None) -> str:
        import uuid
        conv_id = str(uuid.uuid4())
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT INTO conversations (id, user_id, tenant_id, query, response, query_embedding, created_at, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (conv_id, user_id, tenant_id, query, response, query_embedding, datetime.now(UTC).isoformat(), json.dumps(metadata or {})),
            )
        return conv_id

    def search(self, query: str, user_id: str, tenant_id: str, top_k: int = 5) -> list[dict[str, Any]]:
        results = []
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                """SELECT id, query, response, created_at, metadata FROM conversations
                   WHERE tenant_id = ? AND user_id = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (tenant_id, user_id, top_k),
            ).fetchall()
        for row in rows:
            results.append({
                "id": row[0], "query": row[1], "response": row[2],
                "created_at": row[3], "metadata": json.loads(row[4]),
            })
        return results

    def search_by_embedding(self, query_embedding: str, user_id: str, tenant_id: str, top_k: int = 5) -> list[dict[str, Any]]:
        results = []
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                """SELECT id, query, response, created_at, metadata, query_embedding FROM conversations
                   WHERE tenant_id = ? AND user_id = ? AND query_embedding IS NOT NULL
                   ORDER BY created_at DESC LIMIT ?""",
                (tenant_id, user_id, top_k),
            ).fetchall()
        for row in rows:
            results.append({
                "id": row[0], "query": row[1], "response": row[2],
                "created_at": row[3], "metadata": json.loads(row[4]),
                "embedding": row[5],
            })
        return results

    def get_history(self, user_id: str, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
        results = []
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                """SELECT id, query, response, created_at, metadata FROM conversations
                   WHERE tenant_id = ? AND user_id = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (tenant_id, user_id, limit),
            ).fetchall()
        for row in rows:
            results.append({
                "id": row[0], "query": row[1], "response": row[2],
                "created_at": row[3], "metadata": json.loads(row[4]),
            })
        return results

    def get_stats(self, user_id: str, tenant_id: str) -> dict[str, int]:
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute(
                "SELECT COUNT(*) FROM conversations WHERE tenant_id = ? AND user_id = ?",
                (tenant_id, user_id),
            ).fetchone()[0]
            today = datetime.now(UTC).strftime("%Y-%m-%d")
            today_count = conn.execute(
                "SELECT COUNT(*) FROM conversations WHERE tenant_id = ? AND user_id = ? AND date(created_at) = ?",
                (tenant_id, user_id, today),
            ).fetchone()[0]
        return {"total": total, "today": today_count}

    def clear(self, user_id: str, tenant_id: str) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "DELETE FROM conversations WHERE tenant_id = ? AND user_id = ?",
                (tenant_id, user_id),
            )