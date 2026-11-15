import logging
from fastapi import APIRouter
from app.core.config import settings
from app.core.state import store, index, generator
from app.healthcare import TEMPLATES
from app.api.common import compute_system_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])

@router.get("/health")
def health():
    return {
        'status': 'ok',
        'service': 'healthcare-rag',
        'documents': len(store.list_docs()),
        'chunks': len(index.items),
    }

@router.get("/api/system/status")
def status():
    return compute_system_status()

@router.get("/api/rag/config")
def config():
    return {
        'embedding_model': settings.embedding_model,
        'top_k': settings.top_k,
        'chunk_size': settings.chunk_size,
        'chunk_overlap': settings.chunk_overlap,
        'reranker_enabled': settings.reranker_enabled,
        'templates': list(TEMPLATES),
        'llm_provider': settings.llm_provider,
        'llm_model': settings.llm_model,
        'llm_configured': settings.llm_configured,
    }

@router.get("/api/llm/health")
def llm_health():
    """
    Verifies LLM configuration and performs a minimal health check against Gemini or OpenAI.
    Returns status: ok when successful, or status: error with diagnostic message.
    """
    if settings.llm_provider == 'gemini':
        client, client_err = generator._get_gemini_client()
        model_name = getattr(settings, 'gemini_model', 'gemini-1.5-flash')
        provider_name = 'gemini'
        key_present = bool(getattr(settings, 'gemini_api_key', None))
    else:
        client, client_err = generator._get_openai_client()
        model_name = settings.openai_model
        provider_name = 'openai'
        key_present = bool(settings.openai_api_key)

    if not client:
        return {
            "status": "error",
            "provider": provider_name,
            "model": model_name,
            "configured": False,
            "key_present": key_present,
            "masked_key": settings.masked_openai_key,
            "error": client_err or f"missing api key: {provider_name.upper()}_API_KEY is not set in environment or .env",
        }

    try:
        # Perform tiny test call to verify credentials and connectivity
        client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=2,
        )
        return {
            "status": "ok",
            "provider": provider_name,
            "model": model_name,
            "configured": True,
            "key_present": True,
            "masked_key": settings.masked_openai_key,
            "error": None,
        }
    except Exception as e:
        err_msg = str(e)
        logger.error("%s health check call failed: %s", provider_name, e, exc_info=True)
        return {
            "status": "error",
            "provider": provider_name,
            "model": model_name,
            "configured": True,
            "key_present": True,
            "masked_key": settings.masked_openai_key,
            "error": err_msg,
        }
