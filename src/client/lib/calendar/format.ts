/** Display helpers for the booking page. Date keys are 'YYYY-MM-DD' in the host's calendar. */

export type DisplayLocale = 'en' | 'tr';

const INTL_LOCALE: Record<DisplayLocale, string> = { en: 'en-US', tr: 'tr-TR' };

/** Short GMT offset of a time zone at a moment, e.g. "GMT+3", "GMT-5", "GMT+5:30"; "GMT" for UTC. */
export function getTimezoneOffsetLabel(timeZone: string, atMs: number = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(
      new Date(atMs)
    );
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  } catch {
    return 'GMT';
  }
}

/** "Europe/Istanbul (GMT+3)"; plain "UTC" for UTC. */
export function formatTimezoneLabel(timeZone: string, atMs: number = Date.now()): string {
  if (timeZone === 'UTC') return 'UTC';
  return `${timeZone} (${getTimezoneOffsetLabel(timeZone, atMs)})`;
}

/**
 * Time zones offered in the picker: the visitor's own and the host's first, then a fixed list,
 * without duplicates.
 */
export function buildTimezoneOptions(
  selected: string,
  hostTimezone: string,
  common: readonly string[]
): string[] {
  return Array.from(new Set([selected, hostTimezone, ...common])).filter(Boolean);
}

export interface DateParts {
  /** Weekday name, e.g. "Thursday" / "Perşembe". */
  weekday: string;
  /** Day and month, e.g. "October 15" / "15 Ekim". */
  dayMonth: string;
  /** Month and year, e.g. "October 2026" / "Ekim 2026". */
  monthYear: string;
}

/** Names for a calendar day, independent of the viewer's time zone. */
export function getDateParts(dateKey: string, locale: DisplayLocale): DateParts {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const intl = INTL_LOCALE[locale];
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intl, { ...options, timeZone: 'UTC' }).format(date);
  return {
    weekday: format({ weekday: 'long' }),
    dayMonth: format({ day: 'numeric', month: 'long' }),
    monthYear: format({ month: 'long', year: 'numeric' }),
  };
}

/** Month heading for a 1-based month, e.g. "Ekim 2026". */
export function formatMonthYear(year: number, month: number, locale: DisplayLocale): string {
  return getDateParts(`${year}-${String(month).padStart(2, '0')}-01`, locale).monthYear;
}

/** Number of leading blank cells in a Monday-first month grid (0 for a Monday start, 6 for a Sunday start). */
export function getLeadingBlankCells(year: number, month: number): number {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (firstDay + 6) % 7;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Date key shifted by whole days; used for keyboard navigation in the calendar. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}
