from pathlib import Path
import os
from dotenv import load_dotenv

# Search candidate .env locations: current working directory, workspace root, and backend folder.
# Existing process environment variables intentionally win over these files so deployment
# secrets such as OPENAI_API_KEY are not overwritten by an empty checked-in placeholder.
_candidates = [
    Path.cwd() / '.env',
    Path(__file__).resolve().parents[2] / '.env',
    Path(__file__).resolve().parents[1] / '.env',
]
for _env_file in _candidates:
    if _env_file.is_file():
        load_dotenv(dotenv_path=_env_file, override=False)

class Settings:
    def __init__(self):
        self.base_dir = Path(os.getenv('RAG_BASE_DIR', Path(__file__).resolve().parents[2]))
        self.data_dir = Path(os.getenv('RAG_DATA_DIR', self.base_dir / 'data'))
        self.upload_dir = Path(os.getenv('RAG_UPLOAD_DIR', self.data_dir / 'uploads'))
        self.db_path = Path(os.getenv('RAG_DB_PATH', self.data_dir / 'rag.sqlite3'))
        self.index_path = Path(os.getenv('RAG_INDEX_PATH', self.data_dir / 'index.npz'))

        # Upload limits
        self.max_file_mb = int(os.getenv('MAX_UPLOAD_MB', os.getenv('MAX_FILE_MB', '25')))
        self.chunk_size = int(os.getenv('CHUNK_SIZE', '700'))
        self.chunk_overlap = int(os.getenv('CHUNK_OVERLAP', '100'))
        self.top_k = int(os.getenv('TOP_K', '8'))
        self.embedding_model = os.getenv('EMBEDDING_MODEL', 'local-hash-384')

        # LLM Provider Configuration (Gemini / OpenAI / Local)
        self.gemini_api_key = os.getenv('GEMINI_API_KEY', os.getenv('GOOGLE_API_KEY', '')).strip()
        self.gemini_model = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite').strip()

        self.openai_api_key = os.getenv('OPENAI_API_KEY', '').strip()
        # Default LLM_PROVIDER to 'gemini' if GEMINI_API_KEY is set or LLM_PROVIDER is gemini, else openai
        default_provider = 'gemini' if (self.gemini_api_key or os.getenv('LLM_PROVIDER') == 'gemini') else ('openai' if self.openai_api_key else 'local')
        self.llm_provider = os.getenv('LLM_PROVIDER', default_provider).lower().strip()

        self.openai_model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini').strip()
        self.openai_timeout = float(os.getenv('OPENAI_TIMEOUT', os.getenv('REQUEST_TIMEOUT', '30.0')))
        self.llm_base_url = os.getenv('LLM_BASE_URL', '').strip()

        if self.llm_provider == 'gemini':
            self.llm_model = self.gemini_model
            self.llm_api_key = self.gemini_api_key
        else:
            self.llm_model = self.openai_model
            self.llm_api_key = self.openai_api_key

        # Web Search API Settings
        self.google_api_key = os.getenv('GOOGLE_API_KEY', self.gemini_api_key).strip()
        self.google_cse_id = os.getenv('GOOGLE_CSE_ID', '').strip()
        self.request_timeout = float(os.getenv('REQUEST_TIMEOUT', '15.0'))

        # Infrastructure
        self.cors_origins = os.getenv('CORS_ORIGINS', '*')
        self.qdrant_url = os.getenv('QDRANT_URL', '').strip()
        self.reranker_enabled = os.getenv('RERANKER_ENABLED', 'false').lower() == 'true'
        self.default_template = os.getenv('DEFAULT_TEMPLATE', 'research_papers')

    @property
    def llm_configured(self) -> bool:
        if self.llm_provider == 'gemini':
            return bool(self.gemini_api_key)
        return bool(self.openai_api_key and self.llm_provider == 'openai')

    @property
    def masked_openai_key(self) -> str:
        if self.llm_provider == 'gemini':
            if not self.gemini_api_key:
                return "<not set>"
            if len(self.gemini_api_key) <= 8:
                return "****"
            return f"AIza...{self.gemini_api_key[-4:]}"
        if not self.openai_api_key:
            return "<not set>"
        if len(self.openai_api_key) <= 8:
            return "****"
        return f"sk-...{self.openai_api_key[-4:]}"

    def ensure(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.ensure()
