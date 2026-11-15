import json
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.state import store, index
from app.healthcare import TEMPLATES, redact_preview
from app.schemas import BatchUploadResponse, BatchUploadItemResult, ProgressResponse
from app.api.common import (
    doc_json,
    stream_and_validate_pdf,
    get_progress_data,
    _ingest,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    template: str = Form(settings.default_template),
    version: str = Form("1"),
    effective_date: str = Form(""),
    supersedes_document_id: str = Form(""),
):
    if template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Unknown knowledge-base template")

    temp_path, file_hash, _ = await stream_and_validate_pdf(file)

    old = store.find_hash(file_hash)
    if old:
        if old['status'] == 'completed':
            temp_path.unlink(missing_ok=True)
            return {"document": doc_json(old), "duplicate": True}
        else:
            store.delete_doc(old['id'])

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
    return {"document": doc_json(store.get_doc(doc_id)), "duplicate": False}

@router.post("/upload-batch", response_model=BatchUploadResponse)
async def upload_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    template: str = Form(settings.default_template),
    version: str = Form("1"),
):
    """Batch upload of multiple research PDFs."""
    if template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Unknown knowledge-base template")

    results: List[BatchUploadItemResult] = []

    for f in files:
        fname = f.filename or "file.pdf"
        try:
            temp_path, file_hash, _ = await stream_and_validate_pdf(f)

            old = store.find_hash(file_hash)
            if old:
                temp_path.unlink(missing_ok=True)
                results.append(
                    BatchUploadItemResult(
                        filename=fname,
                        success=True,
                        document_id=old["id"],
                        stage=old["status"],
                        duplicate=True,
                        document=doc_json(old),
                    )
                )
                continue

            safe_filename = Path(fname).name.replace(" ", "_")
            final_dest = settings.upload_dir / f"{uuid.uuid4()}_{safe_filename}"
            temp_path.rename(final_dest)

            doc_id = store.add_doc(
                safe_filename,
                final_dest,
                file_hash,
                template=template,
                version=version,
            )

            background_tasks.add_task(_ingest, doc_id, final_dest, safe_filename)
            results.append(
                BatchUploadItemResult(
                    filename=fname,
                    success=True,
                    document_id=doc_id,
                    stage="received",
                    duplicate=False,
                    document=doc_json(store.get_doc(doc_id)),
                )
            )
        except HTTPException as exc:
            results.append(
                BatchUploadItemResult(
                    filename=fname,
                    success=False,
                    error=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                )
            )
        except Exception as exc:
            results.append(
                BatchUploadItemResult(
                    filename=fname,
                    success=False,
                    error=str(exc),
                )
            )

    return BatchUploadResponse(results=results)

@router.get("")
def list_documents():
    return {"documents": [doc_json(x) for x in store.list_docs()]}

@router.get("/{document_id}")
def get_document(document_id: str):
    x = store.get_doc(document_id)
    if not x:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc_json(x)

@router.get("/{document_id}/status")
def get_document_status(document_id: str):
    return get_document(document_id)

@router.get("/{document_id}/progress", response_model=ProgressResponse)
def get_document_progress(document_id: str):
    x = store.get_doc(document_id)
    if not x:
        raise HTTPException(status_code=404, detail="Document not found")
    prog = get_progress_data(dict(x))
    return ProgressResponse(
        document_id=prog["document_id"],
        stage=prog["stage"],
        percent=prog["percent"],
        status=prog["status"],
        error=prog["error"],
    )

@router.get("/{document_id}/versions")
def get_document_versions(document_id: str):
    if not store.get_doc(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"versions": [doc_json(x) for x in store.versions(document_id)]}

@router.get("/{document_id}/preview")
def get_document_preview(document_id: str):
    x = store.get_doc(document_id)
    if not x:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        pages = json.loads(x["extracted"] or "[]")
    except Exception:
        pages = []
    text = "\n".join(p.get("text", "") for p in pages)
    return {
        "document_id": document_id,
        "redacted": True,
        "warning": "Safe preview only; deterministic screening is not a guarantee of de-identification. Original is unchanged.",
        "preview": redact_preview(text),
    }

@router.post("/{document_id}/reprocess")
def reprocess_document(document_id: str, bg: BackgroundTasks):
    x = store.get_doc(document_id)
    if not x:
        raise HTTPException(status_code=404, detail="Document not found")
    index.remove_doc(document_id)
    store.update_doc(document_id, status="received", error="")
    bg.add_task(_ingest, document_id, x["stored_path"], x["filename"])
    return doc_json(store.get_doc(document_id))

@router.delete("/{document_id}")
def delete_document(document_id: str):
    x = store.get_doc(document_id)
    if not x:
        raise HTTPException(status_code=404, detail="Document not found")
    index.remove_doc(document_id)
    try:
        Path(x["stored_path"]).unlink(missing_ok=True)
    except Exception:
        pass
    store.delete_doc(document_id)
    return {"deleted": document_id}
