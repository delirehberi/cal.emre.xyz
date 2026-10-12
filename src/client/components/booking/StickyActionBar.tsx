import React from 'react';
import { Button } from '../ui/Button';

export interface StickyActionBarProps {
  /** Primary line, e.g. "15 Ekim · 14:30". */
  summary: string;
  /** Secondary line, e.g. "30 dk · Europe/Istanbul". */
  meta: string;
  actionLabel: string;
  /** Called when the action is pressed (ignored when `form` is set). */
  onAction?: () => void;
  /** Id of a form to submit instead of calling `onAction`. */
  form?: string;
  isLoading?: boolean;
}

/** Fixed bar at the bottom of the phone layout with the chosen time and the next action. */
export const StickyActionBar: React.FC<StickyActionBarProps> = ({ summary, meta, actionLabel, onAction, form, isLoading }) => (
  <>
    {/* Keeps the end of the page clear of the fixed bar. */}
    <div aria-hidden="true" className="h-[88px] tablet:hidden" />
    <div className="fixed inset-x-0 bottom-0 z-30 flex h-[88px] items-center justify-between gap-3 border-t border-line bg-card px-4 pt-3 pb-6 tablet:hidden">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-mono text-caption leading-ui font-medium text-ink">{summary}</p>
        <p className="truncate font-sans text-small text-muted">{meta}</p>
      </div>
      {form ? (
        <Button type="submit" form={form} className="shrink-0" isLoading={isLoading}>
          {actionLabel}
        </Button>
      ) : (
        <Button className="shrink-0" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  </>
);
