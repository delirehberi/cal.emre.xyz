import type { Event, EventTemplate } from 'nostr-tools';
import {
  DEFAULT_WORKING_HOURS,
  normalizeWorkingHours,
  type WorkingHoursConfig,
} from '../calendar/slots';

/** NIP-78 application-specific data kind. */
export const AVAILABILITY_KIND = 30078;
/** `d` tag identifying Kün availability records. */
export const AVAILABILITY_IDENTIFIER = 'kun/availability';

/**
 * Builds a NIP-78 (kind 30078) replaceable event carrying the host's public availability.
 * The content is intentionally public: visitors need it to compute bookable slots.
 */
export function createAvailabilityEventTemplate(
  config: WorkingHoursConfig,
  createdAt: number = Math.floor(Date.now() / 1000)
): EventTemplate {
  const normalized = normalizeWorkingHours(config, DEFAULT_WORKING_HOURS);
  return {
    kind: AVAILABILITY_KIND,
    created_at: createdAt,
    tags: [
      ['d', AVAILABILITY_IDENTIFIER],
      ['alt', 'Kün booking availability'],
    ],
    content: JSON.stringify({
      version: 1,
      startHour: normalized.startHour,
      endHour: normalized.endHour,
      workingDays: normalized.workingDays,
      dayHours: normalized.dayHours,
      timezone: normalized.timezone,
      bufferMinutes: normalized.bufferMinutes,
      durations: normalized.durations,
      defaultDuration: normalized.defaultDuration,
      minNoticeMinutes: normalized.minNoticeMinutes,
      location: normalized.location,
    }),
  };
}

/**
 * Parses a kind 30078 availability event. Returns null for foreign or malformed events.
 */
export function parseAvailabilityEvent(
  event: Pick<Event, 'kind' | 'tags' | 'content'>
): WorkingHoursConfig | null {
  if (event.kind !== AVAILABILITY_KIND) return null;
  const identifier = event.tags.find((t) => t[0] === 'd')?.[1];
  if (identifier !== AVAILABILITY_IDENTIFIER) return null;

  try {
    const data = JSON.parse(event.content) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return normalizeWorkingHours(data as Partial<WorkingHoursConfig>, DEFAULT_WORKING_HOURS);
  } catch {
    return null;
  }
}
