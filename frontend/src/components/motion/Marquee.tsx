import React from 'react';

interface MarqueeProps {
  items: string[];
  speedSeconds?: number;
}

export const Marquee: React.FC<MarqueeProps> = ({ items, speedSeconds = 30 }) => {
  return (
    <div className="relative w-full overflow-hidden py-3 bg-warm-card/60 dark:bg-dark-card/60 border-y border-warm-border/60 dark:border-dark-border/60 backdrop-blur-xs select-none">
      {/* Blur fade edge masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-warm-bg dark:from-dark-bg to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-warm-bg dark:from-dark-bg to-transparent" />

      <div
        className="flex gap-8 whitespace-nowrap animate-marquee"
        style={{ animationDuration: `${speedSeconds}s` }}
      >
        {/* Render items twice for infinite loop */}
        {[...items, ...items, ...items, ...items].map((text, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 text-xs uppercase tracking-widest font-mono text-warm-subtext dark:text-dark-subtext"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-subtle" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
