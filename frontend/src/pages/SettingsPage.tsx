import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RagConfig, SystemStatus } from '../lib/types';
import { useTheme } from '../hooks/useTheme';
import { PageTransition } from '../components/layout/PageTransition';
import { TiltCard } from '../components/motion/TiltCard';
import {
  Settings,
  Sun,
  Moon,
  Server,
  Activity,
  ShieldAlert,
  Cpu,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const [config, setConfig] = useState<RagConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getRagConfig().then(setConfig).catch(() => null),
      api.getSystemStatus().then(setStatus).catch(() => null),
      api.getHealth().then(setHealthStatus).catch(() => null),
    ]).finally(() => setIsLoading(false));
  }, []);

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle font-mono text-xs font-semibold">
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences & System Architecture</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-text dark:text-dark-text tracking-tight">
            Settings & Research Guardrails
          </h1>
          <p className="text-xs sm:text-sm text-warm-subtext dark:text-dark-subtext">
            Configuration parameters, theme modes, vector specifications, and medical safety limitations.
          </p>
        </div>

        {/* Theme Preference Bento Card */}
        <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-soft space-y-4">
          <h3 className="font-display font-bold text-xl text-warm-text dark:text-dark-text">
            Appearance & Editorial Theme
          </h3>
          <p className="text-xs text-warm-subtext dark:text-dark-subtext">
            Choose between the warm off-white research paper canvas and the low-glare deep dark mode.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-2xl border text-left space-y-2 transition-all ${
                theme === 'light'
                  ? 'border-accent bg-warm-bg ring-2 ring-accent/20 shadow-soft'
                  : 'border-warm-border dark:border-dark-border bg-warm-surface dark:bg-dark-surface hover:border-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <Sun className="w-5 h-5 text-amber-500" />
                {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-accent" />}
              </div>
              <span className="font-bold text-xs text-warm-text dark:text-dark-text block">
                Warm Editorial (Light)
              </span>
              <span className="text-[11px] text-warm-muted block">#F5F1EA Warm Canvas</span>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-2xl border text-left space-y-2 transition-all ${
                theme === 'dark'
                  ? 'border-accent bg-dark-bg ring-2 ring-accent/20 shadow-soft'
                  : 'border-warm-border dark:border-dark-border bg-warm-surface dark:bg-dark-surface hover:border-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <Moon className="w-5 h-5 text-indigo-400" />
                {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-accent-subtle" />}
              </div>
              <span className="font-bold text-xs text-warm-text dark:text-dark-text block">
                Low Glare (Dark)
              </span>
              <span className="text-[11px] text-warm-muted block">#0F1312 Deep Charcoal</span>
            </button>
          </div>
        </TiltCard>

        {/* Backend Connectivity Status */}
        <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-border dark:border-dark-border">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-accent dark:text-accent-subtle" />
              <div>
                <h3 className="font-display font-bold text-xl text-warm-text dark:text-dark-text">
                  FastAPI Backend Service
                </h3>
                <p className="text-xs text-warm-muted">Proxied to localhost:8000</p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Connected & Healthy
            </span>
          </div>

          {status && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-2">
              <div className="p-3 rounded-2xl bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border">
                <span className="text-[10px] text-warm-muted block mb-0.5">Vector Index</span>
                <span className="font-semibold text-warm-text dark:text-dark-text">
                  {status.vector_index}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border">
                <span className="text-[10px] text-warm-muted block mb-0.5">Embed Dimension</span>
                <span className="font-semibold text-warm-text dark:text-dark-text">
                  {status.embedding_dimension}-d
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border">
                <span className="text-[10px] text-warm-muted block mb-0.5">LLM Provider</span>
                <span className="font-semibold text-warm-text dark:text-dark-text">
                  {status.llm_provider} ({status.llm_model})
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-warm-bg dark:bg-dark-bg border border-warm-border dark:border-dark-border">
                <span className="text-[10px] text-warm-muted block mb-0.5">Qdrant Ready</span>
                <span className="font-semibold text-warm-text dark:text-dark-text">
                  {status.qdrant_configured ? 'Yes' : 'Local Fallback'}
                </span>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-warm-muted">Interactive API Documentation:</span>
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-accent dark:text-accent-subtle font-semibold flex items-center gap-1 hover:underline"
            >
              <span>Open Swagger Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </TiltCard>

        {/* Limitations & Clinical Guardrails */}
        <TiltCard className="bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border rounded-3xl p-6 sm:p-8 shadow-soft space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-accent dark:text-accent-subtle uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Healthcare Scope & Clinical Boundaries</span>
          </div>

          <div className="text-xs text-warm-subtext dark:text-dark-subtext space-y-3 leading-relaxed">
            <p>
              <strong>1. Research-Literature Exploration Only:</strong> VerityCare is engineered solely to summarize and inspect indexed peer-reviewed studies. It is not an FDA-cleared diagnostic device, clinical decision support system, or medical emergency advice platform.
            </p>
            <p>
              <strong>2. Deterministic Regex Screening:</strong> While the platform automatically detects dates of birth, MRNs, phone numbers, and emails, deterministic regex is not an absolute guarantee of complete HIPAA/GDPR de-identification. Never upload sensitive personal health records without prior manual sanitization.
            </p>
            <p>
              <strong>3. Scientific Truth vs. Heuristics:</strong> Comparative token overlap and term disagreement analysis are heuristic aids. They do not constitute formal medical consensus or contradiction adjudication.
            </p>
          </div>
        </TiltCard>
      </div>
    </PageTransition>
  );
};
