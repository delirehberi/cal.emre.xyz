import { SimplePool, type Event, type Filter } from 'nostr-tools';
import { APP_CONFIG } from '../../../config';
import { parseRelayList, parseContactRelays, filterHealthyRelays, buildCacheRelayUrl, type RelayList } from './nip65';
import {
  parseTimeCalendarEvent,
  parseDateCalendarEvent,
  parseCalendarRSVP,
  type TimeCalendarEvent,
  type DateCalendarEvent,
  type CalendarRSVP,
} from './nip52';

import { hostDataCache } from './cache';
import { AVAILABILITY_IDENTIFIER, AVAILABILITY_KIND, parseAvailabilityEvent } from './availability';
import type { WorkingHoursConfig } from '../calendar/slots';

export interface HostProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
}

export interface PublishResult {
  relay: string;
  success: boolean;
  error?: string;
}

export interface HostAppointment {
  event: TimeCalendarEvent;
  rsvps: CalendarRSVP[];
  hostRsvp?: CalendarRSVP;
  isDeleted: boolean;
  effectiveStatus: 'accepted' | 'tentative' | 'declined' | 'canceled';
  hostPubkey: string;
  guestPubkey?: string;
  isHost: boolean;
}

class RelayPoolManager {
  private pool: SimplePool;

  constructor() {
    this.pool = new SimplePool();
  }

  getPool(): SimplePool {
    return this.pool;
  }

  /**
   * Returns a merged list of bootstrap relays and custom relays.
   */
  getBootstrapRelays(customRelays?: string[]): string[] {
    const combined = [...(customRelays || []), ...APP_CONFIG.defaultRelays];
    return filterHealthyRelays(combined);
  }

  /**
   * Returns read-only query relays.
   * If a cache relay is configured, bundles upstream bootstrap relays into a single cache relay query URL.
   * Otherwise falls back to direct bootstrap relays.
   */
  getReadRelays(customRelays?: string[]): string[] {
    const upstreams = this.getBootstrapRelays(customRelays);
    if (APP_CONFIG.cacheRelayUrl) {
      const cacheUrl = buildCacheRelayUrl(upstreams, APP_CONFIG.cacheRelayUrl);
      if (cacheUrl) {
        return [cacheUrl];
      }
    }
    return upstreams;
  }

  /**
   * Fetches Kind 0 user metadata profile with persistent caching.
   */
  async fetchHostProfile(
    pubkey: string,
    relays?: string[],
    forceRefresh = false
  ): Promise<HostProfile | null> {
    if (!forceRefresh) {
      const cached = hostDataCache.getCachedProfile(pubkey);
      if (cached) {
        return cached;
      }
    }

    const queryRelays = this.getReadRelays(relays);
    const filter: Filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1,
    };

    try {
      const event = await this.pool.get(queryRelays, filter);
      if (!event) {
        return hostDataCache.getCachedProfile(pubkey, true);
      }

      const data = JSON.parse(event.content) as Record<string, unknown>;
      const profile: HostProfile = {
        pubkey,
        name: typeof data.name === 'string' ? data.name : undefined,
        displayName: typeof data.display_name === 'string' ? data.display_name : (typeof data.name === 'string' ? data.name : undefined),
        about: typeof data.about === 'string' ? data.about : undefined,
        picture: typeof data.picture === 'string' ? data.picture : undefined,
        banner: typeof data.banner === 'string' ? data.banner : undefined,
        nip05: typeof data.nip05 === 'string' ? data.nip05 : undefined,
        lud16: typeof data.lud16 === 'string' ? data.lud16 : undefined,
        website: typeof data.website === 'string' ? data.website : undefined,
      };

      hostDataCache.setCachedProfile(pubkey, profile);
      return profile;
    } catch {
      return hostDataCache.getCachedProfile(pubkey, true);
    }
  }

  /**
   * Fetches Kind 10002 or Kind 3 relay list for a public key with persistent caching.
   */
  async fetchHostRelays(
    pubkey: string,
    bootstrapRelays?: string[],
    forceRefresh = false
  ): Promise<RelayList> {
    if (!forceRefresh) {
      const cached = hostDataCache.getCachedRelays(pubkey);
      if (cached) {
        return cached;
      }
    }

    const queryRelays = this.getReadRelays(bootstrapRelays);

    try {
      // Try Kind 10002 first
      const kind10002 = await this.pool.get(queryRelays, {
        kinds: [10002],
        authors: [pubkey],
        limit: 1,
      });

      if (kind10002) {
        const parsed = parseRelayList(kind10002);
        if (parsed.all.length > 0) {
          hostDataCache.setCachedRelays(pubkey, parsed);
          return parsed;
        }
      }

      // Fallback to Kind 3
      const kind3 = await this.pool.get(queryRelays, {
        kinds: [3],
        authors: [pubkey],
        limit: 1,
      });

      if (kind3) {
        const parsed = parseContactRelays(kind3);
        if (parsed.all.length > 0) {
          hostDataCache.setCachedRelays(pubkey, parsed);
          return parsed;
        }
      }
    } catch {
      // Query failure, fallback
    }

    const staleOrFallback = hostDataCache.getCachedRelays(pubkey, true);
    if (staleOrFallback) {
      return staleOrFallback;
    }

    // Default fallback
    const fallback: RelayList = {
      read: [...APP_CONFIG.defaultRelays],
      write: [...APP_CONFIG.defaultRelays],
      all: [...APP_CONFIG.defaultRelays],
    };
    return fallback;
  }

  /**
   * Fetches time-based (31923) and date-based (31922) calendar events for a host.
   */
  async fetchCalendarEvents(
    pubkey: string,
    options?: { since?: number; until?: number; relays?: string[] }
  ): Promise<{ timeEvents: TimeCalendarEvent[]; dateEvents: DateCalendarEvent[] }> {
    const queryRelays = this.getReadRelays(options?.relays);

    const filter: Filter = {
      kinds: [31923, 31922],
      authors: [pubkey],
      limit: 100,
    };

    if (options?.since) filter.since = options.since;
    if (options?.until) filter.until = options.until;

    const events = await this.pool.querySync(queryRelays, filter);

    const timeEvents: TimeCalendarEvent[] = [];
    const dateEvents: DateCalendarEvent[] = [];

    for (const ev of events) {
      try {
        if (ev.kind === 31923) {
          timeEvents.push(parseTimeCalendarEvent(ev));
        } else if (ev.kind === 31922) {
          dateEvents.push(parseDateCalendarEvent(ev));
        }
      } catch {
        // Skip malformed individual events
      }
    }

    return { timeEvents, dateEvents };
  }

  /**
   * Fetches Kind 31925 RSVPs referencing given event coordinates ('a' tags).
   */
  async fetchCalendarRSVPs(
    eventCoordinates: string[],
    relays?: string[]
  ): Promise<CalendarRSVP[]> {
    if (eventCoordinates.length === 0) return [];

    const queryRelays = this.getReadRelays(relays);

    const filter: Filter = {
      kinds: [31925],
      '#a': eventCoordinates,
      limit: 200,
    };

    const events = await this.pool.querySync(queryRelays, filter);
    const rsvps: CalendarRSVP[] = [];

    for (const ev of events) {
      try {
        rsvps.push(parseCalendarRSVP(ev));
      } catch {
        // Skip malformed RSVPs
      }
    }

    return rsvps;
  }

  /**
   * Fetches all calendar appointments for a host (both authored and attendee events),
   * including RSVPs and deletion status.
   */
  async fetchHostAppointments(
    pubkey: string,
    options?: { relays?: string[] }
  ): Promise<HostAppointment[]> {
    const queryRelays = this.getReadRelays(options?.relays);

    // 1. Fetch time calendar events authored by host or with host in p-tag
    const [authoredEvents, taggedEvents] = await Promise.all([
      this.pool.querySync(queryRelays, {
        kinds: [31923],
        authors: [pubkey],
        limit: 150,
      }),
      this.pool.querySync(queryRelays, {
        kinds: [31923],
        '#p': [pubkey],
        limit: 150,
      }),
    ]);

    const seenIds = new Set<string>();
    const allRawEvents = [...authoredEvents, ...taggedEvents].filter((ev) => {
      if (seenIds.has(ev.id)) return false;
      seenIds.add(ev.id);
      return true;
    });

    const parsedEvents: TimeCalendarEvent[] = [];
    for (const raw of allRawEvents) {
      try {
        parsedEvents.push(parseTimeCalendarEvent(raw));
      } catch {
        // Skip malformed events
      }
    }

    if (parsedEvents.length === 0) {
      return [];
    }

    const coordinates = parsedEvents.map((e) => e.coordinate);

    // 2. Fetch RSVPs and Deletion Events (Kind 5) in parallel
    const [rsvpsRaw, deletions] = await Promise.all([
      this.fetchCalendarRSVPs(coordinates, options?.relays),
      this.pool.querySync(queryRelays, {
        kinds: [5],
        authors: [pubkey],
        limit: 100,
      }),
    ]);

    const deletedCoordinates = new Set<string>();
    const deletedIds = new Set<string>();

    for (const del of deletions) {
      for (const tag of del.tags) {
        if (tag[0] === 'a' && tag[1]) {
          deletedCoordinates.add(tag[1]);
        }
        if (tag[0] === 'e' && tag[1]) {
          deletedIds.add(tag[1]);
        }
      }
    }

    // 3. Map events into HostAppointment records
    const appointments: HostAppointment[] = parsedEvents.map((event) => {
      const eventRsvps = rsvpsRaw.filter((r) => r.eventCoordinate === event.coordinate);
      // Sort RSVPs descending by created_at to get latest
      eventRsvps.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      const hostAttendee = event.attendees.find((a) => a.role === 'host');
      const guestAttendee = event.attendees.find((a) => a.role === 'attendee');

      // The true host of the scheduled appointment
      const hostPubkey = hostAttendee?.pubkey || (event.pubkey ? event.pubkey : pubkey);
      const guestPubkey = guestAttendee?.pubkey || (event.pubkey !== hostPubkey ? event.pubkey : event.attendees.find((a) => a.pubkey !== hostPubkey)?.pubkey);
      const isHost = pubkey.toLowerCase() === hostPubkey.toLowerCase();

      // Find the RSVP signed by the actual Host
      const hostRsvp = eventRsvps.find((r) => r.pubkey && r.pubkey.toLowerCase() === hostPubkey.toLowerCase());
      const isDeleted = (event.id && deletedIds.has(event.id)) || deletedCoordinates.has(event.coordinate) || false;

      let effectiveStatus: HostAppointment['effectiveStatus'] = 'tentative';
      if (isDeleted) {
        effectiveStatus = 'canceled';
      } else if (hostRsvp) {
        effectiveStatus = hostRsvp.status;
      } else if (event.pubkey && event.pubkey.toLowerCase() === hostPubkey.toLowerCase()) {
        // If the Host authored the event directly, it is considered accepted by the host
        effectiveStatus = 'accepted';
      } else {
        // If a guest created the reservation and host hasn't RSVP'd yet, it is pending/tentative
        effectiveStatus = 'tentative';
      }

      return {
        event,
        rsvps: eventRsvps,
        hostRsvp,
        isDeleted,
        effectiveStatus,
        hostPubkey,
        guestPubkey,
        isHost,
      };
    });

    // Sort by event start ascending
    return appointments.sort((a, b) => a.event.start - b.event.start);
  }


  /**
   * Fetches the host's published availability (NIP-78, kind 30078). Newest valid event wins.
   */
  async fetchHostAvailability(
    pubkey: string,
    relays?: string[]
  ): Promise<WorkingHoursConfig | null> {
    const queryRelays = this.getBootstrapRelays(relays);
    try {
      const events = await this.pool.querySync(queryRelays, {
        kinds: [AVAILABILITY_KIND],
        authors: [pubkey],
        '#d': [AVAILABILITY_IDENTIFIER],
        limit: 5,
      });
      const newestFirst = [...events].sort((a, b) => b.created_at - a.created_at);
      for (const event of newestFirst) {
        const parsed = parseAvailabilityEvent(event);
        if (parsed) return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Publishes a signed Nostr event to multiple relays in parallel.
   */
  async publishEvent(
    targetRelays: string[],
    signedEvent: Event,
    timeoutMs = 6000
  ): Promise<PublishResult[]> {
    const relays = filterHealthyRelays(targetRelays);
    if (relays.length === 0) {
      throw new Error('No valid relays provided for publishing.');
    }

    const publishPromises = relays.map(async (relay): Promise<PublishResult> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Publish timeout')), timeoutMs);
        });

        await Promise.race([
          Promise.all(this.pool.publish([relay], signedEvent)),
          timeoutPromise,
        ]);

        return { relay, success: true };
      } catch (err) {
        return {
          relay,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    });

    return await Promise.all(publishPromises);
  }

  /**
   * Closes all active connections.
   */
  close(): void {
    const relaysToClose = new Set<string>(APP_CONFIG.defaultRelays);
    if (APP_CONFIG.cacheRelayUrl) {
      const cacheUrl = buildCacheRelayUrl(Array.from(APP_CONFIG.defaultRelays), APP_CONFIG.cacheRelayUrl);
      if (cacheUrl) {
        relaysToClose.add(cacheUrl);
      }
    }
    this.pool.close(Array.from(relaysToClose));
  }
}

export const nostrPool = new RelayPoolManager();
