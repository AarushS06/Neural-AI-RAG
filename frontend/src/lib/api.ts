import {
  AnswerMode,
  ChatResponse,
  CompareResult,
  ConversationDetail,
  ConversationSummary,
  DocumentPreview,
  DocumentRecord,
  QualityReport,
  RagConfig,
  SearchResultItem,
  SystemStatus,
  TemplateInfo,
  UploadResponse,
} from './types';

// In Vite development, /api and /health are proxied to localhost:8000
const BASE_URL = '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers,
    });

    if (!response.ok) {
      let errMessage = `HTTP error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // ignore
      }
      throw new Error(errMessage);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  async getHealth(): Promise<{ status: string; service: string; documents: number; chunks: number }> {
    return request('/health');
  },

  async getSystemStatus(): Promise<SystemStatus> {
    return request('/api/system/status');
  },

  async getRagConfig(): Promise<RagConfig> {
    return request('/api/rag/config');
  },

  async getTemplates(): Promise<{ templates: TemplateInfo[] }> {
    return request('/api/knowledge-bases/templates');
  },

  async getQualityReport(): Promise<QualityReport> {
    return request('/api/knowledge-bases/quality-report');
  },

  async uploadDocument(
    file: File,
    options?: {
      template?: string;
      version?: string;
      effective_date?: string;
      supersedes_document_id?: string;
    }
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.template) formData.append('template', options.template);
    if (options?.version) formData.append('version', options.version);
    if (options?.effective_date) formData.append('effective_date', options.effective_date);
    if (options?.supersedes_document_id) formData.append('supersedes_document_id', options.supersedes_document_id);

    return request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async getDocuments(): Promise<{ documents: DocumentRecord[] }> {
    return request('/api/documents');
  },

  async getDocument(documentId: string): Promise<DocumentRecord> {
    return request(`/api/documents/${encodeURIComponent(documentId)}`);
  },

  async getDocumentStatus(documentId: string): Promise<DocumentRecord> {
    return request(`/api/documents/${encodeURIComponent(documentId)}/status`);
  },

  async getDocumentVersions(documentId: string): Promise<{ versions: DocumentRecord[] }> {
    return request(`/api/documents/${encodeURIComponent(documentId)}/versions`);
  },

  async getDocumentPreview(documentId: string): Promise<DocumentPreview> {
    return request(`/api/documents/${encodeURIComponent(documentId)}/preview`);
  },

  async reprocessDocument(documentId: string): Promise<DocumentRecord> {
    return request(`/api/documents/${encodeURIComponent(documentId)}/reprocess`, {
      method: 'POST',
    });
  },

  async deleteDocument(documentId: string): Promise<{ deleted: string }> {
    return request(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
  },

  async search(
    query: string,
    top_k = 8,
    document_id: string | null = null,
    template: string | null = null
  ): Promise<{ results: SearchResultItem[]; retrieval: any }> {
    return request('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k,
        document_id: document_id || undefined,
        template: template || undefined,
      }),
    });
  },

  async chat(req: {
    question: string;
    mode: AnswerMode;
    conversation_id?: string | null;
    document_id?: string | null;
    template?: string | null;
    top_k?: number;
  }): Promise<ChatResponse> {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        question: req.question,
        mode: req.mode,
        conversation_id: req.conversation_id || null,
        document_id: req.document_id || null,
        template: req.template || undefined,
        top_k: req.top_k || 8,
      }),
    });
  },

  /**
   * Real streaming chat: reads tokens from /api/chat/stream
   * and also retrieves the citations & metadata.
   */
  async streamChat(
    req: {
      question: string;
      mode: AnswerMode;
      conversation_id?: string | null;
      document_id?: string | null;
      template?: string | null;
      top_k?: number;
    },
    callbacks: {
      onToken: (token: string) => void;
      onComplete: (res: ChatResponse) => void;
      onError: (err: Error) => void;
    }
  ): Promise<void> {
    try {
      const chatBody = {
        question: req.question,
        mode: req.mode,
        conversation_id: req.conversation_id || null,
        document_id: req.document_id || null,
        template: req.template || undefined,
        top_k: req.top_k || 8,
      };

      // In the backend, /api/chat/stream runs chat and yields space-separated words
      // Let's call /api/chat/stream for live token stream
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
      });

      if (!response.ok || !response.body) {
        // Fallback to standard chat endpoint
        const fallbackRes = await this.chat(req);
        callbacks.onComplete(fallbackRes);
        return;
      }

      let streamedText = '';
      try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedText += chunk;
          callbacks.onToken(chunk);
        }
      } catch (streamErr) {
        console.warn('Streaming read interrupted; falling back to standard chat', streamErr);
      }

      if (!streamedText.trim()) {
        const fallbackRes = await this.chat(req);
        callbacks.onComplete(fallbackRes);
        return;
      }

      // Fetch the conversation and final metadata to retrieve full citations
      const convList = await this.getConversations();
      const lastConvId = req.conversation_id || (convList.conversations[0]?.id ?? '');
      
      let finalCitations: any[] = [];
      let finalQuality: any = 'identified';
      
      if (lastConvId) {
        try {
          const detail = await this.getConversation(lastConvId);
          const lastMsg = detail.messages[detail.messages.length - 1];
          if (lastMsg && lastMsg.citations) {
            finalCitations = typeof lastMsg.citations === 'string'
              ? JSON.parse(lastMsg.citations)
              : lastMsg.citations;
          }
        } catch {
          // ignore
        }
      }

      callbacks.onComplete({
        conversation_id: lastConvId,
        answer: streamedText.trim(),
        mode: req.mode,
        citations: finalCitations,
        safety_notice: 'Not medical advice; verify evidence and consult a qualified professional.',
        evidence_quality: finalQuality,
        retrieval: {
          returned_passages: finalCitations.length,
          dense_enabled: req.mode !== 'knowledge',
          sparse_enabled: req.mode !== 'knowledge',
          fusion: 'RRF',
        },
        insufficient_evidence: req.mode !== 'knowledge' && finalCitations.length === 0,
      });
    } catch (err: any) {
      // If streaming fails, attempt graceful fallback to standard /api/chat
      try {
        const fallbackRes = await this.chat(req);
        callbacks.onComplete(fallbackRes);
      } catch (fallbackErr: any) {
        callbacks.onError(fallbackErr);
      }
    }
  },

  async getConversations(): Promise<{ conversations: ConversationSummary[] }> {
    return request('/api/chat/conversations');
  },

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    return request(`/api/chat/conversations/${encodeURIComponent(conversationId)}`);
  },

  async deleteConversation(conversationId: string): Promise<{ deleted: string }> {
    return request(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
  },

  async exportConversation(conversationId: string): Promise<string> {
    const res = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/export`);
    if (!res.ok) throw new Error('Failed to export conversation');
    return res.text();
  },

  async compare(documentIds: string[]): Promise<CompareResult> {
    return request('/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        document_ids: documentIds,
      }),
    });
  },
};
