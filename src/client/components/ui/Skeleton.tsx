import React from 'react';
import { cn } from '../../lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

const VARIANT_STYLES = {
  text: 'h-4 w-full rounded-control',
  circular: 'rounded-full',
  rectangular: 'rounded-button',
} as const;

export const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'rectangular', ...props }) => (
  <div aria-hidden="true" className={cn('animate-pulse bg-line', VARIANT_STYLES[variant], className)} {...props} />
);
