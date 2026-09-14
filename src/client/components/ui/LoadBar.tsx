import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface LoadBarProps {
  /** Whether the loading animation is currently active */
  active?: boolean;
  /** If true, fixes the loadbar to the very top edge of the viewport (z-50) */
  fixedTop?: boolean;
  /** Optional custom CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

export const LoadBar: React.FC<LoadBarProps> = ({
  active = true,
  fixedTop = false,
  className,
  label = 'Loading',
}) => {
  if (!active) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      className={twMerge(
        clsx(
          fixedTop
            ? 'fixed top-0 left-0 right-0 z-50 h-1'
            : 'relative h-1.5 w-full rounded-full',
          'overflow-hidden bg-line',
          className
        )
      )}
    >
      <div className="h-full w-full animate-loadbar origin-left bg-ink" />
    </div>
  );
};
