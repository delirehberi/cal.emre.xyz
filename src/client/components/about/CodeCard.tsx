import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface CodeSegment {
  text: string;
  /** `comment` is dimmed, `value` is highlighted (green on the dark tile, bold on the light dark-mode tile); plain text is the default. */
  tone?: 'plain' | 'comment' | 'value';
}

export type CodeLine = ReadonlyArray<CodeSegment>;

export interface CodeCardProps {
  lines: ReadonlyArray<CodeLine>;
  /** Accessible name of the code block. */
  label: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<CodeSegment['tone']>, string> = {
  plain: 'text-tile-fg',
  comment: 'text-muted dark:text-tile-fg/70',
  value: 'text-slot dark:font-bold dark:text-tile-fg',
};

/** Terminal-style card: a `<pre><code>` block that scrolls sideways on small screens and can be copied. */
export const CodeCard: React.FC<CodeCardProps> = ({ lines, label, copyLabel, copiedLabel, className }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const handleCopy = async () => {
    const text = lines.map((line) => line.map((segment) => segment.text).join('')).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-card bg-tile p-[18px] tablet:px-7 tablet:py-[26px]', className)}>
      <div className="flex items-center justify-between">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-[7px] w-[7px] rounded-full bg-tile-fg/30" />
          <span className="h-[7px] w-[7px] rounded-full bg-tile-fg/30" />
          <span className="h-[7px] w-[7px] rounded-full bg-tile-fg/30" />
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-control px-2 py-1 font-sans text-small leading-ui font-semibold text-tile-fg/70 transition-colors hover:text-tile-fg"
        >
          {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto rounded-control font-mono text-eyebrow leading-[1.6] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tile-fg tablet:text-caption"
      >
        <code>
          {lines.map((line, index) => (
            <React.Fragment key={index}>
              {line.map((segment, segmentIndex) => (
                <span key={segmentIndex} className={TONE_CLASS[segment.tone ?? 'plain']}>
                  {segment.text}
                </span>
              ))}
              {index < lines.length - 1 ? '\n' : null}
            </React.Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
};
