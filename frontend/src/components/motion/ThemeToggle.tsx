import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Magnetic } from './Magnetic';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Magnetic strength={0.3}>
      <button
        onClick={toggleTheme}
        aria-label="Toggle visual theme"
        className="relative w-9 h-9 rounded-full bg-warm-card dark:bg-dark-card border border-warm-border dark:border-dark-border flex items-center justify-center text-warm-text dark:text-dark-text shadow-soft hover:border-accent dark:hover:border-accent-subtle transition-colors"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Moon className="w-4 h-4 text-teal-400" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ opacity: 0, rotate: 90, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.7 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Sun className="w-4 h-4 text-amber-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </Magnetic>
  );
};
