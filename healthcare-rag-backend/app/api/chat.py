import json
import re
import time
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse

from app.core.config import settings
from app.core.state import store, index, generator
from app.schemas import ChatRequest, ChatResponse, CompareRequest
from app.api.common import doc_json, decorate

router = APIRouter(tags=["chat"])

class ChatRateLimiter:
    """Sliding-window rate limiter per client IP address."""
    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._ip_history = defaultdict(list)

    def check(self, ip: str):
        now = time.time()
        cutoff = now - self.window_seconds
        self._ip_history[ip] = [t for t in self._ip_history[ip] if t > cutoff]
        if len(self._ip_history[ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded: maximum 60 requests per minute. Please wait a moment before sending more messages."
            )
        self._ip_history[ip].append(now)

chat_rate_limiter = ChatRateLimiter(max_requests=60, window_seconds=60.0)

def sanitize_question(raw_question: str) -> str:
    """Validates and sanitizes user input."""
    if raw_question is None:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty or contain only whitespace."
        )
    # Strip null bytes and non-printable control characters except whitespace/newlines
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', raw_question).strip()
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty or contain only whitespace."
        )
    if len(cleaned) > 4000:
        raise HTTPException(
            status_code=400,
            detail="Question exceeds maximum allowed length of 4000 characters."
        )
    return cleaned

@router.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    chat_rate_limiter.check(client_ip)

    question = sanitize_question(req.question)
    req.question = question

    cid = req.conversation_id or store.create_conv(question[:80])
    _, m = store.conv(cid)
    hist = [dict(a) for a in m]
    results = [] if req.mode == 'knowledge' else decorate(index.search(question, req.top_k, req.document_id), req.template)
    res = generator.answer(question, req.mode, results, hist)
    ans = res.answer
    cites = res.citations
    gen_type = res.generator
    llm_used = res.llm_used
    llm_error = res.llm_error

    store.add_msg(cid, 'user', question, req.mode)
    store.add_msg(cid, 'assistant', ans, req.mode, cites)

    return {
        'conversation_id': cid,
        'answer': ans,
        'mode': req.mode,
        'citations': cites,
        'generator': gen_type,
        'llm_used': llm_used,
        'llm_error': llm_error,
        'safety_notice': 'Not medical advice; verify evidence and consult a qualified professional.',
        'evidence_quality': [r.get('evidence_quality', {}).get('document_type', 'not available') for r in results] if results else 'not available',
        'retrieval': {
            'returned_passages': len(results),
            'dense_enabled': req.mode != 'knowledge',
            'sparse_enabled': req.mode != 'knowledge',
            'fusion': 'RRF',
        },
        'insufficient_evidence': req.mode != 'knowledge' and not results,
    }

@router.post("/api/chat/stream")
def stream_chat(req: ChatRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    chat_rate_limiter.check(client_ip)

    question = sanitize_question(req.question)
    req.question = question

    cid = req.conversation_id or store.create_conv(question[:80])
    _, m = store.conv(cid)
    hist = [dict(a) for a in m]
    results = [] if req.mode == 'knowledge' else decorate(index.search(question, req.top_k, req.document_id), req.template)

    def token_generator():
        full_text = []
        for token in generator.stream_answer(question, req.mode, results, hist):
            full_text.append(token)
            yield token
        # After stream finishes, record into DB
        complete_ans = "".join(full_text)
        cites, _ = generator._build_citations(results)
        store.add_msg(cid, 'user', question, req.mode)
        store.add_msg(cid, 'assistant', complete_ans, req.mode, cites)

    return StreamingResponse(
        token_generator(),
        media_type='text/plain',
        headers={
            "X-Conversation-Id": cid,
            "Access-Control-Expose-Headers": "X-Conversation-Id",
        },
    )

@router.get("/api/chat/conversations")
def list_conversations():
    return {'conversations': [dict(x) for x in store.conversations()]}

@router.get("/api/chat/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    c, m = store.conv(conversation_id)
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {'conversation': dict(c), 'messages': [dict(x) for x in m]}

@router.delete("/api/chat/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    store.delete_conv(conversation_id)
    return {'deleted': conversation_id}

@router.get("/api/chat/conversations/{conversation_id}/export")
def export_conversation(conversation_id: str):
    c, m = store.conv(conversation_id)
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return PlainTextResponse(
        '\n\n'.join(f'{x["role"].upper()}: {x["content"]}' for x in m),
        media_type='text/plain',
    )

@router.post("/api/compare")
def compare(req: CompareRequest):
    if len(req.document_ids) < 2:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Comparison requires at least 2 document IDs. Please select 2 or more documents to compare.",
                },
                "detail": "Comparison requires at least 2 document IDs. Please select 2 or more documents to compare.",
                "heuristic_analysis": {
                    "method": "heuristic token overlap, not scientific truth",
                    "shared_terms": [],
                    "agreement": "no comparison possible with fewer than 2 documents",
                    "disagreement": "Requires at least 2 documents.",
                },
            },
        )

    docs = [store.get_doc(i) for i in req.document_ids]
    present = [doc_json(x) for x in docs if x]
    if len(present) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 of the requested documents must exist in the knowledge base for comparison."
        )

    claims = []
    for d in present:
        extracted = d.get('extracted', []) if isinstance(d, dict) else []
        text = ' '.join(p.get('text', '') for p in extracted)
        terms = set(re.findall(r'\b[a-z]{5,}\b', text.lower()))
        claims.append(terms)

    overlap = []
    if claims:
        common = set.intersection(*claims) if len(claims) > 1 else claims[0]
        overlap = sorted(common)[:30]

    analysis = {
        'method': 'heuristic token overlap, not scientific truth',
        'shared_terms': overlap,
        'agreement': 'possible shared vocabulary' if overlap else 'no shared vocabulary detected',
        'disagreement': 'Requires expert claim-level review; no contradiction has been scientifically established.',
    }
    return {
        'documents': present,
        'comparison': 'Compare the indexed evidence from these papers; heuristic overlap is not scientific truth.',
        'heuristic_analysis': analysis,
    }
