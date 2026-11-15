import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { QualityReport, SystemStatus } from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import { Counter } from '../components/motion/Counter';
import { TiltCard } from '../components/motion/TiltCard';
import {
  ShieldCheck,
  ShieldAlert,
  Database,
  Layers,
  FileQuestion,
  CopyCheck,
  Clock,
  AlertTriangle,
  Cpu,
  RefreshCw,
  Binary,
} from 'lucide-react';

export const QualityPage: React.FC = () => {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [q, s] = await Promise.all([
        api.getQualityReport(),
        api.getSystemStatus().catch(() => null),
      ]);
      setReport(q);
      setSystemStatus(s);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle font-mono text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence Audit & Integrity Engine</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-text dark:text-dark-text tracking-tight">
              Knowledge Base Quality Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext">
              Real-time audit of metadata completeness, recency freshness, deduplication, and privacy flags.
            </p>
          </div>

          <button
            onClick={loadData}
            className="px-5 py-2.5 rounded-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-xs font-medium text-warm-text dark:text-dark-text hover:bg-warm-surface dark:hover:bg-dark-surface transition flex items-center gap-2 self-start sm:self-auto shadow-soft"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-Audit Corpus</span>
          </button>
        </div>

        {isLoading || !report ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 bg-warm-card dark:bg-dark-card rounded-3xl border border-warm-border dark:border-dark-border animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Primary KPI Grid with Staggered Fade-in & Animated Numbers */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {/* Total Documents */}
              <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                <TiltCard className="h-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                  <div className="flex items-center justify-between text-xs text-warm-muted dark:text-dark-muted font-medium">
                    <span>Indexed Documents</span>
                    <Database className="w-4 h-4 text-accent dark:text-accent-subtle" />
                  </div>
                  <div className="font-display font-bold text-3xl sm:text-4xl text-warm-text dark:text-dark-text">
                    <Counter to={report.document_count} />
                  </div>
                  <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                    Verified PDF papers in database
                  </p>
                </TiltCard>
              </motion.div>

              {/* Total Chunks */}
              <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                <TiltCard className="h-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                  <div className="flex items-center justify-between text-xs text-warm-muted dark:text-dark-muted font-medium">
                    <span>Indexed Passages</span>
                    <Layers className="w-4 h-4 text-accent dark:text-accent-subtle" />
                  </div>
                  <div className="font-display font-bold text-3xl sm:text-4xl text-warm-text dark:text-dark-text">
                    <Counter to={report.chunk_count} />
                  </div>
                  <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                    Searchable vectors in NumPy store
                  </p>
                </TiltCard>
              </motion.div>

              {/* PHI Flagged Documents */}
              <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                <TiltCard
                  className={`h-full border rounded-3xl p-6 shadow-soft space-y-2 ${
                    report.phi_flagged_documents > 0
                      ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                      : 'bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className={report.phi_flagged_documents > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-warm-muted dark:text-dark-muted'}>
                      PHI Privacy Flags
                    </span>
                    {report.phi_flagged_documents > 0 ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div
                    className={`font-display font-bold text-3xl sm:text-4xl ${
                      report.phi_flagged_documents > 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-warm-text dark:text-dark-text'
                    }`}
                  >
                    <Counter to={report.phi_flagged_documents} />
                  </div>
                  <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                    {report.phi_flagged_documents > 0
                      ? 'Requires manual de-identification review'
                      : 'Clean collection: zero flagged MRN/dates'}
                  </p>
                </TiltCard>
              </motion.div>

              {/* Missing Metadata */}
              <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                <TiltCard className="h-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                  <div className="flex items-center justify-between text-xs text-warm-muted dark:text-dark-muted font-medium">
                    <span>Incomplete Metadata</span>
                    <FileQuestion className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="font-display font-bold text-3xl sm:text-4xl text-warm-text dark:text-dark-text">
                    <Counter to={report.missing_metadata_documents} />
                  </div>
                  <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                    Papers missing title, author, or year
                  </p>
                </TiltCard>
              </motion.div>
            </motion.div>

            {/* Deduplication & Freshness Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-warm-text dark:text-dark-text">
                  <CopyCheck className="w-4 h-4 text-accent dark:text-accent-subtle" />
                  <span>Deduplication Interceptions</span>
                </div>
                <div className="font-mono text-2xl font-bold text-accent dark:text-accent-subtle flex items-baseline gap-1.5">
                  <Counter to={report.duplicate_count} />
                  <span className="text-xs font-normal text-warm-muted">prevented</span>
                </div>
                <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                  SHA-256 collisions stopped to preserve ranking
                </p>
              </TiltCard>

              <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-warm-text dark:text-dark-text">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Stale Papers (&gt; 5 Years)</span>
                </div>
                <div className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-baseline gap-1.5">
                  <Counter to={report.stale_or_expired_documents} />
                  <span className="text-xs font-normal text-warm-muted">flagged</span>
                </div>
                <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                  Historical literature requiring review against newer guidelines
                </p>
              </TiltCard>

              <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-warm-text dark:text-dark-text">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>OCR Empty Pages</span>
                </div>
                <div className="font-mono text-2xl font-bold text-warm-text dark:text-dark-text">
                  <Counter to={report.ocr_extraction_warnings} />
                </div>
                <p className="text-[11px] text-warm-subtext dark:text-dark-subtext">
                  Image-only or scanned pages needing OCR enhancement
                </p>
              </TiltCard>
            </div>

            {/* Template Distribution Bento Section */}
            <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-soft space-y-5">
              <h3 className="font-display font-bold text-xl text-warm-text dark:text-dark-text">
                Corpus Template Distribution
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {Object.entries(report.template_distribution || {}).map(([key, count]) => {
                  const pct =
                    report.document_count > 0
                      ? Math.round((count / report.document_count) * 100)
                      : 0;

                  return (
                    <div
                      key={key}
                      className="bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border rounded-2xl p-4 space-y-2 text-xs"
                    >
                      <span className="font-semibold text-warm-text dark:text-dark-text capitalize truncate block">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-xl font-bold text-accent dark:text-accent-subtle">
                          <Counter to={count} />
                        </span>
                        <span className="text-warm-muted font-mono">{pct}%</span>
                      </div>
                      <div className="w-full bg-warm-border/60 dark:bg-dark-border/60 h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                          className="bg-accent dark:bg-accent-subtle h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Index Configuration Summary */}
            <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-soft space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>Vector Index Pipeline Specification</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-warm-bg dark:bg-dark-bg rounded-2xl border border-warm-border dark:border-dark-border">
                  <span className="text-[10px] text-warm-muted block mb-1">Embedding Space</span>
                  <span className="font-semibold text-warm-text dark:text-dark-text">
                    {report.index_config?.embedding_model || 'local-hash-384'}
                  </span>
                </div>

                <div className="p-3 bg-warm-bg dark:bg-dark-bg rounded-2xl border border-warm-border dark:border-dark-border">
                  <span className="text-[10px] text-warm-muted block mb-1">Chunk Parameters</span>
                  <span className="font-semibold text-warm-text dark:text-dark-text">
                    {report.index_config?.chunk_size || 700} / {report.index_config?.chunk_overlap || 100} chars
                  </span>
                </div>

                <div className="p-3 bg-warm-bg dark:bg-dark-bg rounded-2xl border border-warm-border dark:border-dark-border">
                  <span className="text-[10px] text-warm-muted block mb-1">Top-k Default</span>
                  <span className="font-semibold text-warm-text dark:text-dark-text">
                    {report.index_config?.top_k || 8} Passages
                  </span>
                </div>

                <div className="p-3 bg-warm-bg dark:bg-dark-bg rounded-2xl border border-warm-border dark:border-dark-border">
                  <span className="text-[10px] text-warm-muted block mb-1">Reranker Adapter</span>
                  <span className="font-semibold text-warm-text dark:text-dark-text">
                    {report.index_config?.reranker_enabled ? 'Active Cross-Encoder' : 'Disabled (RRF Default)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
