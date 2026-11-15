import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import {
  AnswerMode,
  ChatResponse,
  Citation,
  ConversationMessage,
  ConversationSummary,
  DocumentRecord,
} from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import {
  Send,
  Sparkles,
  BookOpen,
  Split,
  PlusCircle,
  Trash2,
  Download,
  Copy,
  CheckCircle2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  FileText,
  SlidersHorizontal,
  Clock,
  ShieldAlert,
  SearchX,
  ExternalLink,
  UploadCloud,
  Loader2,
  Plus,
} from 'lucide-react';

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Composer states
  const [question, setQuestion] = useState(initialQuery);
  const [mode, setMode] = useState<AnswerMode>('combined');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [topK, setTopK] = useState<number>(8);
  const [showFilters, setShowFilters] = useState(false);

  // Quick Ingestion state
  const [isUploadingPaper, setIsUploadingPaper] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [activeUploadPrompt, setActiveUploadPrompt] = useState<{
    documentId: string;
    documentTitle: string;
    chunksCount: number;
    studyType: string;
    questions: string[];
  } | null>(null);

  // Streaming & Loading states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [latestResponse, setLatestResponse] = useState<ChatResponse | null>(null);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    api.getDocuments().then((res) => setDocuments(res.documents)).catch(() => {});
  }, []);

  const handleQuickUpload = async (file: File) => {
    setIsUploadingPaper(true);
    setUploadStatusMsg(`Uploading & extracting ${file.name}...`);

    try {
      const res = await api.uploadDocument(file, {
        template: 'research_papers',
        version: '1',
      });

      const docId = res.document.id;
      setUploadStatusMsg('Structuring & indexing vector embeddings...');

      const maxTries = 40;
      let count = 0;
      const timer = setInterval(async () => {
        count++;
        try {
          const doc = await api.getDocument(docId);
          if (doc.status === 'completed' || doc.status === 'failed' || count >= maxTries) {
            clearInterval(timer);
            setIsUploadingPaper(false);
            setUploadStatusMsg(null);
            api.getDocuments().then((r) => setDocuments(r.documents)).catch(() => {});

            if (doc.status === 'completed') {
              const meta = (doc.metadata?.metadata as any) || {};
              const title = meta.title || doc.filename;
              const chunks = doc.metadata?.chunks || 1;
              const studyType = doc.quality?.study_type || 'clinical trial';
              setSelectedDocId(doc.id);

              const tailoredQuestions = [
                `What are the primary clinical findings and outcomes in ${title}?`,
                `What study population, intervention, and controls were analyzed?`,
                `What study limitations and adverse events were highlighted?`,
                `Summarize the key takeaways and methodological conclusions.`,
              ];

              setActiveUploadPrompt({
                documentId: doc.id,
                documentTitle: title,
                chunksCount: chunks,
                studyType,
                questions: tailoredQuestions,
              });

              const introMsg: ConversationMessage = {
                id: Date.now().toString(),
                conversation_id: activeConvId || '',
                role: 'assistant',
                content: `📄 **${title}** has been ingested into your knowledge base with **${chunks} passages** (${studyType}).\n\nWhat would you like to explore about this paper? Click any question below to retrieve grounded evidence using RAG:`,
                mode: 'combined',
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, introMsg]);
            }
          }
        } catch {
          clearInterval(timer);
          setIsUploadingPaper(false);
          setUploadStatusMsg(null);
        }
      }, 500);
    } catch (err: any) {
      setIsUploadingPaper(false);
      setUploadStatusMsg(null);
      alert(`Upload error: ${err.message || 'Failed to process file'}`);
    }
  };

  useEffect(() => {
    if (initialQuery && documents.length > 0) {
      handleAsk(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
    } catch {
      // ignore
    }
  };

  const handleSelectConversation = async (convId: string) => {
    setActiveConvId(convId);
    setLatestResponse(null);
    setIsStreaming(false);
    setStreamedText('');
    try {
      const detail = await api.getConversation(convId);
      setMessages(detail.messages || []);
      const lastAssistant = [...(detail.messages || [])].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant && lastAssistant.citations) {
        const parsed = typeof lastAssistant.citations === 'string'
          ? JSON.parse(lastAssistant.citations)
          : lastAssistant.citations;
        setLatestResponse({
          conversation_id: convId,
          answer: lastAssistant.content,
          mode: (lastAssistant.mode as AnswerMode) || 'combined',
          citations: parsed || [],
          safety_notice: 'Not medical advice; verify evidence and consult a qualified professional.',
          evidence_quality: 'identified',
          retrieval: {
            returned_passages: parsed?.length || 0,
            dense_enabled: true,
            sparse_enabled: true,
            fusion: 'RRF',
          },
          insufficient_evidence: false,
        });
      }
    } catch {
      // ignore
    } finally {
      setIsStreaming(false);
      setStreamedText('');
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setLatestResponse(null);
    setStreamedText('');
    setIsStreaming(false);
    setQuestion('');
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(convId);
      if (activeConvId === convId) handleNewChat();
      loadConversations();
    } catch {
      // ignore
    }
  };

  const handleExport = async () => {
    if (!activeConvId) return;
    try {
      const text = await api.exportConversation(activeConvId);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veritycare_chat_${activeConvId.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || isStreaming) return;

    setQuestion('');
    setIsStreaming(true);
    setStreamedText('');
    setLatestResponse(null);

    // Optimistic user message
    const tempUserMsg: ConversationMessage = {
      id: Date.now().toString(),
      conversation_id: activeConvId || '',
      role: 'user',
      content: q,
      mode: 'combined',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const finalRes = await api.chat({
        question: q,
        mode: 'combined',
        conversation_id: activeConvId,
        document_id: selectedDocId || null,
        template: selectedTemplate || null,
        top_k: topK,
      });

      setLatestResponse(finalRes);
      setActiveConvId(finalRes.conversation_id);

      const assistantMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        conversation_id: finalRes.conversation_id,
        role: 'assistant',
        content: finalRes.answer,
        mode: finalRes.mode,
        citations: finalRes.citations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      loadConversations();
    } catch (err: any) {
      const errorMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        conversation_id: activeConvId || '',
        role: 'assistant',
        content: `Error retrieving evidence: ${err?.message || 'Check backend connection'}. Please verify the backend is running.`,
        mode: 'combined',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamedText('');
    }
  };

  const handleCopyAnswer = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  return (
    <PageTransition>
      <div className="flex-1 flex h-[calc(100vh-6.5rem)] overflow-hidden">
        {/* Left Sidebar: Conversations History */}
        <aside className="hidden lg:flex w-72 h-full flex-col bg-warm-card dark:bg-dark-card border-r border-warm-border dark:border-dark-border transition-colors">
          <div className="p-4 border-b border-warm-border dark:border-dark-border flex items-center justify-between">
            <span className="text-xs font-semibold text-warm-text dark:text-dark-text tracking-wide uppercase">
              Inquiries History
            </span>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white hover:bg-accent-hover text-xs font-medium shadow-soft transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-warm-muted dark:text-dark-muted">
                No saved conversations yet. Ask a question to begin.
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activeConvId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-accent/10 dark:bg-accent/20 text-accent dark:text-accent-subtle font-semibold border border-accent/20'
                        : 'text-warm-subtext dark:text-dark-subtext hover:bg-warm-bg dark:hover:bg-dark-bg'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{c.title || 'Research Inquiry'}</div>
                      <span className="text-[10px] text-warm-muted dark:text-dark-muted block mt-0.5">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-warm-muted hover:text-rose-600 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Chat Viewport */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-warm-bg dark:bg-dark-bg">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {messages.length === 0 && !isStreaming ? (
              <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle flex items-center justify-center mx-auto shadow-soft">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display text-3xl font-bold text-warm-text dark:text-dark-text">
                    What would you like to research today?
                  </h2>
                  <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext leading-relaxed mt-2 max-w-lg mx-auto">
                    Ask your question to get merged answers combining AI intelligence with indexed research paper evidence.
                  </p>
                </div>

                {/* Step 1: Upload Document & Run RAG Pipeline Card */}
                <div className="p-6 bg-warm-card dark:bg-dark-card border-2 border-dashed border-accent/40 rounded-3xl shadow-soft text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle flex items-center justify-center mx-auto">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-warm-text dark:text-dark-text">
                      Step 1: Upload Research Paper (PDF) to Run RAG Pipeline
                    </h3>
                    <p className="text-xs text-warm-subtext dark:text-dark-subtext mt-1 max-w-md mx-auto">
                      Extract clinical passages, chunk text, generate vector embeddings, and query it directly using ChatGPT.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <label className="cursor-pointer px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-full text-xs font-semibold shadow-soft transition inline-flex items-center gap-2">
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload PDF Document</span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleQuickUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {documents.length > 0 && (
                    <div className="pt-4 border-t border-warm-border dark:border-dark-border">
                      <div className="text-[11px] font-semibold text-warm-subtext dark:text-dark-subtext uppercase tracking-wider mb-2">
                        Or Select an Existing Indexed Paper:
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {documents.slice(0, 4).map((doc) => {
                          const meta = (doc.metadata?.metadata as any) || {};
                          const title = meta.title || doc.filename;
                          const chunks = doc.metadata?.chunks || 1;
                          const studyType = doc.quality?.study_type || 'clinical trial';
                          return (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDocId(doc.id);
                                setActiveUploadPrompt({
                                  documentId: doc.id,
                                  documentTitle: title,
                                  chunksCount: chunks,
                                  studyType,
                                  questions: [
                                    `What are the primary clinical findings and outcomes in ${title}?`,
                                    `What study population, intervention, and controls were analyzed?`,
                                    `What study limitations and adverse events were highlighted?`,
                                    `Summarize the key takeaways and methodological conclusions.`,
                                  ],
                                });
                                const introMsg: ConversationMessage = {
                                  id: Date.now().toString(),
                                  conversation_id: activeConvId || '',
                                  role: 'assistant',
                                  content: `📄 **${title}** is selected from your knowledge base with **${chunks} passages** (${studyType}).\n\nWhat would you like to explore about this paper? Click any question below to retrieve grounded evidence using RAG:`,
                                  mode: 'combined',
                                  created_at: new Date().toISOString(),
                                };
                                setMessages((prev) => [...prev, introMsg]);
                              }}
                              className="text-left px-3 py-1.5 rounded-full bg-warm-bg dark:bg-dark-bg hover:bg-accent/15 text-warm-text dark:text-dark-text text-xs font-medium border border-warm-border dark:border-dark-border transition flex items-center gap-1.5 shadow-soft"
                              title={`Click to query ${title}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-accent" />
                              <span className="max-w-[180px] truncate">{title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((m, idx) => (
                  <div key={m.id || idx}>
                    {m.role === 'user' ? (
                      /* User message */
                      <div className="flex justify-end">
                        <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-warm-text dark:text-dark-text rounded-3xl rounded-tr-md px-5 py-3.5 max-w-xl text-sm shadow-soft select-text">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-accent dark:text-accent-subtle mb-1">
                            Researcher Query • {m.mode?.toUpperCase()}
                          </div>
                          <div className="leading-relaxed font-medium">{m.content}</div>
                        </div>
                      </div>
                    ) : (
                      /* Assistant message */
                      <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-4">
                        {/* Header bar */}
                        <div className="flex items-center justify-between pb-3 border-b border-warm-border dark:border-dark-border text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent dark:bg-accent-subtle"></span>
                            <span className="font-semibold text-warm-text dark:text-dark-text uppercase tracking-wider text-[11px]">
                              {m.mode === 'rag'
                                ? 'Strict Paper Evidence'
                                : m.mode === 'knowledge'
                                ? 'Pretrained Model Knowledge'
                                : 'Combined Evidence'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyAnswer(m.content)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-warm-subtext dark:text-dark-subtext hover:bg-warm-bg dark:hover:bg-dark-bg transition"
                            >
                              {copiedAnswer ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            {activeConvId && (
                              <button
                                onClick={handleExport}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-warm-subtext dark:text-dark-subtext hover:bg-warm-bg dark:hover:bg-dark-bg transition"
                              >
                                <Download className="w-3 h-3" />
                                <span>Export</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Answer text */}
                        <div className="text-sm text-warm-text dark:text-dark-text leading-relaxed whitespace-pre-line select-text font-normal">
                          {m.content}
                        </div>

                        {/* Suggested Starter Questions for Ingested Document */}
                        {activeUploadPrompt && idx === messages.length - 1 && (
                          <div className="pt-3 border-t border-warm-border dark:border-dark-border space-y-2">
                            <span className="text-[11px] font-semibold text-accent dark:text-accent-subtle uppercase tracking-wider block">
                              Suggested Grounded Questions:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {activeUploadPrompt.questions.map((qText, qIdx) => (
                                <button
                                  key={qIdx}
                                  onClick={() => handleAsk(qText)}
                                  className="text-left p-3 rounded-2xl bg-warm-surface dark:bg-dark-surface hover:bg-accent hover:text-white border border-warm-border dark:border-dark-border transition text-xs font-semibold flex items-start gap-2 shadow-soft group"
                                >
                                  <span className="w-4 h-4 rounded-full bg-accent/15 text-accent group-hover:bg-white group-hover:text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 transition">
                                    {qIdx + 1}
                                  </span>
                                  <span className="leading-snug">{qText}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Citations Chips and Details */}
                        {m.citations && (
                          <div className="pt-3 border-t border-warm-border dark:border-dark-border space-y-3">
                            <span className="text-[11px] font-semibold text-warm-muted dark:text-dark-muted uppercase tracking-wider block">
                              Verified Source Citations:
                            </span>

                            <div className="flex flex-wrap gap-2">
                              {(typeof m.citations === 'string'
                                ? JSON.parse(m.citations)
                                : m.citations
                              ).map((cite: Citation) => {
                                const isExpanded = expandedCitationId === cite.citation_id;
                                return (
                                  <div key={cite.citation_id} className="space-y-2">
                                    <motion.button
                                      initial={{ scale: 0.85, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                      onClick={() =>
                                        setExpandedCitationId(
                                          isExpanded ? null : cite.citation_id
                                        )
                                      }
                                      className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
                                        isExpanded
                                          ? 'bg-accent text-white border-accent shadow-sm'
                                          : 'bg-warm-surface dark:bg-dark-surface border-warm-border dark:border-dark-border text-warm-text dark:text-dark-text hover:border-accent'
                                      }`}
                                    >
                                      <Bookmark className="w-3 h-3" />
                                      <span>[{cite.citation_id}]</span>
                                      <span className="font-sans font-normal text-[11px] truncate max-w-[140px]">
                                        {cite.title || 'Source Passage'}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3 h-3 ml-1" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3 ml-1" />
                                      )}
                                    </motion.button>

                                    {/* Expanded Citation Passage Card */}
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="p-4 rounded-2xl bg-warm-surface dark:bg-dark-surface border border-accent/40 shadow-soft text-xs space-y-2 max-w-xl"
                                        >
                                          <div className="flex items-center justify-between text-[11px] text-warm-muted dark:text-dark-muted">
                                            <span>
                                              Page {cite.page ?? 1} • Section:{' '}
                                              <strong>{cite.section || 'Body'}</strong>
                                            </span>
                                            <span className="font-mono text-[10px]">
                                              Chunk: {cite.chunk_id}
                                            </span>
                                          </div>
                                          <blockquote className="bg-warm-bg dark:bg-dark-bg p-3 rounded-xl border-l-4 border-accent font-serif italic text-warm-text dark:text-dark-text leading-relaxed select-text">
                                            "{cite.evidence}"
                                          </blockquote>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Live streaming token indicator */}
                {isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    className="bg-warm-card dark:bg-dark-card border border-accent/40 rounded-3xl p-6 shadow-lift space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-accent dark:text-accent-subtle">
                      <div className="w-2 h-2 rounded-full bg-accent dark:bg-accent-subtle animate-ping" />
                      <span>Streaming Grounded Synthesis...</span>
                    </div>
                    {streamedText ? (
                      <div className="text-sm text-warm-text dark:text-dark-text leading-relaxed whitespace-pre-line font-normal">
                        {streamedText}
                        <span className="inline-block w-1.5 h-4 bg-accent dark:bg-accent-subtle ml-1 align-middle animate-pulse rounded-full" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="h-4 bg-warm-border/60 dark:bg-dark-border/60 rounded-md w-3/4 shimmer-gradient animate-shimmer" />
                        <div className="h-4 bg-warm-border/60 dark:bg-dark-border/60 rounded-md w-1/2 shimmer-gradient animate-shimmer" />
                      </div>
                    )}
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer Box (Unified ChatGPT Style) */}
          <div className="p-4 sm:p-6 border-t border-warm-border/80 dark:border-dark-border/80 bg-warm-card/80 dark:bg-dark-card/80 backdrop-blur-md">
            <div className="max-w-3xl mx-auto space-y-3">
              {/* Ingestion Progress Bar */}
              {isUploadingPaper && (
                <div className="bg-accent/10 border border-accent/30 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-accent dark:text-accent-subtle shadow-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadStatusMsg || 'Ingesting PDF into RAG pipeline...'}</span>
                  </div>
                  <span className="text-[11px] opacity-75 font-mono">Docling / PyMuPDF</span>
                </div>
              )}

              {/* Collapsible Scope & Top-k Filter Drawer */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3.5 bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-2"
                  >
                    <div>
                      <label className="block text-warm-muted dark:text-dark-muted mb-1">
                        Scope Document:
                      </label>
                      <select
                        value={selectedDocId}
                        onChange={(e) => setSelectedDocId(e.target.value)}
                        className="w-full bg-warm-surface dark:bg-dark-surface border border-warm-border dark:border-dark-border rounded-xl p-2 text-xs text-warm-text dark:text-dark-text"
                      >
                        <option value="">All Documents ({documents.length})</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.metadata?.metadata?.title || d.filename}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-warm-muted dark:text-dark-muted mb-1 flex justify-between">
                        <span>Top-k Passages:</span>
                        <strong className="font-mono text-accent dark:text-accent-subtle">{topK}</strong>
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="16"
                        value={topK}
                        onChange={(e) => setTopK(Number(e.target.value))}
                        className="w-full accent-accent h-2 rounded-lg cursor-pointer mt-2"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Single Pill Input UI like ChatGPT */}
              <div className="relative flex items-center bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-full px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent transition-all">
                {/* Plus (+) Button for Uploading PDF into RAG */}
                <label
                  className="flex-shrink-0 w-9 h-9 rounded-full hover:bg-warm-card dark:hover:bg-dark-card text-warm-muted dark:text-dark-muted hover:text-warm-text dark:hover:text-dark-text flex items-center justify-center cursor-pointer transition mr-1"
                  title="Upload Research Paper (PDF) to RAG"
                >
                  <Plus className="w-5 h-5" />
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleQuickUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                {/* Single Question Input */}
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAsk();
                  }}
                  placeholder="Ask your question..."
                  className="flex-1 bg-transparent border-0 px-2 py-1.5 text-sm text-warm-text dark:text-dark-text placeholder:text-warm-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-0 leading-relaxed"
                />

                {/* Right Actions: Filters & Send Button */}
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-full transition ${
                      showFilters
                        ? 'text-accent dark:text-accent-subtle bg-accent/10'
                        : 'text-warm-muted dark:text-dark-muted hover:text-warm-text dark:hover:text-dark-text hover:bg-warm-card dark:hover:bg-dark-card'
                    }`}
                    title="Filters & Scope"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAsk()}
                    disabled={!question.trim() || isStreaming}
                    className={`w-9 h-9 rounded-full text-white transition flex items-center justify-center ${
                      !question.trim() || isStreaming
                        ? 'bg-warm-muted/30 text-warm-subtext/50 dark:text-dark-subtext/50 cursor-not-allowed'
                        : 'bg-accent hover:bg-accent-hover shadow-sm active:scale-95'
                    }`}
                    title="Send Question"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};
