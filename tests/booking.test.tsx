// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { I18nProvider } from '../src/client/i18n';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import { decryptBookingDetails } from '../src/client/lib/nostr/encryption';
import { encodeNpub } from '../src/client/lib/nostr/keys';
import type { TimeSlot, DayAvailabilitySummary } from '../src/client/lib/calendar/slots';

const auth = vi.hoisted(() => ({
  user: null as { pubkey: string } | null,
  signer: null as unknown,
  isLoggedIn: false,
  loginAsGuest: vi.fn(),
}));

const relays = vi.hoisted(() => ({
  publishEvent: vi.fn(),
  fetchHostRelays: vi.fn(),
  fetchHostProfile: vi.fn(),
  fetchCalendarEvents: vi.fn(),
  fetchCalendarRSVPs: vi.fn(),
  queryNip05Pubkey: vi.fn(),
}));

vi.mock('../src/client/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../src/client/lib/nostr/relays', () => ({
  nostrPool: {
    publishEvent: relays.publishEvent,
    fetchHostRelays: relays.fetchHostRelays,
    fetchHostProfile: relays.fetchHostProfile,
    fetchCalendarEvents: relays.fetchCalendarEvents,
    fetchCalendarRSVPs: relays.fetchCalendarRSVPs,
  },
}));
vi.mock('../src/client/lib/nostr/keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/client/lib/nostr/keys')>()),
  queryNip05Pubkey: relays.queryNip05Pubkey,
}));

import { DatePicker, getCalendarTarget } from '../src/client/components/booking/DatePicker';
import { TimeSlotGrid } from '../src/client/components/booking/TimeSlotGrid';
import { DurationPicker } from '../src/client/components/booking/DurationPicker';
import { BookingForm, type BookingResult } from '../src/client/components/booking/BookingForm';
import { BookingPage } from '../src/client/pages/BookingPage';

const withI18n = (ui: React.ReactElement) => <I18nProvider>{ui}</I18nProvider>;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('calendar keyboard targets', () => {
  it('maps arrow keys to date shifts', () => {
    expect(getCalendarTarget('2099-03-10', 'ArrowLeft')).toBe('2099-03-09');
    expect(getCalendarTarget('2099-03-10', 'ArrowRight')).toBe('2099-03-11');
    expect(getCalendarTarget('2099-03-10', 'ArrowUp')).toBe('2099-03-03');
    expect(getCalendarTarget('2099-03-10', 'ArrowDown')).toBe('2099-03-17');
    expect(getCalendarTarget('2099-03-10', 'Enter')).toBeNull();
  });
});

describe('DatePicker', () => {
  // March 2099 starts on a Sunday: six blank cells before the 1st in a Monday-first grid.
  const open = ['2099-03-02', '2099-03-03', '2099-03-04', '2099-03-31'];
  const summaries: DayAvailabilitySummary[] = Array.from({ length: 31 }, (_, index) => {
    const date = `2099-03-${String(index + 1).padStart(2, '0')}`;
    return { date, day: index + 1, hasAvailableSlots: open.includes(date), availableSlotCount: open.includes(date) ? 4 : 0 };
  });

  const Harness: React.FC<{ onSelect?: (key: string) => void; onMonth?: (y: number, m: number) => void }> = ({ onSelect, onMonth }) => {
    const [month, setMonth] = useState({ year: 2099, month: 3 });
    const [selected, setSelected] = useState('2099-03-03');
    return (
      <DatePicker
        selectedDate={selected}
        onSelectDate={(key) => {
          setSelected(key);
          onSelect?.(key);
        }}
        availabilitySummaries={month.month === 3 ? summaries : []}
        currentYear={month.year}
        currentMonth={month.month}
        onMonthChange={(year, m) => {
          setMonth({ year, month: m });
          onMonth?.(year, m);
        }}
      />
    );
  };

  const day = (n: number) => screen.getAllByRole('button').find((b) => b.textContent === String(n) && b.getAttribute('aria-label')?.includes(','))!;

  it('shows the month, a green dot only on open days and one tab stop', () => {
    render(withI18n(<Harness />));
    expect(screen.getByRole('heading', { name: 'March 2099' })).toBeTruthy();
    const days = screen.getAllByRole('button').filter((b) => /open time/.test(b.getAttribute('aria-label') ?? ''));
    expect(days).toHaveLength(31);

    const free = days.filter((b) => b.getAttribute('aria-label')!.endsWith('open time available'));
    expect(free).toHaveLength(4);
    expect(free.every((b) => b.querySelector('span.bg-slot'))).toBe(true);
    const unavailable = days.filter((b) => b.getAttribute('aria-label')!.endsWith('no open time'));
    expect(unavailable.every((b) => b.getAttribute('aria-disabled') === 'true' && !b.querySelector('span.bg-slot'))).toBe(true);

    expect(days.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(day(3).tabIndex).toBe(0);
    expect(day(3).getAttribute('aria-pressed')).toBe('true');
    expect(day(3).getAttribute('aria-label')).toBe('Tuesday, March 3, open time available');
  });

  it('selects an open day and ignores a day without open time', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(withI18n(<Harness onSelect={onSelect} />));
    await user.click(day(4));
    expect(onSelect).toHaveBeenCalledWith('2099-03-04');
    await user.click(day(10));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('moves focus with the arrow keys and across months', async () => {
    const user = userEvent.setup();
    const onMonth = vi.fn();
    render(withI18n(<Harness onMonth={onMonth} />));
    day(3).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(day(4));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(day(11));
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(document.activeElement).toBe(day(3));

    day(31).focus();
    await user.keyboard('{ArrowRight}');
    expect(onMonth).toHaveBeenCalledWith(2099, 4);
    expect(screen.getByRole('heading', { name: 'April 2099' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toContain('April 1'));
  });

  it('changes month with Page keys and the navigation buttons', async () => {
    const user = userEvent.setup();
    render(withI18n(<Harness />));
    day(3).focus();
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('heading', { name: 'April 2099' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'March 2099' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'May 2099' })).toBeTruthy();
  });

  it('uses Monday-first Turkish weekday labels', () => {
    window.localStorage.setItem('cal_locale', 'tr');
    render(withI18n(<Harness />));
    expect(screen.getByText('Pt')).toBeTruthy();
    expect(screen.getByText('Pz')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mart 2099' })).toBeTruthy();
  });
});

describe('DurationPicker', () => {
  it('selects a duration and reveals the longer ones', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      withI18n(<DurationPicker durations={[15, 30, 45, 60]} extendedDurations={[90, 120]} selectedDuration={30} onSelectDuration={onSelect} />)
    );
    const group = screen.getByRole('radiogroup', { name: 'Meeting length' });
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
    expect(within(group).getByRole('radio', { name: '30 min' }).getAttribute('aria-checked')).toBe('true');

    await user.click(within(group).getByRole('radio', { name: '45 min' }));
    expect(onSelect).toHaveBeenCalledWith(45);

    const longer = screen.getByRole('button', { name: 'longer…' });
    expect(longer.getAttribute('aria-expanded')).toBe('false');
    await user.click(longer);
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['15 min', '30 min', '45 min', '60 min', '90 min', '120 min']);
    expect(screen.getByRole('button', { name: 'fewer' }).getAttribute('aria-expanded')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'fewer' }));
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
  });

  it('uses Turkish labels', () => {
    window.localStorage.setItem('cal_locale', 'tr');
    render(withI18n(<DurationPicker durations={[15, 30, 45, 60]} extendedDurations={[90, 120]} selectedDuration={30} onSelectDuration={() => {}} />));
    expect(screen.getByRole('heading', { name: 'Ne kadar süre?' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '30 dk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'daha uzun…' })).toBeTruthy();
  });
});

describe('TimeSlotGrid', () => {
  const slot = (start: number, time: string, available: boolean, reason?: TimeSlot['reason']): TimeSlot => ({
    start,
    end: start + 1800,
    startTimeISO: '',
    endTimeISO: '',
    formattedStartTime: time,
    formattedEndTime: time,
    available,
    reason,
  });
  const slots = [slot(1, '09:00', true), slot(2, '09:30', false, 'booked'), slot(3, '10:00', true), slot(4, '10:30', false, 'past')];

  const renderGrid = (props: Partial<React.ComponentProps<typeof TimeSlotGrid>> = {}) =>
    render(
      withI18n(
        <TimeSlotGrid
          slots={slots}
          selectedSlot={null}
          onSelectSlot={() => {}}
          attendeeTimezone="Europe/Istanbul"
          hostTimezone="UTC"
          onTimezoneChange={() => {}}
          selectedDate="2099-03-03"
          durationMinutes={30}
          {...props}
        />
      )
    );

  it('lists only open times and folds the rest into one line', async () => {
    const user = userEvent.setup();
    renderGrid();
    const group = screen.getByRole('group', { name: 'Open times' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['09:00', '10:00']);
    expect(screen.getByText('2 booked or past')).toBeTruthy();
    expect(screen.queryByText('09:30')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Show' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    const list = screen.getByRole('list', { name: 'Booked or past times' });
    expect(within(list).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['09:30', '10:30']);
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByRole('list', { name: 'Booked or past times' })).toBeNull();
  });

  it('marks the chosen time and reports clicks', async () => {
    const user = userEvent.setup();
    const onSelectSlot = vi.fn();
    renderGrid({ selectedSlot: slots[0], onSelectSlot });
    expect(screen.getByRole('button', { name: '09:00' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '10:00' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: '10:00' }));
    expect(onSelectSlot).toHaveBeenCalledWith(slots[2]);
  });

  it('shows the day line and a time zone select with offsets', async () => {
    const user = userEvent.setup();
    const onTimezoneChange = vi.fn();
    renderGrid({ onTimezoneChange });
    expect(screen.getByText('Tuesday, March 3 · 30 min')).toBeTruthy();
    const select = screen.getByRole('combobox', { name: 'Time zone' });
    expect((select as unknown as { value: string }).value).toBe('Europe/Istanbul');
    expect(within(select).getByRole('option', { name: 'Europe/Istanbul (GMT+3)' })).toBeTruthy();
    await user.selectOptions(select, 'UTC');
    expect(onTimezoneChange).toHaveBeenCalledWith('UTC');
  });

  it('explains an empty day and shows a busy state while loading', () => {
    const { unmount } = renderGrid({ slots: [slot(2, '09:30', false, 'booked')] });
    expect(screen.getByText('There are no open times on this day. Pick another day.')).toBeTruthy();
    unmount();
    renderGrid({ isLoading: true });
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('BookingForm', () => {
  const hostSecret = generateSecretKey();
  const hostPubkey = getPublicKey(hostSecret);
  const hostSigner = new PrivateKeySigner(hostSecret);
  const bookerSecret = generateSecretKey();
  const bookerPubkey = getPublicKey(bookerSecret);
  const inviteeSecret = generateSecretKey();
  const inviteePubkey = getPublicKey(inviteeSecret);
  const inviteeSigner = new PrivateKeySigner(inviteeSecret);

  const slot: TimeSlot = {
    start: 4_102_473_600,
    end: 4_102_475_400,
    startTimeISO: '',
    endTimeISO: '',
    formattedStartTime: '14:30',
    formattedEndTime: '15:00',
    available: true,
  };

  const signIn = () => {
    auth.signer = new PrivateKeySigner(bookerSecret);
    auth.user = { pubkey: bookerPubkey };
    auth.isLoggedIn = true;
  };

  const setup = (overrides: Partial<React.ComponentProps<typeof BookingForm>> = {}) => {
    const onSuccess = vi.fn<(result: BookingResult) => void>();
    const onChangeSlot = vi.fn();
    render(
      withI18n(
        <BookingForm
          hostPubkey={hostPubkey}
          hostProfile={{ pubkey: hostPubkey, displayName: 'Emre' }}
          hostNip05="emre@example.com"
          hostTimezone="UTC"
          hostRelays={['wss://relay.example']}
          selectedSlot={slot}
          selectedDuration={30}
          selectedDate="2099-03-03"
          attendeeTimezone="UTC"
          onTimezoneChange={() => {}}
          onSuccess={onSuccess}
          onChangeSlot={onChangeSlot}
          {...overrides}
        />
      )
    );
    return { onSuccess, onChangeSlot, user: userEvent.setup() };
  };

  const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Name'), 'Ayşe Demir');
  };

  const submit = async (user: ReturnType<typeof userEvent.setup>) => {
    const buttons = screen.getAllByRole('button', { name: 'Confirm booking' });
    await user.click(buttons[0]);
  };

  beforeEach(() => {
    auth.signer = null;
    auth.user = null;
    auth.isLoggedIn = false;
    auth.loginAsGuest.mockReset();
    relays.publishEvent.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('shows the chosen time, the fields from the design and an encrypted default', () => {
    signIn();
    setup();
    expect(screen.getByRole('heading', { name: 'Complete your details' })).toBeTruthy();
    expect(screen.getByText('Tuesday, March 3 · 14:30 – 15:00')).toBeTruthy();
    for (const label of ['Title', 'Name', 'Email (optional)', 'Notes', 'Invite participants', 'Time zone']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    const encrypted = screen.getByRole('radio', { name: /Encrypted/ }) as HTMLInputElement;
    expect(encrypted.checked).toBe(true);
    expect((screen.getByRole('radio', { name: /Public/ }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('group', { name: 'Privacy' })).toBeTruthy();
  });

  it('goes back to the list of times with "Change"', async () => {
    signIn();
    const { user, onChangeSlot } = setup();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(onChangeSlot).toHaveBeenCalledTimes(1);
  });

  it('publishes an encrypted booking with a copy for each invited key and e-mails everyone', async () => {
    signIn();
    const { user, onSuccess } = setup();
    await user.type(screen.getByLabelText('Title'), 'Proje görüşmesi');
    await fillRequired(user);
    await user.type(screen.getByLabelText('Email (optional)'), 'ayse@example.com');
    await user.type(screen.getByLabelText('Notes'), 'Gündem: takvim');
    await user.type(screen.getByLabelText('Invite participants'), `${encodeNpub(inviteePubkey)}{Enter}`);
    await user.type(screen.getByLabelText('Invite participants'), 'mehmet@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(within(screen.getByRole('list', { name: 'Invited participants' })).getAllByRole('listitem')).toHaveLength(2);

    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const [targetRelays, event] = relays.publishEvent.mock.calls[0];
    expect(targetRelays).toEqual(['wss://relay.example']);
    expect(event.kind).toBe(31923);
    const tag = (name: string) => event.tags.filter((t: string[]) => t[0] === name);
    expect(tag('title')[0][1]).toBe('Appointment (30 min)');
    expect(JSON.stringify(event)).not.toContain('Proje görüşmesi');
    expect(JSON.stringify(event)).not.toContain('ayse@example.com');
    expect(tag('p').map((t: string[]) => t[1])).toEqual([bookerPubkey, hostPubkey, inviteePubkey]);
    expect(tag('enc')).toHaveLength(1);

    const asHost = await decryptBookingDetails(hostSigner, bookerPubkey, event.content);
    expect(asHost).toMatchObject({ name: 'Ayşe Demir', title: 'Proje görüşmesi', notes: 'Gündem: takvim', email: 'ayse@example.com' });
    expect(asHost?.participants).toEqual([encodeNpub(inviteePubkey), 'mehmet@example.com']);
    const asInvitee = await decryptBookingDetails(inviteeSigner, bookerPubkey, event.content, { tags: event.tags, viewerPubkey: inviteePubkey });
    expect(asInvitee?.name).toBe('Ayşe Demir');

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recipients = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).to).sort();
    expect(recipients).toEqual(['ayse@example.com', 'mehmet@example.com']);
    expect(onSuccess.mock.calls[0][0]).toMatchObject({ eventTitle: 'Proje görüşmesi', start: slot.start, end: slot.end, guestKeys: null });
  });

  it('publishes a public booking with the typed title and readable content but never the e-mail', async () => {
    signIn();
    const { user, onSuccess } = setup();
    await user.click(screen.getByRole('radio', { name: /Public/ }));
    expect(screen.getByText('Your email is never published, even for public bookings.')).toBeTruthy();
    await user.type(screen.getByLabelText('Title'), 'Open office hours');
    await fillRequired(user);
    await user.type(screen.getByLabelText('Email (optional)'), 'ayse@example.com');
    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const event = relays.publishEvent.mock.calls[0][1];
    expect(event.tags.find((t: string[]) => t[0] === 'title')[1]).toBe('Open office hours');
    expect(event.tags.some((t: string[]) => t[0] === 'enc')).toBe(false);
    const content = JSON.parse(event.content);
    expect(content).toMatchObject({ name: 'Ayşe Demir', title: 'Open office hours' });
    expect(event.content).not.toContain('ayse@example.com');
  });

  it('creates a guest key for visitors without one and hands it to the success screen', async () => {
    const guestSigner = new PrivateKeySigner(generateSecretKey());
    auth.loginAsGuest.mockReturnValue({ signer: guestSigner, nsec: 'nsec1guest', npub: 'npub1guest' });
    const { user, onSuccess } = setup();
    expect(screen.getByText(/A key is generated for you/)).toBeTruthy();
    await fillRequired(user);
    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(auth.loginAsGuest).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0].guestKeys).toEqual({ nsec: 'nsec1guest', npub: 'npub1guest' });
    expect(relays.publishEvent.mock.calls[0][1].pubkey).toBe(await guestSigner.getPublicKey());
  });

  it('does not publish without a name', async () => {
    signIn();
    const { user } = setup();
    await submit(user);
    expect(relays.publishEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid or repeated participant without publishing', async () => {
    signIn();
    const { user } = setup();
    await fillRequired(user);
    await user.type(screen.getByLabelText('Invite participants'), 'nobody{Enter}');
    expect(screen.getByRole('alert').textContent).toContain('Enter an npub or a valid email address.');

    await user.clear(screen.getByLabelText('Invite participants'));
    await user.type(screen.getByLabelText('Invite participants'), 'a@example.com{Enter}');
    await user.type(screen.getByLabelText('Invite participants'), 'A@example.com{Enter}');
    expect(screen.getByRole('alert').textContent).toContain('Already added.');

    await user.clear(screen.getByLabelText('Invite participants'));
    await user.type(screen.getByLabelText('Invite participants'), 'broken');
    await submit(user);
    expect(relays.publishEvent).not.toHaveBeenCalled();
  });

  it('adds and removes participants', async () => {
    signIn();
    const { user } = setup();
    await user.type(screen.getByLabelText('Invite participants'), 'a@example.com{Enter}');
    const list = screen.getByRole('list', { name: 'Invited participants' });
    expect(within(list).getByText('a@example.com')).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: 'Remove a@example.com' }));
    expect(screen.queryByRole('list', { name: 'Invited participants' })).toBeNull();
  });

  it('refuses to publish an encrypted booking when the signer cannot encrypt', async () => {
    auth.signer = {
      type: 'nip07',
      getPublicKey: async () => bookerPubkey,
      signEvent: async () => {
        throw new Error('must not sign');
      },
    };
    auth.user = { pubkey: bookerPubkey };
    auth.isLoggedIn = true;
    const { user, onSuccess } = setup();
    await fillRequired(user);
    await submit(user);
    expect((await screen.findByRole('alert')).textContent).toMatch(/does not support encryption/);
    expect(relays.publishEvent).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reports a failed publish and stays on the form', async () => {
    signIn();
    relays.publishEvent.mockRejectedValue(new Error('No relay accepted the event'));
    const { user, onSuccess } = setup();
    await fillRequired(user);
    await submit(user);
    expect((await screen.findByRole('alert')).textContent).toContain('No relay accepted the event');
    expect(onSuccess).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ayşe Demir');
  });

  it('tells the page when a submission starts and ends', async () => {
    signIn();
    const states: boolean[] = [];
    const { user } = setup({ onSubmittingChange: (value) => states.push(value) });
    await fillRequired(user);
    await submit(user);
    await waitFor(() => expect(states).toEqual([true, false]));
  });
});

describe('BookingPage', () => {
  const hostPubkey = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';

  const mockViewport = (wide: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: wide && query.includes('640'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  };

  /** Fixes "now" without freezing timers: Monday 2030-03-04 08:00 UTC (host works Monday to Friday, 09:00-17:00 UTC). */
  const freezeDate = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  const renderPage = async (identifier = 'delirehberi@emre.xyz') => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    render(withI18n(<BookingPage identifier={identifier} />));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Open times' })).not.toBeNull());
    return user;
  };

  beforeEach(() => {
    auth.signer = null;
    auth.user = null;
    auth.isLoggedIn = false;
    relays.queryNip05Pubkey.mockReset().mockResolvedValue(hostPubkey);
    relays.fetchHostRelays.mockReset().mockResolvedValue({ all: ['wss://r'], read: ['wss://r'], write: ['wss://r'] });
    relays.fetchHostProfile.mockReset().mockResolvedValue({ pubkey: hostPubkey, displayName: 'delirehberi', nip05: 'delirehberi@emre.xyz', about: 'Builder.' });
    relays.fetchCalendarEvents.mockReset().mockResolvedValue({ timeEvents: [] });
    relays.fetchCalendarRSVPs.mockReset().mockResolvedValue([]);
  });

  it('shows the intro, the host and the three steps', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Pick a time.' })).toBeTruthy();
    expect(screen.getByText('Calendar owner')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'delirehberi' })).toBeTruthy();
    for (const name of ['How long?', 'Which day?', 'Which time?']) {
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: '30 min' }).getAttribute('aria-checked')).toBe('true');
  });

  it('selects today when it has open time and lists 30 minute slots', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    await renderPage();
    const today = screen.getByRole('button', { name: 'Monday, March 4, open time available' });
    expect(today.getAttribute('aria-pressed')).toBe('true');
    const times = within(screen.getByRole('group', { name: 'Open times' })).getAllByRole('button').map((b) => b.textContent);
    expect(times).toHaveLength(16);
    expect(times[0]).toBe('09:00');
    expect(times[15]).toBe('16:30');
    expect(screen.getByText('Monday, March 4 · 30 min')).toBeTruthy();
  });

  it('jumps to the next open day when today has none and the visitor has not chosen', async () => {
    freezeDate('2030-03-08T18:00:00Z'); // Friday evening
    mockViewport(true);
    await renderPage();
    expect(screen.getByRole('button', { name: 'Monday, March 11, open time available' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Monday, March 11 · 30 min')).toBeTruthy();
  });

  it('recomputes the slots when the duration changes', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    const user = await renderPage();
    await user.click(screen.getByRole('radio', { name: '60 min' }));
    const times = within(screen.getByRole('group', { name: 'Open times' })).getAllByRole('button');
    expect(times).toHaveLength(8);
    expect(screen.getByText('Monday, March 4 · 60 min')).toBeTruthy();
  });

  it('blocks a slot that collides with a busy event from the host calendar', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    const busyStart = Date.UTC(2030, 2, 4, 10, 0) / 1000;
    relays.fetchCalendarEvents.mockResolvedValue({
      timeEvents: [
        {
          coordinate: '31923:host:busy',
          pubkey: hostPubkey,
          identifier: 'busy',
          title: 'Busy',
          start: busyStart,
          end: busyStart + 3600,
          attendees: [],
          hashtags: [],
          content: '',
        },
      ],
    });
    await renderPage();
    await waitFor(() => {
      const times = within(screen.getByRole('group', { name: 'Open times' })).getAllByRole('button').map((b) => b.textContent);
      expect(times).not.toContain('10:00');
    });
    const times = within(screen.getByRole('group', { name: 'Open times' })).getAllByRole('button').map((b) => b.textContent);
    expect(times).toContain('09:00');
    expect(times).not.toContain('10:30');
    expect(screen.getByText(/booked or past/)).toBeTruthy();
  });

  it('opens the details form in place as soon as a time is chosen on tablet and desktop', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    const user = await renderPage();
    await user.click(screen.getByRole('button', { name: '14:30' }));
    expect(screen.getByRole('heading', { name: 'Complete your details' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Open times' })).toBeNull();
    expect(screen.getByText('Monday, March 4 · 14:30 – 15:00')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Title')));

    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('heading', { name: 'Which time?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '14:30' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the list on phones and opens the form from the action bar', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(false);
    const user = await renderPage();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '14:30' }));
    expect(screen.getByRole('heading', { name: 'Which time?' })).toBeTruthy();
    expect(screen.getByText('March 4 · 14:30')).toBeTruthy();
    expect(screen.getByText('30 min · ' + Intl.DateTimeFormat().resolvedOptions().timeZone)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Complete your details' })).toBeTruthy();
    const submitButtons = screen.getAllByRole('button', { name: 'Confirm booking' });
    const bar = submitButtons.find((b) => b.getAttribute('form') === 'booking-form');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('type')).toBe('submit');
  });

  it('clears the chosen time when the day or the duration changes', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(false);
    const user = await renderPage();
    await user.click(screen.getByRole('button', { name: '14:30' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: '45 min' }));
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();

    // 45 minute slots start at 09:00, 09:45, ... so 14:15 exists and 14:30 does not.
    await user.click(screen.getByRole('button', { name: '14:15' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tuesday, March 5, open time available' }));
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows the host error when the identifier cannot be resolved', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    relays.queryNip05Pubkey.mockResolvedValue(null);
    render(withI18n(<BookingPage identifier="nobody@example.com" />));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Host profile could not be loaded from relays.' })).toBeTruthy();
  });

  it('renders the Turkish page from the design', async () => {
    freezeDate('2030-03-04T08:00:00Z');
    mockViewport(true);
    window.localStorage.setItem('cal_locale', 'tr');
    await act(async () => {
      render(withI18n(<BookingPage identifier="delirehberi@emre.xyz" />));
    });
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Boş saatler' })).not.toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Bir zaman seç.' })).toBeTruthy();
    expect(screen.getByText('Takvim sahibi')).toBeTruthy();
    for (const name of ['Ne kadar süre?', 'Hangi gün?', 'Hangi saat?']) {
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    }
    expect(screen.getByText('Yeşil nokta: o gün boş zaman var')).toBeTruthy();
    expect(screen.getByText('Pazartesi, 4 Mart · 30 dk')).toBeTruthy();
  });
});
