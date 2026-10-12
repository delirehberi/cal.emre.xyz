import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import type { DayAvailabilitySummary } from '../../lib/calendar/slots';
import { formatDateKey } from '../../lib/calendar/slots';
import {
  addDaysToDateKey,
  formatMonthYear,
  getDateParts,
  getDaysInMonth,
  getLeadingBlankCells,
  toDateKey,
} from '../../lib/calendar/format';
import { StepCard } from './StepCard';

export interface DatePickerProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateKey: string) => void;
  availabilitySummaries: DayAvailabilitySummary[];
  currentYear: number;
  currentMonth: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
}

const NAV_BUTTON =
  'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-muted';

/** Date key arrows and Page keys move to, or null when the key does not navigate. */
export const getCalendarTarget = (dateKey: string, key: string): string | null => {
  switch (key) {
    case 'ArrowLeft':
      return addDaysToDateKey(dateKey, -1);
    case 'ArrowRight':
      return addDaysToDateKey(dateKey, 1);
    case 'ArrowUp':
      return addDaysToDateKey(dateKey, -7);
    case 'ArrowDown':
      return addDaysToDateKey(dateKey, 7);
    default:
      return null;
  }
};

/** Step 2: pick a day. Days with open time carry a green dot. */
export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onSelectDate,
  availabilitySummaries,
  currentYear,
  currentMonth,
  onMonthChange,
}) => {
  const { t, locale } = useTranslation();
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  const availability = useMemo(() => {
    const map = new Map<string, DayAvailabilitySummary>();
    for (const summary of availabilitySummaries) map.set(summary.date, summary);
    return map;
  }, [availabilitySummaries]);

  const weekdays = t('booking.datePicker.weekdays').split(',');
  const blanks = getLeadingBlankCells(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, index) => toDateKey(currentYear, currentMonth, index + 1));

  const hasSlots = (dateKey: string) => dateKey >= todayKey && (availability.get(dateKey)?.hasAvailableSlots ?? false);

  // Exactly one day is in the tab order: the selected one, else the first open day, else the first day.
  const tabStop = days.includes(selectedDate) ? selectedDate : (days.find(hasSlots) ?? days[0]);

  useEffect(() => {
    if (pendingFocus.current) {
      cellRefs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(currentYear, currentMonth - 1 + delta, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth() + 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, dateKey: string) => {
    let target = getCalendarTarget(dateKey, event.key);
    if (event.key === 'Home') target = addDaysToDateKey(dateKey, -((new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7));
    if (event.key === 'End') target = addDaysToDateKey(dateKey, 6 - ((new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7));
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const delta = event.key === 'PageUp' ? -1 : 1;
      const [year, month, day] = dateKey.split('-').map(Number);
      const moved = new Date(Date.UTC(year, month - 1 + delta, 1));
      const last = getDaysInMonth(moved.getUTCFullYear(), moved.getUTCMonth() + 1);
      pendingFocus.current = toDateKey(moved.getUTCFullYear(), moved.getUTCMonth() + 1, Math.min(day, last));
      onMonthChange(moved.getUTCFullYear(), moved.getUTCMonth() + 1);
      return;
    }
    if (!target) return;
    event.preventDefault();
    const [year, month] = target.split('-').map(Number);
    if (year !== currentYear || month !== currentMonth) {
      pendingFocus.current = target;
      onMonthChange(year, month);
    } else {
      cellRefs.current.get(target)?.focus();
    }
  };

  return (
    <StepCard step={2} title={t('booking.steps.day')}>
      <div className="flex items-center justify-between">
        <h3 aria-live="polite" className="font-display text-heading-xs font-bold text-ink capitalize">
          {formatMonthYear(currentYear, currentMonth, locale)}
        </h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => changeMonth(-1)} aria-label={t('booking.datePicker.previousMonth')} className={NAV_BUTTON}>
            <ChevronLeft aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={() => changeMonth(1)} aria-label={t('booking.datePicker.nextMonth')} className={NAV_BUTTON}>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div aria-hidden="true" className="grid grid-cols-7 text-center">
        {weekdays.map((name, index) => (
          <span key={`${name}-${index}`} className="font-mono text-[11px] leading-ui font-medium text-muted">
            {name}
          </span>
        ))}
      </div>

      <div role="group" aria-label={formatMonthYear(currentYear, currentMonth, locale)} className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: blanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" className="h-[52px]" />
        ))}
        {days.map((dateKey) => {
          const day = Number(dateKey.slice(8));
          const free = hasSlots(dateKey);
          const selected = dateKey === selectedDate;
          const { weekday, dayMonth } = getDateParts(dateKey, locale);
          const label = t(free ? 'booking.datePicker.dayAvailable' : 'booking.datePicker.dayUnavailable', {
            date: `${weekday}, ${dayMonth}`,
          });

          return (
            <button
              key={dateKey}
              ref={(node) => {
                if (node) cellRefs.current.set(dateKey, node);
                else cellRefs.current.delete(dateKey);
              }}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              aria-disabled={!free || undefined}
              aria-current={dateKey === todayKey ? 'date' : undefined}
              tabIndex={dateKey === tabStop ? 0 : -1}
              onClick={() => free && onSelectDate(dateKey)}
              onKeyDown={(event) => handleKeyDown(event, dateKey)}
              className={cn(
                'flex h-[52px] w-full max-w-12 flex-col items-center justify-center gap-[3px] justify-self-center rounded-field font-sans text-body leading-ui font-medium transition-colors',
                selected ? 'bg-ink text-paper' : free ? 'cursor-pointer text-ink hover:bg-line' : 'cursor-default text-muted opacity-55'
              )}
            >
              {day}
              {free && <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-slot" />}
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-2 font-sans text-small text-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-slot" />
        {t('booking.datePicker.legend')}
      </p>
    </StepCard>
  );
};
