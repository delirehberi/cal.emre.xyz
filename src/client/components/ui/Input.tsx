import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            {label}
          </label>
        )}
        <div className="relative rounded-lg">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={twMerge(
              clsx(
                'block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500',
                'focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 focus:border-transparent',
                error
                  ? 'border-red-500 focus:ring-red-500 dark:border-red-500 dark:focus:ring-red-500'
                  : 'border-stone-300 dark:border-stone-700',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className, id, rows = 3, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={twMerge(
            clsx(
              'block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500',
              'focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 focus:border-transparent',
              error
                ? 'border-red-500 focus:ring-red-500 dark:border-red-500 dark:focus:ring-red-500'
                : 'border-stone-300 dark:border-stone-700',
              className
            )
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
