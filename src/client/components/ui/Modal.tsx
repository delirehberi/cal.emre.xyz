import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useTranslation } from '../../i18n';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const MAX_WIDTH = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getFocusable = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => window.getComputedStyle(node).display !== 'none' && window.getComputedStyle(node).visibility !== 'hidden'
  );

/**
 * Accessible dialog: labelled by its title, traps Tab inside, closes on Escape or a click on the scrim,
 * locks page scroll and gives focus back to the element that opened it.
 * Focus starts on the first `[data-autofocus]` element, else on the first focusable one after the close button.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (dialog) {
      const focusable = getFocusable(dialog);
      // Start on content, not on the close button.
      const target =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ??
        focusable.find((node) => !node.hasAttribute('data-modal-close')) ??
        focusable[0] ??
        dialog;
      target.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = getFocusable(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 tablet:p-6">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-card border border-line bg-card p-6 text-left shadow-popover focus:outline-none',
          MAX_WIDTH[maxWidth],
          className
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && (
              <h2 id={titleId} className="font-display text-heading-m font-bold text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="font-sans text-ui leading-ui text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-modal-close=""
            onClick={onClose}
            aria-label={t('common.close')}
            className="-m-1 shrink-0 cursor-pointer rounded-control p-1 text-muted transition-colors hover:text-ink"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
};
