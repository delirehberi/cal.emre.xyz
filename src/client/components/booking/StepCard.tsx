import React, { useId } from 'react';
import { cn } from '../../lib/cn';

export interface StepCardProps {
  step: number;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Id for the heading, so the step can be linked to or focused. */
  headingId?: string;
}

/** A numbered card of the booking page ("1 How long?", "2 Which day?", "3 Which time?"). */
export const StepCard: React.FC<StepCardProps> = ({ step, title, children, className, headingId }) => {
  const generatedId = useId();
  const id = headingId ?? generatedId;

  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex w-full flex-col gap-[18px] rounded-card border border-line bg-card p-5 tablet:p-6 desktop:p-7',
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-label leading-ui font-medium text-paper"
        >
          {step}
        </span>
        <h2 id={id} tabIndex={-1} className="font-display text-heading-s font-bold text-ink focus:outline-none">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
};
