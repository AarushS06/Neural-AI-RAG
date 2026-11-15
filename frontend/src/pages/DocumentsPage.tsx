import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { DocumentPreview, DocumentRecord, HealthcareMetadata, UploadResponse } from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import {
  UploadCloud,
  FileText,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Layers,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  X,
  Copy,
  Plus,
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState('all');

  // Upload modal / stepper state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTemplate, setUploadTemplate] = useState('research_papers');
  const [uploadVersion, setUploadVersion] = useState('1.0');
  const [uploadEffectiveDate, setUploadEffectiveDate] = useState('');
  const [uploadSupersedes, setUploadSupersedes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeUploadDoc, setActiveUploadDoc] = useState<DocumentRecord | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Detail Drawer state
  const [detailDoc, setDetailDoc] = useState<DocumentRecord | null>(null);
  const [docVersions, setDocVersions] = useState<DocumentRecord[]>([]);
  const [previewData, setPreviewData] = useState<DocumentPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Deletion modal state
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDocuments();
      setDocuments(res.documents);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const pollUploadStatus = async (docId: string) => {
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;
      try {
        const doc = await api.getDocument(docId);
        setActiveUploadDoc(doc);
        if (doc.status === 'completed' || doc.status === 'failed' || tries > 40) {
          clearInterval(interval);
          setIsUploading(false);
          loadDocuments();
        }
      } catch {
        clearInterval(interval);
        setIsUploading(false);
      }
    }, 600);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const res: UploadResponse = await api.uploadDocument(selectedFile, {
        template: uploadTemplate,
        version: uploadVersion,
        effective_date: uploadEffectiveDate,
        supersedes_document_id: uploadSupersedes,
      });

      setActiveUploadDoc(res.document);
      pollUploadStatus(res.document.id);
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err.message || 'Upload failed');
    }
  };

  const handleOpenDetail = async (doc: DocumentRecord) => {
    setDetailDoc(doc);
    setPreviewData(null);
    try {
      const verRes = await api.getDocumentVersions(doc.id);
      setDocVersions(verRes.versions);
    } catch {
      setDocVersions([]);
    }
  };

  const handleLoadPreview = async (docId: string) => {
    setIsLoadingPreview(true);
    try {
      const p = await api.getDocumentPreview(docId);
      setPreviewData(p);
    } catch {
      // ignore
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDocTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteDocument(deleteDocTarget.id);
      setDeleteDocTarget(null);
      if (detailDoc?.id === deleteDocTarget.id) setDetailDoc(null);
      loadDocuments();
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReprocess = async (docId: string) => {
    try {
      await api.reprocessDocument(docId);
      loadDocuments();
      if (detailDoc?.id === docId) {
        const updated = await api.getDocument(docId);
        setDetailDoc(updated);
      }
    } catch (err: any) {
      alert(`Reprocessing error: ${err.message}`);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const meta = (d.metadata?.metadata || {}) as Partial<HealthcareMetadata>;
    const text = `${d.filename} ${meta.title || ''} ${meta.authors || ''} ${meta.journal || ''} ${meta.doi || ''}`.toLowerCase();
    const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
    const matchesTemplate = templateFilter === 'all' || d.template === templateFilter;
    return matchesSearch && matchesTemplate;
  });

  const getStepNumber = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'received': return 1;
      case 'extracting': return 2;
      case 'chunking': return 3;
      case 'embedding': return 4;
      case 'indexing': return 5;
      case 'completed': return 6;
      default: return 1;
    }
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-text dark:text-dark-text tracking-tight">
              Research Document Library
            </h1>
            <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext mt-1">
              Indexed biomedical papers, clinical guidelines, and structure-aware passage vectors.
            </p>
          </div>

          <button
            onClick={() => {
              setSelectedFile(null);
              setActiveUploadDoc(null);
              setUploadError(null);
              setShowUploadModal(true);
            }}
            className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white font-medium text-xs shadow-soft transition flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New PDF</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-2xl p-4 shadow-soft flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-warm-muted dark:text-dark-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by paper title, authors, DOI, PMID, journal..."
              className="w-full pl-10 pr-4 py-2 bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl text-xs text-warm-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl px-3 py-2 text-xs text-warm-text dark:text-dark-text"
            >
              <option value="all">All Templates</option>
              <option value="research_papers">Research Papers</option>
              <option value="clinical_guidelines">Clinical Guidelines</option>
              <option value="drug_information">Drug Information</option>
              <option value="patient_education">Patient Education</option>
              <option value="hospital_policy">Hospital Policy</option>
            </select>

            <button
              onClick={loadDocuments}
              className="p-2 rounded-xl bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border text-warm-subtext dark:text-dark-subtext hover:text-warm-text dark:hover:text-dark-text transition"
              title="Refresh library"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Document Cards Grid */}
        {isLoading ? (
          /* Skeleton Loaders (Instead of plain spinner) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 space-y-4 animate-pulse"
              >
                <div className="flex justify-between">
                  <div className="w-24 h-4 bg-warm-border dark:bg-dark-border rounded-full" />
                  <div className="w-16 h-4 bg-warm-border dark:bg-dark-border rounded-full" />
                </div>
                <div className="w-3/4 h-6 bg-warm-border dark:bg-dark-border rounded-lg" />
                <div className="w-1/2 h-4 bg-warm-border dark:bg-dark-border rounded-md" />
                <div className="w-full h-10 bg-warm-border dark:bg-dark-border rounded-xl mt-4" />
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-12 text-center text-warm-muted dark:text-dark-muted space-y-3">
            <FileText className="w-12 h-12 mx-auto text-warm-border dark:text-dark-border" />
            <h3 className="font-display text-xl font-bold text-warm-text dark:text-dark-text">
              No matching research documents
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              Upload PDF papers to make them searchable and inspectable in the assistant.
            </p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.06 } },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDocs.map((doc) => {
              const meta = (doc.metadata?.metadata || {}) as Partial<HealthcareMetadata>;
              const chunks = doc.metadata?.chunks || 0;
              const quality = doc.quality || {};
              const phi = doc.phi_report || { flagged: false, count: 0 };
              const isReady = doc.status === 'completed';

              return (
                <motion.div
                  key={doc.id}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft hover:shadow-lift transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header tags */}
                    <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                      <span className="font-mono px-2.5 py-0.5 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle uppercase tracking-wider font-semibold">
                        {doc.template?.replace(/_/g, ' ')}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          isReady
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => handleOpenDetail(doc)}
                      className="font-display font-bold text-lg text-warm-text dark:text-dark-text group-hover:text-accent transition line-clamp-2 cursor-pointer leading-snug"
                    >
                      {meta.title || doc.filename}
                    </h3>

                    {/* Authors / filename */}
                    <p className="text-xs text-warm-subtext dark:text-dark-subtext line-clamp-1">
                      {meta.authors && meta.authors !== 'not available'
                        ? meta.authors
                        : doc.filename}
                    </p>

                    {/* Quality & Chunks metadata */}
                    <div className="flex items-center gap-2 text-[11px] flex-wrap pt-1">
                      {quality.study_type && quality.study_type !== 'not available' && (
                        <span className="px-2 py-0.5 rounded-md bg-warm-bg dark:bg-dark-bg text-warm-subtext dark:text-dark-subtext border border-warm-border dark:border-dark-border capitalize">
                          {quality.study_type}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-warm-muted dark:text-dark-muted font-mono">
                        <Layers className="w-3 h-3 text-accent" />
                        <span>{chunks} passages</span>
                      </span>
                      {phi.flagged && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full">
                          <ShieldAlert className="w-3 h-3" />
                          <span>PHI Flagged</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-4 mt-4 border-t border-warm-border/60 dark:border-dark-border/60 flex items-center justify-between">
                    <button
                      onClick={() => handleOpenDetail(doc)}
                      className="text-xs font-semibold text-accent dark:text-accent-subtle hover:underline flex items-center gap-1"
                    >
                      <span>Inspect Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReprocess(doc.id)}
                        className="p-1.5 rounded-lg text-warm-muted hover:text-accent transition"
                        title="Reprocess Ingestion"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteDocTarget(doc)}
                        className="p-1.5 rounded-lg text-warm-muted hover:text-rose-600 transition"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Upload Modal with Live Ingestion Stepper */}
        <AnimatePresence>
          {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-lift space-y-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-warm-border dark:border-dark-border">
                  <h3 className="font-display font-bold text-xl text-warm-text dark:text-dark-text">
                    Ingest Healthcare Research PDF
                  </h3>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-1 text-warm-muted hover:text-warm-text dark:hover:text-dark-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Dropzone with drag-over animated outline */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      setSelectedFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                    isDragOver
                      ? 'border-accent bg-accent/10 scale-[1.02]'
                      : selectedFile
                      ? 'border-accent bg-warm-bg dark:bg-dark-bg'
                      : 'border-warm-border dark:border-dark-border hover:border-accent'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />

                  <UploadCloud className="w-10 h-10 text-accent mb-2" />
                  {selectedFile ? (
                    <div>
                      <span className="font-bold text-sm text-warm-text dark:text-dark-text block">
                        {selectedFile.name}
                      </span>
                      <span className="text-xs text-warm-muted">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to ingest
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold text-sm text-warm-text dark:text-dark-text block">
                        Drag & drop research paper PDF
                      </span>
                      <span className="text-xs text-warm-muted">
                        Or click to browse from your device
                      </span>
                    </div>
                  )}
                </div>

                {/* Governance & Template Fields */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-warm-muted dark:text-dark-muted mb-1 font-medium">
                      Template:
                    </label>
                    <select
                      value={uploadTemplate}
                      onChange={(e) => setUploadTemplate(e.target.value)}
                      className="w-full bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl p-2 text-warm-text dark:text-dark-text"
                    >
                      <option value="research_papers">Research Papers</option>
                      <option value="clinical_guidelines">Clinical Guidelines</option>
                      <option value="drug_information">Drug Information</option>
                      <option value="patient_education">Patient Education</option>
                      <option value="hospital_policy">Hospital Policy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-warm-muted dark:text-dark-muted mb-1 font-medium">
                      Version:
                    </label>
                    <input
                      type="text"
                      value={uploadVersion}
                      onChange={(e) => setUploadVersion(e.target.value)}
                      className="w-full bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl p-2 text-warm-text dark:text-dark-text"
                    />
                  </div>

                  <div>
                    <label className="block text-warm-muted dark:text-dark-muted mb-1 font-medium">
                      Effective Date:
                    </label>
                    <input
                      type="date"
                      value={uploadEffectiveDate}
                      onChange={(e) => setUploadEffectiveDate(e.target.value)}
                      className="w-full bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl p-2 text-warm-text dark:text-dark-text"
                    />
                  </div>

                  <div>
                    <label className="block text-warm-muted dark:text-dark-muted mb-1 font-medium">
                      Supersedes ID (Optional):
                    </label>
                    <input
                      type="text"
                      value={uploadSupersedes}
                      onChange={(e) => setUploadSupersedes(e.target.value)}
                      placeholder="Prior ID"
                      className="w-full bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-xl p-2 text-warm-text dark:text-dark-text font-mono"
                    />
                  </div>
                </div>

                {/* Live Pipeline Stepper with Filling Line and SVG Path Draw */}
                {activeUploadDoc && (
                  <div className="bg-warm-bg dark:bg-dark-bg p-5 rounded-2xl border border-warm-border dark:border-dark-border space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-warm-text dark:text-dark-text">
                      <span className="flex items-center gap-2">
                        {activeUploadDoc.status === 'completed' ? (
                          <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <motion.path
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-accent dark:bg-accent-subtle animate-ping" />
                        )}
                        <span>Stage: {activeUploadDoc.status}</span>
                      </span>
                      <span className="font-mono text-accent dark:text-accent-subtle">
                        Step {getStepNumber(activeUploadDoc.status)} of 6
                      </span>
                    </div>

                    {/* Filling line */}
                    <div className="w-full h-1.5 bg-warm-card dark:bg-dark-card rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-accent to-accent-subtle rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(getStepNumber(activeUploadDoc.status) / 6) * 100}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                      />
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 text-center text-[10px]">
                      {['Received', 'Extract', 'Chunk', 'Embed', 'Index', 'Done'].map((st, i) => {
                        const stepNum = i + 1;
                        const isDone = stepNum <= getStepNumber(activeUploadDoc.status);
                        const isCurrent = stepNum === getStepNumber(activeUploadDoc.status);
                        return (
                          <div
                            key={st}
                            className={`py-1.5 rounded-lg font-medium transition-all ${
                              isCurrent
                                ? 'bg-accent text-white shadow-soft ring-2 ring-accent/30'
                                : isDone
                                ? 'bg-accent/20 text-accent dark:text-accent-subtle'
                                : 'bg-warm-card dark:bg-dark-card text-warm-muted'
                            }`}
                          >
                            {st}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
                    {uploadError}
                  </div>
                )}

                {/* Action CTA */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-warm-subtext hover:bg-warm-bg dark:hover:bg-dark-bg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartUpload}
                    disabled={!selectedFile || isUploading}
                    className={`px-6 py-2.5 rounded-full text-xs font-semibold text-white shadow-soft ${
                      !selectedFile || isUploading
                        ? 'bg-warm-muted/40 cursor-not-allowed'
                        : 'bg-accent hover:bg-accent-hover'
                    }`}
                  >
                    {isUploading ? 'Ingesting...' : 'Start Pipeline'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Document Detail Drawer */}
        <AnimatePresence>
          {detailDoc && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="w-full max-w-xl h-full bg-warm-card dark:bg-dark-card border-l border-warm-border dark:border-dark-border p-6 sm:p-8 shadow-lift overflow-y-auto space-y-6"
              >
                <div className="flex items-center justify-between pb-4 border-b border-warm-border dark:border-dark-border">
                  <span className="font-mono text-xs text-accent font-bold uppercase">
                    Document Provenance
                  </span>
                  <button
                    onClick={() => setDetailDoc(null)}
                    className="p-1 text-warm-muted hover:text-warm-text dark:hover:text-dark-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Title */}
                <div>
                  <h2 className="font-display font-bold text-2xl text-warm-text dark:text-dark-text leading-snug">
                    {detailDoc.metadata?.metadata?.title || detailDoc.filename}
                  </h2>
                  <p className="text-xs text-warm-subtext dark:text-dark-subtext mt-1">
                    {detailDoc.metadata?.metadata?.authors || 'Authors unlisted'} • {detailDoc.metadata?.metadata?.year || 'Year unlisted'}
                  </p>
                </div>

                {/* Metadata & PICO grid */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase text-warm-text dark:text-dark-text">
                    Extracted PICO & Journal Criteria
                  </h4>
                  <div className="bg-warm-bg dark:bg-dark-bg p-4 rounded-2xl border border-warm-border dark:border-dark-border text-xs space-y-2">
                    <div>
                      <strong className="text-warm-text dark:text-dark-text">Population (P):</strong>{' '}
                      <span className="text-warm-subtext dark:text-dark-subtext">
                        {detailDoc.metadata?.metadata?.population || 'Not available in extracted text'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-warm-text dark:text-dark-text">Intervention (I):</strong>{' '}
                      <span className="text-warm-subtext dark:text-dark-subtext">
                        {detailDoc.metadata?.metadata?.intervention || 'Not available in extracted text'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-warm-text dark:text-dark-text">Comparator (C):</strong>{' '}
                      <span className="text-warm-subtext dark:text-dark-subtext">
                        {detailDoc.metadata?.metadata?.comparator || 'Not available in extracted text'}
                      </span>
                    </div>
                    <div>
                      <strong className="text-warm-text dark:text-dark-text">Outcomes (O):</strong>{' '}
                      <span className="text-warm-subtext dark:text-dark-subtext">
                        {detailDoc.metadata?.metadata?.outcomes || 'Not available in extracted text'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Redacted Preview Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase text-warm-text dark:text-dark-text">
                      Deterministic Redacted Preview
                    </h4>
                    <button
                      onClick={() => handleLoadPreview(detailDoc.id)}
                      className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Load Safe Preview</span>
                    </button>
                  </div>

                  {isLoadingPreview && (
                    <div className="text-xs text-warm-muted animate-pulse">
                      Generating deterministic preview...
                    </div>
                  )}

                  {previewData && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200">
                        {previewData.warning}
                      </div>
                      <pre className="font-mono text-xs bg-warm-bg dark:bg-dark-bg p-3 rounded-xl border border-warm-border dark:border-dark-border max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
                        {previewData.preview}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Linked Versions */}
                {docVersions.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase text-warm-text dark:text-dark-text">
                      Document Versions
                    </h4>
                    <div className="divide-y divide-warm-border dark:divide-dark-border text-xs">
                      {docVersions.map((v) => (
                        <div key={v.id} className="py-2 flex items-center justify-between">
                          <span>Version {v.version || '1.0'}</span>
                          <span className="text-warm-muted">{v.filename}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteDocTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 max-w-md w-full shadow-lift space-y-4"
              >
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-xl text-warm-text dark:text-dark-text">
                  Permanently Delete Document?
                </h3>
                <p className="text-xs text-warm-subtext dark:text-dark-subtext leading-relaxed">
                  Are you sure you want to delete <strong>"{deleteDocTarget.filename}"</strong>?
                  All associated vector embeddings will be purged from the index.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setDeleteDocTarget(null)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-warm-subtext"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};
