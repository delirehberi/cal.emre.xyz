import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

export interface TimeFieldProps {
  /** Minutes from midnight (0-1440). */
  value: number;
  onChange: (minutes: number) => void;
  'aria-label': string;
  className?: string;
}

export const formatMinutes = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Parses "H:MM" or "HH:MM" (24-hour) into minutes from midnight; "24:00" is allowed as an end of day. */
export const parseTimeInput = (text: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return hours * 60 + minutes;
};

/**
 * 24-hour time box. A native time input follows the browser locale (AM/PM in many of them),
 * while hosts here always schedule on a 24-hour clock, so this is a text field that commits only valid times.
 */
export const TimeField: React.FC<TimeFieldProps> = ({ value, onChange, className, ...props }) => {
  const [draft, setDraft] = useState(formatMinutes(value));

  useEffect(() => {
    setDraft(formatMinutes(value));
  }, [value]);

  const commit = (text: string) => {
    const minutes = parseTimeInput(text);
    if (minutes !== null && minutes !== value) onChange(minutes);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        commit(event.target.value);
      }}
      onBlur={() => setDraft(formatMinutes(parseTimeInput(draft) ?? value))}
      className={cn(
        'w-[72px] rounded-control border border-line bg-paper px-3.5 py-[9px] text-center font-mono text-ui leading-ui font-medium text-ink focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        className
      )}
      {...props}
    />
  );
};
