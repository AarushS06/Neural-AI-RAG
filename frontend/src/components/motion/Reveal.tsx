import React from 'react';
import { motion, useInView } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  const getOffset = () => {
    switch (direction) {
      case 'up': return { y: 24, x: 0 };
      case 'down': return { y: -24, x: 0 };
      case 'left': return { x: 24, y: 0 };
      case 'right': return { x: -24, y: 0 };
    }
  };

  const offset = getOffset();

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ opacity: 0, ...offset, filter: 'blur(8px)' }}
        animate={
          isInView
            ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }
            : { opacity: 0, ...offset, filter: 'blur(8px)' }
        }
        transition={{
          duration: 0.55,
          delay,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};
