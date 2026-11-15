import React from 'react';
import { AlertCircle, ShieldAlert, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-warm-border/80 dark:border-dark-border/80 bg-warm-card/90 dark:bg-dark-card/90 backdrop-blur-md py-2.5 px-4 sm:px-6 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        {/* Mandatory Medical Disclaimer */}
        <div className="flex items-center gap-2 text-[11px] text-warm-subtext dark:text-dark-subtext font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-accent dark:text-accent-subtle flex-shrink-0" />
          <span>
            <strong>Healthcare Research Exploration Only:</strong> Not medical advice, clinical diagnosis, or emergency guidance. Don't upload personal health information (PHI).
          </span>
        </div>

        {/* Engine provenance notice */}
        <div className="flex items-center gap-3 text-[11px] text-warm-muted dark:text-dark-muted font-mono">
          <span>FastAPI • Local Hybrid RRF • Qdrant-Ready</span>
        </div>
      </div>
    </footer>
  );
};
