import { describe, it, expect } from 'vitest';
import {
  generateICS,
  formatUtcDateTime,
  escapeICSText,
  foldLine,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateOffice365CalendarUrl,
  generateYahooCalendarUrl,
  generateAppleCalendarDataUri,
} from '../src/client/lib/calendar/ics';

describe('Calendar Engine: ics.ts', () => {
  const sampleEvent = {
    uid: 'test-meeting-123@cal.emre.xyz',
    title: 'Nostr Strategy & Architecture Call',
    description: 'Discussion on NIP-52 calendar protocol implementation.\nJoin link: https://meet.jit.si/nostr-cal',
    location: 'https://meet.jit.si/nostr-cal',
    start: 1788343200, // 2026-09-02 10:00:00 UTC
    end: 1788345000,   // 2026-09-02 10:30:00 UTC
    url: 'https://cal.emre.xyz/z@emre.xyz',
    organizer: {
      name: 'Emre Yilmaz',
      email: 'z@emre.xyz',
    },
    attendee: {
      name: 'Satoshi Nakamoto',
      email: 'satoshi@gmx.com',
    },
    alarmMinutesBefore: 15,
  };

  describe('formatUtcDateTime & Text Escaping', () => {
    it('formats timestamp into UTC iCalendar format (YYYYMMDDTHHMMSSZ)', () => {
      expect(formatUtcDateTime(1788343200)).toBe('20260902T100000Z');
      expect(formatUtcDateTime(1788345000)).toBe('20260902T103000Z');
    });

    it('escapes special RFC 5545 characters', () => {
      const text = 'Hello, World; Testing \\ and \n new line';
      const escaped = escapeICSText(text);
      expect(escaped).toBe('Hello\\, World\\; Testing \\\\ and \\n new line');
    });

    it('folds lines longer than 75 octets with CRLF and leading space', () => {
      const longLine = 'DESCRIPTION:' + 'A'.repeat(100);
      const folded = foldLine(longLine);
      const parts = folded.split('\r\n');
      expect(parts.length).toBeGreaterThan(1);
      expect(parts[1].startsWith(' ')).toBe(true);
      expect(new TextEncoder().encode(parts[0]).length).toBeLessThanOrEqual(75);
    });
  });

  describe('generateICS', () => {
    it('generates valid RFC 5545 VCALENDAR and VEVENT string with correct line folding', () => {
      const ics = generateICS(sampleEvent);

      expect(ics).toContain('BEGIN:VCALENDAR\r\n');
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('PRODID:-//cal.emre.xyz//NIP-52 Calendar//EN\r\n');
      expect(ics).toContain('BEGIN:VEVENT\r\n');
      expect(ics).toContain('UID:test-meeting-123@cal.emre.xyz\r\n');
      expect(ics).toContain('DTSTART:20260902T100000Z\r\n');
      expect(ics).toContain('DTEND:20260902T103000Z\r\n');
      expect(ics).toContain('SUMMARY:Nostr Strategy & Architecture Call\r\n');
      expect(ics).toContain('LOCATION:https://meet.jit.si/nostr-cal\r\n');
      expect(ics).toContain('ORGANIZER;CN=Emre Yilmaz:mailto:z@emre.xyz\r\n');
      // Verify folded attendee line
      expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Satoshi Nakamoto:mailto:\r\n satoshi@gmx.com\r\n');
      expect(ics).toContain('BEGIN:VALARM\r\n');
      expect(ics).toContain('TRIGGER:-PT15M\r\n');
      expect(ics).toContain('ACTION:DISPLAY\r\n');
      expect(ics).toContain('END:VALARM\r\n');
      expect(ics).toContain('END:VEVENT\r\n');
      expect(ics).toContain('END:VCALENDAR\r\n');
    });

    it('throws error when end time is before start time or invalid', () => {
      expect(() =>
        generateICS({
          title: 'Invalid',
          start: 2000,
          end: 1000,
        })
      ).toThrow('End time (1000) must be after start time (2000)');

      expect(() =>
        generateICS({
          title: 'Invalid',
          start: 0,
          end: 1000,
        })
      ).toThrow('Invalid start timestamp');
    });
  });

  describe('Calendar Web Links', () => {
    it('generates accurate Google Calendar link', () => {
      const url = generateGoogleCalendarUrl({
        title: 'Meeting with Emre',
        start: 1788343200,
        end: 1788345000,
        description: 'Test details',
        location: 'Remote',
      });

      expect(url).toContain('https://calendar.google.com/calendar/render');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('dates=20260902T100000Z%2F20260902T103000Z');
      expect(url).toContain('text=Meeting+with+Emre');
      expect(url).toContain('details=Test+details');
      expect(url).toContain('location=Remote');
    });

    it('generates accurate Outlook Calendar link', () => {
      const url = generateOutlookCalendarUrl({
        title: 'Meeting with Emre',
        start: 1788343200,
        end: 1788345000,
        description: 'Test details',
      });

      expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose');
      expect(url).toContain('subject=Meeting+with+Emre');
      expect(url).toContain('startdt=2026-09-02T10%3A00%3A00.000Z');
    });

    it('generates accurate Office 365 Calendar link', () => {
      const url = generateOffice365CalendarUrl({
        title: 'Meeting with Emre',
        start: 1788343200,
        end: 1788345000,
      });

      expect(url).toContain('https://outlook.office.com/calendar/0/deeplink/compose');
    });

    it('generates accurate Yahoo Calendar link', () => {
      const url = generateYahooCalendarUrl({
        title: 'Meeting with Emre',
        start: 1788343200,
        end: 1788345000,
      });

      expect(url).toContain('https://calendar.yahoo.com');
      expect(url).toContain('title=Meeting+with+Emre');
      expect(url).toContain('st=20260902T100000Z');
    });

    it('generates Apple Calendar Data URI', () => {
      const dataUri = generateAppleCalendarDataUri('BEGIN:VCALENDAR\r\nEND:VCALENDAR');
      expect(dataUri.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
      expect(dataUri).toContain('BEGIN%3AVCALENDAR');
    });
  });
});
