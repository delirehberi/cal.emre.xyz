export interface CalendarPerson {
  name?: string;
  email?: string;
  pubkey?: string;
}

export interface ICSEventParams {
  /** Unique ID for the calendar event */
  uid?: string;
  /** Meeting title / summary */
  title: string;
  /** Detailed description or notes */
  description?: string;
  /** Meeting location or video link */
  location?: string;
  /** Start Unix timestamp in seconds */
  start: number;
  /** End Unix timestamp in seconds */
  end: number;
  /** Event URL (e.g. nostr naddr coordinate or web booking link) */
  url?: string;
  /** Host / Organizer info */
  organizer?: CalendarPerson;
  /** Attendee info */
  attendee?: CalendarPerson;
  /** Status of the appointment */
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  /** Alarm reminder in minutes before meeting (defaults to 15m) */
  alarmMinutesBefore?: number;
  /** Calendar method (defaults to 'REQUEST') */
  method?: 'REQUEST' | 'PUBLISH';
}

/**
 * Formats a Unix timestamp (in seconds) to UTC iCalendar date-time string (YYYYMMDDTHHMMSSZ).
 */
export function formatUtcDateTime(timestampSeconds: number): string {
  const d = new Date(timestampSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes characters for RFC 5545 text fields:
 * - Backslashes -> \\
 * - Semicolons -> \;
 * - Commas -> \,
 * - Newlines -> \n
 */
export function escapeICSText(text: string = ''): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Folds a single iCalendar content line so that each line is at most 75 octets (RFC 5545 Section 3.1).
 * Continuation lines begin with a single whitespace character (space).
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= 75) {
    return line;
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let byteOffset = 0;
  let isFirstLine = true;

  while (byteOffset < bytes.length) {
    const maxLineBytes = isFirstLine ? 75 : 74; // account for leading space on subsequent lines
    let endOffset = Math.min(bytes.length, byteOffset + maxLineBytes);

    // Ensure we don't slice in the middle of a multi-byte UTF-8 character
    while (endOffset > byteOffset && (bytes[endOffset] & 0xc0) === 0x80) {
      endOffset--;
    }

    const chunk = decoder.decode(bytes.slice(byteOffset, endOffset));
    chunks.push(isFirstLine ? chunk : ` ${chunk}`);
    byteOffset = endOffset;
    isFirstLine = false;
  }

  return chunks.join('\r\n');
}

/**
 * Generates an RFC 5545 compliant `.ics` calendar event string.
 */
export function generateICS(params: ICSEventParams): string {
  const {
    uid = `cal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@cal.emre.xyz`,
    title,
    description = '',
    location = '',
    start,
    end,
    url,
    organizer,
    attendee,
    status = 'CONFIRMED',
    alarmMinutesBefore = 15,
    method = 'REQUEST',
  } = params;

  if (typeof start !== 'number' || isNaN(start) || start <= 0) {
    throw new Error(`Invalid start timestamp: ${start}`);
  }
  if (typeof end !== 'number' || isNaN(end) || end <= 0) {
    throw new Error(`Invalid end timestamp: ${end}`);
  }
  if (end <= start) {
    throw new Error(`End time (${end}) must be after start time (${start})`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const dtStamp = formatUtcDateTime(nowSeconds);
  const dtStart = formatUtcDateTime(start);
  const dtEnd = formatUtcDateTime(end);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'PRODID:-//cal.emre.xyz//NIP-52 Calendar//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(title)}`,
    `STATUS:${status}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICSText(location)}`);
  }

  if (url) {
    lines.push(`URL:${url}`);
  }

  if (organizer) {
    const orgEmail = organizer.email || (organizer.pubkey ? `${organizer.pubkey}@cal.emre.xyz` : 'host@cal.emre.xyz');
    const orgName = organizer.name ? `CN=${escapeICSText(organizer.name)}:` : '';
    lines.push(`ORGANIZER;${orgName}mailto:${orgEmail}`);
  }

  if (attendee) {
    const attEmail = attendee.email || (attendee.pubkey ? `${attendee.pubkey}@cal.emre.xyz` : 'guest@cal.emre.xyz');
    const attName = attendee.name ? `CN=${escapeICSText(attendee.name)}:` : '';
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;${attName}mailto:${attEmail}`);
  }

  // Add VALARM for desktop/mobile calendar alerts
  if (alarmMinutesBefore > 0) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:-PT${alarmMinutesBefore}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICSText(`Reminder: ${title}`)}`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Generates a direct Google Calendar web link for one-click adding.
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  start: number;
  end: number;
  description?: string;
  location?: string;
}): string {
  const startUtc = formatUtcDateTime(params.start);
  const endUtc = formatUtcDateTime(params.end);

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${startUtc}/${endUtc}`,
  });

  if (params.description) {
    query.set('details', params.description);
  }
  if (params.location) {
    query.set('location', params.location);
  }

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/**
 * Generates an Outlook.com (Consumer) calendar link.
 */
export function generateOutlookCalendarUrl(params: {
  title: string;
  start: number;
  end: number;
  description?: string;
  location?: string;
}): string {
  const startDate = new Date(params.start * 1000).toISOString();
  const endDate = new Date(params.end * 1000).toISOString();

  const query = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: params.title,
    startdt: startDate,
    enddt: endDate,
  });

  if (params.description) {
    query.set('body', params.description);
  }
  if (params.location) {
    query.set('location', params.location);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${query.toString()}`;
}

/**
 * Generates an Office 365 (Enterprise) calendar link.
 */
export function generateOffice365CalendarUrl(params: {
  title: string;
  start: number;
  end: number;
  description?: string;
  location?: string;
}): string {
  const startDate = new Date(params.start * 1000).toISOString();
  const endDate = new Date(params.end * 1000).toISOString();

  const query = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: params.title,
    startdt: startDate,
    enddt: endDate,
  });

  if (params.description) {
    query.set('body', params.description);
  }
  if (params.location) {
    query.set('location', params.location);
  }

  return `https://outlook.office.com/calendar/0/deeplink/compose?${query.toString()}`;
}

/**
 * Generates a Yahoo Calendar link.
 */
export function generateYahooCalendarUrl(params: {
  title: string;
  start: number;
  end: number;
  description?: string;
  location?: string;
}): string {
  const startUtc = formatUtcDateTime(params.start);
  const endUtc = formatUtcDateTime(params.end);

  const query = new URLSearchParams({
    v: '60',
    title: params.title,
    st: startUtc,
    et: endUtc,
  });

  if (params.description) {
    query.set('desc', params.description);
  }
  if (params.location) {
    query.set('in_loc', params.location);
  }

  return `https://calendar.yahoo.com/?${query.toString()}`;
}

/**
 * Creates a browser data URL for Apple Calendar / direct import.
 */
export function generateAppleCalendarDataUri(icsContent: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
}

/**
 * Creates a Blob Object URL for client-side download.
 */
export function createICSBlobUrl(icsContent: string): string {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Triggers a client-side file download for an `.ics` file.
 */
export function downloadICSFile(filename: string, icsContent: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
