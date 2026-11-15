export type AnswerMode = 'knowledge' | 'rag' | 'combined';

export interface HealthcareMetadata {
  title: string;
  authors: string;
  year: string;
  doi: string;
  pmid: string;
  journal: string;
  study_type: string;
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
  template: string;
}

export interface DocumentQuality {
  study_type: string;
  review_label: 'high' | 'moderate' | 'not available' | string;
  document_type: 'guideline' | 'review' | 'primary_study' | 'not available' | string;
  recency_label: 'recent' | 'stale' | 'not available' | string;
  source_quality: 'identified' | 'unknown' | string;
}

export interface PHIFinding {
  type: string;
  match: string;
}

export interface PHIReport {
  flagged: boolean;
  count: number;
  types: string[];
  findings: PHIFinding[];
  warning: string;
}

export interface ExtractedPage {
  page_number: number;
  text: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  template: string;
  version: string;
  effective_date: string | null;
  supersedes_document_id: string | null;
  status: 'received' | 'extracting' | 'cleaning' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'failed' | string;
  error: string | null;
  created_at: string;
  updated_at: string;
  metadata: {
    pages?: number;
    chunks?: number;
    metadata?: HealthcareMetadata;
    classification?: string;
  };
  extracted?: ExtractedPage[];
  phi_report: PHIReport;
  quality: DocumentQuality;
}

export interface TemplateInfo {
  name: string;
  label: string;
  guidance: string;
}

export interface Citation {
  citation_id: string;
  document_id: string;
  title: string;
  section: string | null;
  page: number | null;
  chunk_id: string;
  evidence: string;
  evidence_quality: DocumentQuality;
  source_quality: string;
}

export interface RetrievalMeta {
  returned_passages: number;
  dense_enabled: boolean;
  sparse_enabled: boolean;
  fusion: string;
  heuristic_quality_labels?: boolean;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  mode: AnswerMode;
  citations: Citation[];
  safety_notice: string;
  evidence_quality: string | string[];
  retrieval: RetrievalMeta;
  insufficient_evidence: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: AnswerMode | string;
  citations?: Citation[] | string;
  created_at: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface QualityReport {
  document_count: number;
  chunk_count: number;
  missing_metadata_documents: number;
  duplicate_count: number;
  ocr_extraction_warnings: number;
  phi_flagged_documents: number;
  stale_or_expired_documents: number;
  template_distribution: Record<string, number>;
  index_config: {
    embedding_model: string;
    top_k: number;
    chunk_size: number;
    chunk_overlap: number;
    reranker_enabled: boolean;
    templates: string[];
  };
}

export interface SystemStatus {
  status: string;
  storage: string;
  vector_index: string;
  embedding_model: string;
  embedding_dimension: number;
  llm_provider: string;
  llm_model: string;
  qdrant_configured: boolean;
  reranker_enabled: boolean;
  document_count: number;
  chunk_count: number;
}

export interface RagConfig {
  embedding_model: string;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  reranker_enabled: boolean;
  templates: string[];
}

export interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  source: string;
  content: string;
  page_start: number;
  page_end: number;
  section: string;
  score: number;
  dense_score?: number;
  template?: string;
  version?: string;
  evidence_quality?: DocumentQuality;
  phi_flagged?: boolean;
}

export interface CompareResult {
  documents: DocumentRecord[];
  comparison: string;
  heuristic_analysis: {
    method: string;
    shared_terms: string[];
    agreement: string;
    disagreement: string;
  };
}

export interface DocumentPreview {
  document_id: string;
  redacted: boolean;
  warning: string;
  preview: string;
}

export interface UploadResponse {
  document: DocumentRecord;
  duplicate: boolean;
}
