#!/usr/bin/env python3
"""
Ingestion script for Indian Supreme Court Precedents from data/raw/
Ingests the first 50 case law PDFs, extracts structured citations and headnotes,
and builds a local searchable index in storage/legal/
"""
from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

import pypdf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("legal_ingest")

DATA_RAW_DIR = Path("data/raw")
STORAGE_LEGAL_DIR = Path("storage/legal")
PRED_JSON_PATH = STORAGE_LEGAL_DIR / "precedents.json"
PRED_DB_PATH = STORAGE_LEGAL_DIR / "legal_db.sqlite"


def extract_metadata_from_text(first_page_text: str, filename: str) -> dict[str, str]:
    """Extract official citation, case title, and subject matter from page text."""
    lines = [l.strip() for l in first_page_text.split("\n") if l.strip()]
    
    citation = ""
    title = ""
    subject = ""

    # Extract SCR / INSC citation
    for line in lines:
        if "S.C.R." in line or "INSC" in line:
            m = re.search(r"(\[?\d{4}\]?\s*\d*\s*S\.C\.R\.?\s*[\d\-:]*(?:\s*:\s*\d{4}\s*INSC\s*\d+)?)", line)
            if m:
                citation = m.group(1).strip()
                break
            citation = line.strip()
            break

    # Extract Title (Party A v. Party B)
    for i, line in enumerate(lines[:25]):
        if line.lower() == "v." or line.lower() == "versus" or " v. " in line or " vs. " in line:
            if " v. " in line or " vs. " in line:
                title = line.strip()
            elif i > 0 and i + 1 < len(lines):
                title = f"{lines[i-1]} v. {lines[i+1]}"
            break

    if not title:
        # Fallback to Suo Motu or First Heading
        for line in lines[:15]:
            if line.startswith("IN RE:") or line.startswith("IN THE MATTER OF"):
                title = line.strip()
                break

    if not title:
        title = Path(filename).stem.replace("_", " ")

    if not citation:
        citation = f"SCR {Path(filename).stem}"

    # Extract primary act mentions
    acts_found = []
    act_patterns = [
        r"POCSO|Protection of Children from Sexual Offences",
        r"NDPS|Narcotic Drugs and Psychotropic Substances",
        r"Information Technology Act|IT Act|Section 67B",
        r"Negotiable Instruments Act|Section 138",
        r"Penal Code|Indian Penal Code|IPC|Bharatiya Nyaya Sanhita|BNS",
        r"Code of Criminal Procedure|Cr\.?P\.?C|BNSS|Bharatiya Nagarik Suraksha",
        r"Code of Civil Procedure|C\.?P\.?C",
        r"Evidence Act|Indian Evidence Act|BSA|Bharatiya Sakshya",
        r"Specific Relief Act",
        r"Arbitration and Conciliation Act",
        r"Constitution of India|Article \d+",
        r"Insolvency and Bankruptcy Code|IBC",
        r"Limitation Act",
        r"Prevention of Corruption Act",
        r"Consumer Protection Act",
    ]
    for p in act_patterns:
        if re.search(p, first_page_text, re.IGNORECASE):
            acts_found.append(p.split("|")[0])

    subject = ", ".join(acts_found) if acts_found else "General Indian Law"

    return {
        "title": title,
        "citation": citation,
        "subject": subject,
    }


def init_sqlite_db() -> sqlite3.Connection:
    """Initialize SQLite FTS5 database for precedent retrieval."""
    STORAGE_LEGAL_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(PRED_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS legal_precedents (
            id TEXT PRIMARY KEY,
            filename TEXT,
            title TEXT,
            citation TEXT,
            subject TEXT,
            num_pages INTEGER,
            summary TEXT,
            full_text TEXT
        )
    """)
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS precedents_fts USING fts5(
            id,
            title,
            citation,
            subject,
            summary,
            full_text
        )
    """)
    conn.commit()
    return conn


def ingest_corpus(max_files: int = 50) -> None:
    """Ingest up to max_files legal PDFs into JSON and SQLite store."""
    if not DATA_RAW_DIR.is_dir():
        logger.error("Directory %s does not exist", DATA_RAW_DIR)
        return

    pdf_files = sorted([f for f in os.listdir(DATA_RAW_DIR) if f.lower().endswith(".pdf")])
    selected_files = pdf_files[:max_files]
    logger.info("Starting ingestion of %d Indian case law files (out of %d total)", len(selected_files), len(pdf_files))

    conn = init_sqlite_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM legal_precedents")
    cur.execute("DELETE FROM precedents_fts")
    conn.commit()

    precedents_list: list[dict[str, Any]] = []

    for idx, fname in enumerate(selected_files, 1):
        fpath = DATA_RAW_DIR / fname
        try:
            reader = pypdf.PdfReader(fpath)
            num_pages = len(reader.pages)
            if num_pages == 0:
                continue

            # Extract first 5 pages for text analysis & summary
            pages_text = []
            for p in reader.pages[: min(8, num_pages)]:
                extracted = p.extract_text()
                if extracted:
                    pages_text.append(extracted)

            combined_text = "\n\n".join(pages_text)
            meta = extract_metadata_from_text(pages_text[0] if pages_text else "", fname)

            # Generate a 200-word synopsis from the headnotes/initial pages
            lines = [l.strip() for l in combined_text.split("\n") if len(l.strip()) > 30][:10]
            summary = " ".join(lines)[:800] if lines else combined_text[:800]

            case_record = {
                "id": f"insc-{idx:03d}",
                "filename": fname,
                "title": meta["title"],
                "citation": meta["citation"],
                "subject": meta["subject"],
                "num_pages": num_pages,
                "summary": summary,
                "key_passages": combined_text[:2000],
            }

            precedents_list.append(case_record)

            cur.execute(
                """
                INSERT INTO legal_precedents (id, filename, title, citation, subject, num_pages, summary, full_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_record["id"],
                    case_record["filename"],
                    case_record["title"],
                    case_record["citation"],
                    case_record["subject"],
                    num_pages,
                    summary,
                    combined_text,
                ),
            )
            cur.execute(
                """
                INSERT INTO precedents_fts (id, title, citation, subject, summary, full_text)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    case_record["id"],
                    case_record["title"],
                    case_record["citation"],
                    case_record["subject"],
                    summary,
                    combined_text,
                ),
            )

            if idx % 10 == 0 or idx == len(selected_files):
                logger.info("Ingested [%d/%d] cases: %s (%s)", idx, len(selected_files), meta["title"][:50], meta["citation"])

        except Exception as exc:
            logger.warning("Failed ingesting %s: %s", fname, exc)

    conn.commit()
    conn.close()

    with open(PRED_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(precedents_list, f, indent=2, ensure_ascii=False)

    logger.info("SUCCESS: Ingested %d Indian Supreme Court cases into %s and %s", len(precedents_list), PRED_JSON_PATH, PRED_DB_PATH)


if __name__ == "__main__":
    ingest_corpus(300)
