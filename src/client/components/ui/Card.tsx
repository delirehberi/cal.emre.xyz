import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const variantStyles = {
    default:
      'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm',
    flat:
      'bg-stone-50 dark:bg-stone-950 border border-stone-200/70 dark:border-stone-800/70',
    subtle:
      'bg-stone-100/60 dark:bg-stone-900/50 border border-transparent',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-xl p-5 md:p-6 transition-colors',
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
