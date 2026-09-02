import type { Event, EventTemplate } from 'nostr-tools';

export type RSVPStatus = 'accepted' | 'declined' | 'tentative';
export type FreeBusyStatus = 'free' | 'busy';
export type AttendeeRole = 'host' | 'attendee' | 'organizer';

export interface CalendarAttendee {
  pubkey: string;
  relay?: string;
  role?: AttendeeRole;
}

export interface TimeCalendarEvent {
  id?: string;
  pubkey?: string;
  created_at?: number;
  identifier: string; // 'd' tag
  title: string;
  summary?: string;
  description?: string;
  start: number; // Unix timestamp in seconds
  end?: number; // Unix timestamp in seconds
  startTzid?: string;
  endTzid?: string;
  location?: string;
  geohash?: string;
  hashtags: string[];
  attendees: CalendarAttendee[];
  content: string;
  coordinate: string; // 31923:<pubkey>:<d-tag>
}

export interface DateCalendarEvent {
  id?: string;
  pubkey?: string;
  created_at?: number;
  identifier: string; // 'd' tag
  title: string;
  summary?: string;
  description?: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  location?: string;
  geohash?: string;
  hashtags: string[];
  attendees: CalendarAttendee[];
  content: string;
  coordinate: string; // 31922:<pubkey>:<d-tag>
}

export interface CalendarRSVP {
  id?: string;
  pubkey?: string;
  created_at?: number;
  identifier: string; // 'd' tag
  eventCoordinate: string; // 'a' tag (e.g. 31923:<hostPubkey>:<d-tag>)
  relayHint?: string;
  hostPubkey?: string;
  status: RSVPStatus;
  freeBusy: FreeBusyStatus;
  content: string;
}

export interface CalendarCollection {
  id?: string;
  pubkey?: string;
  created_at?: number;
  identifier: string;
  title: string;
  summary?: string;
  eventCoordinates: string[];
}

/**
 * Creates an unsigned Kind 31923 Time-Based Calendar Event template.
 */
export function createTimeCalendarEventTemplate(params: {
  identifier: string;
  title: string;
  start: number;
  end?: number;
  startTzid?: string;
  endTzid?: string;
  summary?: string;
  description?: string;
  location?: string;
  geohash?: string;
  hashtags?: string[];
  attendees?: CalendarAttendee[];
  content?: string;
}): EventTemplate {
  if (!params.identifier.trim()) {
    throw new Error('Time calendar event must have a valid identifier (d-tag)');
  }
  if (!params.title.trim()) {
    throw new Error('Time calendar event must have a title');
  }
  if (typeof params.start !== 'number' || isNaN(params.start) || params.start <= 0) {
    throw new Error(`Invalid start timestamp: ${params.start}`);
  }

  const tags: string[][] = [
    ['d', params.identifier.trim()],
    ['title', params.title.trim()],
    ['start', Math.floor(params.start).toString()],
  ];

  if (params.end) {
    tags.push(['end', Math.floor(params.end).toString()]);
  }
  if (params.startTzid) {
    tags.push(['start_tzid', params.startTzid]);
  }
  if (params.endTzid) {
    tags.push(['end_tzid', params.endTzid]);
  }
  if (params.summary) {
    tags.push(['summary', params.summary]);
  }
  if (params.description) {
    tags.push(['description', params.description]);
  }
  if (params.location) {
    tags.push(['location', params.location]);
  }
  if (params.geohash) {
    tags.push(['g', params.geohash]);
  }

  if (params.hashtags) {
    for (const tag of params.hashtags) {
      if (tag.trim()) {
        tags.push(['t', tag.trim()]);
      }
    }
  }

  if (params.attendees) {
    for (const att of params.attendees) {
      const pTag = ['p', att.pubkey];
      if (att.relay) {
        pTag.push(att.relay);
      } else if (att.role) {
        pTag.push('');
      }
      if (att.role) {
        pTag.push(att.role);
      }
      tags.push(pTag);
    }
  }

  return {
    kind: 31923,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content || params.description || '',
  };
}

/**
 * Parses a Kind 31923 Time-Based Calendar Event.
 */
export function parseTimeCalendarEvent(event: Event): TimeCalendarEvent {
  if (event.kind !== 31923) {
    throw new Error(`Expected kind 31923 event, got kind ${event.kind}`);
  }

  let identifier = '';
  let title = '';
  let start = 0;
  let end: number | undefined;
  let startTzid: string | undefined;
  let endTzid: string | undefined;
  let summary: string | undefined;
  let description: string | undefined;
  let location: string | undefined;
  let geohash: string | undefined;
  const hashtags: string[] = [];
  const attendees: CalendarAttendee[] = [];

  for (const tag of event.tags) {
    const [tagName, val1, val2, val3] = tag;
    switch (tagName) {
      case 'd':
        identifier = val1 || '';
        break;
      case 'title':
        title = val1 || '';
        break;
      case 'start':
        start = parseInt(val1, 10) || 0;
        break;
      case 'end':
        end = parseInt(val1, 10) || undefined;
        break;
      case 'start_tzid':
        startTzid = val1;
        break;
      case 'end_tzid':
        endTzid = val1;
        break;
      case 'summary':
        summary = val1;
        break;
      case 'description':
        description = val1;
        break;
      case 'location':
        location = val1;
        break;
      case 'g':
        geohash = val1;
        break;
      case 't':
        if (val1) hashtags.push(val1);
        break;
      case 'p':
        if (val1) {
          attendees.push({
            pubkey: val1,
            relay: val2 || undefined,
            role: (val3 as AttendeeRole) || undefined,
          });
        }
        break;
    }
  }

  if (!identifier) {
    throw new Error('Event missing identifier (d-tag)');
  }
  if (!title) {
    throw new Error('Event missing title tag');
  }
  if (!start) {
    throw new Error('Event missing valid start timestamp tag');
  }

  const coordinate = `31923:${event.pubkey}:${identifier}`;

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    identifier,
    title,
    summary,
    description: description || event.content,
    start,
    end,
    startTzid,
    endTzid,
    location,
    geohash,
    hashtags,
    attendees,
    content: event.content,
    coordinate,
  };
}

/**
 * Creates an unsigned Kind 31922 Date-Based Calendar Event template.
 */
export function createDateCalendarEventTemplate(params: {
  identifier: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  summary?: string;
  description?: string;
  location?: string;
  geohash?: string;
  hashtags?: string[];
  attendees?: CalendarAttendee[];
  content?: string;
}): EventTemplate {
  if (!params.identifier.trim()) {
    throw new Error('Date calendar event must have a valid identifier (d-tag)');
  }
  if (!params.title.trim()) {
    throw new Error('Date calendar event must have a title');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.start)) {
    throw new Error(`Invalid start date format (must be YYYY-MM-DD): "${params.start}"`);
  }
  if (params.end && !/^\d{4}-\d{2}-\d{2}$/.test(params.end)) {
    throw new Error(`Invalid end date format (must be YYYY-MM-DD): "${params.end}"`);
  }

  const tags: string[][] = [
    ['d', params.identifier.trim()],
    ['title', params.title.trim()],
    ['start', params.start],
  ];

  if (params.end) {
    tags.push(['end', params.end]);
  }
  if (params.summary) {
    tags.push(['summary', params.summary]);
  }
  if (params.description) {
    tags.push(['description', params.description]);
  }
  if (params.location) {
    tags.push(['location', params.location]);
  }
  if (params.geohash) {
    tags.push(['g', params.geohash]);
  }

  if (params.hashtags) {
    for (const tag of params.hashtags) {
      if (tag.trim()) {
        tags.push(['t', tag.trim()]);
      }
    }
  }

  if (params.attendees) {
    for (const att of params.attendees) {
      const pTag = ['p', att.pubkey];
      if (att.relay) pTag.push(att.relay);
      if (att.role) {
        if (!att.relay) pTag.push('');
        pTag.push(att.role);
      }
      tags.push(pTag);
    }
  }

  return {
    kind: 31922,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content || params.description || '',
  };
}

/**
 * Parses a Kind 31922 Date-Based Calendar Event.
 */
export function parseDateCalendarEvent(event: Event): DateCalendarEvent {
  if (event.kind !== 31922) {
    throw new Error(`Expected kind 31922 event, got kind ${event.kind}`);
  }

  let identifier = '';
  let title = '';
  let start = '';
  let end: string | undefined;
  let summary: string | undefined;
  let description: string | undefined;
  let location: string | undefined;
  let geohash: string | undefined;
  const hashtags: string[] = [];
  const attendees: CalendarAttendee[] = [];

  for (const tag of event.tags) {
    const [tagName, val1, val2, val3] = tag;
    switch (tagName) {
      case 'd':
        identifier = val1 || '';
        break;
      case 'title':
        title = val1 || '';
        break;
      case 'start':
        start = val1 || '';
        break;
      case 'end':
        end = val1 || undefined;
        break;
      case 'summary':
        summary = val1;
        break;
      case 'description':
        description = val1;
        break;
      case 'location':
        location = val1;
        break;
      case 'g':
        geohash = val1;
        break;
      case 't':
        if (val1) hashtags.push(val1);
        break;
      case 'p':
        if (val1) {
          attendees.push({
            pubkey: val1,
            relay: val2 || undefined,
            role: (val3 as AttendeeRole) || undefined,
          });
        }
        break;
    }
  }

  if (!identifier) {
    throw new Error('Event missing identifier (d-tag)');
  }
  if (!title) {
    throw new Error('Event missing title tag');
  }
  if (!start) {
    throw new Error('Event missing start date tag');
  }

  const coordinate = `31922:${event.pubkey}:${identifier}`;

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    identifier,
    title,
    summary,
    description: description || event.content,
    start,
    end,
    location,
    geohash,
    hashtags,
    attendees,
    content: event.content,
    coordinate,
  };
}

/**
 * Creates an unsigned Kind 31925 Calendar Event RSVP template.
 */
export function createCalendarRSVPTemplate(params: {
  eventCoordinate: string; // e.g. 31923:<hostPubkey>:<identifier>
  status: RSVPStatus;
  freeBusy?: FreeBusyStatus;
  relayHint?: string;
  hostPubkey?: string;
  content?: string;
  identifier?: string;
}): EventTemplate {
  if (!params.eventCoordinate.trim()) {
    throw new Error('RSVP must have a target eventCoordinate (a-tag)');
  }

  const identifier = params.identifier || params.eventCoordinate;
  const freeBusy = params.freeBusy || (params.status === 'accepted' ? 'busy' : 'free');

  const tags: string[][] = [
    ['d', identifier],
    ['a', params.eventCoordinate, ...(params.relayHint ? [params.relayHint] : [])],
    ['status', params.status],
    ['fb', freeBusy],
  ];

  if (params.hostPubkey) {
    tags.push(['p', params.hostPubkey, ...(params.relayHint ? [params.relayHint] : [])]);
  }

  return {
    kind: 31925,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.content || '',
  };
}

/**
 * Parses a Kind 31925 Calendar Event RSVP.
 */
export function parseCalendarRSVP(event: Event): CalendarRSVP {
  if (event.kind !== 31925) {
    throw new Error(`Expected kind 31925 event, got kind ${event.kind}`);
  }

  let identifier = '';
  let eventCoordinate = '';
  let relayHint: string | undefined;
  let hostPubkey: string | undefined;
  let status: RSVPStatus = 'accepted';
  let freeBusy: FreeBusyStatus = 'busy';

  for (const tag of event.tags) {
    const [tagName, val1, val2] = tag;
    switch (tagName) {
      case 'd':
        identifier = val1 || '';
        break;
      case 'a':
        eventCoordinate = val1 || '';
        if (val2) relayHint = val2;
        break;
      case 'p':
        hostPubkey = val1;
        break;
      case 'status':
        if (val1 === 'accepted' || val1 === 'declined' || val1 === 'tentative') {
          status = val1;
        }
        break;
      case 'fb':
        if (val1 === 'busy' || val1 === 'free') {
          freeBusy = val1;
        }
        break;
    }
  }

  if (!eventCoordinate) {
    throw new Error('RSVP event missing target eventCoordinate (a-tag)');
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    identifier: identifier || eventCoordinate,
    eventCoordinate,
    relayHint,
    hostPubkey,
    status,
    freeBusy,
    content: event.content,
  };
}

/**
 * Creates an unsigned Kind 5 Deletion Event template (NIP-09).
 */
export function createDeletionEventTemplate(params: {
  eventId?: string;
  coordinate?: string;
  kind?: number;
  reason?: string;
}): EventTemplate {
  if (!params.eventId && !params.coordinate) {
    throw new Error('Deletion event must specify either an eventId or coordinate (a-tag)');
  }

  const tags: string[][] = [];

  if (params.eventId) {
    tags.push(['e', params.eventId]);
  }
  if (params.coordinate) {
    tags.push(['a', params.coordinate]);
  }
  if (params.kind !== undefined) {
    tags.push(['k', params.kind.toString()]);
  }

  return {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: params.reason || 'Canceled by host',
  };
}

