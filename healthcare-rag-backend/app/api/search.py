import re
import uuid
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.core.config import settings
from app.core.state import store, index, web_search_client
from app.schemas import SearchRequest, SearchResponse, ImportPaperRequest, ImportPaperResponse, ImportPaperResult
from app.api.common import decorate, _ingest

router = APIRouter(tags=["search"])

@router.post("/api/search", response_model=SearchResponse)
async def search_endpoint(req: SearchRequest):
    """
    Hybrid Search:
    - scope 'local': queries the local NumPy vector index with RRF fusion.
    - scope 'web': queries online biomedical sources (Google CSE, Europe PMC, Semantic Scholar, PubMed).
    - scope 'both' (default): returns both local indexed passages and web literature results.
    """
    local_results: List[Dict[str, Any]] = []
    web_results: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # 1. Local Search (if scope is local or both)
    if req.scope in ('local', 'both'):
        raw_local = index.search(req.query, req.top_k, req.document_id)
        local_results = decorate(raw_local, req.template)

    # 2. Web Search (if scope is web or both)
    if req.scope in ('web', 'both'):
        try:
            w_res, w_warn = await web_search_client.search_all(req.query, top_k=req.top_k)
            web_results = w_res
            warnings.extend(w_warn)
        except Exception as e:
            warnings.append(f"Web search error: {str(e)}")

    retrieval_meta = {
        "dense_enabled": req.scope != "web",
        "sparse_enabled": req.scope != "web",
        "fusion": "RRF",
        "heuristic_quality_labels": True,
        "scope": req.scope,
    }

    return SearchResponse(
        results=local_results,
        retrieval=retrieval_meta,
        web_results=web_results,
        warnings=warnings,
    )

@router.post("/api/rag/retrieve", response_model=SearchResponse)
async def retrieve_endpoint(req: SearchRequest):
    """Alias for search endpoint maintaining backwards compatibility."""
    return await search_endpoint(req)

@router.post("/api/search/import", response_model=ImportPaperResponse)
async def import_search_results(req: ImportPaperRequest, background_tasks: BackgroundTasks):
    """
    Imports open-access web literature into the local RAG knowledge base.
    Downloads open-access PDFs if available, or ingests title + abstract as synthetic text.
    Runs chunking, embedding, and indexing. Tags source='web'.
    """
    items_to_import = []

    # If items provided directly
    if req.items:
        items_to_import.extend([it.model_dump() for it in req.items])

    # If URLs provided
    if req.urls:
        for u in req.urls:
            items_to_import.append({"url": u, "title": f"Web Paper {u[:35]}", "abstract": ""})

    if not items_to_import:
        raise HTTPException(status_code=400, detail="No papers or URLs provided for import.")

    results: List[ImportPaperResult] = []

    for item in items_to_import:
        title = item.get("title") or "Imported Web Paper"
        pdf_url = item.get("open_access_pdf_url")
        url = item.get("url") or ""
        doi = item.get("doi") or ""
        abstract = item.get("abstract") or ""

        pdf_downloaded = False
        file_bytes = b""

        # Try to download PDF if open access URL exists
        if pdf_url and pdf_url.startswith("http"):
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    resp = await client.get(pdf_url)
                    if resp.status_code == 200 and resp.content.startswith(b"%PDF"):
                        file_bytes = resp.content
                        pdf_downloaded = True
            except Exception:
                pdf_downloaded = False

        # If no valid PDF downloaded, create synthetic text paper
        if not pdf_downloaded:
            synthetic_text = (
                f"%PDF-1.4\n"
                f"Title: {title}\n"
                f"DOI: {doi}\n"
                f"Source URL: {url}\n"
                f"Template: {req.template}\n\n"
                f"Abstract\n{abstract or 'Abstract not provided.'}\n\n"
                f"Summary\nThis paper was imported from external biomedical search ({url or doi})."
            )
            file_bytes = synthetic_text.encode("utf-8")

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        old = store.find_hash(file_hash)
        if old:
            results.append(
                ImportPaperResult(
                    title=title,
                    document_id=old["id"],
                    success=True,
                    source_type="pdf" if pdf_downloaded else "text",
                    error="Already indexed in knowledge base",
                )
            )
            continue

        safe_title = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', title[:40])
        final_dest = settings.upload_dir / f"web_{uuid.uuid4()}_{safe_title}.pdf"
        final_dest.write_bytes(file_bytes)

        doc_id = store.add_doc(
            f"{safe_title}.pdf",
            final_dest,
            file_hash,
            meta={"url": url, "doi": doi, "imported_from": "web_search", "abstract": abstract},
            template=req.template or "research_papers",
            version="1",
        )

        background_tasks.add_task(_ingest, doc_id, final_dest, f"{safe_title}.pdf")
        results.append(
            ImportPaperResult(
                title=title,
                document_id=doc_id,
                success=True,
                source_type="pdf" if pdf_downloaded else "text",
            )
        )

    return ImportPaperResponse(
        imported_count=sum(1 for r in results if r.success),
        results=results,
    )
