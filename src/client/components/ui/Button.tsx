import React from 'react';
import { cn } from '../../lib/cn';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const BASE_STYLES =
  'inline-flex items-center justify-center gap-2 rounded-button border border-transparent font-sans font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-caption leading-ui',
  md: 'px-5 py-3 text-body leading-ui',
  lg: 'px-6 py-3.5 text-body leading-ui',
};

/** Danger is reserved for "cancel meeting" and "log out". */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:opacity-90',
  secondary: 'border-line bg-card text-ink hover:border-muted',
  danger: 'border-danger bg-card text-danger hover:bg-danger/10',
  quiet: 'text-muted hover:text-ink',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={cn(BASE_STYLES, SIZE_STYLES[size], VARIANT_STYLES[variant], className)}
    {...props}
  >
    {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-current" aria-hidden="true" /> : leftIcon}
    <span>{children}</span>
    {!isLoading && rightIcon}
  </button>
);
