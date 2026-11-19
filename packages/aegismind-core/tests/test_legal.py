import pytest
from fastapi.testclient import TestClient
from aegismind_core.app import app
from aegismind_core.legal.models import LegalCaseInput

client = TestClient(app)

def test_legal_sample_cases():
    response = client.get("/api/v1/legal/sample-cases")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    titles = [case["title"] for case in data]
    assert any("S.138 NI Act" in t for t in titles)
    assert any("u/s 482 CrPC" in t for t in titles)

def test_legal_precedents_search():
    response = client.get("/api/v1/legal/precedents?query=cheque+dishonour&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "total" in data
    assert "precedents" in data
    assert isinstance(data["precedents"], list)

def test_legal_models():
    case = LegalCaseInput(
        case_title="State of Maharashtra vs XYZ",
        court_forum="High Court of Bombay",
        case_type="Criminal",
        case_text="The complainant filed an FIR alleging cheating under Section 420 IPC without averment of initial dishonest intention.",
        client_posture="Defendant/Accused",
        specific_questions=["Can FIR be quashed under 482 CrPC?"]
    )
    assert case.case_title == "State of Maharashtra vs XYZ"
    assert case.client_posture == "Defendant/Accused"
    assert len(case.case_text) > 10

def test_legal_upload_case_text():
    sample_content = b"IN THE HIGH COURT OF JUDICATURE AT BOMBAY\nCRIMINAL APPELLATE JURISDICTION\nCriminal Writ Petition No. 101 of 2024\nPetitioner: Ramesh Sharma vs Respondent: State of Maharashtra & Anr.\nPrayer for quashing of FIR under Section 482 CrPC."
    response = client.post(
        "/api/v1/legal/upload-case",
        files={"file": ("petition.txt", sample_content, "text/plain")}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["filename"] == "petition.txt"
    assert "Ramesh Sharma" in res_data["extracted_text"]
    assert res_data["character_count"] > 50
