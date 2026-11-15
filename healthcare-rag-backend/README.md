# Healthcare Research RAG Backend

A modular FastAPI evidence-first literature assistant. It supports PDF upload, asynchronous ingestion, PyMuPDF extraction (with a documented Docling extension point), cleaning, section-aware page-preserving chunking, deterministic NumPy embeddings, persisted dense+sparse hybrid retrieval with reciprocal-rank fusion, automated combined-mode paper synthesis, evidence quality auditing, PHI screening, and an integrated **one-stop dashboard workflow**.

This is research-literature exploration software, not a diagnostic, treatment, emergency, or clinically validated service. Do not upload personal health information without a separate privacy and security design.

## Run locally
```bash
cd healthcare-rag-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
# Swagger docs: http://127.0.0.1:8000/docs
pytest -q
```

The default configuration requires no external services: SQLite stores document metadata and chat histories, `data/index.npz` stores local vectors/chunks, and deterministic generation provides safe offline responses. Set `LLM_PROVIDER=openai_compatible`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` to connect an external model; set `QDRANT_URL` to route embeddings to a vector database.

---

## The Guided Dashboard Flow

The backend powers a single, guided dashboard flow:
1. **User drops a PDF** on the dashboard (`POST /api/dashboard/analyze`).
2. **Backend runs the ingestion pipeline** asynchronously:
   - `received` (0%) -> `extracting` (20%) -> `chunking` (40%) -> `embedding` (60%) -> `analysing` (80%) -> `ready_for_question` (100%).
3. **Automated Synthesis**: When embedding completes, backend automatically runs combined-mode RAG to generate an **evidence-backed summary**, extracts **clinical PICO metadata**, calculates **evidence-quality scores**, audits for **PHI flags**, and produces **3-5 suggested questions**.
4. **Interactive Q&A**: Once ready, the dashboard prompts the user to inquire. Queries are answered via `POST /api/dashboard/{document_id}/ask` scoped directly to the uploaded paper.

---

## Dashboard API Endpoints

### 1. `POST /api/dashboard/analyze`
Starts the automated ingestion pipeline for an uploaded PDF.
- **Request**: Multipart form data with `file` (PDF only, max 25 MB), optional `template`, `version`.
- **Response**:
```json
{
  "document_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4",
  "stage": "received",
  "percent": 0,
  "duplicate": false
}
```
*Note: If the PDF was previously uploaded (identical SHA-256 hash), it returns the existing document with `"duplicate": true` and its current stage.*

### 2. `GET /api/dashboard/{document_id}/progress`
Returns current processing stage and completion percentage.
- **Response**:
```json
{
  "document_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4",
  "stage": "ready_for_question",
  "percent": 100,
  "status": "completed",
  "error": null
}
```
*SSE stream also available at `GET /api/dashboard/{document_id}/progress/stream`.*

### 3. `GET /api/dashboard/{document_id}/result`
Returns consolidated analysis. Only available when the document is ready (`stage: ready_for_question`). Returns **409 Conflict** if still processing.
- **Response**:
```json
{
  "document_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4",
  "filename": "lecanemab_trial.pdf",
  "page_count": 12,
  "chunk_count": 28,
  "metadata": {
    "title": "Randomized Trial of Lecanemab in Early Alzheimer Disease",
    "authors": "Christopher H. van Dyck, Chad J. Swanson, Paul Aisen",
    "year": "2023",
    "doi": "10.1056/NEJMoa2212948",
    "pmid": "36449413",
    "journal": "New England Journal of Medicine",
    "study_type": "randomized controlled trial",
    "population": "Early Alzheimer's disease persons 50 to 90 years of age",
    "intervention": "Lecanemab 10 mg/kg biweekly",
    "comparator": "Placebo",
    "outcomes": "Change from baseline in CDR-SB score at 18 months"
  },
  "summary": "Combined answer: Lecanemab, an IgG1 monoclonal antibody targeting amyloid-beta soluble protofibrils, resulted in moderately less clinical decline on the CDR-SB compared to placebo at 18 months in early Alzheimer's disease.",
  "citations": [
    {
      "citation_id": "C1",
      "document_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4",
      "title": "lecanemab_trial.pdf",
      "section": "Results",
      "page": 5,
      "chunk_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4-0012",
      "evidence": "Lecanemab reduced brain amyloid levels and resulted in less clinical decline on the CDR-SB than placebo at 18 months.",
      "evidence_quality": {
        "study_type": "randomized controlled trial",
        "review_label": "moderate",
        "document_type": "primary_study",
        "recency_label": "recent",
        "source_quality": "identified"
      }
    }
  ],
  "evidence_quality": {
    "study_type": "randomized controlled trial",
    "review_label": "moderate",
    "document_type": "primary_study",
    "recency_label": "recent",
    "source_quality": "identified"
  },
  "phi_report": {
    "flagged": false,
    "count": 0,
    "types": []
  },
  "phi_flagged": false,
  "suggested_questions": [
    "What are the primary clinical objectives and findings of 'Randomized Trial of Lecanemab in Early Alzheimer Disease'?",
    "What was the methodology and efficacy of Lecanemab 10 mg/kg biweekly?",
    "What patient population was included in this study?",
    "What quantitative outcomes (CDR-SB reduction) were reported?",
    "What study limitations, potential biases, or adverse events were reported by the authors?"
  ]
}
```

### 4. `POST /api/dashboard/{document_id}/ask`
Asks a clinical/literature question strictly scoped to the document in `combined` mode. Returns **409 Conflict** if the document is not ready yet.
- **Request**:
```json
{
  "question": "What primary outcome differences were observed at 18 months?",
  "conversation_id": null
}
```
- **Response**:
```json
{
  "conversation_id": "7b0d91d4-8392-4f1e-bc93-5477ba6190ec",
  "document_id": "c1f7b8a2-7104-4e89-b883-92f7d3e210a4",
  "question": "What primary outcome differences were observed at 18 months?",
  "answer": "Combined answer: The following statements are supported by indexed passages; general background may be incomplete or outdated.\n\n[C1] Lecanemab reduced brain amyloid levels and resulted in less clinical decline on the CDR-SB than placebo at 18 months (-0.45 difference, P<0.001).\n\nNot medical advice. Heuristics and retrieved text are not clinical validation; verify current authoritative sources and consult a qualified professional.",
  "mode": "combined",
  "citations": [ ... ],
  "safety_notice": "Not medical advice; verify evidence and consult a qualified professional.",
  "retrieval": {
    "returned_passages": 3,
    "dense_enabled": true,
    "sparse_enabled": true,
    "fusion": "RRF"
  },
  "insufficient_evidence": false
}
```

### 5. `GET /api/dashboard`
Returns single-payload consolidated metrics: totals, recent documents (with status and stage), active processing queue, quality summary, and system status.

---

## Additional Endpoints

- `POST /api/documents/upload-batch`: Upload multiple PDF papers in a single request.
- `POST /api/documents/upload`: Standard multipart PDF ingestion.
- `GET /api/documents`: List all ingested documents.
- `GET /api/documents/{id}/preview`: Safe deterministic redacted text preview.
- `POST /api/chat`: Multi-turn conversational RAG (`knowledge`, `rag`, or `combined` mode).
- `POST /api/search` & `POST /api/rag/retrieve`: Hybrid dense+sparse retrieval.
- `POST /api/compare`: Token overlap and claim analysis between multiple papers.
- `GET /api/knowledge-bases/quality-report`: Knowledge base integrity, freshness, and PHI audit report.

---

## End-to-End Walkthrough with `curl`

```bash
# 1. Upload a research PDF to the dashboard flow
curl -X POST http://127.0.0.1:8000/api/dashboard/analyze \
  -F "file=@trial_paper.pdf" \
  -F "template=research_papers"
# Output: {"document_id": "DOC_ID", "stage": "received", "percent": 0, "duplicate": false}

# 2. Poll progress until stage is ready_for_question (or listen via SSE)
curl http://127.0.0.1:8000/api/dashboard/DOC_ID/progress
# Output: {"document_id": "DOC_ID", "stage": "ready_for_question", "percent": 100, ...}

# 3. Retrieve automated summary, PICO metadata, and suggested questions
curl http://127.0.0.1:8000/api/dashboard/DOC_ID/result

# 4. Inquire about specific findings in the paper
curl -X POST http://127.0.0.1:8000/api/dashboard/DOC_ID/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What primary outcome differences were observed?"}'
```
