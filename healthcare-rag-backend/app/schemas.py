from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any

TemplateType = Literal[
    'research_papers',
    'clinical_guidelines',
    'drug_information',
    'patient_education',
    'hospital_policy',
]

AnswerMode = Literal['knowledge', 'rag', 'combined']

# --- Chat & Search Schemas ---
class ChatRequest(BaseModel):
    question: str = Field(min_length=1, description="The user question or inquiry")
    mode: AnswerMode = Field(default='combined', description="Retrieval answering mode")
    conversation_id: Optional[str] = Field(default=None, description="Optional existing conversation ID")
    top_k: int = Field(default=8, ge=1, le=50, description="Number of passages to retrieve")
    document_id: Optional[str] = Field(default=None, description="Scope query to specific document ID")
    template: Optional[TemplateType] = Field(default=None, description="Filter by healthcare template")

SearchScope = Literal['local', 'web', 'both']

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, description="Text search query")
    top_k: int = Field(default=8, ge=1, le=50, description="Maximum results to return")
    document_id: Optional[str] = Field(default=None, description="Scope search to specific document ID")
    template: Optional[TemplateType] = Field(default=None, description="Filter by healthcare template")
    scope: SearchScope = Field(default='both', description="Search scope: local index, web literature, or both")

class WebSearchResultItem(BaseModel):
    id: str
    title: str
    authors: str = "Unknown"
    year: str = ""
    venue: str = ""
    abstract: str = ""
    url: str = ""
    doi: str = ""
    open_access_pdf_url: Optional[str] = None
    source: str = "web"
    relevance_score: float = 0.0

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    retrieval: Dict[str, Any]
    web_results: List[WebSearchResultItem] = []
    warnings: List[str] = []

class ImportPaperItem(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    open_access_pdf_url: Optional[str] = None
    source: Optional[str] = "web"

class ImportPaperRequest(BaseModel):
    result_ids: Optional[List[str]] = None
    urls: Optional[List[str]] = None
    items: Optional[List[ImportPaperItem]] = None
    template: Optional[str] = "research_papers"

class ImportPaperResult(BaseModel):
    title: str
    document_id: Optional[str] = None
    success: bool
    source_type: str = "text"
    error: Optional[str] = None

class ImportPaperResponse(BaseModel):
    imported_count: int
    results: List[ImportPaperResult]

class CompareRequest(BaseModel):
    document_ids: List[str] = Field(min_length=1, description="List of document IDs to compare")

# --- Dashboard Schemas ---
class DashboardAnalyzeResponse(BaseModel):
    document_id: str
    stage: str
    percent: int
    duplicate: bool

class ProgressResponse(BaseModel):
    document_id: str
    stage: str
    percent: int
    status: str
    error: Optional[str] = None

class DashboardResultResponse(BaseModel):
    document_id: str
    filename: str
    page_count: int
    chunk_count: int
    metadata: Dict[str, Any]
    summary: str
    citations: List[Dict[str, Any]]
    evidence_quality: Dict[str, Any]
    phi_report: Dict[str, Any]
    phi_flagged: bool
    suggested_questions: List[str]

class DashboardAskRequest(BaseModel):
    question: str = Field(min_length=1, description="Clinical or literature question regarding this document")
    conversation_id: Optional[str] = Field(default=None, description="Optional conversation ID to append message to")

class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    mode: str
    citations: List[Dict[str, Any]]
    generator: str
    llm_used: bool = False
    llm_error: Optional[str] = None
    safety_notice: str
    evidence_quality: Any = None
    retrieval: Dict[str, Any]
    insufficient_evidence: bool = False

class DashboardAskResponse(BaseModel):
    conversation_id: str
    document_id: str
    question: str
    answer: str
    mode: str
    citations: List[Dict[str, Any]]
    generator: Optional[str] = None
    llm_used: bool = False
    llm_error: Optional[str] = None
    safety_notice: str
    evidence_quality: Any = None
    retrieval: Dict[str, Any]
    insufficient_evidence: bool = False

class RecentDocumentItem(BaseModel):
    id: str
    filename: str
    status: str
    stage: str
    template: Optional[str] = None
    version: Optional[str] = None
    evidence_quality: Dict[str, Any] = {}
    phi_flagged: bool = False
    uploaded_at: Optional[str] = None
    page_count: int = 0
    chunk_count: int = 0

class QueueItem(BaseModel):
    id: str
    filename: str
    stage: str
    percent: int
    status: str
    uploaded_at: Optional[str] = None

class DashboardResponse(BaseModel):
    totals: Dict[str, int]
    recent_documents: List[RecentDocumentItem]
    processing_queue: List[QueueItem]
    quality_summary: Dict[str, Any]
    system_status: Dict[str, Any]

# --- Batch Upload Schemas ---
class BatchUploadItemResult(BaseModel):
    filename: str
    success: bool
    document_id: Optional[str] = None
    stage: Optional[str] = None
    duplicate: Optional[bool] = False
    document: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class BatchUploadResponse(BaseModel):
    results: List[BatchUploadItemResult]
