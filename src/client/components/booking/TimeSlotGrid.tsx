import React, { useId, useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import type { TimeSlot } from '../../lib/calendar/slots';
import { buildTimezoneOptions, formatTimezoneLabel, getDateParts } from '../../lib/calendar/format';
import { Select } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { StepCard } from './StepCard';

export const WORLD_TIMEZONES = [
  'UTC',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Kyiv',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Atlantic/Reykjavik',
] as const;

export interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  attendeeTimezone: string;
  hostTimezone: string;
  onTimezoneChange: (timezone: string) => void;
  selectedDate: string;
  durationMinutes: number;
  isLoading?: boolean;
}

/** The time zone picker shared by the slot list and the details form. */
export const TimezoneSelect: React.FC<{
  value: string;
  hostTimezone: string;
  onChange: (timezone: string) => void;
}> = ({ value, hostTimezone, onChange }) => {
  const { t } = useTranslation();
  const options = buildTimezoneOptions(value, hostTimezone, WORLD_TIMEZONES);

  return (
    <Select
      label={t('booking.timeSlots.timezone')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      icon={<Globe aria-hidden="true" className="h-[18px] w-[18px]" />}
    >
      {options.map((timezone) => (
        <option key={timezone} value={timezone}>
          {formatTimezoneLabel(timezone)}
        </option>
      ))}
    </Select>
  );
};

/** Step 3: the open times of the chosen day. Booked and past times are folded into one line. */
export const TimeSlotGrid: React.FC<TimeSlotGridProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  attendeeTimezone,
  hostTimezone,
  onTimezoneChange,
  selectedDate,
  durationMinutes,
  isLoading = false,
}) => {
  const { t, locale } = useTranslation();
  const [showUnavailable, setShowUnavailable] = useState(false);
  const foldedId = useId();

  const open = slots.filter((slot) => slot.available);
  const unavailable = slots.filter((slot) => !slot.available);
  const { weekday, dayMonth } = getDateParts(selectedDate, locale);

  return (
    <StepCard step={3} title={t('booking.steps.time')}>
      <TimezoneSelect value={attendeeTimezone} hostTimezone={hostTimezone} onChange={onTimezoneChange} />

      <p className="font-sans text-ui leading-ui font-medium text-muted">
        {t('booking.timeSlots.dayLine', {
          weekday,
          dayMonth,
          duration: t('booking.duration.minutes', { minutes: durationMinutes }),
        })}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 rounded-button" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <p className="rounded-button border border-dashed border-line px-3.5 py-3 font-sans text-caption leading-ui text-muted">
          {t('booking.timeSlots.noSlots')}
        </p>
      ) : (
        <div role="group" aria-label={t('booking.timeSlots.slotsLabel')} className="grid grid-cols-2 gap-2.5">
          {open.map((slot) => {
            const selected = selectedSlot?.start === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectSlot(slot)}
                className={cn(
                  'flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2.5 rounded-button border font-mono text-body leading-ui font-medium text-ink transition-colors',
                  selected ? 'border-slot bg-slot-soft ring-1 ring-slot ring-inset' : 'border-line bg-card hover:border-muted'
                )}
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-slot" />
                {slot.formattedStartTime}
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && unavailable.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 rounded-button border border-dashed border-line px-3.5 py-3 font-sans text-caption leading-ui">
            <p className="min-w-0 flex-1 text-muted">{t('booking.timeSlots.folded', { count: unavailable.length })}</p>
            <button
              type="button"
              aria-expanded={showUnavailable}
              aria-controls={foldedId}
              onClick={() => setShowUnavailable((value) => !value)}
              className="shrink-0 cursor-pointer rounded-control font-semibold text-ink hover:underline"
            >
              {showUnavailable ? t('booking.timeSlots.hide') : t('booking.timeSlots.show')}
            </button>
          </div>
          {showUnavailable && (
            <ul id={foldedId} aria-label={t('booking.timeSlots.unavailableLabel')} className="grid grid-cols-2 gap-2.5">
              {unavailable.map((slot) => (
                <li
                  key={slot.start}
                  title={slot.reason === 'booked' ? t('booking.timeSlots.busyTooltip') : undefined}
                  className="flex h-12 items-center justify-center rounded-button border border-dashed border-line font-mono text-body leading-ui font-medium text-muted line-through opacity-70"
                >
                  {slot.formattedStartTime}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </StepCard>
  );
};
