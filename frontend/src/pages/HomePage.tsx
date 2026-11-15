import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { SystemStatus } from '../lib/types';
import { PageTransition } from '../components/layout/PageTransition';
import { SplitText } from '../components/motion/SplitText';
import { TiltCard } from '../components/motion/TiltCard';
import { Counter } from '../components/motion/Counter';
import { Marquee } from '../components/motion/Marquee';
import { Magnetic } from '../components/motion/Magnetic';
import {
  Sparkles,
  ArrowRight,
  UploadCloud,
  MessageSquare,
  ShieldCheck,
  Layers,
  Database,
  Search,
  BookOpen,
  CheckCircle2,
  Lock,
  Binary,
  Globe,
  Cpu,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    api.getSystemStatus().then(setStatus).catch(() => {});
  }, []);

  const samplePrompts = [
    'What clinical outcomes and CDR-SB score reductions were observed in trials?',
    'What limitations or adverse events were reported in the indexed studies?',
    'Summarize patient population characteristics and comparative controls.',
    'Compare efficacy between pharmacological and dietary interventions.',
  ];

  const trustPhrases = [
    'Verifiable Page-Level Citations',
    'Dense Semantic & BM25 Hybrid Fusion',
    'Deterministic PICO Extraction',
    'Zero Silent Redactions',
    'OpenAI & Extractive Synthesis',
    'Online Medical Literature Retrieval',
    'Deterministic PHI Auditing',
  ];

  return (
    <PageTransition>
      <div className="relative overflow-hidden min-h-[calc(100vh-8rem)] flex flex-col justify-between">
        {/* Subtle Ambient Grain & Gradient Blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/15 dark:bg-accent/25 blur-3xl animate-blob" />
          <div className="absolute top-48 -right-32 w-[28rem] h-[28rem] rounded-full bg-teal-200/20 dark:bg-emerald-950/40 blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-emerald-300/15 dark:bg-accent-subtle/20 blur-3xl animate-blob animation-delay-4000" />
          <div className="absolute inset-0 bg-grain opacity-60" />
        </div>

        {/* Hero Section */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-8 w-full text-center space-y-8">
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-xs font-medium text-warm-text dark:text-dark-text shadow-soft backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-accent dark:bg-accent-subtle animate-pulse"></span>
            <span className="font-semibold text-accent dark:text-accent-subtle">RAG 2.0 Biomedical Assistant</span>
            <span className="text-warm-muted dark:text-dark-muted">•</span>
            <span>Zero Hallucinated Citations</span>
          </motion.div>

          {/* Huge Display Heading with characterful serif and word reveal */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.08] text-warm-text dark:text-dark-text font-bold">
              <SplitText text="Evidence you can inspect," delay={0.05} />{' '}
              <span className="italic font-normal text-accent dark:text-accent-subtle block sm:inline">
                not just hallucinated text.
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-warm-subtext dark:text-dark-subtext max-w-2xl mx-auto font-sans leading-relaxed">
              VerityCare transforms biomedical trials and guidelines into structure-aware, verifiable knowledge. Every claim ties back to exact PDF pages, section headers, and clinical PICO parameters.
            </p>
          </div>

          {/* CTA Buttons with Magnetic effect */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <Magnetic strength={0.2}>
              <Link
                to="/chat"
                className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-accent text-white font-medium text-sm shadow-lift hover:bg-accent-hover transition-all duration-300 active:scale-95"
              >
                <span>Start Literature Inquiry</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>

            <Magnetic strength={0.2}>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-warm-text dark:text-dark-text font-medium text-sm hover:border-accent dark:hover:border-accent-subtle transition-all duration-300 shadow-soft"
              >
                <UploadCloud className="w-4 h-4 text-accent dark:text-accent-subtle" />
                <span>Upload Research PDF</span>
              </Link>
            </Magnetic>
          </motion.div>
        </div>

        {/* Infinite Trust Marquee */}
        <div className="my-6">
          <Marquee items={trustPhrases} speedSeconds={34} />
        </div>

        {/* Live Metrics Row with Animated Counters */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-warm-card/80 dark:bg-dark-card/80 border border-warm-border dark:border-dark-border text-center backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-mono text-warm-muted dark:text-dark-muted block mb-1">
                Indexed Papers
              </span>
              <Counter
                to={status?.document_count ?? 4}
                className="font-display text-3xl font-bold text-warm-text dark:text-dark-text"
              />
            </div>

            <div className="p-4 rounded-2xl bg-warm-card/80 dark:bg-dark-card/80 border border-warm-border dark:border-dark-border text-center backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-mono text-warm-muted dark:text-dark-muted block mb-1">
                Vector Passages
              </span>
              <Counter
                to={status?.chunk_count ?? 117}
                className="font-display text-3xl font-bold text-accent dark:text-accent-subtle"
              />
            </div>

            <div className="p-4 rounded-2xl bg-warm-card/80 dark:bg-dark-card/80 border border-warm-border dark:border-dark-border text-center backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-mono text-warm-muted dark:text-dark-muted block mb-1">
                Vector Dimension
              </span>
              <Counter
                to={status?.embedding_dimension ?? 384}
                suffix="-d"
                className="font-display text-3xl font-bold text-warm-text dark:text-dark-text"
              />
            </div>

            <div className="p-4 rounded-2xl bg-warm-card/80 dark:bg-dark-card/80 border border-warm-border dark:border-dark-border text-center backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-mono text-warm-muted dark:text-dark-muted block mb-1">
                LLM Provider
              </span>
              <span className="font-display text-2xl font-bold text-warm-text dark:text-dark-text uppercase">
                {status?.llm_provider || 'OpenAI / Local'}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Grid Feature Highlights with TiltCards */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase font-mono tracking-widest text-accent dark:text-accent-subtle font-bold">
              Architectural Rigor
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-warm-text dark:text-dark-text">
              Engineered for verified clinical inquiry
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TiltCard className="bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border p-6 shadow-soft">
              <div className="w-10 h-10 rounded-2xl bg-accent/10 dark:bg-accent-subtle/15 text-accent dark:text-accent-subtle flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-warm-text dark:text-dark-text mb-2">
                Structure-Preserving Chunks
              </h3>
              <p className="text-xs text-warm-subtext dark:text-dark-subtext leading-relaxed">
                Chunks respect sentence boundaries, retaining page provenance and section headers (Abstract, Methods, Results, Limitations).
              </p>
            </TiltCard>

            <TiltCard className="bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border p-6 shadow-soft">
              <div className="w-10 h-10 rounded-2xl bg-accent/10 dark:bg-accent-subtle/15 text-accent dark:text-accent-subtle flex items-center justify-center mb-4">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-warm-text dark:text-dark-text mb-2">
                Hybrid Search + RRF
              </h3>
              <p className="text-xs text-warm-subtext dark:text-dark-subtext leading-relaxed">
                Dense semantic vector similarity paired with exact BM25 keyword matching, merged via Reciprocal Rank Fusion.
              </p>
            </TiltCard>

            <TiltCard className="bg-warm-card dark:bg-dark-card border-warm-border dark:border-dark-border p-6 shadow-soft">
              <div className="w-10 h-10 rounded-2xl bg-accent/10 dark:bg-accent-subtle/15 text-accent dark:text-accent-subtle flex items-center justify-center mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-warm-text dark:text-dark-text mb-2">
                Live Web Literature Search
              </h3>
              <p className="text-xs text-warm-subtext dark:text-dark-subtext leading-relaxed">
                Discover papers online from Europe PMC, Semantic Scholar, and PubMed, and import open-access research with one click.
              </p>
            </TiltCard>
          </div>
        </div>

        {/* Sample Question Chips */}
        <div className="max-w-4xl mx-auto px-4 pb-12 w-full text-center space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-warm-muted dark:text-dark-muted">
            Explore sample clinical queries:
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => navigate(`/chat?q=${encodeURIComponent(p)}`)}
                className="px-4 py-2 rounded-full text-xs bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-warm-subtext dark:text-dark-subtext hover:border-accent hover:text-accent dark:hover:text-accent-subtle transition shadow-xs text-left"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
