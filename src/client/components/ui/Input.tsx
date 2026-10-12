import React, { useId } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, ChevronDown } from 'lucide-react';

const FIELD_LABEL = 'block font-sans text-caption leading-ui font-medium text-muted';

/** Box shared by input, textarea and select. */
const FIELD_BOX =
  'block w-full rounded-button border bg-card px-3.5 py-3 font-sans text-body leading-ui text-ink placeholder:text-muted transition-colors focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50';

const boxBorder = (error?: string) => (error ? 'border-ink' : 'border-line');

interface FieldMessageProps {
  id: string;
  error?: string;
  helperText?: string;
}

/**
 * Errors are not red: red is reserved for destructive actions.
 * They are announced through aria-invalid/aria-describedby and marked with an icon and heavier weight.
 */
const FieldMessage: React.FC<FieldMessageProps> = ({ id, error, helperText }) => {
  if (error) {
    return (
      <p id={id} role="alert" className="flex items-start gap-1.5 font-sans text-caption font-semibold text-ink">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  }
  if (helperText) {
    return (
      <p id={id} className="font-sans text-caption text-muted">
        {helperText}
      </p>
    );
  }
  return null;
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className={FIELD_LABEL}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            className={clsx(FIELD_BOX, boxBorder(error), leftIcon && 'pl-10', rightIcon && 'pr-10', className)}
            {...props}
          />
          {rightIcon && <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">{rightIcon}</div>}
        </div>
        <FieldMessage id={messageId} error={error} helperText={helperText} />
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
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className={FIELD_LABEL}>
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={clsx(FIELD_BOX, 'min-h-[88px] resize-y', boxBorder(error), className)}
          {...props}
        />
        <FieldMessage id={messageId} error={error} helperText={helperText} />
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Leading icon, e.g. a globe for time zones. */
  icon?: React.ReactNode;
}

/** Native select with the Kün field styling; keeps platform pickers and keyboard behaviour. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, icon, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const messageId = `${selectId}-message`;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className={FIELD_LABEL}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
              {icon}
            </div>
          )}
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            className={clsx(
              FIELD_BOX,
              'cursor-pointer appearance-none truncate pr-10',
              boxBorder(error),
              icon && 'pl-10',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3.5 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
        <FieldMessage id={messageId} error={error} helperText={helperText} />
      </div>
    );
  }
);

Select.displayName = 'Select';
