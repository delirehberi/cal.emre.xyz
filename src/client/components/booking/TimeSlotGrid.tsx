import React from 'react';
import { Clock, Globe, AlertCircle, Ban } from 'lucide-react';
import { Card } from '../ui/Card';
import { useTranslation } from '../../i18n';
import type { TimeSlot } from '../../lib/calendar/slots';

export interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  attendeeTimezone: string;
  onTimezoneChange?: (tz: string) => void;
  selectedDate?: string;
  isLoading?: boolean;
}

const WORLD_TIMEZONES = [
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
];

export const TimeSlotGrid: React.FC<TimeSlotGridProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  attendeeTimezone,
  onTimezoneChange,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  const timezoneList = Array.from(new Set([attendeeTimezone, ...WORLD_TIMEZONES])).filter(Boolean);

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-stone-500" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            {t('booking.timeSlotGrid.title')}
          </h3>
        </div>

        {/* Changeable Timezone Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
          <Globe className="h-3.5 w-3.5 text-stone-500 shrink-0" />
          {onTimezoneChange ? (
            <select
              value={attendeeTimezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer max-w-[180px] truncate"
              title={t('booking.timeSlotGrid.changeTimezone')}
            >
              {timezoneList.map((tz) => (
                <option key={tz} value={tz} className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100">
                  {tz}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate max-w-[180px] font-medium">{attendeeTimezone}</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-slot-${i}`}
              className="h-11 rounded-lg bg-stone-100 dark:bg-stone-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t('booking.timeSlotGrid.noSlotsForDate')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
          {slots.map((slot) => {
            const isSelected =
              selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;

            if (!slot.available) {
              return (
                <div
                  key={`${slot.start}-${slot.end}`}
                  title={slot.reason === 'booked' ? t('booking.timeSlotGrid.busySlotTooltip') : undefined}
                  className="flex items-center justify-between rounded-lg border border-stone-200/60 bg-stone-50/70 px-3 py-2.5 text-xs text-stone-400 dark:border-stone-800/60 dark:bg-stone-900/40 dark:text-stone-600 cursor-not-allowed select-none"
                >
                  <span className="line-through">{slot.formattedStartTime}</span>
                  {slot.reason === 'booked' && (
                    <Ban className="h-3 w-3 text-stone-400 dark:text-stone-600 opacity-60" />
                  )}
                </div>
              );
            }

            return (
              <button
                key={`${slot.start}-${slot.end}`}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={`flex items-center justify-center rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-stone-900 bg-stone-900 text-stone-50 shadow-sm dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900 ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-1'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-900 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:border-stone-300 dark:hover:bg-stone-900'
                }`}
              >
                <span>{slot.formattedStartTime}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};
