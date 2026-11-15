import React from 'react';
import { motion, useInView } from 'framer-motion';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  wordClassName?: string;
}

export const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = '',
  delay = 0,
  wordClassName = '',
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  const words = text.split(' ');

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden whitespace-nowrap mr-[0.28em] last:mr-0">
          <motion.span
            initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
            animate={
              isInView
                ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                : { opacity: 0, y: 22, filter: 'blur(8px)' }
            }
            transition={{
              duration: 0.5,
              delay: delay + i * 0.035,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`inline-block ${wordClassName}`}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};
