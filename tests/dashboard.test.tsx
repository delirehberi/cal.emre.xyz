import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardPage } from '../src/client/pages/DashboardPage';
import { WorkingHoursForm } from '../src/client/components/dashboard/WorkingHoursForm';
import { BookedEventsList } from '../src/client/components/dashboard/BookedEventsList';
import {
  getHostWorkingHours,
  saveHostWorkingHours,
  type WorkingHoursConfig,
} from '../src/client/lib/calendar/slots';
import {
  createDeletionEventTemplate,
  createCalendarRSVPTemplate,
} from '../src/client/lib/nostr/nip52';
import { I18nProvider } from '../src/client/i18n';
import { ThemeProvider } from '../src/client/context/ThemeContext';
import { AuthProvider } from '../src/client/context/AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  </ThemeProvider>
);

describe('Host Dashboard & Availability Settings Tests (Phase 7)', () => {
  const dummyPubkey = '3bf0c63fcb93463407af97b5e0907d743712d0ec403c3167f56bc1b1433d3b2f';
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    });
  });

  describe('WorkingHours Storage & Config', () => {
    it('returns default working hours when no saved config exists', () => {
      const config = getHostWorkingHours(dummyPubkey);
      expect(config.startHour).toBe(9);
      expect(config.endHour).toBe(17);
      expect(config.workingDays).toEqual([1, 2, 3, 4, 5]);
      expect(config.timezone).toBe('UTC');
    });

    it('saves and retrieves custom working hours from localStorage', () => {
      const customConfig: WorkingHoursConfig = {
        startHour: 10,
        endHour: 18,
        workingDays: [2, 3, 4],
        timezone: 'Europe/Istanbul',
        bufferMinutes: 15,
        defaultDuration: 60,
        location: 'https://meet.jit.si/workouse-sovereign',
      };

      saveHostWorkingHours(dummyPubkey, customConfig);
      const loaded = getHostWorkingHours(dummyPubkey);

      expect(loaded.startHour).toBe(10);
      expect(loaded.endHour).toBe(18);
      expect(loaded.workingDays).toEqual([2, 3, 4]);
      expect(loaded.timezone).toBe('Europe/Istanbul');
      expect(loaded.bufferMinutes).toBe(15);
      expect(loaded.defaultDuration).toBe(60);
      expect(loaded.location).toBe('https://meet.jit.si/workouse-sovereign');
    });
  });

  describe('WorkingHoursForm Component Rendering', () => {
    it('renders WorkingHoursForm with all fields and options', () => {
      const html = renderToString(
        wrapper({
          children: <WorkingHoursForm pubkey={dummyPubkey} />,
        })
      );

      expect(html).toContain('Working Hours Configuration');
      expect(html).toContain('Working Days');
      expect(html).toContain('Start Hour (0-23)');
      expect(html).toContain('End Hour (0-23)');
      expect(html).toContain('Default Duration (Minutes)');
      expect(html).toContain('Host Timezone');
      expect(html).toContain('Buffer Between Meetings');
      expect(html).toContain('Meeting Location / Video Call Link');
      expect(html).toContain('Save Availability Settings');
    });
  });

  describe('BookedEventsList Component Rendering', () => {
    it('renders BookedEventsList with tab headers and refresh button', () => {
      const html = renderToString(
        wrapper({
          children: (
            <BookedEventsList
              pubkey={dummyPubkey}
              signer={null}
              hostTimezone="Europe/Istanbul"
            />
          )
        })
      );

      expect(html).toContain('Upcoming Appointments');
      expect(html).toContain('Past Appointments');
      expect(html).toContain('Refresh');
    });
  });

  describe('DashboardPage Component Rendering', () => {
    it('renders unauthenticated login prompt when user is not logged in', () => {
      const html = renderToString(
        wrapper({
          children: <DashboardPage />,
        })
      );

      expect(html).toContain('Host Authentication Required');
      expect(html).toContain('Connect with Nostr');
    });
  });

  describe('NIP-09 Event Deletion and RSVP Helpers for Dashboard', () => {
    it('creates a valid Kind 5 Deletion event template', () => {
      const template = createDeletionEventTemplate({
        eventId: 'fa301bcde123',
        coordinate: `31923:${dummyPubkey}:meeting-123`,
        kind: 31923,
        reason: 'Host had an emergency conflict',
      });

      expect(template.kind).toBe(5);
      expect(template.content).toBe('Host had an emergency conflict');
      expect(template.tags).toContainEqual(['e', 'fa301bcde123']);
      expect(template.tags).toContainEqual(['a', `31923:${dummyPubkey}:meeting-123`]);
      expect(template.tags).toContainEqual(['k', '31923']);
    });

    it('creates a valid Kind 31925 RSVP acceptance template', () => {
      const template = createCalendarRSVPTemplate({
        eventCoordinate: `31923:${dummyPubkey}:meeting-123`,
        status: 'accepted',
        freeBusy: 'busy',
        hostPubkey: dummyPubkey,
      });

      expect(template.kind).toBe(31925);
      expect(template.tags).toContainEqual(['a', `31923:${dummyPubkey}:meeting-123`]);
      expect(template.tags).toContainEqual(['status', 'accepted']);
      expect(template.tags).toContainEqual(['fb', 'busy']);
      expect(template.tags).toContainEqual(['p', dummyPubkey]);
    });

    it('creates a valid Kind 31925 RSVP decline template', () => {
      const template = createCalendarRSVPTemplate({
        eventCoordinate: `31923:${dummyPubkey}:meeting-123`,
        status: 'declined',
        freeBusy: 'free',
        hostPubkey: dummyPubkey,
      });

      expect(template.kind).toBe(31925);
      expect(template.tags).toContainEqual(['status', 'declined']);
      expect(template.tags).toContainEqual(['fb', 'free']);
    });
  });
});
