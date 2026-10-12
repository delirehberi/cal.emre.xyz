import React from 'react';
import { clsx } from 'clsx';

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Accessible on/off switch. Provide an `aria-label` or `aria-labelledby`. */
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, className, type = 'button', ...props }) => (
  <button
    type={type}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-ink' : 'bg-line',
      className
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={clsx(
        'absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full transition-transform',
        checked ? 'translate-x-4 bg-paper' : 'translate-x-0 bg-card'
      )}
    />
  </button>
);
