import React from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `default` sits on the paper background; `flat` is the empty-state/inset surface. */
  variant?: 'default' | 'flat';
}

const VARIANT_STYLES = {
  default: 'bg-card',
  flat: 'bg-paper',
} as const;

export const Card: React.FC<CardProps> = ({ children, className, variant = 'default', ...props }) => (
  <div
    className={cn(
      'rounded-card border border-line p-5 transition-colors tablet:p-6 desktop:p-7',
      VARIANT_STYLES[variant],
      className
    )}
    {...props}
  >
    {children}
  </div>
);
