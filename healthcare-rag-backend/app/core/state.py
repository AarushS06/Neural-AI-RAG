from .config import settings
from ..db.store import Store
from ..rag.index import LocalIndex
from ..rag.generation import Generator
from ..rag.web_search import WebSearchClient

store = Store(settings.db_path)
index = LocalIndex(settings.index_path)
generator = Generator(settings)
web_search_client = WebSearchClient(settings)
