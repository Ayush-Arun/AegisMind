from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any

from aegismind_core.legal.models import PrecedentItem

logger = logging.getLogger("legal_retriever")

STORAGE_LEGAL_DIR = Path("storage/legal")
PRED_DB_PATH = STORAGE_LEGAL_DIR / "legal_db.sqlite"
PRED_JSON_PATH = STORAGE_LEGAL_DIR / "precedents.json"


def search_precedents(query: str, limit: int = 5) -> list[PrecedentItem]:
    """Retrieve the most relevant Indian Supreme Court precedents from the indexed database."""
    results: list[PrecedentItem] = []
    
    # Clean query for FTS5 (take key alphanumeric terms)
    terms = [re_term for re_term in query.split() if len(re_term) > 3 and re_term.isalnum()][:8]
    if not terms:
        terms = ["Court", "Appeal", "Section", "Evidence"]
    fts_query = " OR ".join(terms)

    if PRED_DB_PATH.exists():
        try:
            conn = sqlite3.connect(PRED_DB_PATH)
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, title, citation, subject, summary, full_text
                FROM precedents_fts
                WHERE precedents_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, limit),
            )
            rows = cur.fetchall()
            for row in rows:
                _id, title, citation, subject, summary, full_text = row
                results.append(
                    PrecedentItem(
                        case_name=title or "Supreme Court of India Ruling",
                        citation=citation or "Supreme Court Reports",
                        court="Supreme Court of India",
                        applicable_ratio=f"Subject: {subject}. Key holding: {summary[:250]}...",
                        relevance_summary=f"Directly relevant to issues of {subject} and judicial review standards.",
                        stance="SUPPORTING",
                    )
                )
            conn.close()
        except Exception as exc:
            logger.warning("FTS search failed: %s; falling back to JSON records", exc)

    # Fallback to JSON if SQLite returned fewer results
    if len(results) < limit and PRED_JSON_PATH.exists():
        try:
            with open(PRED_JSON_PATH, "r", encoding="utf-8") as f:
                cases = json.load(f)
            query_lower = query.lower()
            for c in cases:
                if any(t.lower() in c.get("summary", "").lower() or t.lower() in c.get("subject", "").lower() for t in terms):
                    if not any(r.case_name == c["title"] for r in results):
                        results.append(
                            PrecedentItem(
                                case_name=c["title"],
                                citation=c["citation"],
                                court="Supreme Court of India",
                                applicable_ratio=c["summary"][:250] + "...",
                                relevance_summary=f"Pertaining to {c.get('subject', 'Indian Law')}",
                                stance="SUPPORTING",
                            )
                        )
                    if len(results) >= limit:
                        break
        except Exception as exc:
            logger.warning("JSON precedent search fallback failed: %s", exc)

    return results[:limit]
