import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const IntroLogoReveal: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show only once per browser session
    const seen = sessionStorage.getItem('veritycare_intro_seen');
    if (!seen) {
      setShow(true);
      sessionStorage.setItem('veritycare_intro_seen', 'true');
      const timer = setTimeout(() => setShow(false), 1100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-warm-bg dark:bg-dark-bg cursor-pointer select-none"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-16 h-16 rounded-3xl bg-accent text-white flex items-center justify-center shadow-lift shadow-accent/25"
            >
              <span className="font-display font-bold text-3xl italic">V</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <h1 className="font-display text-2xl font-bold tracking-tight text-warm-text dark:text-dark-text">
                VerityCare
              </h1>
              <p className="text-xs uppercase font-mono tracking-widest text-accent dark:text-accent-subtle mt-0.5">
                Evidence-First Literature RAG
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
