import uuid
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app, store, index, settings, generator

client = TestClient(app)

def test_chat_generator_modes_mocked_openai():
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = (
        "Lecanemab demonstrates moderate slowing of cognitive decline in early Alzheimer's disease [C1]. "
        "Amyloid plaque burden is reduced significantly compared to placebo [C2]. "
        "Overall clinical takeaway: therapeutic monitoring is advised."
    )
    mock_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    # Seed an index chunk so retrieval produces results
    chunk_id = f"test-chunk-{uuid.uuid4().hex[:6]}"
    doc_id = f"doc-{uuid.uuid4().hex[:6]}"
    index.add([{
        "chunk_id": chunk_id,
        "document_id": doc_id,
        "source": "Lecanemab_Trial.pdf",
        "content": "Lecanemab reduced brain amyloid and cognitive decline in clinical trials.",
        "page_start": 1,
        "page_end": 1,
        "section": "Results",
        "content_type": "paragraph",
    }])

    # 1. Test combined mode with mocked OpenAI
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res = client.post(
            "/api/chat",
            json={"question": "How does lecanemab affect decline?", "mode": "combined"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "combined"
        assert data["generator"].startswith("openai")
        assert data["llm_used"] is True
        assert data["llm_error"] is None
        assert "[C1]" in data["answer"]
        assert "Not medical advice" in data["answer"]

        # Verify that combined mode sent retrieved passages in user prompt
        call_args = mock_client.chat.completions.create.call_args
        messages = call_args[1]["messages"]
        system_msg = next(m["content"] for m in messages if m["role"] == "system")
        assert "blends the provided research paper evidence with general medical knowledge" in system_msg
        user_msg = next(m["content"] for m in messages if m["role"] == "user")
        assert "Retrieved Passages:" in user_msg
        assert "[C1]" in user_msg

    # 2. Test RAG strict mode with mocked OpenAI
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_rag = client.post(
            "/api/chat",
            json={"question": "What were the primary endpoints?", "mode": "rag"},
        )
        assert res_rag.status_code == 200
        data_rag = res_rag.json()
        assert data_rag["mode"] == "rag"
        assert data_rag["generator"].startswith("openai")
        assert data_rag["llm_used"] is True
        assert data_rag["llm_error"] is None

        # Verify strict RAG system prompt forbids outside knowledge
        call_args_rag = mock_client.chat.completions.create.call_args
        messages_rag = call_args_rag[1]["messages"]
        system_rag = next(m["content"] for m in messages_rag if m["role"] == "system")
        assert "DO NOT use any outside medical knowledge" in system_rag
        assert "introductory summary sentence" in system_rag

    # 3. Test knowledge mode with mocked OpenAI
    mock_choice.message.content = "Alzheimer's disease is a neurodegenerative disorder characterized by amyloid plaques."
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_know = client.post(
            "/api/chat",
            json={"question": "What is Alzheimer's disease?", "mode": "knowledge"},
        )
        assert res_know.status_code == 200
        data_know = res_know.json()
        assert data_know["mode"] == "knowledge"
        assert data_know["llm_used"] is True
        assert len(data_know["citations"]) == 0

def test_chat_fallback_when_no_key():
    # Simulate missing API key
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(None, "missing api key: OPENAI_API_KEY is not set")):
        res = client.post(
            "/api/chat",
            json={"question": "What reduces inflammation?", "mode": "rag"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["generator"] == "extractive-fallback"
        assert data["llm_used"] is False
        assert "missing api key" in data["llm_error"]
        assert "Not medical advice" in data["answer"]

def test_chat_fallback_when_api_call_fails():
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("401 Unauthorized: Invalid API key")

    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res = client.post(
            "/api/chat",
            json={"question": "What is the therapy for hypertension?", "mode": "combined"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["generator"] == "extractive-fallback"
        assert data["llm_used"] is False
        assert "401" in data["llm_error"]
        assert "Not medical advice" in data["answer"]

def test_citation_validation_strips_invalid_citations():
    # Mock LLM returning an invalid citation like [C99] when only C1 exists
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Valid evidence [C1] but invalid hallucinated citation [C99]."
    mock_response.choices = [mock_choice]
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    dummy_results = [{
        "chunk_id": "test-c1",
        "document_id": "doc-1",
        "source": "study.pdf",
        "content": "Aspirin reduces inflammation.",
        "page_start": 1,
        "section": "Body",
    }]

    with patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        ans, cites, gen_type, llm_used, llm_error = generator.answer("test query", "rag", dummy_results)
        assert "[C1]" in ans
        assert "[C99]" not in ans  # [C99] must be stripped!
        assert llm_used is True
        assert llm_error is None

def test_llm_health_and_system_status():
    # 1. When not configured / no key
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(None, "missing api key")):
        res = client.get("/api/llm/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "error"
        assert "missing api key" in data["error"]

    # 2. When mocked client ping succeeds
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock()
    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)):
        res_ok = client.get("/api/llm/health")
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "ok"
        assert res_ok.json()["provider"] == "openai"

    # 3. System status and config endpoints have llm_provider, llm_model, llm_configured
    status_res = client.get("/api/system/status")
    assert status_res.status_code == 200
    st = status_res.json()
    assert "llm_provider" in st
    assert "llm_model" in st
    assert "llm_configured" in st

    config_res = client.get("/api/rag/config")
    assert config_res.status_code == 200
    cfg = config_res.json()
    assert "llm_provider" in cfg
    assert "llm_model" in cfg
    assert "llm_configured" in cfg

def test_web_search_merge_and_deduplication():
    # Mock Europe PMC and Semantic Scholar responses
    mock_epmc = [
        {"id": "epmc-1", "title": "Immunotherapy for Alzheimer Disease", "doi": "10.1000/1", "source": "europe_pmc", "relevance_score": 0.95, "authors": "Smith et al.", "year": "2023", "abstract": "Study on immunotherapy."},
        {"id": "epmc-2", "title": "Cognitive Decline Biomarkers", "doi": "10.1000/2", "source": "europe_pmc", "relevance_score": 0.90, "authors": "Doe et al.", "year": "2022", "abstract": "Biomarker analysis."},
    ]
    mock_s2 = [
        {"id": "s2-1", "title": "Immunotherapy for Alzheimer Disease", "doi": "10.1000/1", "source": "semantic_scholar", "relevance_score": 0.94, "authors": "Smith et al.", "year": "2023", "abstract": "Duplicate paper."},
        {"id": "s2-2", "title": "Novel Tau Therapies", "doi": "10.1000/3", "source": "semantic_scholar", "relevance_score": 0.88, "authors": "Johnson et al.", "year": "2024", "abstract": "Tau therapies."},
    ]

    from app.core.state import web_search_client
    with patch.object(web_search_client, "search_europe_pmc", return_value=mock_epmc), \
         patch.object(web_search_client, "search_semantic_scholar", return_value=mock_s2), \
         patch.object(web_search_client, "search_pubmed", return_value=[]), \
         patch.object(web_search_client, "search_google", return_value=[]):

        res = client.post("/api/search", json={"query": "Alzheimer immunotherapy", "scope": "web"})
        assert res.status_code == 200
        data = res.json()
        assert "web_results" in data
        assert len(data["web_results"]) == 3  # 1 duplicate by DOI (10.1000/1) deduplicated!
        titles = [r["title"] for r in data["web_results"]]
        assert titles.count("Immunotherapy for Alzheimer Disease") == 1

def test_search_import_paper():
    import_payload = {
        "items": [
            {
                "title": f"Web Study on Tau Pathology {uuid.uuid4().hex[:6]}",
                "abstract": "Tau protein aggregates were assessed in cerebrospinal fluid of patients.",
                "url": "https://example.org/study-tau",
                "doi": "10.1056/tau-study",
            }
        ],
        "template": "research_papers",
    }

    res = client.post("/api/search/import", json=import_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["imported_count"] == 1
    doc_id = data["results"][0]["document_id"]
    assert doc_id is not None

    # Verify document exists in documents list
    doc_res = client.get(f"/api/documents/{doc_id}")
    assert doc_res.status_code == 200
    assert "Tau_Pathology" in doc_res.json()["filename"]

    # Cleanup
    client.delete(f"/api/documents/{doc_id}")

def test_compare_endpoint_validation():
    # Fewer than 2 document IDs should return 400 Bad Request
    res_zero = client.post("/api/compare", json={"document_ids": []})
    assert res_zero.status_code == 422 or res_zero.status_code == 400

    res_one = client.post("/api/compare", json={"document_ids": ["single-doc"]})
    assert res_one.status_code == 400
    assert "at least 2" in res_one.json()["error"]["message"].lower()

def test_quality_report_handles_empty_db():
    # Quality report should return real numbers without errors
    res = client.get("/api/knowledge-bases/quality-report")
    assert res.status_code == 200
    q = res.json()
    assert isinstance(q["document_count"], int)
    assert isinstance(q["chunk_count"], int)
    assert isinstance(q["missing_metadata_documents"], int)
    assert isinstance(q["duplicate_count"], int)
    assert isinstance(q["template_distribution"], dict)
    assert "research_papers" in q["template_distribution"]

def test_chat_empty_and_whitespace_validation():
    # Empty string or whitespace-only should return 400/422
    res_empty = client.post("/api/chat", json={"question": "", "mode": "knowledge"})
    assert res_empty.status_code in (400, 422)

    res_ws = client.post("/api/chat", json={"question": "    ", "mode": "knowledge"})
    assert res_ws.status_code == 400
    assert "empty" in res_ws.json()["detail"].lower()

def test_chat_rate_limiting():
    from app.api.chat import ChatRateLimiter
    limiter = ChatRateLimiter(max_requests=3, window_seconds=10.0)
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("1.2.3.4")
    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail

def test_openai_retry_and_backoff_on_429():
    mock_client = MagicMock()
    # First call raises 429 rate limit, second call succeeds
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = "Answer after rate limit retry."

    mock_client.chat.completions.create.side_effect = [
        Exception("Rate limit reached for requests (429)"),
        mock_resp,
    ]

    with patch.object(settings, "llm_provider", "openai"), \
         patch.object(generator, "_get_openai_client", return_value=(mock_client, None)), \
         patch("time.sleep", return_value=None):  # Don't delay the test
        res = generator.answer("What is clinical evidence?", "knowledge", [])
        assert res.llm_used is True
        assert "Answer after rate limit retry" in res.answer
        assert mock_client.chat.completions.create.call_count == 2
