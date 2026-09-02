import { describe, it, expect } from 'vitest';
import type { Event } from 'nostr-tools';
import {
  createTimeCalendarEventTemplate,
  parseTimeCalendarEvent,
  createDateCalendarEventTemplate,
  parseDateCalendarEvent,
  createCalendarRSVPTemplate,
  parseCalendarRSVP,
} from '../src/client/lib/nostr/nip52';

describe('nip52.ts: NIP-52 Calendar Events Operations', () => {
  const mockPubkey = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';

  describe('Kind 31923: Time-Based Calendar Event', () => {
    it('creates a valid Kind 31923 event template', () => {
      const template = createTimeCalendarEventTemplate({
        identifier: 'strategy-session-30m',
        title: '30m Strategy Session',
        start: 1725285600,
        end: 1725287400,
        startTzid: 'America/New_York',
        endTzid: 'America/New_York',
        summary: 'Introductory discussion regarding Nostr infrastructure.',
        description: 'Detailed agenda notes and setup.',
        location: 'https://meet.jit.si/nostr-cal-call',
        hashtags: ['consulting', 'nostr'],
        attendees: [
          { pubkey: mockPubkey, role: 'host' },
          { pubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', role: 'attendee' },
        ],
      });

      expect(template.kind).toBe(31923);
      expect(template.tags).toContainEqual(['d', 'strategy-session-30m']);
      expect(template.tags).toContainEqual(['title', '30m Strategy Session']);
      expect(template.tags).toContainEqual(['start', '1725285600']);
      expect(template.tags).toContainEqual(['end', '1725287400']);
      expect(template.tags).toContainEqual(['start_tzid', 'America/New_York']);
      expect(template.tags).toContainEqual(['location', 'https://meet.jit.si/nostr-cal-call']);
      expect(template.tags).toContainEqual(['t', 'consulting']);
    });

    it('parses a Kind 31923 event accurately', () => {
      const mockEvent: Event = {
        id: 'event-id-123',
        pubkey: mockPubkey,
        created_at: 1725280000,
        kind: 31923,
        tags: [
          ['d', 'intro-call'],
          ['title', 'Intro Call'],
          ['start', '1725285600'],
          ['end', '1725287400'],
          ['start_tzid', 'UTC'],
          ['summary', 'Quick intro'],
          ['location', 'https://meet.jit.si/test'],
          ['p', '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', '', 'attendee'],
        ],
        content: 'Agenda details',
        sig: 'sig-123',
      };

      const parsed = parseTimeCalendarEvent(mockEvent);
      expect(parsed.identifier).toBe('intro-call');
      expect(parsed.title).toBe('Intro Call');
      expect(parsed.start).toBe(1725285600);
      expect(parsed.end).toBe(1725287400);
      expect(parsed.startTzid).toBe('UTC');
      expect(parsed.location).toBe('https://meet.jit.si/test');
      expect(parsed.coordinate).toBe(`31923:${mockPubkey}:intro-call`);
      expect(parsed.attendees).toHaveLength(1);
      expect(parsed.attendees[0].role).toBe('attendee');
    });
  });

  describe('Kind 31922: Date-Based Calendar Event', () => {
    it('creates and parses a Kind 31922 all-day event template', () => {
      const template = createDateCalendarEventTemplate({
        identifier: 'bitcoin-conference-2026',
        title: 'Bitcoin Conference 2026',
        start: '2026-09-15',
        end: '2026-09-17',
        location: 'Istanbul, TR',
        summary: 'Annual Bitcoin conference',
      });

      expect(template.kind).toBe(31922);
      expect(template.tags).toContainEqual(['d', 'bitcoin-conference-2026']);
      expect(template.tags).toContainEqual(['start', '2026-09-15']);
      expect(template.tags).toContainEqual(['end', '2026-09-17']);

      const mockEvent: Event = {
        id: 'date-event-id',
        pubkey: mockPubkey,
        created_at: 1725280000,
        kind: 31922,
        tags: template.tags,
        content: template.content,
        sig: 'sig-abc',
      };

      const parsed = parseDateCalendarEvent(mockEvent);
      expect(parsed.identifier).toBe('bitcoin-conference-2026');
      expect(parsed.start).toBe('2026-09-15');
      expect(parsed.end).toBe('2026-09-17');
      expect(parsed.coordinate).toBe(`31922:${mockPubkey}:bitcoin-conference-2026`);
    });
  });

  describe('Kind 31925: Calendar Event RSVP', () => {
    it('creates an RSVP with busy status for accepted appointment', () => {
      const coordinate = `31923:${mockPubkey}:intro-call`;
      const template = createCalendarRSVPTemplate({
        eventCoordinate: coordinate,
        status: 'accepted',
        freeBusy: 'busy',
        hostPubkey: mockPubkey,
        content: 'Looking forward to meeting!',
      });

      expect(template.kind).toBe(31925);
      expect(template.tags).toContainEqual(['a', coordinate]);
      expect(template.tags).toContainEqual(['status', 'accepted']);
      expect(template.tags).toContainEqual(['fb', 'busy']);
      expect(template.tags).toContainEqual(['p', mockPubkey]);
    });

    it('parses an RSVP event accurately', () => {
      const coordinate = `31923:${mockPubkey}:intro-call`;
      const mockEvent: Event = {
        id: 'rsvp-1',
        pubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        created_at: 1725281000,
        kind: 31925,
        tags: [
          ['d', coordinate],
          ['a', coordinate, 'wss://relay.damus.io'],
          ['status', 'accepted'],
          ['fb', 'busy'],
          ['p', mockPubkey],
        ],
        content: 'Confirmed attendance',
        sig: 'sig-xyz',
      };

      const parsed = parseCalendarRSVP(mockEvent);
      expect(parsed.eventCoordinate).toBe(coordinate);
      expect(parsed.status).toBe('accepted');
      expect(parsed.freeBusy).toBe('busy');
      expect(parsed.relayHint).toBe('wss://relay.damus.io');
      expect(parsed.hostPubkey).toBe(mockPubkey);
    });
  });
});
