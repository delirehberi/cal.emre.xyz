import { describe, it, expect } from 'vitest';
import {
  addDaysToDateKey,
  buildTimezoneOptions,
  formatMonthYear,
  formatTimezoneLabel,
  getDateParts,
  getDaysInMonth,
  getLeadingBlankCells,
  getTimezoneOffsetLabel,
  toDateKey,
} from '../src/client/lib/calendar/format';
import { APP_CONFIG } from '../src/config';

describe('time zone labels', () => {
  const summer = Date.UTC(2026, 6, 1, 12);
  const winter = Date.UTC(2026, 0, 15, 12);

  it('shows the GMT offset', () => {
    expect(getTimezoneOffsetLabel('Europe/Istanbul', summer)).toBe('GMT+3');
    expect(getTimezoneOffsetLabel('Asia/Kolkata', summer)).toBe('GMT+5:30');
    expect(getTimezoneOffsetLabel('America/New_York', winter)).toBe('GMT-5');
  });

  it('follows daylight saving time', () => {
    expect(getTimezoneOffsetLabel('Europe/London', summer)).toBe('GMT+1');
    expect(getTimezoneOffsetLabel('Europe/London', winter)).toBe('GMT');
  });

  it('formats the picker label and keeps UTC plain', () => {
    expect(formatTimezoneLabel('Europe/Istanbul', summer)).toBe('Europe/Istanbul (GMT+3)');
    expect(formatTimezoneLabel('UTC', summer)).toBe('UTC');
  });

  it('falls back for an unknown zone', () => {
    expect(getTimezoneOffsetLabel('Not/AZone')).toBe('GMT');
  });

  it('puts the visitor and host zones first without duplicates', () => {
    expect(buildTimezoneOptions('Europe/Istanbul', 'UTC', ['UTC', 'Europe/Berlin', 'Europe/Istanbul'])).toEqual([
      'Europe/Istanbul',
      'UTC',
      'Europe/Berlin',
    ]);
    expect(buildTimezoneOptions('', 'UTC', ['UTC'])).toEqual(['UTC']);
  });
});

describe('date names', () => {
  it('names a day in Turkish and English regardless of the machine time zone', () => {
    expect(getDateParts('2026-10-15', 'tr')).toEqual({
      weekday: 'Perşembe',
      dayMonth: '15 Ekim',
      monthYear: 'Ekim 2026',
    });
    expect(getDateParts('2026-10-15', 'en')).toEqual({
      weekday: 'Thursday',
      dayMonth: 'October 15',
      monthYear: 'October 2026',
    });
  });

  it('formats month headings', () => {
    expect(formatMonthYear(2026, 10, 'tr')).toBe('Ekim 2026');
    expect(formatMonthYear(2027, 1, 'en')).toBe('January 2027');
  });
});

describe('month grid helpers', () => {
  it('counts leading blanks for a Monday-first grid', () => {
    expect(getLeadingBlankCells(2026, 10)).toBe(3); // 1 Oct 2026 is a Thursday
    expect(getLeadingBlankCells(2026, 6)).toBe(0); // 1 Jun 2026 is a Monday
    expect(getLeadingBlankCells(2026, 2)).toBe(6); // 1 Feb 2026 is a Sunday
  });

  it('knows the days in a month, including leap years', () => {
    expect(getDaysInMonth(2026, 10)).toBe(31);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2028, 2)).toBe(29);
  });

  it('builds and shifts date keys across month and year boundaries', () => {
    expect(toDateKey(2026, 3, 5)).toBe('2026-03-05');
    expect(addDaysToDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToDateKey('2026-10-15', 7)).toBe('2026-10-22');
    expect(addDaysToDateKey('2028-02-28', 2)).toBe('2028-03-01');
  });
});

describe('duration config', () => {
  it('offers 15, 30, 45 and 60 minutes with 90 and 120 behind "longer"', () => {
    expect([...APP_CONFIG.allowedDurationsMinutes]).toEqual([15, 30, 45, 60]);
    expect([...APP_CONFIG.extendedDurationsMinutes]).toEqual([90, 120]);
    expect(APP_CONFIG.allowedDurationsMinutes).toContain(APP_CONFIG.defaultDurationMinutes);
  });
});
