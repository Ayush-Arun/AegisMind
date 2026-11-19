from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import pypdf
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse

from aegismind_core.legal.models import LegalAuditReport, LegalCaseInput, PrecedentItem
from aegismind_core.legal.retriever import PRED_JSON_PATH, search_precedents
from aegismind_core.legal.swarm import LegalSwarmOrchestrator

logger = logging.getLogger("legal_routes")

legal_router = APIRouter(prefix="/api/v1/legal", tags=["legal_intelligence"])
orchestrator = LegalSwarmOrchestrator()


@legal_router.post("/upload-case")
async def upload_case_file(file: UploadFile = File(...)) -> dict[str, Any]:
    """Upload an Indian court case file (PDF, TXT, MD) and extract text."""
    filename = file.filename or "uploaded_case.pdf"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    extracted_text = ""
    pages_count = 1

    if filename.lower().endswith(".pdf"):
        import io
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            pages_count = len(reader.pages)
            extracted_pages = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    extracted_pages.append(txt)
            extracted_text = "\n\n".join(extracted_pages)
        except Exception as exc:
            logger.error("PDF extraction failed: %s", exc)
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Failed to read PDF: {exc}")
    else:
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content.decode("latin-1", errors="ignore")

    if not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract readable text from document. Ensure it is not a scanned image PDF.",
        )

    # Guess a title from the first 200 characters
    first_lines = [l.strip() for l in extracted_text[:500].split("\n") if l.strip()]
    guessed_title = first_lines[0] if first_lines else filename

    return {
        "filename": filename,
        "title": guessed_title[:120],
        "pages_count": pages_count,
        "character_count": len(extracted_text),
        "word_count": len(extracted_text.split()),
        "extracted_text": extracted_text,
    }


@legal_router.post("/analyze", response_model=LegalAuditReport)
async def analyze_case(case_input: LegalCaseInput) -> LegalAuditReport:
    """Execute complete Multi-Agent Chamber analysis on the case."""
    try:
        return await orchestrator.analyze(case_input)
    except Exception as exc:
        logger.error("Multi-agent analysis failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@legal_router.post("/analyze-stream")
async def analyze_case_stream(case_input: LegalCaseInput) -> StreamingResponse:
    """Stream real-time multi-agent deliberation events using Server-Sent Events (SSE)."""

    async def sse_event_stream() -> AsyncIterator[str]:
        try:
            async for event in orchestrator.analyze_stream(case_input):
                data = json.dumps(event)
                yield f"event: {event.get('type', 'message')}\ndata: {data}\n\n"
        except Exception as exc:
            logger.error("SSE stream error: %s", exc)
            error_data = json.dumps({"type": "error", "message": str(exc)})
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@legal_router.get("/precedents")
async def get_precedents(
    query: str | None = Query(None, description="Keyword or legal topic to search"),
    limit: int = Query(20, ge=1, le=50),
) -> dict[str, Any]:
    """Browse or search the 50 ingested Supreme Court of India precedent cases."""
    if query:
        results = search_precedents(query, limit=limit)
        return {"query": query, "total": len(results), "precedents": [r.model_dump() for r in results]}

    if PRED_JSON_PATH.exists():
        try:
            with open(PRED_JSON_PATH, "r", encoding="utf-8") as f:
                cases = json.load(f)
            return {"query": None, "total": len(cases), "precedents": cases[:limit]}
        except Exception as exc:
            logger.warning("Could not load precedents JSON: %s", exc)

    return {"query": None, "total": 0, "precedents": []}


@legal_router.get("/sample-cases")
async def get_sample_cases() -> list[dict[str, Any]]:
    """Provide realistic sample Indian law cases for quick advocate testing."""
    return [
        {
            "id": "sample-ni-act-138",
            "title": "M/s Apex Logistics v. Rajesh Sharma (S.138 NI Act Cheque Dishonour)",
            "case_type": "Criminal",
            "court_forum": "Metropolitan Magistrate / Sessions Court, New Delhi",
            "client_posture": "Defendant/Accused",
            "text": """IN THE COURT OF CHIEF METROPOLITAN MAGISTRATE, SAKET COURTS, NEW DELHI
CC No. 4921/2023
IN THE MATTER OF:
M/s Apex Logistics Pvt. Ltd. ... Complainant
Versus
Mr. Rajesh Sharma ... Accused

COMPLAINT UNDER SECTION 138 READ WITH SECTION 141/142 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

1. That the Complainant is a private limited company engaged in supply chain logistics.
2. That the Accused approached the Complainant in January 2023 for transport services, against which Invoices totaling Rs. 42,50,000/- were raised.
3. That in partial discharge of the legally enforceable debt, the Accused issued Cheque bearing No. 004812 dated 15.06.2023 drawn on HDFC Bank, Connaught Place Branch, for an amount of Rs. 25,00,000/-.
4. That the Complainant deposited the said Cheque with its banker ICICI Bank, Saket on 18.06.2023. However, the said Cheque was returned dishonoured with the remark 'Funds Insufficient' vide Cheque Return Memo dated 20.06.2023.
5. That the Complainant sent a Statutory Legal Demand Notice dated 25.07.2023 through Speed Post, calling upon the Accused to make payment within 15 days of receipt. The notice was delivered on 28.07.2023.
6. That the Accused sent a reply dated 10.08.2023 disputing the invoices and alleging that the cheque in question was handed over in 2021 as blank signed security cheque for an unrelated past contract which was completed.
7. That despite statutory notice and lapse of 15 days, no payment has been made by the Accused. Hence this complaint.""",
        },
        {
            "id": "sample-quash-420-ipc",
            "title": "Sunil Verma v. State of Maharashtra & Anr. (Quashing u/s 482 CrPC)",
            "case_type": "Criminal",
            "court_forum": "High Court of Judicature at Bombay",
            "client_posture": "Petitioner/Complainant",
            "text": """IN THE HIGH COURT OF JUDICATURE AT BOMBAY
CRIMINAL APPELLATE JURISDICTION
CRIMINAL WRIT PETITION NO. 1840 OF 2024
IN THE MATTER OF:
Sunil Verma ... Petitioner
Versus
1. State of Maharashtra
2. TechVenture Solutions LLP ... Respondents

PETITION UNDER SECTION 482 OF THE CODE OF CRIMINAL PROCEDURE, 1973 FOR QUASHING OF FIR NO. 112/2024 REGISTERED AT CYBER POLICE STATION, BKC, MUMBAI FOR OFFENCES UNDER SECTIONS 406, 420 READ WITH SECTION 120-B OF IPC

1. The Petitioner is a software architecture consultant and ex-director of CloudCore Pvt. Ltd.
2. Respondent No. 2 lodged FIR No. 112/2024 alleging that Petitioner entered into a Software Development Agreement dated 12.04.2022 and received Rs. 85,00,000/- in milestone payments, but delivered defective source code and failed to complete Milestone 4.
3. The FIR alleges that Petitioner fraudulently induced Respondent No. 2 to release funds and misappropriated the payment, thereby committing criminal breach of trust (S.406) and cheating (S.420 IPC).
4. The Petitioner submits that the entire dispute is purely contractual and civil in nature arising out of scope changes under Clause 14 of the Master Service Agreement, which contains an express Arbitration Clause.
5. There is no allegation or evidentiary proof of dishonest intention at the inception of the contract in April 2022. The criminal process has been instituted with an ulterior motive to arm-twist and recover unliquidated damages without paying court fees.""",
        },
    ]
