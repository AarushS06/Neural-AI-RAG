from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.state import store, index, generator, web_search_client
from app.api import dashboard, documents, chat, search, quality, system

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("app.startup")
    logger.info(
        "=== LLM Configuration Initialized === Provider: %s | Model: %s | Key Configured: %s (%s)",
        settings.llm_provider,
        settings.openai_model,
        bool(settings.openai_api_key),
        settings.masked_openai_key,
    )
    yield

app = FastAPI(
    title='Healthcare Research RAG Backend',
    version='2.1.0',
    description='Evidence-first biomedical literature assistant with live web search, OpenAI RAG, and quality auditing; not medical advice.',
    lifespan=lifespan,
)

# CORS Middleware
origins = [o.strip() for o in settings.cors_origins.split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Standardized Error Handler: provides both {"error": {"code", "message"}} and {"detail": message}
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        422: "UNPROCESSABLE_ENTITY",
        500: "INTERNAL_SERVER_ERROR",
    }
    code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": msg,
            },
            "detail": msg,
        },
    )

# Include Modular Routers
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(quality.router)
app.include_router(system.router)

# Backwards compatibility re-exports
__all__ = ["app", "store", "index", "generator", "web_search_client", "settings"]
