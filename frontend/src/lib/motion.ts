import { Variants, Transition } from 'framer-motion';

// Easing presets
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeInOutCubic = [0.65, 0, 0.35, 1] as const;

// Spring presets
export const springDefault: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
};

// Page transition with subtle y-slide and blur
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    filter: 'blur(10px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.42,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: 'blur(8px)',
    transition: {
      duration: 0.28,
      ease: [0.65, 0, 0.35, 1],
    },
  },
};

// Stagger containers
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

export const staggerChild: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.48,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// Card hover scale and glow
export const cardHoverVariants: Variants = {
  initial: { y: 0, scale: 1 },
  hover: {
    y: -4,
    scale: 1.012,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};
