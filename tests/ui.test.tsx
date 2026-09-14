import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Button } from '../src/client/components/ui/Button';
import { Card } from '../src/client/components/ui/Card';
import { StatusBadge } from '../src/client/components/ui/StatusBadge';
import { Chip, ChipGroup, getNextChipIndex } from '../src/client/components/ui/Chip';
import { Toggle } from '../src/client/components/ui/Toggle';
import { Skeleton } from '../src/client/components/ui/Skeleton';
import { Input, TextArea, Select } from '../src/client/components/ui/Input';
import { HostCard } from '../src/client/components/booking/HostCard';
import { DurationPicker } from '../src/client/components/booking/DurationPicker';
import { DatePicker } from '../src/client/components/booking/DatePicker';
import { TimeSlotGrid } from '../src/client/components/booking/TimeSlotGrid';
import { NostrEduBanner } from '../src/client/components/booking/NostrEduBanner';
import { BookingSuccess } from '../src/client/components/booking/BookingSuccess';
import { Footer } from '../src/client/components/layout/Footer';
import { LoadBar } from '../src/client/components/ui/LoadBar';
import { BookingPage } from '../src/client/pages/BookingPage';
import { APP_CONFIG } from '../src/config';
import { I18nProvider } from '../src/client/i18n';
import { ThemeProvider } from '../src/client/context/ThemeContext';
import { AuthProvider } from '../src/client/context/AuthContext';

describe('UI Primitives SSR and Rendering Tests', () => {
  it('renders Button with variants and content', () => {
    const html = renderToString(<Button variant="primary">Confirm Booking</Button>);
    expect(html).toContain('Confirm Booking');
    expect(html).toContain('button');
  });

  it('maps Button variants to Kün tokens and keeps red for danger only', () => {
    const primary = renderToString(<Button variant="primary">Go</Button>);
    expect(primary).toContain('bg-ink');
    expect(primary).toContain('text-paper');
    expect(primary).not.toContain('danger');

    const secondary = renderToString(<Button variant="secondary">Go</Button>);
    expect(secondary).toContain('border-line');
    expect(secondary).toContain('bg-card');

    const danger = renderToString(<Button variant="danger">Cancel meeting</Button>);
    expect(danger).toContain('border-danger');
    expect(danger).toContain('text-danger');

    const quiet = renderToString(<Button variant="quiet">Later</Button>);
    expect(quiet).toContain('text-muted');
  });

  it('disables and marks a loading Button as busy', () => {
    const html = renderToString(<Button isLoading>Saving</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
  });

  it('renders a selected Chip as a checked radio', () => {
    const selected = renderToString(<Chip selected>30 min</Chip>);
    expect(selected).toContain('role="radio"');
    expect(selected).toContain('aria-checked="true"');
    expect(selected).toContain('bg-ink');
    const idle = renderToString(<Chip>15 min</Chip>);
    expect(idle).toContain('aria-checked="false"');
    expect(idle).toContain('bg-card');
  });

  it('renders ChipGroup as a radiogroup with a roving tabindex', () => {
    const html = renderToString(
      <ChipGroup
        aria-label="Duration"
        value={30}
        onChange={() => undefined}
        options={[
          { value: 15, label: '15 min' },
          { value: 30, label: '30 min' },
          { value: 60, label: '60 min' },
        ]}
      />
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Duration"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it('navigates chips with arrow keys, wrapping and skipping disabled options', () => {
    const enabled = [0, 2, 3];
    expect(getNextChipIndex(enabled, 0, 'ArrowRight')).toBe(2);
    expect(getNextChipIndex(enabled, 3, 'ArrowRight')).toBe(0);
    expect(getNextChipIndex(enabled, 0, 'ArrowLeft')).toBe(3);
    expect(getNextChipIndex(enabled, 2, 'ArrowUp')).toBe(0);
    expect(getNextChipIndex(enabled, 2, 'Home')).toBe(0);
    expect(getNextChipIndex(enabled, 0, 'End')).toBe(3);
    expect(getNextChipIndex(enabled, 2, 'Enter')).toBeNull();
    expect(getNextChipIndex([], 0, 'ArrowRight')).toBeNull();
  });

  it('renders Toggle as a switch with checked state', () => {
    const on = renderToString(<Toggle checked onChange={() => undefined} aria-label="Monday" />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('bg-ink');
    expect(on).toContain('translate-x-4');
    const off = renderToString(<Toggle checked={false} onChange={() => undefined} aria-label="Sunday" />);
    expect(off).toContain('aria-checked="false"');
    expect(off).toContain('bg-line');
  });

  it('links field labels and messages to their controls and keeps errors out of red', () => {
    const html = renderToString(<Input label="Name" error="Name is required" />);
    expect(html).toMatch(/<label[^>]*for="([^"]+)"/);
    const id = html.match(/<label[^>]*for="([^"]+)"/)![1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`aria-describedby="${id}-message"`);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('danger');
    expect(html).not.toContain('red-');

    const helper = renderToString(<Input label="Email" helperText="Optional" />);
    expect(helper).toContain('Optional');
    expect(helper).not.toContain('aria-invalid');
  });

  it('renders Select with its options, chevron and optional icon', () => {
    const html = renderToString(
      <Select label="Time zone" icon={<span data-testid="icon" />} defaultValue="Europe/Istanbul">
        <option value="Europe/Istanbul">Europe/Istanbul</option>
        <option value="UTC">UTC</option>
      </Select>
    );
    expect(html).toContain('<select');
    expect(html).toContain('Time zone');
    expect(html).toContain('Europe/Istanbul');
    expect(html).toContain('lucide-chevron-down');
    expect(html).toContain('pl-10');
  });

  it('renders Card on the card surface with the line border and card radius', () => {
    const html = renderToString(<Card>Body</Card>);
    expect(html).toContain('bg-card');
    expect(html).toContain('border-line');
    expect(html).toContain('rounded-card');
    expect(renderToString(<Card variant="flat">Body</Card>)).toContain('bg-paper');
  });

  it('renders Card with content and styles', () => {
    const html = renderToString(<Card>Card Body Content</Card>);
    expect(html).toContain('Card Body Content');
  });

  it('renders StatusBadge kinds with their markers', () => {
    const confirmed = renderToString(<StatusBadge kind="confirmed">Confirmed</StatusBadge>);
    expect(confirmed).toContain('Confirmed');
    expect(confirmed).toContain('bg-slot-soft');
    expect(confirmed).toContain('bg-slot');

    const pending = renderToString(<StatusBadge kind="pending">Pending</StatusBadge>);
    expect(pending).toContain('border-line');
    expect(pending).toContain('border-[1.5px]');
    expect(pending).not.toContain('bg-slot');

    expect(renderToString(<StatusBadge kind="encrypted">Encrypted</StatusBadge>)).toContain('lucide-lock');
    expect(renderToString(<StatusBadge kind="public">Public</StatusBadge>)).toContain('lucide-eye');
    expect(renderToString(<StatusBadge kind="cancelled">Cancelled</StatusBadge>)).toContain('line-through');
  });

  it('renders Skeleton loader element', () => {
    const html = renderToString(<Skeleton variant="circular" className="h-10 w-10" />);
    expect(html).toContain('animate-pulse');
  });

  it('renders Input and TextArea with labels and values', () => {
    const inputHtml = renderToString(
      <Input label="Your Name" placeholder="Satoshi Nakamoto" defaultValue="Alice" />
    );
    expect(inputHtml).toContain('Your Name');
    expect(inputHtml).toContain('Alice');

    const textareaHtml = renderToString(
      <TextArea label="Meeting Notes" placeholder="Agenda items" defaultValue="Discuss NIP-52" />
    );
    expect(textareaHtml).toContain('Meeting Notes');
    expect(textareaHtml).toContain('Discuss NIP-52');
  });

  it('renders LoadBar component with progressbar role and accessibility labels', () => {
    const html = renderToString(<LoadBar active={true} label="Loading Host Profile" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading Host Profile"');
    expect(html).toContain('animate-loadbar');

    const fixedTopHtml = renderToString(<LoadBar active={true} fixedTop={true} />);
    expect(fixedTopHtml).toContain('fixed top-0');

    const inactiveHtml = renderToString(<LoadBar active={false} />);
    expect(inactiveHtml).toBe('');
  });
});

describe('Booking Components Rendering Tests', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );

  it('renders HostCard with profile details', () => {
    const html = renderToString(
      wrapper({
        children: (
          <HostCard
            profile={{
              pubkey: '3bf0c63fcb93463407af97b5e0907d743712d0ec403c3167f56bc1b1433d3b2f',
              displayName: 'Emre Yılmaz',
              nip05: 'z@emre.xyz',
              about: 'Building sovereign calendar systems on Nostr.',
            }}
            nip05Identifier="z@emre.xyz"
            timezone="Europe/Istanbul"
          />
        ),
      })
    );
    expect(html).toContain('Emre Yılmaz');
    expect(html).toContain('z@emre.xyz');
    expect(html).toContain('Europe/Istanbul');
    expect(html).toContain('Building sovereign calendar');
    expect(html).toContain('Calendar owner');
    expect(html).toContain('>e<');
  });

  it('renders HostCard with the localized default bio when the profile has none', () => {
    const html = renderToString(
      wrapper({ children: <HostCard profile={null} nip05Identifier="alice@example.com" timezone="UTC" /> })
    );
    expect(html).toContain('alice');
    expect(html).toContain('Pick a time that suits you');
  });

  it('renders DurationPicker with duration options', () => {
    const html = renderToString(
      wrapper({
        children: (
          <DurationPicker
            durations={[15, 30, 45, 60]}
            extendedDurations={[90, 120]}
            selectedDuration={30}
            onSelectDuration={() => {}}
          />
        ),
      })
    );
    expect(html).toContain('15 min');
    expect(html).toContain('30 min');
    expect(html).toContain('45 min');
    expect(html).toContain('60 min');
    expect(html).toContain('longer…');
    expect(html).not.toContain('90 min');
    expect(html).toContain('role="radiogroup"');
  });

  it('keeps a chosen extended duration visible', () => {
    const html = renderToString(
      wrapper({
        children: (
          <DurationPicker
            durations={[15, 30, 45, 60]}
            extendedDurations={[90, 120]}
            selectedDuration={90}
            onSelectDuration={() => {}}
          />
        ),
      })
    );
    expect(html).toContain('90 min');
    expect(html).toContain('120 min');
  });

  it('renders DatePicker calendar header and days', () => {
    const html = renderToString(
      wrapper({
        children: (
          <DatePicker
            selectedDate="2026-09-15"
            onSelectDate={() => {}}
            availabilitySummaries={[]}
            currentYear={2026}
            currentMonth={9}
            onMonthChange={() => {}}
          />
        ),
      })
    );
    expect(html).toContain('September 2026');
    expect(html).toContain('Green dot: that day has open time');
  });

  it('renders TimeSlotGrid with slot items', () => {
    const html = renderToString(
      wrapper({
        children: (
          <TimeSlotGrid
            slots={[
              {
                start: 1789470000,
                end: 1789471800,
                startTimeISO: '2026-09-15T10:00:00Z',
                endTimeISO: '2026-09-15T10:30:00Z',
                formattedStartTime: '10:00',
                formattedEndTime: '10:30',
                available: true,
              },
              {
                start: 1789471800,
                end: 1789473600,
                startTimeISO: '2026-09-15T10:30:00Z',
                endTimeISO: '2026-09-15T11:00:00Z',
                formattedStartTime: '10:30',
                formattedEndTime: '11:00',
                available: false,
                reason: 'booked',
              },
            ]}
            selectedSlot={null}
            onSelectSlot={() => {}}
            attendeeTimezone="UTC"
            hostTimezone="Europe/Istanbul"
            onTimezoneChange={() => {}}
            selectedDate="2026-09-15"
            durationMinutes={30}
          />
        ),
      })
    );
    expect(html).toContain('10:00');
    // Booked times are folded into one line instead of being listed.
    expect(html).not.toContain('10:30');
    expect(html).toContain('1 booked or past');
    expect(html).toContain('Tuesday, September 15 · 30 min');
    expect(html).toContain('<select');
    expect(html).toContain('Europe/Istanbul (GMT+3)');
  });

  it('renders NostrEduBanner with educational link', () => {
    const html = renderToString(
      wrapper({
        children: <NostrEduBanner />,
      })
    );
    expect(html).toContain('nostr.com');
    expect(html).toContain('A key is generated for you');
  });

  it('renders BookingSuccess with calendar export options', () => {
    const html = renderToString(
      wrapper({
        children: (
          <BookingSuccess
            eventTitle="Appointment with Emre"
            hostName="Emre"
            hostPubkey="3bf0c63fcb93463407af97b5e0907d743712d0ec403c3167f56bc1b1433d3b2f"
            hostNip05="z@emre.xyz"
            start={1789470000}
            end={1789471800}
            formattedDate="2026-09-15"
            formattedStartTime="10:00 AM"
            formattedEndTime="10:30 AM"
            attendeeTimezone="UTC"
            naddr="naddr1qqqx..."
            guestKeys={{
              npub: 'npub1qqqx...',
              nsec: 'nsec1qqqx...',
            }}
            onBookAnother={() => {}}
          />
        ),
      })
    );
    expect(html).toContain('Appointment with Emre');
    expect(html).toContain('naddr1qqqx...');
    expect(html).toContain('nsec1qqqx...');
  });

  it('renders Footer with the Nostr community badge and the three links', () => {
    const html = renderToString(
      wrapper({
        children: <Footer />,
      })
    );
    expect(html).toContain('A nostr.org.tr community initiative');
    expect(html).toContain('bg-nostr-soft');
    expect(html).toContain('github.com/delirehberi/cal.emre.xyz');
    expect(html).toContain('>GitHub<');
    expect(html).toContain('>NIP-52<');
    expect(html).toContain('nostrhub.io/nip/52');
    expect(html).toContain('>nostr.com<');
    expect(html).toContain('aria-label="Footer links"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders BookingPage with alternate user without flashing default host', () => {
    const alternateNpub = 'npub1nqvz7vzg3llhpcyyywt5vdlt5xvc4a7dwkpm5tgm2skdvdzt9cjsnnq5pv';
    const html = renderToString(
      wrapper({
        children: <BookingPage identifier={alternateNpub} />,
      })
    );

    // Should render the loadbar / progressbar and loading banner with the alternate identifier
    expect(html).toContain('role="progressbar"');
    expect(html).toContain(alternateNpub);

    // MUST NEVER contain default host's name, nip05, or pubkey
    expect(html).not.toContain('delirehberi@emre.xyz');
    expect(html).not.toContain('Emre Yılmaz');
    expect(html).not.toContain(APP_CONFIG.defaultHostPubkey);
  });

  it('renders BookingPage with default host directly without loadbar when at root', () => {
    const html = renderToString(
      wrapper({
        children: <BookingPage identifier={APP_CONFIG.defaultHostNip05} />,
      })
    );

    // Default host profile should be rendered
    expect(html).toContain('delirehberi');
  });
});

describe('Brand components', () => {
  it('renders the lockup with an accessible Kün name and no domain or protocol text', async () => {
    const { Lockup } = await import('../src/client/components/brand');
    const html = renderToString(React.createElement(Lockup));
    expect(html).toContain('aria-label="Kün"');
    expect(html).not.toMatch(/cal\.emre\.xyz|NIP-52/i);
    expect(html).toContain('>k<');
    expect(html).toContain('>n<');
  });

  it('keeps the wordmark dots on the ü: one ink dot and one green dot', async () => {
    const { Wordmark } = await import('../src/client/components/brand');
    const html = renderToString(React.createElement(Wordmark));
    expect(html.match(/bg-ink/g)).toHaveLength(1);
    expect(html.match(/bg-slot/g)).toHaveLength(1);
  });

  it('draws the mark as a 3×3 grid with a larger green open-slot dot on the right of the middle row', async () => {
    const { Mark } = await import('../src/client/components/brand');
    const html = renderToString(React.createElement(Mark));
    expect(html.match(/<circle/g)).toHaveLength(9);
    expect(html).toContain('cx="46" cy="32" r="6.2"');
    expect(html).toContain('fill-slot');
    expect(html).toContain('aria-hidden="true"');
  });

  it('only exposes a mark name when a title is given', async () => {
    const { Mark } = await import('../src/client/components/brand');
    expect(renderToString(React.createElement(Mark, { title: 'Kün' }))).toContain('aria-label="Kün"');
  });

  it('sizes the lockup mark at 40 / 32 / 26 px and hides the wordmark below 320 px', async () => {
    const { Lockup } = await import('../src/client/components/brand');
    expect(renderToString(React.createElement(Lockup, { size: 'L' }))).toContain('[--mark:40px]');
    expect(renderToString(React.createElement(Lockup, { size: 'M' }))).toContain('[--mark:32px]');
    expect(renderToString(React.createElement(Lockup, { size: 'S' }))).toContain('[--mark:26px]');
    const responsive = renderToString(React.createElement(Lockup));
    expect(responsive).toContain('tablet:[--mark:32px]');
    expect(responsive).toContain('desktop:[--mark:40px]');
    expect(responsive).toContain('max-[319px]:hidden');
    expect(renderToString(React.createElement(Lockup, { markOnly: true }))).not.toContain('>k<');
  });
});

describe('cn class merging', () => {
  it('keeps Kün text sizes next to text colours and still resolves real conflicts', async () => {
    const { cn } = await import('../src/client/lib/cn');
    expect(cn('text-body', 'text-ink')).toBe('text-body text-ink');
    expect(cn('text-caption leading-ui', 'text-muted')).toBe('text-caption leading-ui text-muted');
    expect(cn('text-ink', 'text-paper')).toBe('text-paper');
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
    expect(cn('rounded-card', 'rounded-hero')).toBe('rounded-hero');
    expect(cn('p-5', 'p-7')).toBe('p-7');
  });
});

describe('ChipGroup layout override', () => {
  it('lets a caller turn the group into display: contents', () => {
    const html = renderToString(
      <ChipGroup className="contents" aria-label="x" value={1} onChange={() => undefined} options={[{ value: 1, label: 'a' }]} />
    );
    expect(html).toContain('contents');
    expect(html).not.toContain('class="flex flex-wrap');
  });

});
