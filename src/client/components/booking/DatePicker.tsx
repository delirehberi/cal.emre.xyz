import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { useTranslation } from '../../i18n';
import type { DayAvailabilitySummary } from '../../lib/calendar/slots';
import { formatDateKey } from '../../lib/calendar/slots';

export interface DatePickerProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateKey: string) => void;
  availabilitySummaries: DayAvailabilitySummary[];
  currentYear: number;
  currentMonth: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
}

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

  const availabilityMap = useMemo(() => {
    const map = new Map<string, DayAvailabilitySummary>();
    for (const summary of availabilitySummaries) {
      map.set(summary.date, summary);
    }
    return map;
  }, [availabilitySummaries]);

  const monthName = useMemo(() => {
    const date = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }, [currentYear, currentMonth, locale]);

  const weekDayHeaders = useMemo(() => {
    // English or Turkish day headers
    if (locale === 'tr') {
      return ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
    }
    return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  }, [locale]);

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

    // In Europe/ISO format, Monday is day 0, Sunday is day 6
    // getUTCDay: 0 = Sun, 1 = Mon, ..., 6 = Sat
    let firstDayIndex = firstDayOfMonth.getUTCDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6; // Sunday to end of week

    const cells: Array<{ dateKey: string; dayNumber: number; isCurrentMonth: boolean }> = [];

    // Leading empty days
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dateKey: '', dayNumber: 0, isCurrentMonth: false });
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const formattedDay = String(d).padStart(2, '0');
      const formattedMonth = String(currentMonth).padStart(2, '0');
      const dateKey = `${currentYear}-${formattedMonth}-${formattedDay}`;
      cells.push({ dateKey, dayNumber: d, isCurrentMonth: true });
    }

    return cells;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onMonthChange(currentYear - 1, 12);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onMonthChange(currentYear + 1, 1);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  const handleTodayClick = () => {
    const now = new Date();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth() + 1;
    onMonthChange(nowYear, nowMonth);
    onSelectDate(todayKey);
  };

  return (
    <Card className="space-y-4">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-stone-500" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 capitalize">
            {monthName}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTodayClick}
            className="rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {t('booking.datePicker.today')}
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label={t('booking.datePicker.previousMonth')}
            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label={t('booking.datePicker.nextMonth')}
            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDayHeaders.map((dayName, idx) => (
          <span
            key={`${dayName}-${idx}`}
            className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 py-1"
          >
            {dayName}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, index) => {
          if (!cell.isCurrentMonth) {
            return <div key={`empty-${index}`} className="h-9 w-full" />;
          }

          const isSelected = selectedDate === cell.dateKey;
          const isToday = todayKey === cell.dateKey;
          const isPast = cell.dateKey < todayKey;
          const availability = availabilityMap.get(cell.dateKey);
          const hasSlots = availability?.hasAvailableSlots ?? false;
          const isDisabled = isPast || !hasSlots;

          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(cell.dateKey)}
              className={`group relative flex h-9 w-full flex-col items-center justify-center rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-stone-900 text-stone-50 font-bold shadow-xs dark:bg-stone-100 dark:text-stone-900 cursor-pointer'
                  : isDisabled
                  ? 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
                  : isToday
                  ? 'border border-stone-400 text-stone-900 dark:border-stone-600 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer'
                  : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 cursor-pointer'
              }`}
            >
              <span>{cell.dayNumber}</span>
              {hasSlots && !isPast && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
};
