import time
import uuid
from fastapi.testclient import TestClient
from app.main import app, store, index, settings

client = TestClient(app)

def wait_for_ready(doc_id: str, max_seconds: float = 6.0):
    start = time.time()
    while time.time() - start < max_seconds:
        r = client.get(f"/api/dashboard/{doc_id}/progress")
        assert r.status_code == 200
        data = r.json()
        if data["stage"] in ("ready_for_question", "failed"):
            return data
        time.sleep(0.05)
    raise TimeoutError(f"Document {doc_id} did not complete within {max_seconds}s")

def test_dashboard_overview():
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "totals" in data
    assert "documents" in data["totals"]
    assert "chunks" in data["totals"]
    assert "conversations" in data["totals"]
    assert "recent_documents" in data
    assert "processing_queue" in data
    assert "quality_summary" in data
    assert "system_status" in data

def test_full_analyze_progress_result_ask_flow():
    pdf_content = (
        b"%PDF-1.5\n"
        b"Title: Randomized Trial of Lecanemab in Early Alzheimer Disease\n"
        b"Authors: Christopher H. van Dyck, Chad J. Swanson, Paul Aisen\n"
        b"Year: 2023\n"
        b"DOI: 10.1056/NEJMoa2212948\n"
        b"Abstract\n"
        b"Lecanemab, an IgG1 monoclonal antibody that binds with high affinity to amyloid-beta soluble protofibrils, "
        b"was tested in a phase 3 trial involving persons with early Alzheimer's disease.\n"
        b"Methods\n"
        b"We conducted an 18-month, multicenter, double-blind trial involving persons 50 to 90 years of age with early Alzheimer's disease.\n"
        b"Participants were randomly assigned in a 1:1 ratio to receive intravenous lecanemab or placebo every 2 weeks.\n"
        b"The primary end point was the change from baseline at 18 months in the score on the Clinical Dementia Rating-Sum of Boxes (CDR-SB).\n"
        b"Results\n"
        b"A total of 1795 participants were enrolled. The mean score on the CDR-SB at baseline was approximately 3.2.\n"
        b"Lecanemab reduced brain amyloid levels and resulted in less clinical decline on the CDR-SB than placebo at 18 months.\n"
        b"Conclusions\n"
        b"In persons with early Alzheimer's disease, lecanemab reduced markers of amyloid and resulted in moderately less decline on measures of cognition.\n"
        + f"Run: {uuid.uuid4().hex}\n".encode()
    )

    # 1. Start Analysis
    res = client.post(
        "/api/dashboard/analyze",
        files={"file": ("lecanemab_trial.pdf", pdf_content, "application/pdf")},
        data={"template": "research_papers", "version": "1.0"},
    )
    assert res.status_code == 200
    init_data = res.json()
    doc_id = init_data["document_id"]
    assert init_data["duplicate"] is False
    assert init_data["stage"] in ("received", "extracting", "chunking", "embedding", "analysing", "ready_for_question")

    # 2. Progress Polling
    prog = wait_for_ready(doc_id)
    assert prog["stage"] == "ready_for_question"
    assert prog["percent"] == 100
    assert prog["error"] is None

    # Also test /api/documents/{id}/progress alias
    doc_prog = client.get(f"/api/documents/{doc_id}/progress").json()
    assert doc_prog["stage"] == "ready_for_question"
    assert doc_prog["percent"] == 100

    # 3. Fetch Consolidated Result
    res_result = client.get(f"/api/dashboard/{doc_id}/result")
    assert res_result.status_code == 200
    result_data = res_result.json()
    assert result_data["document_id"] == doc_id
    assert result_data["page_count"] >= 1
    assert result_data["chunk_count"] >= 1
    assert "metadata" in result_data
    assert "Lecanemab" in result_data["metadata"].get("title", "")
    assert len(result_data["summary"]) > 10
    assert len(result_data["citations"]) >= 1
    assert "evidence_quality" in result_data
    assert len(result_data["suggested_questions"]) >= 3
    assert len(result_data["suggested_questions"]) <= 5

    # 4. Ask scoped question
    ask_res = client.post(
        f"/api/dashboard/{doc_id}/ask",
        json={"question": "What primary endpoint and CDR-SB reduction was observed?"},
    )
    assert ask_res.status_code == 200
    ask_data = ask_res.json()
    assert ask_data["document_id"] == doc_id
    assert ask_data["mode"] == "combined"
    assert "CDR-SB" in ask_data["answer"] or "lecanemab" in ask_data["answer"].lower()
    assert len(ask_data["citations"]) >= 1
    assert "conversation_id" in ask_data
    assert "safety_notice" in ask_data

    # Cleanup
    client.delete(f"/api/documents/{doc_id}")

def test_progress_stream_sse():
    # Test that SSE stream returns valid event stream and terminates on ready_for_question
    doc_id = store.add_doc("sse_test.pdf", "/tmp/sse.pdf", f"sse_{uuid.uuid4().hex}")
    store.update_doc(doc_id, status="completed")

    res = client.get(f"/api/dashboard/{doc_id}/progress/stream")
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    assert "event: progress" in res.text
    assert "ready_for_question" in res.text

    # Cleanup
    store.delete_doc(doc_id)
    client.delete(f"/api/chat/conversations/{ask_data['conversation_id']}")

def test_ask_before_ready_returns_409():
    unique_hash = f"fakehash_{uuid.uuid4().hex}"
    doc_id = store.add_doc("test.pdf", "/tmp/fake.pdf", unique_hash)
    store.update_doc(doc_id, status="extracting")

    # Ask before ready -> 409
    res = client.post(f"/api/dashboard/{doc_id}/ask", json={"question": "What is this?"})
    assert res.status_code == 409
    err = res.json()
    assert "error" in err
    assert err["error"]["code"] == "CONFLICT"
    assert "not ready" in err["error"]["message"].lower()

    # Result before ready -> 409
    res_result = client.get(f"/api/dashboard/{doc_id}/result")
    assert res_result.status_code == 409
    err_res = res_result.json()
    assert "error" in err_res
    assert err_res["error"]["code"] == "CONFLICT"

    # Cleanup
    store.delete_doc(doc_id)

def test_non_pdf_rejections():
    # 1. Invalid extension (.txt)
    r1 = client.post(
        "/api/dashboard/analyze",
        files={"file": ("notes.txt", b"%PDF-1.4\nSome text", "text/plain")},
    )
    assert r1.status_code == 400
    assert r1.json()["error"]["code"] == "BAD_REQUEST"
    assert "Only PDF files are accepted" in r1.json()["error"]["message"]

    # 2. PDF extension but missing %PDF magic bytes
    r2 = client.post(
        "/api/dashboard/analyze",
        files={"file": ("fake.pdf", b"NOT A VALID PDF FILE HEADER", "application/pdf")},
    )
    assert r2.status_code == 400
    assert r2.json()["error"]["code"] == "BAD_REQUEST"
    assert "%PDF" in r2.json()["error"]["message"]

def test_oversize_rejection():
    # Temporarily set max_file_mb to 0.001 (1 KB) for test
    old_max = settings.max_file_mb
    try:
        settings.max_file_mb = 1  # 1 MB
        oversize_data = b"%PDF-1.4\n" + b"X" * (1024 * 1024 + 100)
        res = client.post(
            "/api/dashboard/analyze",
            files={"file": ("oversize.pdf", oversize_data, "application/pdf")},
        )
        assert res.status_code == 413
        assert res.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
        assert "exceeds configured size limit" in res.json()["error"]["message"]
    finally:
        settings.max_file_mb = old_max

def test_duplicate_upload():
    pdf = b"%PDF-1.4\nTitle: Duplicate Study\nBody\nTesting duplicate hash detection.\n"

    # First upload
    r1 = client.post(
        "/api/dashboard/analyze",
        files={"file": ("dup_test.pdf", pdf, "application/pdf")},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    doc_id1 = d1["document_id"]
    assert d1["duplicate"] is False

    # Second upload with identical content
    r2 = client.post(
        "/api/dashboard/analyze",
        files={"file": ("dup_test.pdf", pdf, "application/pdf")},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["document_id"] == doc_id1
    assert d2["duplicate"] is True

    # Cleanup
    client.delete(f"/api/documents/{doc_id1}")

def test_batch_upload():
    valid_pdf = b"%PDF-1.4\nTitle: Batch Valid Paper\nBody\nTesting valid batch upload.\n"
    invalid_file = b"Not a pdf"

    res = client.post(
        "/api/documents/upload-batch",
        files=[
            ("files", ("valid.pdf", valid_pdf, "application/pdf")),
            ("files", ("invalid.txt", invalid_file, "text/plain")),
        ],
    )
    assert res.status_code == 200
    batch_data = res.json()
    assert "results" in batch_data
    assert len(batch_data["results"]) == 2

    valid_res = next(r for r in batch_data["results"] if r["filename"] == "valid.pdf")
    assert valid_res["success"] is True
    assert valid_res["document_id"] is not None

    invalid_res = next(r for r in batch_data["results"] if r["filename"] == "invalid.txt")
    assert invalid_res["success"] is False
    assert "Only PDF files are accepted" in invalid_res["error"]

    # Cleanup
    if valid_res["document_id"]:
        client.delete(f"/api/documents/{valid_res['document_id']}")

def test_corrupted_pdf_handling():
    # PDF starts with %PDF magic bytes, but internal structure is binary corrupted with no readable text
    corrupted_pdf = b"%PDF-1.4\n\x00\x80\xff\xfe\xca\xfe\xba\xbe\xde\xad\xbe\xef\x00\x00\x00\x00" + uuid.uuid4().bytes
    res = client.post(
        "/api/dashboard/analyze",
        files={"file": ("corrupt.pdf", corrupted_pdf, "application/pdf")},
    )
    assert res.status_code == 200
    doc_id = res.json()["document_id"]

    prog = wait_for_ready(doc_id)
    assert prog["stage"] == "failed"
    assert prog["percent"] == 0
    assert prog["error"] is not None

    # Querying result for failed doc returns 409 with failure message
    res_result = client.get(f"/api/dashboard/{doc_id}/result")
    assert res_result.status_code == 409
    assert "failed" in res_result.json()["error"]["message"]

    # Cleanup
    client.delete(f"/api/documents/{doc_id}")

def test_progress_stream_sse():
    # Test that SSE stream returns valid event stream and terminates on ready_for_question
    doc_id = store.add_doc("sse_test.pdf", "/tmp/sse.pdf", f"sse_{uuid.uuid4().hex}")
    store.update_doc(doc_id, status="completed")

    res = client.get(f"/api/dashboard/{doc_id}/progress/stream")
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    assert "event: progress" in res.text
    assert "ready_for_question" in res.text

    # Cleanup
    store.delete_doc(doc_id)
