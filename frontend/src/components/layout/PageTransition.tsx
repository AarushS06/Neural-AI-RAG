import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageTransitionVariants } from '../../lib/motion';

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();

  const variants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : pageTransitionVariants;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full h-full flex flex-col flex-1"
    >
      {children}
    </motion.div>
  );
};
