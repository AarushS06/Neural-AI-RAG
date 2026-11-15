import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { CompareResult, DocumentRecord } from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import { TiltCard } from '../components/motion/TiltCard';
import {
  GitCompare,
  ShieldAlert,
  Sparkles,
  Users,
  Target,
  Scale,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export const ComparePage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDocuments().then((res) => {
      setDocuments(res.documents);
      if (res.documents.length >= 2) {
        setSelectedIds([res.documents[0].id, res.documents[1].id]);
      } else if (res.documents.length === 1) {
        setSelectedIds([res.documents[0].id]);
      }
    }).catch(() => {});
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (selectedIds.length >= 2) {
      runCompare();
    } else {
      setCompareResult(null);
    }
  }, [selectedIds]);

  const runCompare = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.compare(selectedIds);
      setCompareResult(res);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderValue = (val?: string) => {
    if (!val || val === 'not available') {
      return (
        <span className="text-warm-muted dark:text-dark-muted italic">
          Not available in extracted text
        </span>
      );
    }
    return <span className="font-medium text-warm-text dark:text-dark-text">{val}</span>;
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle font-mono text-xs font-semibold">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Multi-Study Comparative Synthesis</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-text dark:text-dark-text tracking-tight">
            Compare Research Papers & Outcomes
          </h1>
          <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext leading-relaxed">
            Side-by-side analysis of clinical PICO parameters, trial controls, sample characteristics, and shared vocabulary.
          </p>
        </div>

        {/* Document Selection Pills */}
        <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-warm-text dark:text-dark-text">
            <span>Select 2 or more documents to compare ({selectedIds.length} chosen):</span>
            <span className="text-warm-muted text-[11px] font-normal">
              Click pill to toggle
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {documents.length === 0 ? (
              <span className="text-xs text-warm-muted">No documents available in library.</span>
            ) : (
              documents.map((d) => {
                const isSelected = selectedIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleSelect(d.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-accent text-white border-accent shadow-soft'
                        : 'bg-warm-bg dark:bg-dark-bg border-warm-border dark:border-dark-border text-warm-text dark:text-dark-text hover:border-accent'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span className="max-w-[200px] truncate">
                      {d.metadata?.metadata?.title || d.filename}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Scientific Disclaimer */}
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-soft">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Heuristic Assistance Notice:</strong> Cross-study comparison evaluates token overlap and extracted PICO criteria. It is <strong>heuristic assistance, not scientific truth</strong>. Clinical consensus or contradiction requires qualified medical expert review.
          </div>
        </div>

        {/* Results Area */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 bg-warm-card dark:bg-dark-card rounded-3xl border border-warm-border dark:border-dark-border animate-pulse" />
            <div className="h-64 bg-warm-card dark:bg-dark-card rounded-3xl border border-warm-border dark:border-dark-border animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-2xl border border-rose-200">
            {error}
          </div>
        ) : compareResult ? (
          <div className="space-y-6">
            {/* Shared Vocabulary Bento Box */}
            <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 shadow-soft space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-accent dark:text-accent-subtle uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Heuristic Terminology Overlap</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-warm-bg dark:bg-dark-bg p-4 rounded-2xl border border-warm-border dark:border-dark-border space-y-2">
                  <span className="font-semibold text-warm-text dark:text-dark-text block">
                    Shared Vocabulary Tokens:
                  </span>
                  {compareResult.heuristic_analysis?.shared_terms?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {compareResult.heuristic_analysis.shared_terms.map((term, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-warm-surface dark:bg-dark-surface border border-warm-border dark:border-dark-border text-warm-text dark:text-dark-text font-mono text-[11px]"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-warm-muted italic">No shared terms detected.</span>
                  )}
                </div>

                <div className="bg-warm-bg dark:bg-dark-bg p-4 rounded-2xl border border-warm-border dark:border-dark-border space-y-2">
                  <span className="font-semibold text-warm-text dark:text-dark-text block">
                    Disagreement & Agreement Signals:
                  </span>
                  <p className="text-warm-subtext dark:text-dark-subtext leading-relaxed">
                    <strong>Vocabulary Status:</strong>{' '}
                    {compareResult.heuristic_analysis?.agreement}
                  </p>
                  <p className="text-warm-subtext dark:text-dark-subtext leading-relaxed">
                    <strong>Adjudication:</strong>{' '}
                    {compareResult.heuristic_analysis?.disagreement}
                  </p>
                </div>
              </div>
            </TiltCard>

            {/* Side-by-Side Comparison Matrix */}
            <div className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl overflow-hidden shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-warm-bg dark:bg-dark-bg border-b border-warm-border dark:border-dark-border text-warm-muted dark:text-dark-muted uppercase text-[10px] tracking-wider">
                      <th className="py-4 px-6 w-48 font-semibold">Criteria</th>
                      {compareResult.documents.map((doc) => (
                        <th
                          key={doc.id}
                          className="py-4 px-6 font-bold text-warm-text dark:text-dark-text min-w-[280px]"
                        >
                          <div className="font-display text-sm truncate">
                            {doc.metadata?.metadata?.title || doc.filename}
                          </div>
                          <div className="font-sans font-normal text-[11px] text-warm-muted normal-case mt-0.5">
                            {doc.filename}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-border/60 dark:divide-dark-border/60">
                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Template
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6 capitalize">
                          {doc.template?.replace(/_/g, ' ')}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Study Design
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium capitalize">
                            {doc.quality?.study_type || 'Unspecified'}
                          </span>
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Population (P)
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6 leading-relaxed">
                          {renderValue(doc.metadata?.metadata?.population)}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Intervention (I)
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6 leading-relaxed">
                          {renderValue(doc.metadata?.metadata?.intervention)}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Comparator (C)
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6 leading-relaxed">
                          {renderValue(doc.metadata?.metadata?.comparator)}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Outcomes (O)
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6 leading-relaxed">
                          {renderValue(doc.metadata?.metadata?.outcomes)}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="py-4 px-6 font-semibold text-warm-muted dark:text-dark-muted">
                        Year / Journal
                      </td>
                      {compareResult.documents.map((doc) => (
                        <td key={doc.id} className="py-4 px-6">
                          {doc.metadata?.metadata?.year || 'N/A'} •{' '}
                          {doc.metadata?.metadata?.journal || 'Unlisted'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 text-center bg-warm-card dark:bg-dark-card rounded-3xl border border-warm-border dark:border-dark-border shadow-soft space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent/10 dark:bg-accent-subtle/15 text-accent dark:text-accent-subtle mx-auto flex items-center justify-center">
              <GitCompare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-warm-text dark:text-dark-text">
                Select at least 2 documents to compare
              </h3>
              <p className="text-xs text-warm-subtext dark:text-dark-subtext max-w-md mx-auto leading-relaxed">
                Click two or more research papers from the selector above to generate an automated side-by-side clinical comparison of PICO criteria (Population, Intervention, Comparator, Outcomes) and terminology overlap.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};
