import { describe, it, expect } from 'vitest';
import { computeAppointmentStats, groupAppointments } from '../src/client/lib/dashboard/stats';
import type { HostAppointment } from '../src/client/lib/nostr/relays';

const HOUR = 3600;
const DAY = 24 * HOUR;
// 2030-03-15 12:00 UTC
const NOW = Date.UTC(2030, 2, 15, 12) / 1000;

const appointment = (
  id: string,
  start: number,
  overrides: Partial<HostAppointment> = {}
): HostAppointment => ({
  event: {
    identifier: id,
    title: id,
    start,
    end: start + HOUR,
    hashtags: [],
    attendees: [],
    content: '',
    coordinate: `31923:pk:${id}`,
  },
  rsvps: [],
  isDeleted: false,
  effectiveStatus: 'accepted',
  hostPubkey: 'pk',
  isHost: true,
  ...overrides,
});

describe('appointment stats', () => {
  const list = [
    appointment('soon', NOW + 2 * DAY),
    appointment('pending', NOW + 3 * DAY, { effectiveStatus: 'tentative' }),
    appointment('later', NOW + 10 * DAY),
    appointment('earlier-this-month', NOW - 5 * DAY),
    appointment('last-month', Date.UTC(2030, 1, 10) / 1000),
    appointment('cancelled', NOW + DAY, { isDeleted: true, effectiveStatus: 'canceled' }),
    appointment('declined', NOW + DAY, { effectiveStatus: 'declined' }),
  ];

  it('counts upcoming, this week, pending and month figures', () => {
    expect(computeAppointmentStats(list, NOW, 'UTC')).toEqual({
      upcoming: 3,
      upcomingThisWeek: 2,
      pending: 1,
      thisMonth: 4,
      monthDelta: 3,
    });
  });

  it('uses the host time zone for month boundaries', () => {
    // 2030-03-31 22:00 UTC is already April 1st in Istanbul (UTC+3)
    const edge = [appointment('edge', Date.UTC(2030, 2, 31, 22) / 1000)];
    expect(computeAppointmentStats(edge, NOW, 'UTC').thisMonth).toBe(1);
    expect(computeAppointmentStats(edge, NOW, 'Europe/Istanbul').thisMonth).toBe(0);
  });

  it('groups upcoming ascending and past (including cancelled) newest first', () => {
    const { upcoming, past } = groupAppointments(list, NOW);
    expect(upcoming.map((a) => a.event.identifier)).toEqual(['soon', 'pending', 'later']);
    expect(past.map((a) => a.event.identifier)).toEqual(['cancelled', 'declined', 'earlier-this-month', 'last-month']);
  });
});
