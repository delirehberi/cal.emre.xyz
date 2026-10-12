import React from 'react';
import { clsx } from 'clsx';

export interface WordmarkProps {
  className?: string;
}

/**
 * The lowercase "kün" wordmark in Bricolage Grotesque ExtraBold.
 * The ü carries two hand-placed dots: one ink, one green (the open slot).
 * Everything is sized in em, so the wordmark scales with its font size.
 */
export const Wordmark: React.FC<WordmarkProps> = ({ className }) => (
  <span
    className={clsx(
      'inline-flex items-start font-display font-extrabold leading-none tracking-[-0.03em] text-ink whitespace-nowrap',
      className
    )}
    aria-hidden="true"
  >
    <span className="mr-[-0.01em]">k</span>
    <span className="relative mr-[-0.01em] inline-flex items-start">
      <span>u</span>
      <span className="absolute left-[0.2103em] top-[0.105em] h-[0.145em] w-[0.145em] rounded-full bg-ink" />
      <span className="absolute left-[0.3987em] top-[0.105em] h-[0.145em] w-[0.145em] rounded-full bg-slot" />
    </span>
    <span>n</span>
  </span>
);
