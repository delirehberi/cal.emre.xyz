import { describe, it, expect } from 'vitest';
import {
  formatDateKey,
  localTimeToUtcTimestamp,
  getDayOfWeekInTimezone,
  extractBusyIntervals,
  isSlotColliding,
  generateDailyTimeSlots,
  generateMonthAvailability,
  formatSlotTime,
  formatDuration,
  type WorkingHoursConfig,
  type BusyInterval,
} from '../src/client/lib/calendar/slots';
import type { TimeCalendarEvent, CalendarRSVP } from '../src/client/lib/nostr/nip52';

describe('Calendar Engine: slots.ts', () => {
  const defaultWorkingHours: WorkingHoursConfig = {
    startHour: 9,
    endHour: 17,
    workingDays: [1, 2, 3, 4, 5], // Monday - Friday
    timezone: 'UTC',
    bufferMinutes: 0,
  };

  describe('formatDateKey & localTimeToUtcTimestamp', () => {
    it('normalizes Date objects and strings to YYYY-MM-DD', () => {
      expect(formatDateKey('2026-09-02')).toBe('2026-09-02');
      const d = new Date(Date.UTC(2026, 8, 2)); // month is 0-indexed: 8 = September
      expect(formatDateKey(d)).toBe('2026-09-02');
    });

    it('converts local time to UTC timestamp accurately', () => {
      // 2026-09-02 09:00 UTC -> 1788339600
      const utcTs = localTimeToUtcTimestamp('2026-09-02', 9, 0, 'UTC');
      const expected = Math.floor(Date.UTC(2026, 8, 2, 9, 0, 0) / 1000);
      expect(utcTs).toBe(expected);

      // 2026-09-02 09:00 in Europe/Istanbul (UTC+3) -> UTC 06:00
      const istanbulTs = localTimeToUtcTimestamp('2026-09-02', 9, 0, 'Europe/Istanbul');
      const expectedIstanbulInUtc = Math.floor(Date.UTC(2026, 8, 2, 6, 0, 0) / 1000);
      expect(istanbulTs).toBe(expectedIstanbulInUtc);
    });

    it('identifies day of week correctly in timezone', () => {
      // 2026-09-02 is Wednesday (3)
      expect(getDayOfWeekInTimezone('2026-09-02', 'UTC')).toBe(3);
      // 2026-09-06 is Sunday (0)
      expect(getDayOfWeekInTimezone('2026-09-06', 'UTC')).toBe(0);
      // 2026-09-07 is Monday (1)
      expect(getDayOfWeekInTimezone('2026-09-07', 'UTC')).toBe(1);
    });
  });

  describe('Busy Interval Extraction & Collision Detection', () => {
    const mockEvents: TimeCalendarEvent[] = [
      {
        id: 'event-1',
        identifier: 'event-1-id',
        title: 'Team Sync',
        start: 1788343200, // 10:00 UTC
        end: 1788345000,   // 10:30 UTC
        pubkey: 'host-pubkey-123',
        hashtags: [],
        attendees: [{ pubkey: 'host-pubkey-123', role: 'host' }],
        content: '',
        coordinate: '31923:host-pubkey-123:event-1-id',
      },
    ];

    const mockRsvps: CalendarRSVP[] = [
      {
        id: 'rsvp-1',
        identifier: 'rsvp-1-id',
        eventCoordinate: '31923:host-pubkey-123:event-1-id',
        hostPubkey: 'host-pubkey-123',
        pubkey: 'attendee-pubkey-456',
        status: 'accepted',
        freeBusy: 'busy',
        content: '',
      },
    ];

    it('extracts busy intervals without duplicates', () => {
      const busy = extractBusyIntervals(mockEvents, mockRsvps, 'host-pubkey-123');
      expect(busy.length).toBe(1);
      expect(busy[0].start).toBe(1788343200);
      expect(busy[0].end).toBe(1788345000);
    });

    it('detects slot collision accurately', () => {
      const busy: BusyInterval[] = [
        { start: 1000, end: 2000, sourceType: 'event' },
      ];

      // Exact overlap
      expect(isSlotColliding(1000, 2000, busy)).toBe(true);
      // Partial overlap start
      expect(isSlotColliding(800, 1200, busy)).toBe(true);
      // Partial overlap end
      expect(isSlotColliding(1800, 2200, busy)).toBe(true);
      // Inside busy interval
      expect(isSlotColliding(1200, 1800, busy)).toBe(true);
      // Completely enclosing busy interval
      expect(isSlotColliding(500, 2500, busy)).toBe(true);

      // Adjacent slots (non-overlapping)
      expect(isSlotColliding(500, 1000, busy)).toBe(false);
      expect(isSlotColliding(2000, 2500, busy)).toBe(false);

      // Far away
      expect(isSlotColliding(0, 400, busy)).toBe(false);
      expect(isSlotColliding(3000, 4000, busy)).toBe(false);
    });

    it('respects buffer time when checking collisions', () => {
      const busy: BusyInterval[] = [
        { start: 1000, end: 2000, sourceType: 'event' },
      ];

      // With 10m (600s) buffer, [2000, 2500] should collide with [1000-600, 2000+600]
      expect(isSlotColliding(2000, 2500, busy, 10)).toBe(true);
      // Slot starting after buffer period should not collide
      expect(isSlotColliding(2700, 3200, busy, 10)).toBe(false);
    });
  });

  describe('generateDailyTimeSlots', () => {
    it('generates correct slot count for 30m meetings from 09:00 to 17:00 (8 hours = 16 slots)', () => {
      // Reference date: Wednesday 2026-09-02
      // Reference current time far in the past so all slots are future
      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 30,
        workingHours: defaultWorkingHours,
        currentTimestamp: 0,
      });

      expect(slots.length).toBe(16);
      expect(slots[0].formattedStartTime).toContain('09:00');
      expect(slots[15].formattedStartTime).toContain('16:30');
      expect(slots.every((s) => s.available)).toBe(true);
    });

    it('generates correct slot count for 60m meetings (8 slots) and 15m meetings (32 slots)', () => {
      const slots60 = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 60,
        workingHours: defaultWorkingHours,
        currentTimestamp: 0,
      });
      expect(slots60.length).toBe(8);

      const slots15 = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 15,
        workingHours: defaultWorkingHours,
        currentTimestamp: 0,
      });
      expect(slots15.length).toBe(32);
    });

    it('returns empty slots array on non-working days (weekend)', () => {
      // 2026-09-06 is Sunday
      const slots = generateDailyTimeSlots({
        date: '2026-09-06',
        durationMinutes: 30,
        workingHours: defaultWorkingHours,
        currentTimestamp: 0,
      });
      expect(slots.length).toBe(0);
    });

    it('marks booked slots unavailable when colliding with busy intervals', () => {
      const start9am = localTimeToUtcTimestamp('2026-09-02', 9, 0, 'UTC');
      const busyIntervals: BusyInterval[] = [
        {
          start: start9am + 30 * 60, // 09:30 - 10:00
          end: start9am + 60 * 60,
          sourceType: 'event',
        },
      ];

      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 30,
        workingHours: defaultWorkingHours,
        busyIntervals,
        currentTimestamp: 0,
      });

      expect(slots[0].available).toBe(true);
      expect(slots[1].available).toBe(false); // 09:30 slot is booked
      expect(slots[1].reason).toBe('booked');
      expect(slots[2].available).toBe(true);
    });

    it('marks past slots unavailable based on current timestamp and lead time', () => {
      const start9am = localTimeToUtcTimestamp('2026-09-02', 9, 0, 'UTC');
      // Current time is 09:40 UTC, lead time 15m -> cutoff is 09:55 UTC
      const currentTimestamp = start9am + 40 * 60;

      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 30,
        workingHours: defaultWorkingHours,
        currentTimestamp,
        minLeadTimeMinutes: 15,
      });

      // 09:00 - 09:30 (past)
      expect(slots[0].available).toBe(false);
      expect(slots[0].reason).toBe('past');
      // 09:30 - 10:00 (past because cutoff is 09:55)
      expect(slots[1].available).toBe(false);
      expect(slots[1].reason).toBe('past');
      // 10:00 - 10:30 (future and bookable)
      expect(slots[2].available).toBe(true);
    });

    it('converts formatted times into attendee timezone properly', () => {
      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 30,
        workingHours: { ...defaultWorkingHours, timezone: 'UTC' },
        attendeeTimezone: 'Europe/Istanbul', // UTC+3
        currentTimestamp: 0,
      });

      // Host 09:00 UTC is 12:00 in Istanbul
      expect(slots[0].formattedStartTime).toContain('12:00');
    });
  });

  describe('generateMonthAvailability', () => {
    it('computes availability for all days of the month', () => {
      const summary = generateMonthAvailability({
        year: 2026,
        month: 9, // September (30 days)
        durationMinutes: 30,
        workingHours: defaultWorkingHours,
        currentTimestamp: 0,
      });

      expect(summary.length).toBe(30);

      // Sept 1, 2026 is Tuesday -> working day
      expect(summary[0].hasAvailableSlots).toBe(true);
      expect(summary[0].availableSlotCount).toBe(16);

      // Sept 6, 2026 is Sunday -> non-working day
      expect(summary[5].hasAvailableSlots).toBe(false);
      expect(summary[5].availableSlotCount).toBe(0);
    });
  });

  describe('formatSlotTime', () => {
    it('formats 12h and 24h times correctly', () => {
      const utcSeconds = localTimeToUtcTimestamp('2026-09-02', 14, 30, 'UTC');
      const time12h = formatSlotTime(utcSeconds, 'UTC', 'en-US', false);
      expect(time12h).toContain('2:30');
      expect(time12h).toContain('PM');

      const time24h = formatSlotTime(utcSeconds, 'UTC', 'en-US', true);
      expect(time24h).toBe('14:30');
    });
  });

  describe('formatDuration', () => {
    it('formats minutes under 60 with locale unit', () => {
      expect(formatDuration(15, 'en')).toBe('15 min');
      expect(formatDuration(30, 'tr')).toBe('30 dk');
      expect(formatDuration(45, 'es')).toBe('45 min');
    });

    it('formats exact hours with singular and plural units', () => {
      expect(formatDuration(60, 'en')).toBe('1 hr');
      expect(formatDuration(120, 'en')).toBe('2 hrs');
      expect(formatDuration(240, 'en')).toBe('4 hrs');
      expect(formatDuration(360, 'en')).toBe('6 hrs');

      expect(formatDuration(60, 'tr')).toBe('1 saat');
      expect(formatDuration(120, 'tr')).toBe('2 saat');
      expect(formatDuration(360, 'tr')).toBe('6 saat');
    });

    it('formats fractional hours cleanly', () => {
      expect(formatDuration(90, 'en')).toBe('1.5 hrs');
      expect(formatDuration(90, 'tr')).toBe('1.5 saat');
    });
  });

  describe('Extended Meeting Durations (up to 6 hours / 360 min)', () => {
    it('generates correct slot count for 2-hour (120m) meetings', () => {
      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 120,
        workingHours: defaultWorkingHours, // 9:00 - 17:00 (8h)
        currentTimestamp: 0,
      });

      // 8 hours / 2 hours = 4 slots: 09:00, 11:00, 13:00, 15:00
      expect(slots.length).toBe(4);
      expect(slots[0].formattedStartTime).toContain('09:00');
      expect(slots[3].formattedStartTime).toContain('15:00');
    });

    it('generates correct slot count for 6-hour (360m) meetings', () => {
      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 360,
        workingHours: defaultWorkingHours, // 9:00 - 17:00 (8h)
        currentTimestamp: 0,
      });

      // 09:00 - 15:00 fits (6h). Next slot would be 15:00 - 21:00 which exceeds 17:00.
      expect(slots.length).toBe(1);
      expect(slots[0].formattedStartTime).toContain('09:00');
    });

    it('supports custom stepMinutes with larger meeting duration', () => {
      const slots = generateDailyTimeSlots({
        date: '2026-09-02',
        durationMinutes: 60,
        stepMinutes: 30, // 30-minute stepping
        workingHours: defaultWorkingHours, // 09:00 - 17:00
        currentTimestamp: 0,
      });

      // 09:00, 09:30, 10:00 ... last valid 60m meeting starts at 16:00
      // 09:00 to 16:00 in 30m steps = 15 slots
      expect(slots.length).toBe(15);
      expect(slots[0].formattedStartTime).toContain('09:00');
      expect(slots[slots.length - 1].formattedStartTime).toContain('16:00');
    });
  });
});
