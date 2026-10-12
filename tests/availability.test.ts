import { describe, it, expect } from 'vitest';
import {
  AVAILABILITY_IDENTIFIER,
  AVAILABILITY_KIND,
  createAvailabilityEventTemplate,
  parseAvailabilityEvent,
} from '../src/client/lib/nostr/availability';
import {
  DEFAULT_WORKING_HOURS,
  generateDailyTimeSlots,
  normalizeWorkingHours,
  resolveDayHours,
  type WorkingHoursConfig,
} from '../src/client/lib/calendar/slots';

const config: WorkingHoursConfig = {
  ...DEFAULT_WORKING_HOURS,
  timezone: 'Europe/Istanbul',
  workingDays: [1, 3],
  dayHours: { 3: { start: 10 * 60, end: 18 * 60 } },
  durations: [30, 45],
  minNoticeMinutes: 24 * 60,
  bufferMinutes: 10,
};

describe('per-day working hours', () => {
  it('resolves overrides, falls back to the default window and hides days off', () => {
    expect(resolveDayHours(config, 1)).toEqual({ start: 540, end: 1020 });
    expect(resolveDayHours(config, 3)).toEqual({ start: 600, end: 1080 });
    expect(resolveDayHours(config, 2)).toBeNull();
  });

  it('generates slots inside the per-day window', () => {
    // 2030-01-02 is a Wednesday
    const slots = generateDailyTimeSlots({
      date: '2030-01-02',
      durationMinutes: 60,
      workingHours: config,
      currentTimestamp: 0,
    });
    expect(slots).toHaveLength(8);
    expect(slots[0].formattedStartTime).toBe('10:00');
    expect(slots[slots.length - 1].formattedEndTime).toBe('18:00');
  });

  it('applies the minimum notice window', () => {
    const date = '2030-01-02';
    const open = generateDailyTimeSlots({ date, durationMinutes: 60, workingHours: config, currentTimestamp: 0 })[0];
    const slots = generateDailyTimeSlots({
      date,
      durationMinutes: 60,
      workingHours: config,
      currentTimestamp: open.start - 23 * 3600,
    });
    expect(slots[0].available).toBe(false);
    expect(slots[0].reason).toBe('past');
    expect(slots[2].available).toBe(true);
  });
});

describe('normalizeWorkingHours', () => {
  it('drops invalid values and keeps defaults', () => {
    const result = normalizeWorkingHours(
      {
        startHour: 99,
        workingDays: [1, 1, 9, 2],
        dayHours: { 1: { start: 600, end: 500 }, 2: { start: 600, end: 720 } },
        durations: [45, 45, 2, 30],
        minNoticeMinutes: -5,
      },
      DEFAULT_WORKING_HOURS
    );
    expect(result.startHour).toBe(9);
    expect(result.workingDays).toEqual([1, 2]);
    expect(result.dayHours).toEqual({ 2: { start: 600, end: 720 } });
    expect(result.durations).toEqual([30, 45]);
    expect(result.minNoticeMinutes).toBeUndefined();
  });
});

describe('NIP-78 availability event', () => {
  it('round-trips through a kind 30078 event', () => {
    const template = createAvailabilityEventTemplate(config, 1700000000);
    expect(template.kind).toBe(AVAILABILITY_KIND);
    expect(template.tags).toContainEqual(['d', AVAILABILITY_IDENTIFIER]);
    const parsed = parseAvailabilityEvent(template as never);
    expect(parsed).toEqual(normalizeWorkingHours(config, DEFAULT_WORKING_HOURS));
  });

  it('ignores foreign and malformed events', () => {
    expect(parseAvailabilityEvent({ kind: 1, tags: [], content: '{}' })).toBeNull();
    expect(parseAvailabilityEvent({ kind: AVAILABILITY_KIND, tags: [['d', 'other']], content: '{}' })).toBeNull();
    expect(
      parseAvailabilityEvent({ kind: AVAILABILITY_KIND, tags: [['d', AVAILABILITY_IDENTIFIER]], content: 'nope' })
    ).toBeNull();
  });
});
