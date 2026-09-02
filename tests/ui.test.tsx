import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Button } from '../src/client/components/ui/Button';
import { Card } from '../src/client/components/ui/Card';
import { Badge } from '../src/client/components/ui/Badge';
import { Skeleton } from '../src/client/components/ui/Skeleton';
import { Input, TextArea } from '../src/client/components/ui/Input';
import { HostCard } from '../src/client/components/booking/HostCard';
import { DurationPicker } from '../src/client/components/booking/DurationPicker';
import { DatePicker } from '../src/client/components/booking/DatePicker';
import { TimeSlotGrid } from '../src/client/components/booking/TimeSlotGrid';
import { NostrEduBanner } from '../src/client/components/booking/NostrEduBanner';
import { BookingSuccess } from '../src/client/components/booking/BookingSuccess';
import { Footer } from '../src/client/components/layout/Footer';
import { I18nProvider } from '../src/client/i18n';
import { ThemeProvider } from '../src/client/context/ThemeContext';
import { AuthProvider } from '../src/client/context/AuthContext';

describe('UI Primitives SSR and Rendering Tests', () => {
  it('renders Button with variants and content', () => {
    const html = renderToString(<Button variant="primary">Confirm Booking</Button>);
    expect(html).toContain('Confirm Booking');
    expect(html).toContain('button');
  });

  it('renders Card with content and styles', () => {
    const html = renderToString(<Card>Card Body Content</Card>);
    expect(html).toContain('Card Body Content');
  });

  it('renders Badge with status colors', () => {
    const html = renderToString(<Badge variant="success">Confirmed</Badge>);
    expect(html).toContain('Confirmed');
    expect(html).toContain('emerald');
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
  });

  it('renders DurationPicker with duration options', () => {
    const html = renderToString(
      wrapper({
        children: (
          <DurationPicker
            durations={[15, 30, 60]}
            selectedDuration={30}
            onSelectDuration={() => {}}
          />
        ),
      })
    );
    expect(html).toContain('15');
    expect(html).toContain('30');
    expect(html).toContain('60');
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
            onTimezoneChange={() => {}}
            selectedDate="2026-09-15"
          />
        ),
      })
    );
    expect(html).toContain('10:00');
    expect(html).toContain('10:30');
    expect(html).toContain('select');
    expect(html).toContain('Europe/Istanbul');
  });

  it('renders NostrEduBanner with educational link', () => {
    const html = renderToString(
      wrapper({
        children: <NostrEduBanner />,
      })
    );
    expect(html).toContain('nostr.com');
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

  it('renders Footer with specification and repository links', () => {
    const html = renderToString(
      wrapper({
        children: <Footer />,
      })
    );
    expect(html).toContain('NIP-52');
    expect(html).toContain('cal.emre.xyz');
    expect(html).toContain('github.com');
  });
});
