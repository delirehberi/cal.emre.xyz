// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { I18nProvider } from '../src/client/i18n';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import { AVAILABILITY_KIND, parseAvailabilityEvent } from '../src/client/lib/nostr/availability';
import { getHostWorkingHours } from '../src/client/lib/calendar/slots';

const relays = vi.hoisted(() => ({
  publishEvent: vi.fn(),
  fetchHostRelays: vi.fn(),
  getBootstrapRelays: vi.fn((custom?: string[]) => custom ?? ['wss://relay.example']),
}));

vi.mock('../src/client/lib/nostr/relays', () => ({
  nostrPool: {
    publishEvent: relays.publishEvent,
    fetchHostRelays: relays.fetchHostRelays,
    getBootstrapRelays: relays.getBootstrapRelays,
  },
}));

import { WorkingHoursForm } from '../src/client/components/dashboard/WorkingHoursForm';
import { BookedEventsList } from '../src/client/components/dashboard/BookedEventsList';
import { Tabs } from '../src/client/components/ui/Tabs';
import { TimeField, parseTimeInput, formatMinutes } from '../src/client/components/ui/TimeField';
import type { HostAppointment } from '../src/client/lib/nostr/relays';

const withI18n = (ui: React.ReactElement) => <I18nProvider>{ui}</I18nProvider>;

const hostKey = generateSecretKey();
const hostPubkey = getPublicKey(hostKey);
const guestPubkey = getPublicKey(generateSecretKey());

beforeEach(() => {
  window.localStorage.clear();
  relays.publishEvent.mockReset().mockResolvedValue([{ relay: 'wss://relay.example', success: true }]);
  relays.fetchHostRelays.mockReset().mockResolvedValue({ all: [], read: [], write: ['wss://relay.example'] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Tabs underline variant', () => {
  const Harness = () => {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <Tabs
        variant="underline"
        idBase="t"
        label="Sections"
        value={value}
        onChange={setValue}
        items={[
          { value: 'a', label: 'First' },
          { value: 'b', label: 'Second' },
        ]}
      />
    );
  };

  it('switches tabs with the arrow keys and marks the selected one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = screen.getByRole('tab', { name: 'First' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveProperty('ariaSelected', 'true');
    expect(first.getAttribute('aria-selected')).toBe('false');
  });
});

describe('TimeField', () => {
  it('parses 24-hour input and rejects everything else', () => {
    expect(parseTimeInput('09:00')).toBe(540);
    expect(parseTimeInput('9:05')).toBe(545);
    expect(parseTimeInput('24:00')).toBe(1440);
    expect(parseTimeInput('24:30')).toBeNull();
    expect(parseTimeInput('12:60')).toBeNull();
    expect(parseTimeInput('9 AM')).toBeNull();
    expect(parseTimeInput('')).toBeNull();
    expect(formatMinutes(1440)).toBe('24:00');
    expect(formatMinutes(545)).toBe('09:05');
  });

  it('commits valid times while typing and restores the last valid one on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeField value={540} onChange={onChange} aria-label="Start" />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.value).toBe('09:00');

    await user.clear(input);
    await user.type(input, '13:45');
    expect(onChange).toHaveBeenLastCalledWith(825);

    await user.clear(input);
    await user.type(input, '99:99');
    await user.tab();
    expect(input.value).toBe('09:00');
  });
});

describe('WorkingHoursForm', () => {
  it('shows time boxes only for available days', async () => {
    const user = userEvent.setup();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} />));

    expect(screen.getByLabelText('Monday start')).toBeTruthy();
    expect(screen.queryByLabelText('Saturday start')).toBeNull();

    await user.click(screen.getByRole('switch', { name: 'Saturday available' }));
    expect(screen.getByLabelText('Saturday start')).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: 'Monday available' }));
    expect(screen.queryByLabelText('Monday start')).toBeNull();
  });

  it('keeps at least one meeting length selected', async () => {
    const user = userEvent.setup();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} />));

    const group = screen.getByRole('group', { name: 'Meeting lengths' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['15 min', '30 min', '45 min', '60 min']);

    for (const chip of chips.slice(0, 3)) await user.click(chip);
    expect(chips[3].getAttribute('aria-pressed')).toBe('true');

    await user.click(chips[3]);
    expect(chips[3].getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Keep at least one length.')).toBeTruthy();
  });

  it('rejects an end time that is not after the start time', async () => {
    const user = userEvent.setup();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} signer={new PrivateKeySigner(hostKey)} />));

    fireEvent.change(screen.getByLabelText('Monday end'), { target: { value: '08:00' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('The end time must be after the start time.')).toBeTruthy();
    expect(relays.publishEvent).not.toHaveBeenCalled();
  });

  it('saves locally and says so when no signer is available', async () => {
    const user = userEvent.setup();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} />));

    await user.click(screen.getByRole('switch', { name: 'Saturday available' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText(/Saved on this device/)).toBeTruthy();
    expect(getHostWorkingHours(hostPubkey).workingDays).toContain(6);
    expect(relays.publishEvent).not.toHaveBeenCalled();
  });

  it('publishes a signed NIP-78 availability event to the host relays', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} signer={new PrivateKeySigner(hostKey)} onSaved={onSaved} />));

    fireEvent.change(screen.getByLabelText('Wednesday start'), { target: { value: '10:30' } });
    await user.click(within(screen.getByRole('group', { name: 'Meeting lengths' })).getByRole('button', { name: '15 min' }));
    await user.selectOptions(screen.getByLabelText('Gap between appointments'), '10');
    await user.selectOptions(screen.getByLabelText('Earliest booking'), '1440');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('Saved and published to your relays.')).toBeTruthy());

    expect(relays.publishEvent).toHaveBeenCalledTimes(1);
    const [targets, event] = relays.publishEvent.mock.calls[0];
    expect(targets).toEqual(['wss://relay.example']);
    expect(event.kind).toBe(AVAILABILITY_KIND);
    expect(event.pubkey).toBe(hostPubkey);

    const published = parseAvailabilityEvent(event);
    expect(published?.dayHours?.[3]).toEqual({ start: 630, end: 1020 });
    expect(published?.durations).toEqual([30, 45, 60]);
    expect(published?.bufferMinutes).toBe(10);
    expect(published?.minNoticeMinutes).toBe(1440);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(getHostWorkingHours(hostPubkey).minNoticeMinutes).toBe(1440);
  });

  it('reports a publish failure but keeps the local copy', async () => {
    relays.publishEvent.mockResolvedValue([{ relay: 'wss://relay.example', success: false, error: 'timeout' }]);
    const user = userEvent.setup();
    render(withI18n(<WorkingHoursForm pubkey={hostPubkey} signer={new PrivateKeySigner(hostKey)} />));

    await user.click(screen.getByRole('switch', { name: 'Sunday available' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText(/no relay accepted/)).toBeTruthy());
    expect(getHostWorkingHours(hostPubkey).workingDays).toContain(0);
  });
});

describe('BookedEventsList', () => {
  const start = Math.floor(Date.now() / 1000) + 3 * 24 * 3600;
  const make = (id: string, status: HostAppointment['effectiveStatus'], offset: number): HostAppointment => ({
    event: {
      id: `event-${id}`,
      pubkey: guestPubkey,
      identifier: id,
      title: `Meeting ${id}`,
      start: start + offset,
      end: start + offset + 1800,
      hashtags: [],
      attendees: [{ pubkey: guestPubkey }, { pubkey: hostPubkey }],
      content: '',
      coordinate: `31923:${guestPubkey}:${id}`,
    },
    rsvps: [],
    isDeleted: false,
    effectiveStatus: status,
    hostPubkey,
    isHost: true,
  });

  const Harness: React.FC<{ initial: HostAppointment[] }> = ({ initial }) => {
    const [appointments, setAppointments] = useState(initial);
    return (
      <BookedEventsList
        pubkey={hostPubkey}
        signer={new PrivateKeySigner(hostKey)}
        hostTimezone="UTC"
        appointments={appointments}
        onAppointmentsChange={setAppointments}
        isLoading={false}
        onRefresh={() => undefined}
      />
    );
  };

  it('offers accept/decline on pending cards and the calendar actions on confirmed ones', () => {
    render(withI18n(<Harness initial={[make('a', 'accepted', 0), make('b', 'tentative', 3600)]} />));

    const confirmed = screen.getByRole('article', { name: 'Meeting a' });
    expect(within(confirmed).getByText('Confirmed')).toBeTruthy();
    expect(within(confirmed).getByRole('button', { name: '.ics' })).toBeTruthy();
    expect(within(confirmed).getByRole('button', { name: 'Copy link' })).toBeTruthy();
    expect(within(confirmed).queryByRole('button', { name: 'Accept' })).toBeNull();

    const pending = screen.getByRole('article', { name: 'Meeting b' });
    expect(within(pending).getByText('Awaiting reply')).toBeTruthy();
    expect(within(pending).getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(within(pending).getByRole('button', { name: 'Decline' })).toBeTruthy();
    expect(within(pending).getByRole('button', { name: 'Cancel meeting' })).toBeTruthy();
  });

  it('publishes an accepting RSVP and updates the card', async () => {
    const user = userEvent.setup();
    render(withI18n(<Harness initial={[make('b', 'tentative', 0)]} />));

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(within(screen.getByRole('article')).getByText('Confirmed')).toBeTruthy());
    const event = relays.publishEvent.mock.calls[0][1];
    expect(event.kind).toBe(31925);
    expect(event.tags).toContainEqual(['status', 'accepted']);
  });

  it('asks for confirmation before cancelling and then publishes a deletion and a decline', async () => {
    const user = userEvent.setup();
    render(withI18n(<Harness initial={[make('a', 'accepted', 0)]} />));

    await user.click(screen.getByRole('button', { name: 'Cancel meeting' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this meeting?' });
    expect(relays.publishEvent).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel meeting' }));

    await waitFor(() => expect(relays.publishEvent).toHaveBeenCalledTimes(2));
    expect(relays.publishEvent.mock.calls.map(([, event]) => event.kind)).toEqual([5, 31925]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Upcoming appointments').nextElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Cancelled')).toBeTruthy();
  });

  it('keeps the meeting when the host backs out of the dialog', async () => {
    const user = userEvent.setup();
    render(withI18n(<Harness initial={[make('a', 'accepted', 0)]} />));

    await user.click(screen.getByRole('button', { name: 'Cancel meeting' }));
    await user.click(screen.getByRole('button', { name: 'Keep meeting' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(relays.publishEvent).not.toHaveBeenCalled();
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });

  it('copies the invite link to the clipboard and confirms inline', async () => {
    const user = userEvent.setup();
    render(withI18n(<Harness initial={[make('a', 'accepted', 0)]} />));

    await user.click(screen.getByRole('button', { name: 'Invite' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toMatch(/\/api\/events\/naddr1[0-9a-z]+\/ics$/);
    expect(screen.getByRole('button', { name: 'Invite link copied' })).toBeTruthy();
  });

  it('shows the empty state without appointments', () => {
    render(withI18n(<Harness initial={[]} />));
    expect(screen.getByText('No upcoming appointments.')).toBeTruthy();
  });
});
