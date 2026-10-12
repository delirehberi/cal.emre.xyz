import React from 'react';
import { clsx } from 'clsx';
import { Mark, BRAND_NAME } from './Mark';
import { Wordmark } from './Wordmark';

export type LockupSize = 'L' | 'M' | 'S' | 'responsive';

export interface LockupProps {
  /**
   * L = 40 px mark, M = 32 px, S = 26 px.
   * `responsive` follows the header rule: 40 at >= 1024, 32 at 640-1023, 26 below 640.
   */
  size?: LockupSize;
  /** Show only the mark. */
  markOnly?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<LockupSize, string> = {
  L: '[--mark:40px]',
  M: '[--mark:32px]',
  S: '[--mark:26px]',
  responsive: '[--mark:26px] tablet:[--mark:32px] desktop:[--mark:40px]',
};

/**
 * Horizontal lockup. Proportions are fixed relative to the mark size:
 * the wordmark is 0.857× the mark and the gap is 0.3×.
 * Below 320 px of viewport width the responsive lockup shows the mark only.
 * The lockup never contains the domain name or a protocol name.
 */
export const Lockup: React.FC<LockupProps> = ({ size = 'responsive', markOnly = false, className }) => (
  <span
    role="img"
    aria-label={BRAND_NAME}
    className={clsx('inline-flex items-center gap-[calc(var(--mark)*0.3)]', SIZE_CLASSES[size], className)}
  >
    <Mark size={undefined} className="h-[var(--mark)] w-[var(--mark)]" />
    {!markOnly && (
      <Wordmark
        className={clsx('text-[length:calc(var(--mark)*0.857)]', size === 'responsive' && 'max-[319px]:hidden')}
      />
    )}
  </span>
);
