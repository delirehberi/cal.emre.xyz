import type { TimeCalendarEvent, CalendarRSVP } from '../nostr/nip52';

export interface WorkingHoursConfig {
  /** Start hour in 24h format (0-23, e.g. 9 for 09:00) */
  startHour: number;
  /** End hour in 24h format (1-24, e.g. 17 for 17:00) */
  endHour: number;
  /** Array of active working days (0 = Sunday, 1 = Monday, ..., 6 = Saturday) */
  workingDays: number[];
  /** IANA timezone string of host, e.g. 'UTC', 'Europe/Istanbul', 'America/New_York' */
  timezone: string;
  /** Optional buffer time in minutes required between appointments */
  bufferMinutes?: number;
  /** Default meeting location or video call link (e.g. Jitsi Meet URL) */
  location?: string;
  /** Default meeting duration in minutes */
  defaultDuration?: number;
  /** Per-weekday hour overrides in minutes from midnight; days without an entry use startHour/endHour */
  dayHours?: Record<number, DayHours>;
  /** Meeting durations (minutes) the host offers; undefined means the app defaults */
  durations?: number[];
  /** Minimum notice in minutes before a booking can start */
  minNoticeMinutes?: number;
}

export interface DayHours {
  /** Opening time in minutes from midnight (0-1439) */
  start: number;
  /** Closing time in minutes from midnight (1-1440), later than start */
  end: number;
}

/**
 * Resolves the opening interval for a weekday, or null when the host is not available that day.
 */
export function resolveDayHours(config: WorkingHoursConfig, dayOfWeek: number): DayHours | null {
  if (!config.workingDays.includes(dayOfWeek)) return null;
  const override = config.dayHours?.[dayOfWeek];
  if (override && override.end > override.start) {
    return {
      start: Math.max(0, Math.min(1439, override.start)),
      end: Math.max(1, Math.min(1440, override.end)),
    };
  }
  const startHour = Math.max(0, Math.min(23, config.startHour));
  const endHour = Math.max(startHour + 1, Math.min(24, config.endHour));
  return { start: startHour * 60, end: endHour * 60 };
}

/**
 * Validates untrusted working-hours data (storage or relay content) into a complete config.
 */
export function normalizeWorkingHours(
  input: Partial<WorkingHoursConfig> | null | undefined,
  defaults: WorkingHoursConfig
): WorkingHoursConfig {
  const parsed = input ?? {};
  const isMinute = (n: unknown, min: number, max: number): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

  const dayHours: Record<number, DayHours> = {};
  if (parsed.dayHours && typeof parsed.dayHours === 'object') {
    for (const [key, value] of Object.entries(parsed.dayHours)) {
      const day = Number(key);
      if (
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6 &&
        value &&
        isMinute(value.start, 0, 1439) &&
        isMinute(value.end, 1, 1440) &&
        value.end > value.start
      ) {
        dayHours[day] = { start: value.start, end: value.end };
      }
    }
  }

  const durations = Array.isArray(parsed.durations)
    ? Array.from(new Set(parsed.durations.filter((d) => isMinute(d, 5, 480)))).sort((a, b) => a - b)
    : [];

  return {
    startHour: isMinute(parsed.startHour, 0, 23) ? parsed.startHour : defaults.startHour,
    endHour: isMinute(parsed.endHour, 1, 24) ? parsed.endHour : defaults.endHour,
    workingDays: Array.isArray(parsed.workingDays)
      ? Array.from(new Set(parsed.workingDays.filter((d) => isMinute(d, 0, 6)))).sort((a, b) => a - b)
      : defaults.workingDays,
    timezone: typeof parsed.timezone === 'string' && parsed.timezone ? parsed.timezone : defaults.timezone,
    bufferMinutes: isMinute(parsed.bufferMinutes, 0, 240) ? parsed.bufferMinutes : defaults.bufferMinutes,
    location: typeof parsed.location === 'string' ? parsed.location : defaults.location,
    defaultDuration: isMinute(parsed.defaultDuration, 5, 480) ? parsed.defaultDuration : defaults.defaultDuration,
    dayHours: Object.keys(dayHours).length > 0 ? dayHours : defaults.dayHours,
    durations: durations.length > 0 ? durations : defaults.durations,
    minNoticeMinutes: isMinute(parsed.minNoticeMinutes, 0, 60 * 24 * 90)
      ? parsed.minNoticeMinutes
      : defaults.minNoticeMinutes,
  };
}

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  startHour: 9,
  endHour: 17,
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'UTC',
  bufferMinutes: 5,
  defaultDuration: 30,
  location: '',
};

export const STORAGE_WORKING_HOURS_PREFIX = 'cal_working_hours_';

/**
 * Loads host working hours from storage with fallback to default config.
 */
export function getHostWorkingHours(pubkey?: string): WorkingHoursConfig {
  const defaults = DEFAULT_WORKING_HOURS;

  if (!pubkey) {
    return defaults;
  }

  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;

    if (!storage) return defaults;

    const raw = storage.getItem(`${STORAGE_WORKING_HOURS_PREFIX}${pubkey}`);
    if (!raw) return defaults;
    return normalizeWorkingHours(JSON.parse(raw) as Partial<WorkingHoursConfig>, defaults);
  } catch {
    return defaults;
  }
}

/**
 * Saves host working hours to storage.
 */
export function saveHostWorkingHours(pubkey: string, config: WorkingHoursConfig): void {
  if (!pubkey) {
    return;
  }
  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;

    if (storage) {
      storage.setItem(`${STORAGE_WORKING_HOURS_PREFIX}${pubkey}`, JSON.stringify(config));
    }
  } catch {
    // Ignore storage write errors (e.g. quota exceeded)
  }
}



export interface TimeSlot {
  /** Slot start time (Unix timestamp in seconds) */
  start: number;
  /** Slot end time (Unix timestamp in seconds) */
  end: number;
  /** ISO string of slot start */
  startTimeISO: string;
  /** ISO string of slot end */
  endTimeISO: string;
  /** Formatted human-readable start time in attendee's timezone */
  formattedStartTime: string;
  /** Formatted human-readable end time in attendee's timezone */
  formattedEndTime: string;
  /** Whether the slot is open for booking */
  available: boolean;
  /** Reason why the slot is unavailable if not available */
  reason?: 'booked' | 'past' | 'outside_working_hours';
}

export interface BusyInterval {
  /** Interval start (Unix timestamp in seconds) */
  start: number;
  /** Interval end (Unix timestamp in seconds) */
  end: number;
  /** Title or description of the occupied slot if known */
  title?: string;
  /** Source identifier of the event or RSVP */
  sourceId?: string;
  /** Type of busy record */
  sourceType: 'event' | 'rsvp';
}

export interface DailySlotsParams {
  /** Selected date formatted as 'YYYY-MM-DD' or a Date object */
  date: string | Date;
  /** Meeting duration in minutes (e.g. 15, 30, 60) */
  durationMinutes: number;
  /** Host working hours configuration */
  workingHours: WorkingHoursConfig;
  /** List of busy intervals from host's Kind 31923 events and accepted Kind 31925 RSVPs */
  busyIntervals?: BusyInterval[];
  /** Target attendee timezone (defaults to host timezone or browser timezone) */
  attendeeTimezone?: string;
  /** Current reference timestamp in seconds (defaults to Date.now() / 1000) */
  currentTimestamp?: number;
  /** Minimum lead time in minutes before meeting can start (defaults to 15m) */
  minLeadTimeMinutes?: number;
}

export interface MonthAvailabilityParams {
  /** Target year (e.g. 2026) */
  year: number;
  /** Target month (1-12) */
  month: number;
  /** Meeting duration in minutes */
  durationMinutes: number;
  /** Host working hours configuration */
  workingHours: WorkingHoursConfig;
  /** List of busy intervals */
  busyIntervals?: BusyInterval[];
  /** Attendee timezone */
  attendeeTimezone?: string;
  /** Current reference timestamp in seconds */
  currentTimestamp?: number;
}

export interface DayAvailabilitySummary {
  /** Date formatted as 'YYYY-MM-DD' */
  date: string;
  /** Day of month (1-31) */
  day: number;
  /** Whether there is at least one bookable slot */
  hasAvailableSlots: boolean;
  /** Total count of available slots */
  availableSlotCount: number;
}

/**
 * Normalizes a date into 'YYYY-MM-DD' string format.
 */
export function formatDateKey(date: string | Date): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date string provided: ${date}`);
    }
    return formatDateKey(parsed);
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the offset in milliseconds for a specific IANA timezone at a specific UTC timestamp.
 */
export function getTimezoneOffsetMs(timeZone: string, utcTimestampMs: number): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date(utcTimestampMs));
    const values: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = parseInt(part.value, 10);
      }
    }

    const hour = values.hour === 24 ? 0 : values.hour;
    const targetUtc = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      hour,
      values.minute,
      values.second
    );

    return targetUtc - utcTimestampMs;
  } catch {
    // Fallback to UTC if timezone is unrecognized
    return 0;
  }
}

/**
 * Converts a localized date ('YYYY-MM-DD') and hour/minute in a given IANA timezone
 * to the exact UTC timestamp in seconds.
 */
export function localTimeToUtcTimestamp(
  dateString: string,
  hours: number,
  minutes: number,
  timeZone: string
): number {
  const [year, month, day] = dateString.split('-').map(Number);
  // Initial estimate assuming UTC
  const initialUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const offsetMs = getTimezoneOffsetMs(timeZone, initialUtcMs);
  // Subtract the timezone offset to get the correct UTC moment
  const exactUtcMs = initialUtcMs - offsetMs;
  return Math.floor(exactUtcMs / 1000);
}

/**
 * Gets the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) for a specific date in a specific timezone.
 */
export function getDayOfWeekInTimezone(dateString: string, timeZone: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  const noonUtcMs = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const weekday = formatter.format(new Date(noonUtcMs));
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[weekday] ?? 0;
}

/**
 * Extracts occupied/busy intervals from host Kind 31923 calendar events and Kind 31925 accepted RSVPs.
 */
export function extractBusyIntervals(
  events: TimeCalendarEvent[] = [],
  rsvps: CalendarRSVP[] = [],
  hostPubkey?: string
): BusyInterval[] {
  const intervals: BusyInterval[] = [];

  // 1. Kind 31923 Time-Based Events
  for (const event of events) {
    if (hostPubkey && event.pubkey && event.pubkey !== hostPubkey) {
      // If hostPubkey is provided, check if host is an attendee or author
      const isHostAttendee = event.attendees.some((a) => a.pubkey === hostPubkey);
      if (!isHostAttendee) {
        continue;
      }
    }

    const start = event.start;
    // Default duration is 30m if end timestamp is missing
    const end = event.end && event.end > start ? event.end : start + 30 * 60;

    intervals.push({
      start,
      end,
      title: event.title,
      sourceId: event.id || event.identifier,
      sourceType: 'event',
    });
  }

  // 2. Kind 31925 RSVPs (accepted and busy status)
  for (const rsvp of rsvps) {
    if (rsvp.status !== 'accepted' || rsvp.freeBusy !== 'busy') {
      continue;
    }

    if (hostPubkey && rsvp.pubkey !== hostPubkey && rsvp.hostPubkey !== hostPubkey) {
      continue;
    }

    // Try finding matching event in events list to get exact start/end
    const matchedEvent = events.find((e) => e.coordinate === rsvp.eventCoordinate);
    if (matchedEvent) {
      const start = matchedEvent.start;
      const end = matchedEvent.end && matchedEvent.end > start ? matchedEvent.end : start + 30 * 60;
      // Prevent duplicate if already added
      const alreadyAdded = intervals.some(
        (i) => i.sourceType === 'event' && i.sourceId === (matchedEvent.id || matchedEvent.identifier)
      );
      if (!alreadyAdded) {
        intervals.push({
          start,
          end,
          title: matchedEvent.title,
          sourceId: rsvp.id || rsvp.identifier,
          sourceType: 'rsvp',
        });
      }
    }
  }

  // Sort chronologically
  return intervals.sort((a, b) => a.start - b.start);
}

/**
 * Determines whether a proposed time slot collides with any occupied intervals,
 * considering optional buffer periods between meetings.
 */
export function isSlotColliding(
  slotStart: number,
  slotEnd: number,
  busyIntervals: BusyInterval[] = [],
  bufferMinutes: number = 0
): boolean {
  const bufferSeconds = bufferMinutes * 60;

  for (const busy of busyIntervals) {
    // Collision condition: max(start1, start2) < min(end1, end2)
    // Slot collides if busy event (with buffer margins) overlaps with proposed slot
    const hasOverlap = Math.max(slotStart, busy.start - bufferSeconds) < Math.min(slotEnd, busy.end + bufferSeconds);
    if (hasOverlap) {
      return true;
    }
  }

  return false;
}

/**
 * Formats a Unix timestamp in seconds to a human-readable 24-hour time string (e.g. "09:30" or "14:00")
 * in a specified timezone.
 */
export function formatSlotTime(
  timestampSeconds: number,
  timeZone: string,
  locale: string = 'en-US',
  use24Hour: boolean = true
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24Hour,
    });
    return formatter.format(new Date(timestampSeconds * 1000));
  } catch {
    const d = new Date(timestampSeconds * 1000);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  }
}

/**
 * Generates all possible time slots for a specified date based on host working hours,
 * verifies availability against busy intervals, and respects timezone shifts and lead time.
 */
export function generateDailyTimeSlots(params: DailySlotsParams): TimeSlot[] {
  const {
    date,
    durationMinutes,
    workingHours,
    busyIntervals = [],
    attendeeTimezone = workingHours.timezone || 'UTC',
    currentTimestamp = Math.floor(Date.now() / 1000),
    minLeadTimeMinutes = workingHours.minNoticeMinutes ?? 15,
  } = params;

  if (durationMinutes <= 0) {
    throw new Error(`Slot duration must be greater than 0 minutes (got ${durationMinutes})`);
  }

  const dateKey = formatDateKey(date);
  const hostTimezone = workingHours.timezone || 'UTC';
  const bufferMinutes = workingHours.bufferMinutes || 0;

  // Verify whether the date falls on a host working day
  const dayOfWeek = getDayOfWeekInTimezone(dateKey, hostTimezone);
  const dayHours = resolveDayHours(workingHours, dayOfWeek);
  if (!dayHours) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const totalWorkingMinutes = dayHours.end - dayHours.start;
  const minLeadTimeSeconds = minLeadTimeMinutes * 60;
  const effectiveCutoffTime = currentTimestamp + minLeadTimeSeconds;

  for (let offsetMinutes = 0; offsetMinutes + durationMinutes <= totalWorkingMinutes; offsetMinutes += durationMinutes) {
    const slotStartMinuteOfDay = dayHours.start + offsetMinutes;
    const slotStartHour = Math.floor(slotStartMinuteOfDay / 60);
    const slotStartMinute = slotStartMinuteOfDay % 60;

    const slotStartTimestamp = localTimeToUtcTimestamp(
      dateKey,
      slotStartHour,
      slotStartMinute,
      hostTimezone
    );
    const slotEndTimestamp = slotStartTimestamp + durationMinutes * 60;

    const startDate = new Date(slotStartTimestamp * 1000);
    const endDate = new Date(slotEndTimestamp * 1000);

    const isPast = slotStartTimestamp < effectiveCutoffTime;
    const isBooked = isSlotColliding(slotStartTimestamp, slotEndTimestamp, busyIntervals, bufferMinutes);

    let available = true;
    let reason: TimeSlot['reason'] = undefined;

    if (isPast) {
      available = false;
      reason = 'past';
    } else if (isBooked) {
      available = false;
      reason = 'booked';
    }

    slots.push({
      start: slotStartTimestamp,
      end: slotEndTimestamp,
      startTimeISO: startDate.toISOString(),
      endTimeISO: endDate.toISOString(),
      formattedStartTime: formatSlotTime(slotStartTimestamp, attendeeTimezone, 'en-US', true),
      formattedEndTime: formatSlotTime(slotEndTimestamp, attendeeTimezone, 'en-US', true),
      available,
      reason,
    });
  }

  return slots;
}

/**
 * Computes the availability summary for every day of a specified calendar month.
 */
export function generateMonthAvailability(params: MonthAvailabilityParams): DayAvailabilitySummary[] {
  const { year, month, durationMinutes, workingHours, busyIntervals = [], attendeeTimezone, currentTimestamp } = params;

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Month must be between 1 and 12.`);
  }

  // Calculate days in target month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const summary: DayAvailabilitySummary[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    const dateKey = `${year}-${formattedMonth}-${formattedDay}`;

    const slots = generateDailyTimeSlots({
      date: dateKey,
      durationMinutes,
      workingHours,
      busyIntervals,
      attendeeTimezone,
      currentTimestamp,
    });

    const availableSlots = slots.filter((s) => s.available);

    summary.push({
      date: dateKey,
      day,
      hasAvailableSlots: availableSlots.length > 0,
      availableSlotCount: availableSlots.length,
    });
  }

  return summary;
}
