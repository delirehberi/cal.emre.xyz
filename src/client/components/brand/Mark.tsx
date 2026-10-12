import React from 'react';
import { clsx } from 'clsx';

export const BRAND_NAME = 'Kün';

export interface MarkProps {
  /** Rendered edge length in px. The mark is square. */
  size?: number;
  className?: string;
  /** Accessible name. When omitted the mark is decorative. */
  title?: string;
}

const GRID_DOTS: ReadonlyArray<readonly [number, number]> = [
  [18, 18],
  [32, 18],
  [46, 18],
  [18, 32],
  [32, 32],
  [18, 46],
  [32, 46],
  [46, 46],
];

/**
 * The Kün mark: a 3×3 grid of time slots on a tile, with the open slot
 * (larger, green, right of the middle row) as the only bright element.
 * Colours follow the theme tokens, so one component serves light and dark.
 */
export const Mark: React.FC<MarkProps> = ({ size = 64, className, title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('shrink-0', className)}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    <rect width="64" height="64" rx="16" className="fill-tile" />
    {GRID_DOTS.map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" opacity="0.42" className="fill-tile-fg" />
    ))}
    <circle cx="46" cy="32" r="6.2" className="fill-slot" />
  </svg>
);
