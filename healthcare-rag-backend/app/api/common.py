import hashlib
import json
import uuid
from pathlib import Path
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile
from app.core.config import settings
from app.core.state import store, index, generator
from app.healthcare import TEMPLATES
from app.ingestion.pipeline import process

CHUNK_STREAM_SIZE = 64 * 1024  # 64 KB

def doc_json(r) -> Optional[dict]:
    if not r:
        return None
    d = dict(r)
    for k in ('metadata', 'extracted', 'phi_report', 'quality'):
        try:
            d[k] = json.loads(d[k] or '{}')
        except Exception:
            pass
    d.pop('stored_path', None)
    d.pop('file_hash', None)
    return d

def decorate(results: list[dict], template: Optional[str] = None) -> list[dict]:
    out = []
    for r in results:
        d = dict(r)
        doc = store.get_doc(d['document_id'])
        if doc:
            d['template'] = doc['template']
            d['version'] = doc['version']
            try:
                d['evidence_quality'] = json.loads(doc['quality'] or '{}')
            except Exception:
                d['evidence_quality'] = {}
            try:
                d['phi_flagged'] = json.loads(doc['phi_report'] or '{}').get('flagged', False)
            except Exception:
                d['phi_flagged'] = False
            if template and d['template'] != template:
                continue
        out.append(d)
    return out

def get_progress_data(doc: dict) -> dict:
    status = (doc.get("status") or "received").lower()
    error = doc.get("error") or None

    stage_map = {
        "received": (0, "received"),
        "extracting": (20, "extracting"),
        "chunking": (40, "chunking"),
        "embedding": (60, "embedding"),
        "analysing": (80, "analysing"),
        "analyzing": (80, "analysing"),
        "completed": (100, "ready_for_question"),
        "ready_for_question": (100, "ready_for_question"),
        "failed": (0, "failed"),
    }
    percent, stage = stage_map.get(status, (0, status))
    return {
        "document_id": doc.get("id", ""),
        "stage": stage,
        "percent": percent,
        "status": status,
        "error": error,
    }

async def stream_and_validate_pdf(file: UploadFile) -> Tuple[Path, str, int]:
    """
    Validates file extension and streams content to a temporary file on disk.
    Computes SHA-256 and verifies %PDF magic bytes and size limit on the fly.
    Raises HTTPException(400, 413, or 415) on invalid files.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Filename must end with .pdf extension."
        )

    max_bytes = settings.max_file_mb * 1024 * 1024
    total_bytes = 0
    hasher = hashlib.sha256()
    header_bytes = b""

    temp_path = settings.upload_dir / f"tmp_{uuid.uuid4()}.pdf"
    try:
        with open(temp_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_STREAM_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds configured size limit of {settings.max_file_mb} MB"
                    )
                if len(header_bytes) < 4:
                    header_bytes += chunk[:4 - len(header_bytes)]
                hasher.update(chunk)
                f.write(chunk)

        if not header_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF signature: file header must start with %PDF magic bytes."
            )

        return temp_path, hasher.hexdigest(), total_bytes
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise

def _ingest(did: str, path: str | Path, filename: str):
    try:
        process(path, did, filename, settings, store, index, generator)
    except Exception as e:
        store.update_doc(did, status='failed', error=str(e))

def compute_quality_report():
    docs = store.list_docs()
    metas = []
    phis = []
    for d in docs:
        try:
            metas.append(json.loads(d['metadata'] or '{}'))
        except Exception:
            metas.append({})
        try:
            phis.append(json.loads(d['phi_report'] or '{}'))
        except Exception:
            phis.append({})

    missing = sum(
        1 for m in metas
        if any(m.get('metadata', {}).get(k, 'not available') == 'not available' for k in ('title', 'authors', 'year'))
    )
    stale = 0
    for d in docs:
        try:
            if json.loads(d['quality'] or '{}').get('recency_label') == 'stale':
                stale += 1
        except Exception:
            pass

    hashes = [d['file_hash'] for d in docs if d['file_hash']]
    duplicate_count = len(hashes) - len(set(hashes)) if hashes else 0

    ocr_warnings = 0
    for d in docs:
        try:
            if not json.loads(d['extracted'] or '[]'):
                ocr_warnings += 1
        except Exception:
            ocr_warnings += 1

    phi_count = sum(1 for p in phis if p.get('flagged'))

    return {
        'document_count': len(docs),
        'chunk_count': len(index.items),
        'missing_metadata_documents': missing,
        'duplicate_count': duplicate_count,
        'ocr_extraction_warnings': ocr_warnings,
        'phi_flagged_documents': phi_count,
        'stale_or_expired_documents': stale,
        'template_distribution': {k: sum(1 for d in docs if d['template'] == k) for k in TEMPLATES},
        'index_config': {
            'embedding_model': settings.embedding_model,
            'top_k': settings.top_k,
            'chunk_size': settings.chunk_size,
            'chunk_overlap': settings.chunk_overlap,
            'reranker_enabled': settings.reranker_enabled,
            'templates': list(TEMPLATES),
        },
    }

def compute_system_status():
    return {
        'status': 'ok',
        'storage': 'sqlite',
        'vector_index': 'local-numpy',
        'embedding_model': settings.embedding_model,
        'embedding_dimension': index.dim,
        'llm_provider': settings.llm_provider,
        'llm_model': settings.llm_model,
        'llm_configured': settings.llm_configured,
        'qdrant_configured': bool(settings.qdrant_url),
        'reranker_enabled': settings.reranker_enabled,
        'document_count': len(store.list_docs()),
        'chunk_count': len(index.items),
    }
