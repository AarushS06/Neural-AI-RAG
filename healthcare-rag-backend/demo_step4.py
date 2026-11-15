import json
import time
import io
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
try:
    import pymupdf as fitz
except ImportError:
    import fitz
from app.main import app, generator, settings

client = TestClient(app)

def create_sample_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    text = (
        "%PDF-1.4\n"
        "Title: Phase 3 Trial of Lecanemab in Early Alzheimer's Disease\n"
        "Authors: Christopher H. van Dyck, M.D., Chad J. Swanson, Ph.D., Paul Aisen, M.D.\n"
        "Year: 2023\n"
        "Journal: New England Journal of Medicine\n"
        "Study Design: Randomized Controlled Trial\n"
        "Population: 1795 participants aged 50 to 90 years with early Alzheimer's disease and confirmed amyloid pathology.\n"
        "Intervention: Intravenous lecanemab at a dose of 10 mg per kilogram of body weight every 2 weeks.\n"
        "Comparator: Placebo administered biweekly.\n"
        "Outcomes: The primary end point was the change from baseline at 18 months in the score on the Clinical Dementia Rating-Sum of Boxes (CDR-SB).\n"
        "Results: Lecanemab reduced brain amyloid burden and resulted in moderately less decline on clinical measures of cognition and function compared to placebo at 18 months.\n"
        "Conclusion: In persons with early Alzheimer's disease, lecanemab reduced markers of amyloid and resulted in moderately less decline in cognition at 18 months."
    )
    page.insert_text((50, 72), text, fontsize=11)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def run_proof():
    print("=" * 60)
    print("STEP 4 PROOF: Normal Upload Flow -> Ingestion -> Chat (3 Modes)")
    print("=" * 60)

    # 1. Upload sample PDF
    pdf_bytes = create_sample_pdf()
    files = {"file": ("lecanemab_trial_phase3.pdf", pdf_bytes, "application/pdf")}
    upload_res = client.post(
        "/api/dashboard/analyze",
        files=files,
        data={"template": "research_papers", "version": "1"}
    )
    print("\n1. Upload Response:")
    print(json.dumps(upload_res.json(), indent=2))
    assert upload_res.status_code == 200
    doc_id = upload_res.json()["document_id"]

    # 2. Poll progress until complete
    for _ in range(20):
        prog_res = client.get(f"/api/dashboard/{doc_id}/progress")
        prog = prog_res.json()
        print(f"Stage: {prog['stage']} ({prog['percent']}%)")
        if prog["stage"] == "ready_for_question":
            break
        time.sleep(0.5)

    # 3. Setup Mock OpenAI client with realistic responses
    mock_client = MagicMock()

    # Combined mode response
    mock_combined_resp = MagicMock()
    mock_combined_choice = MagicMock()
    mock_combined_choice.message.content = (
        "Based on the clinical trial evidence, lecanemab administered intravenously at 10 mg/kg biweekly "
        "demonstrated significant reduction in brain amyloid plaque burden and moderately slowed cognitive "
        "and functional decline over 18 months on the CDR-SB scale [C1]. From general medical pharmacology, "
        "lecanemab is an IgG1 monoclonal antibody directed against soluble amyloid-beta protofibrils, "
        "and patients receiving this therapy require regular surveillance MRI to monitor for amyloid-related "
        "imaging abnormalities (ARIA)."
    )
    mock_combined_resp.choices = [mock_combined_choice]

    # Strict RAG mode response
    mock_rag_resp = MagicMock()
    mock_rag_choice = MagicMock()
    mock_rag_choice.message.content = (
        "In persons with early Alzheimer's disease, lecanemab reduced markers of amyloid and resulted in moderately less decline in cognition at 18 months.\n\n"
        "Key Findings:\n"
        "- The trial evaluated 1795 participants aged 50 to 90 years with confirmed amyloid pathology [C1].\n"
        "- Lecanemab was dosed intravenously at 10 mg per kilogram of body weight every 2 weeks [C1].\n"
        "- The primary outcome measured change on the Clinical Dementia Rating-Sum of Boxes (CDR-SB) at 18 months [C1].\n\n"
        "Takeaway: Lecanemab achieved moderately less decline on clinical cognitive and functional measures relative to placebo."
    )
    mock_rag_resp.choices = [mock_rag_choice]

    # Knowledge mode response
    mock_know_resp = MagicMock()
    mock_know_choice = MagicMock()
    mock_know_choice.message.content = (
        "Alzheimer's disease is a chronic progressive neurodegenerative disorder marked by extracellular beta-amyloid plaques, "
        "intracellular tau neurofibrillary tangles, and progressive memory, executive, and behavioral deterioration."
    )
    mock_know_resp.choices = [mock_know_choice]

    print("\n" + "=" * 60)
    print("2. POST /api/chat in COMBINED Mode:")
    print("=" * 60)
    mock_client.chat.completions.create.return_value = mock_combined_resp
    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_combined = client.post(
            "/api/chat",
            json={
                "question": "What are the clinical effects of lecanemab in early Alzheimer's disease?",
                "mode": "combined",
                "document_id": doc_id,
            }
        )
        print(json.dumps(res_combined.json(), indent=2))
        data_c = res_combined.json()
        assert data_c["llm_used"] is True
        assert data_c["generator"].startswith("openai")
        assert len(data_c["citations"]) > 0

    print("\n" + "=" * 60)
    print("3. POST /api/chat in Strict RAG Mode:")
    print("=" * 60)
    mock_client.chat.completions.create.return_value = mock_rag_resp
    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_rag = client.post(
            "/api/chat",
            json={
                "question": "What was the sample size, dosage, and primary endpoint?",
                "mode": "rag",
                "document_id": doc_id,
            }
        )
        print(json.dumps(res_rag.json(), indent=2))
        data_r = res_rag.json()
        assert data_r["llm_used"] is True
        assert data_r["generator"].startswith("openai")
        assert len(data_r["citations"]) > 0

    print("\n" + "=" * 60)
    print("4. POST /api/chat in KNOWLEDGE Mode:")
    print("=" * 60)
    mock_client.chat.completions.create.return_value = mock_know_resp
    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_know = client.post(
            "/api/chat",
            json={
                "question": "What is the pathophysiology of Alzheimer's disease?",
                "mode": "knowledge",
            }
        )
        print(json.dumps(res_know.json(), indent=2))
        data_k = res_know.json()
        assert data_k["llm_used"] is True
        assert len(data_k["citations"]) == 0

    print("\n" + "=" * 60)
    print("5. POST /api/dashboard/{id}/ask (scoped combined Q&A):")
    print("=" * 60)
    mock_client.chat.completions.create.return_value = mock_combined_resp
    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_ask = client.post(
            f"/api/dashboard/{doc_id}/ask",
            json={"question": "Summarize efficacy and dosing."}
        )
        print(json.dumps(res_ask.json(), indent=2))
        assert res_ask.json()["llm_used"] is True

    print("\n" + "=" * 60)
    print("6. Fallback Behavior when Key is Missing (NO SILENT FALLBACK):")
    print("=" * 60)
    with patch.object(generator, "_get_openai_client", return_value=(None, "missing api key: OPENAI_API_KEY is not set")):
        res_fallback = client.post(
            "/api/chat",
            json={"question": "What are the clinical effects?", "mode": "combined", "document_id": doc_id}
        )
        print(json.dumps(res_fallback.json(), indent=2))
        data_fb = res_fallback.json()
        assert data_fb["generator"] == "extractive-fallback"
        assert data_fb["llm_used"] is False
        assert "missing api key" in data_fb["llm_error"]

    print("\n" + "=" * 60)
    print("7. GET /api/llm/health (Diagnostic verification):")
    print("=" * 60)
    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_hlth = client.get("/api/llm/health")
        print(json.dumps(res_hlth.json(), indent=2))
        assert res_hlth.json()["status"] == "ok"

    # Cleanup
    client.delete(f"/api/documents/{doc_id}")
    print("\nCleaned up test document. STEP 4 PROOF COMPLETE!")

if __name__ == "__main__":
    run_proof()
