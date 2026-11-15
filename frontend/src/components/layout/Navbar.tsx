import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { SystemStatus } from '../../lib/types';
import { ThemeToggle } from '../motion/ThemeToggle';
import {
  Sparkles,
  MessageSquare,
  Files,
  Search,
  GitCompare,
  ShieldCheck,
  Settings,
  Activity,
  Menu,
  X,
} from 'lucide-react';

export const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Sparkles },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/documents', label: 'Documents', icon: Files },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/compare', label: 'Compare', icon: GitCompare },
  { path: '/quality', label: 'Quality', icon: ShieldCheck },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    api.getSystemStatus().then(setStatus).catch(() => {});
    const interval = setInterval(() => {
      api.getSystemStatus().then(setStatus).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-warm-bg/75 dark:bg-dark-bg/80 border-b border-warm-border/75 dark:border-dark-border/75 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-2xl bg-accent flex items-center justify-center text-white shadow-soft shadow-accent/20 transition-transform group-hover:scale-105">
            <span className="font-display font-bold text-lg italic">V</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg tracking-tight font-bold text-warm-text dark:text-dark-text">
                VerityCare
              </span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-accent/10 text-accent dark:bg-accent-subtle/15 dark:text-accent-subtle">
                RAG 2.0
              </span>
            </div>
            <p className="text-[10px] text-warm-muted dark:text-dark-muted font-sans tracking-wide">
              Evidence you can inspect
            </p>
          </div>
        </NavLink>

        {/* Desktop Navigation with Animated Glide Indicator */}
        <nav className="hidden md:flex items-center gap-1 bg-warm-card/90 dark:bg-dark-card/90 border border-warm-border/80 dark:border-dark-border/80 rounded-full p-1.5 shadow-soft backdrop-blur-md">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`relative px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white'
                    : 'text-warm-subtext dark:text-dark-subtext hover:text-warm-text dark:hover:text-dark-text'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-accent rounded-full shadow-xs -z-0"
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 32,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right Status Pill & Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* Live Backend Status Pill */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border text-xs shadow-soft"
            title={`Backend: ${status?.status || 'Active'} | ${status?.document_count ?? 0} docs | ${status?.chunk_count ?? 0} chunks`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono text-warm-subtext dark:text-dark-subtext">
              {status?.document_count ?? 0} papers • {status?.chunk_count ?? 0} passages
            </span>
          </div>

          <ThemeToggle />

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-warm-text dark:text-dark-text hover:bg-warm-card dark:hover:bg-dark-card transition"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-warm-border dark:border-dark-border bg-warm-card dark:bg-dark-card px-4 py-4 space-y-1 shadow-lift"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-accent text-white shadow-soft'
                    : 'text-warm-subtext dark:text-dark-subtext hover:bg-warm-bg dark:hover:bg-dark-bg'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </motion.div>
      )}
    </header>
  );
};
