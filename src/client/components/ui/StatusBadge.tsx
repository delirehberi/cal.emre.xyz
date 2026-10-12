import React from 'react';
import { clsx } from 'clsx';
import { Eye, Lock } from 'lucide-react';

export type StatusKind = 'confirmed' | 'pending' | 'encrypted' | 'public' | 'declined' | 'cancelled';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind;
}

const ICON_CLASS = 'h-[13px] w-[13px] shrink-0 text-muted';

const Leading: React.FC<{ kind: StatusKind }> = ({ kind }) => {
  switch (kind) {
    case 'confirmed':
      return <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-slot" />;
    case 'pending':
    case 'cancelled':
      return <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] border-muted" />;
    case 'declined':
      return <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-muted" />;
    case 'encrypted':
      return <Lock aria-hidden="true" className={ICON_CLASS} />;
    case 'public':
      return <Eye aria-hidden="true" className={ICON_CLASS} />;
  }
};

/**
 * Status pill. Confirmed is the only filled variant (soft green, because it marks a taken open slot);
 * encrypted/public describe event privacy. Declined and cancelled are muted outlines.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ kind, className, children, ...props }) => {
  const muted = kind === 'encrypted' || kind === 'public' || kind === 'declined' || kind === 'cancelled';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full py-[5px] pr-3 pl-2.5 font-sans text-small leading-ui font-semibold whitespace-nowrap',
        kind === 'confirmed' ? 'bg-slot-soft' : 'border border-line',
        muted ? 'text-muted' : 'text-ink',
        kind === 'cancelled' && 'line-through',
        className
      )}
      {...props}
    >
      <Leading kind={kind} />
      {children}
    </span>
  );
};
