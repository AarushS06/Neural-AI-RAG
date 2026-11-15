import asyncio
import json
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.state import store, index, generator
from app.healthcare import TEMPLATES
from app.schemas import (
    DashboardAnalyzeResponse,
    ProgressResponse,
    DashboardResultResponse,
    DashboardAskRequest,
    DashboardAskResponse,
    DashboardResponse,
)
from app.api.common import (
    doc_json,
    decorate,
    stream_and_validate_pdf,
    get_progress_data,
    compute_quality_report,
    compute_system_status,
    _ingest,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.post("/analyze", response_model=DashboardAnalyzeResponse)
async def analyze_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    template: str = Form(settings.default_template),
    version: str = Form("1"),
    effective_date: str = Form(""),
    supersedes_document_id: str = Form(""),
):
    """
    Dashboard entrypoint: uploads and initiates the automated end-to-end literature pipeline:
    extract -> clean -> chunk -> embed -> index -> combined auto-summary -> suggested questions.
    """
    if template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Unknown knowledge-base template")

    temp_path, file_hash, _ = await stream_and_validate_pdf(file)

    # Check for existing duplicate document
    old = store.find_hash(file_hash)
    if old:
        temp_path.unlink(missing_ok=True)
        prog = get_progress_data(dict(old))
        return DashboardAnalyzeResponse(
            document_id=old["id"],
            stage=prog["stage"],
            percent=prog["percent"],
            duplicate=True,
        )

    safe_filename = Path(file.filename or "document.pdf").name.replace(" ", "_")
    final_dest = settings.upload_dir / f"{uuid.uuid4()}_{safe_filename}"
    temp_path.rename(final_dest)

    doc_id = store.add_doc(
        safe_filename,
        final_dest,
        file_hash,
        template=template,
        version=version,
        effective_date=effective_date or None,
        supersedes_document_id=supersedes_document_id or None,
    )

    background_tasks.add_task(_ingest, doc_id, final_dest, safe_filename)

    return DashboardAnalyzeResponse(
        document_id=doc_id,
        stage="received",
        percent=0,
        duplicate=False,
    )

@router.get("/{document_id}/progress", response_model=ProgressResponse)
def get_progress(document_id: str):
    """Returns the live stage and progress percent for the given document."""
    doc = store.get_doc(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    prog = get_progress_data(dict(doc))
    return ProgressResponse(
        document_id=prog["document_id"],
        stage=prog["stage"],
        percent=prog["percent"],
        status=prog["status"],
        error=prog["error"],
    )

@router.get("/{document_id}/progress/stream")
async def stream_progress(document_id: str):
    """Server-Sent Events (SSE) live progress stream."""
    doc = store.get_doc(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    async def event_generator():
        while True:
            current_doc = store.get_doc(document_id)
            if not current_doc:
                payload = json.dumps({"document_id": document_id, "stage": "failed", "percent": 0, "error": "Document deleted"})
                yield f"event: progress\ndata: {payload}\n\n"
                break

            prog = get_progress_data(dict(current_doc))
            payload = json.dumps(prog)
            yield f"event: progress\ndata: {payload}\n\n"

            if prog["stage"] in ("ready_for_question", "failed"):
                break
            await asyncio.sleep(0.4)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/{document_id}/result", response_model=DashboardResultResponse)
def get_result(document_id: str):
    """
    Returns full analysis result only when document is ready_for_question / completed.
    Returns 409 Conflict if still processing or failed.
    """
    doc = store.get_doc(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    prog = get_progress_data(dict(doc))
    if prog["status"] == "failed":
        raise HTTPException(
            status_code=409,
            detail=f"Document analysis failed: {prog['error'] or 'unknown error'}"
        )

    if prog["stage"] != "ready_for_question":
        raise HTTPException(
            status_code=409,
            detail=f"Document is not ready yet (current stage: {prog['stage']}, {prog['percent']}%). Please wait for completion."
        )

    metadata_obj = {}
    try:
        metadata_obj = json.loads(doc["metadata"] or "{}")
    except Exception:
        pass

    quality_obj = {}
    try:
        quality_obj = json.loads(doc["quality"] or "{}")
    except Exception:
        pass

    phi_obj = {}
    try:
        phi_obj = json.loads(doc["phi_report"] or "{}")
    except Exception:
        pass

    return DashboardResultResponse(
        document_id=doc["id"],
        filename=doc["filename"],
        page_count=metadata_obj.get("pages", 1),
        chunk_count=metadata_obj.get("chunks", 0),
        metadata=metadata_obj.get("metadata", {}),
        summary=metadata_obj.get("summary", ""),
        citations=metadata_obj.get("summary_citations", []),
        evidence_quality=quality_obj,
        phi_report=phi_obj,
        phi_flagged=phi_obj.get("flagged", False),
        suggested_questions=metadata_obj.get("suggested_questions", []),
    )

@router.post("/{document_id}/ask", response_model=DashboardAskResponse)
def ask_question(document_id: str, req: DashboardAskRequest):
    """
    Clinical/literature Q&A strictly scoped to this document using combined mode.
    Returns 409 Conflict if document processing is not yet completed.
    """
    doc = store.get_doc(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    prog = get_progress_data(dict(doc))
    if prog["stage"] != "ready_for_question":
        raise HTTPException(
            status_code=409,
            detail=f"Document is not ready for questions yet (current stage: {prog['stage']}, {prog['percent']}%)."
        )

    cid = req.conversation_id or store.create_conv(req.question[:80])
    _, m = store.conv(cid)
    hist = [dict(a) for a in m]

    results = decorate(index.search(req.question, k=settings.top_k, doc_id=document_id))
    res = generator.answer(req.question, 'combined', results, hist)
    ans = res.answer if hasattr(res, 'answer') else res[0]
    cites = res.citations if hasattr(res, 'citations') else (res[1] if len(res) > 1 else [])
    gen_type = res.generator if hasattr(res, 'generator') else (res[2] if len(res) > 2 else "openai")
    llm_used = res.llm_used if hasattr(res, 'llm_used') else (res[3] if len(res) > 3 else False)
    llm_error = res.llm_error if hasattr(res, 'llm_error') else (res[4] if len(res) > 4 else None)

    store.add_msg(cid, 'user', req.question, 'combined')
    store.add_msg(cid, 'assistant', ans, 'combined', cites)

    return DashboardAskResponse(
        conversation_id=cid,
        document_id=document_id,
        question=req.question,
        answer=ans,
        mode="combined",
        citations=cites,
        generator=gen_type,
        llm_used=llm_used,
        llm_error=llm_error,
        safety_notice="Not medical advice; verify evidence and consult a qualified professional.",
        evidence_quality=[r.get('evidence_quality', {}).get('document_type', 'not available') for r in results] if results else [],
        retrieval={
            "returned_passages": len(results),
            "dense_enabled": True,
            "sparse_enabled": True,
            "fusion": "RRF",
        },
        insufficient_evidence=not results,
    )

@router.get("", response_model=DashboardResponse)
def get_dashboard():
    """
    Consolidated single-request dashboard overview:
    totals, latest 10 documents, current processing queue, quality summary, and system status.
    """
    docs = store.list_docs()
    convs = store.conversations()

    # Totals
    total_docs = len(docs)
    total_chunks = len(index.items)
    total_convs = len(convs)

    # Recent documents (latest 10)
    recent = []
    for d in docs[:10]:
        dj = doc_json(d)
        if not dj:
            continue
        prog = get_progress_data(dict(d))
        recent.append({
            "id": dj["id"],
            "filename": dj["filename"],
            "status": dj["status"],
            "stage": prog["stage"],
            "template": dj.get("template"),
            "version": dj.get("version"),
            "evidence_quality": dj.get("quality", {}),
            "phi_flagged": dj.get("phi_report", {}).get("flagged", False),
            "uploaded_at": dj.get("created_at"),
            "page_count": dj.get("metadata", {}).get("pages", 0),
            "chunk_count": dj.get("metadata", {}).get("chunks", 0),
        })

    # Processing queue
    queue = []
    for d in docs:
        status = (d["status"] or "").lower()
        if status in ("received", "extracting", "chunking", "embedding", "analysing", "analyzing"):
            prog = get_progress_data(dict(d))
            queue.append({
                "id": d["id"],
                "filename": d["filename"],
                "stage": prog["stage"],
                "percent": prog["percent"],
                "status": d["status"],
                "uploaded_at": d["created_at"],
            })

    quality_summary = compute_quality_report()
    system_status = compute_system_status()

    return DashboardResponse(
        totals={
            "documents": total_docs,
            "chunks": total_chunks,
            "conversations": total_convs,
        },
        recent_documents=recent,
        processing_queue=queue,
        quality_summary=quality_summary,
        system_status=system_status,
    )
