import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import Lenis from 'lenis';

import { ThemeProvider } from './hooks/useTheme';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ScrollProgress } from './components/motion/ScrollProgress';
import { IntroLogoReveal } from './components/motion/IntroLogoReveal';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { SearchPage } from './pages/SearchPage';
import { ComparePage } from './pages/ComparePage';
import { QualityPage } from './pages/QualityPage';
import { SettingsPage } from './pages/SettingsPage';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/quality" element={<QualityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Legacy redirect for previous paths */}
        <Route path="/assistant" element={<Navigate to="/chat" replace />} />
        <Route path="/library" element={<Navigate to="/documents" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export const App: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  // Initialize smooth scrolling with Lenis unless reduced motion is preferred
  useEffect(() => {
    if (shouldReduceMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [shouldReduceMotion]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-warm-bg dark:bg-dark-bg text-warm-text dark:text-dark-text transition-colors duration-300 relative selection:bg-accent/25 selection:text-accent dark:selection:bg-accent-subtle/30 dark:selection:text-accent-subtle">
          <IntroLogoReveal />
          <ScrollProgress />
          <Navbar />
          <main className="flex-1 flex flex-col">
            <AnimatedRoutes />
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
