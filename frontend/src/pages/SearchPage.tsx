import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { SearchResultItem } from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import { TiltCard } from '../components/motion/TiltCard';
import {
  Search,
  Layers,
  FileText,
  Bookmark,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Globe,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'both' | 'local' | 'web'>('both');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [webResults, setWebResults] = useState<any[]>([]);
  const [retrievalMeta, setRetrievalMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [topK, setTopK] = useState(8);
  const [hasSearched, setHasSearched] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK, scope }),
      });
      const data = await res.json();
      setResults(data.results || []);
      setWebResults(data.web_results || []);
      setRetrievalMeta(data.retrieval || null);
    } catch {
      setResults([]);
      setWebResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWebPaper = async (paper: any) => {
    setImportingId(paper.id);
    try {
      const res = await fetch('/api/search/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              title: paper.title,
              abstract: paper.abstract,
              url: paper.url,
              doi: paper.doi,
              open_access_pdf_url: paper.open_access_pdf_url,
            },
          ],
        }),
      });
      if (res.ok) {
        setImportedIds((prev) => new Set(prev).add(paper.id));
      }
    } catch {
      // ignore
    } finally {
      setImportingId(null);
    }
  };

  const sampleSearches = [
    'amyloid-beta monoclonal antibody',
    'randomized controlled trial limitations',
    'dietary adherence cognitive decline',
    'adverse events and ARIA-E',
  ];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle font-mono text-xs font-semibold">
            <Search className="w-3.5 h-3.5" />
            <span>Hybrid Dense + Sparse & Web Search</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-text dark:text-dark-text tracking-tight">
            Explore Biomedical Literature
          </h1>
          <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext">
            Execute direct vector similarity, BM25 token matching, or discover open-access research from Europe PMC, Semantic Scholar, and PubMed.
          </p>
        </div>

        {/* Search Bar & Scope Selector */}
        <form onSubmit={handleSearch} className="max-w-3xl mx-auto space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-warm-muted dark:text-dark-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by biomedical concept, intervention, drug name, or trial methodology..."
              className="w-full pl-12 pr-32 py-4 bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-full text-sm text-warm-text dark:text-dark-text placeholder:text-warm-muted focus:outline-none focus:ring-2 focus:ring-accent/40 shadow-soft transition"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-full text-xs font-semibold text-white shadow-soft transition ${
                !query.trim() || isLoading
                  ? 'bg-warm-muted/40 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Scope Segmented Control */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-2 text-xs">
            <div className="flex items-center gap-1.5 bg-warm-card dark:bg-dark-card p-1 rounded-full border border-warm-border dark:border-dark-border">
              {(['both', 'local', 'web'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`px-3.5 py-1.5 rounded-full capitalize font-medium transition ${
                    scope === s
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-warm-subtext dark:text-dark-subtext hover:text-warm-text'
                  }`}
                >
                  {s === 'both' ? 'All (Local + Web)' : s === 'local' ? 'Local Indexed' : 'Web Literature'}
                </button>
              ))}
            </div>

            {/* Sample Search Pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] text-warm-muted">Suggestions:</span>
              {sampleSearches.slice(0, 2).map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                  }}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border hover:border-accent transition text-warm-subtext truncate max-w-[160px]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Shimmer loading skeleton */}
        {isLoading && (
          <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-6 rounded-3xl bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border space-y-3">
                <div className="w-1/3 h-5 bg-warm-border dark:bg-dark-border rounded-lg" />
                <div className="w-full h-12 bg-warm-border dark:bg-dark-border rounded-lg" />
                <div className="w-1/4 h-4 bg-warm-border dark:bg-dark-border rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Results Stream */}
        {!isLoading && hasSearched && (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Local Indexed Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-warm-border dark:border-dark-border">
                  <span className="font-display font-bold text-lg text-warm-text dark:text-dark-text flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent dark:text-accent-subtle" />
                    <span>Local Indexed Passages ({results.length})</span>
                  </span>
                  <span className="text-[11px] font-mono text-warm-muted">RRF Ranked</span>
                </div>

                <div className="space-y-4">
                  {results.map((r, i) => (
                    <TiltCard key={r.chunk_id || i} className="p-6 bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border shadow-soft space-y-3">
                      <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle">
                          Score: {(r.score * 100).toFixed(2)}
                        </span>
                        <span className="text-warm-muted">
                          {r.source} • Page {r.page_start} • {r.section}
                        </span>
                      </div>
                      <blockquote className="text-xs sm:text-sm text-warm-text dark:text-dark-text leading-relaxed font-serif italic border-l-3 border-accent pl-3">
                        "{r.content}"
                      </blockquote>
                    </TiltCard>
                  ))}
                </div>
              </div>
            )}

            {/* Web Literature Results */}
            {webResults.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between pb-2 border-b border-warm-border dark:border-dark-border">
                  <span className="font-display font-bold text-lg text-warm-text dark:text-dark-text flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-600 dark:text-accent-subtle" />
                    <span>Online Research Literature ({webResults.length})</span>
                  </span>
                  <span className="text-[11px] font-mono text-warm-muted">Europe PMC / S2 / PubMed</span>
                </div>

                <div className="space-y-4">
                  {webResults.map((w, i) => {
                    const isImported = importedIds.has(w.id);
                    const isImporting = importingId === w.id;

                    return (
                      <TiltCard key={w.id || i} className="p-6 bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border shadow-soft space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold">
                              {w.source} • {w.year || 'Recent'}
                            </span>
                            <h3 className="font-display font-bold text-base text-warm-text dark:text-dark-text leading-snug">
                              {w.title}
                            </h3>
                            <p className="text-xs text-warm-muted">
                              {w.authors} • {w.venue}
                            </p>
                          </div>

                          <button
                            onClick={() => handleImportWebPaper(w)}
                            disabled={isImported || isImporting}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-soft transition ${
                              isImported
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-accent hover:bg-accent-hover text-white'
                            }`}
                          >
                            {isImported ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Imported</span>
                              </>
                            ) : (
                              <>
                                <DownloadCloud className="w-3.5 h-3.5" />
                                <span>{isImporting ? 'Importing...' : 'Import to RAG'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-warm-subtext dark:text-dark-subtext line-clamp-3 leading-relaxed">
                          {w.abstract}
                        </p>

                        {w.url && (
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-accent dark:text-accent-subtle hover:underline font-medium"
                          >
                            <span>View original publication</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TiltCard>
                    );
                  })}
                </div>
              </div>
            )}

            {results.length === 0 && webResults.length === 0 && (
              <div className="text-center py-12 text-warm-muted dark:text-dark-muted space-y-2">
                <Search className="w-8 h-8 mx-auto text-warm-border" />
                <p className="text-sm">No passages or papers matched your query.</p>
                <p className="text-xs">Try broader terms or select 'All (Local + Web)'.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
};
