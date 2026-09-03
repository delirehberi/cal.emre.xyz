import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HostCard } from '../components/booking/HostCard';
import { DurationPicker } from '../components/booking/DurationPicker';
import { DatePicker } from '../components/booking/DatePicker';
import { TimeSlotGrid } from '../components/booking/TimeSlotGrid';
import { BookingForm, type BookingResult } from '../components/booking/BookingForm';
import { StickyActionBar } from '../components/booking/StickyActionBar';
import { BookingSuccess } from '../components/booking/BookingSuccess';
import { APP_CONFIG } from '../../config';
import {
  formatDateKey,
  generateDailyTimeSlots,
  generateMonthAvailability,
  extractBusyIntervals,
  getHostWorkingHours,
  type TimeSlot,
  type BusyInterval,
  type WorkingHoursConfig,
} from '../lib/calendar/slots';
import { nostrPool, type HostProfile } from '../lib/nostr/relays';
import { queryNip05Pubkey, decodeKeyToHex } from '../lib/nostr/keys';
import { useTranslation } from '../i18n';
import { getDateParts } from '../lib/calendar/format';
import { useIsTabletUp } from '../lib/useMediaQuery';
import { AlertCircle } from 'lucide-react';

import { hostDataCache } from '../lib/nostr/cache';

const BOOKING_FORM_ID = 'booking-form';

export interface BookingPageProps {
  identifier?: string;
}

export const BookingPage: React.FC<BookingPageProps> = ({ identifier }) => {
  const { t, locale } = useTranslation();
  const isTabletUp = useIsTabletUp();

  const hostIdentifier = useMemo(() => {
    const raw = identifier || APP_CONFIG.defaultHostNip05;
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }, [identifier]);

  // Resolve cached initial host data synchronously for instant 0ms hydration
  const initialData = useMemo(() => {
    let pubkey: string | null = null;
    const normalizedIdentifier = hostIdentifier.trim().toLowerCase();

    // Check if hex or npub
    if (!normalizedIdentifier.includes('@') && !normalizedIdentifier.includes('.')) {
      try {
        pubkey = decodeKeyToHex(normalizedIdentifier);
      } catch {
        pubkey = null;
      }
    }

    // Check cached NIP-05
    if (!pubkey) {
      const cachedNip05 = hostDataCache.getCachedNip05(normalizedIdentifier);
      if (cachedNip05) {
        pubkey = cachedNip05.pubkey;
      }
    }

    // Default master host fallback
    if (!pubkey && (
      normalizedIdentifier === APP_CONFIG.defaultHostNip05.toLowerCase() ||
      normalizedIdentifier === 'delirehberi' ||
      normalizedIdentifier === 'delirehberi@emre.xyz'
    )) {
      pubkey = APP_CONFIG.defaultHostPubkey;
    }

    const profile = pubkey ? hostDataCache.getCachedProfile(pubkey) : null;
    const relays = pubkey ? hostDataCache.getCachedRelays(pubkey) : null;

    return {
      pubkey,
      profile,
      relays: relays ? relays.all : Array.from(APP_CONFIG.defaultRelays),
      hasCachedData: Boolean(pubkey && profile),
    };
  }, [hostIdentifier]);

  const [hostPubkey, setHostPubkey] = useState<string | null>(initialData.pubkey);
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(initialData.profile);
  const [hostRelays, setHostRelays] = useState<string[]>(initialData.relays);
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);
  const [isLoadingHost, setIsLoadingHost] = useState(!initialData.hasCachedData);
  const [hostError, setHostError] = useState<string | null>(null);

  const [selectedDuration, setSelectedDuration] = useState<number>(APP_CONFIG.defaultDurationMinutes);

  const initialDate = useMemo(() => formatDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getUTCMonth() + 1);

  const [selectedSlotStart, setSelectedSlotStart] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userPickedDate = useRef(false);

  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // Attendee's chosen viewing timezone (defaults to browser local or UTC)
  const [attendeeTimezone, setAttendeeTimezone] = useState<string>(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return detected || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  // Availability the host published to relays (NIP-78); preferred over the local copy
  const [publishedHours, setPublishedHours] = useState<WorkingHoursConfig | null>(null);

  const workingHours: WorkingHoursConfig = useMemo(() => {
    return publishedHours ?? getHostWorkingHours(hostPubkey || undefined);
  }, [publishedHours, hostPubkey]);

  const offeredDurations = workingHours.durations;
  const durationOptions = offeredDurations ?? APP_CONFIG.allowedDurationsMinutes;
  const extendedDurationOptions = offeredDurations ? [] : APP_CONFIG.extendedDurationsMinutes;

  useEffect(() => {
    const available = [...durationOptions, ...extendedDurationOptions];
    if (!available.includes(selectedDuration)) {
      const preferred = workingHours.defaultDuration;
      setSelectedDuration(
        preferred && available.includes(preferred) ? preferred : (available[0] ?? APP_CONFIG.defaultDurationMinutes)
      );
    }
  }, [durationOptions, extendedDurationOptions, selectedDuration, workingHours.defaultDuration]);

  // Resolve host identifier to pubkey & load profile + busy intervals
  useEffect(() => {
    let isCancelled = false;

    const resolveHost = async () => {
      if (!initialData.hasCachedData) {
        setIsLoadingHost(true);
      }
      setHostError(null);

      try {
        let pubkey: string | null = null;

        if (hostIdentifier.includes('@') || hostIdentifier.includes('.')) {
          // Attempt NIP-05 query (cached with stale-while-revalidate)
          pubkey = await queryNip05Pubkey(hostIdentifier);
        } else {
          // Attempt npub or hex decode
          try {
            pubkey = decodeKeyToHex(hostIdentifier);
          } catch {
            pubkey = null;
          }
        }

        if (!pubkey) {
          throw new Error(`Host "${hostIdentifier}" could not be resolved.`);
        }

        if (isCancelled) return;
        setHostPubkey(pubkey);

        // Fetch relays and profile
        const [relayList, profile] = await Promise.all([
          nostrPool.fetchHostRelays(pubkey).catch(() => ({
            all: Array.from(APP_CONFIG.defaultRelays),
            read: Array.from(APP_CONFIG.defaultRelays),
            write: Array.from(APP_CONFIG.defaultRelays),
          })),
          nostrPool.fetchHostProfile(pubkey).catch(() => null),
        ]);

        if (isCancelled) return;
        setHostRelays(relayList.all);
        if (profile) {
          setHostProfile(profile);
        }

        const availability = await nostrPool.fetchHostAvailability(pubkey, relayList.read);
        if (isCancelled) return;
        if (availability) {
          setPublishedHours(availability);
        }

        // Fetch Kind 31923 calendar events and Kind 31925 RSVPs
        const { timeEvents } = await nostrPool.fetchCalendarEvents(pubkey, {
          relays: relayList.read,
        });

        const eventCoordinates = timeEvents.map((e) => e.coordinate);
        const rsvps = await nostrPool.fetchCalendarRSVPs(eventCoordinates, relayList.read);

        if (isCancelled) return;
        const intervals = extractBusyIntervals(timeEvents, rsvps, pubkey);
        setBusyIntervals(intervals);
      } catch (err) {
        if (!isCancelled) {
          // If we already had cached data, do not break the page with an error
          if (!initialData.hasCachedData) {
            setHostError(err instanceof Error ? err.message : String(err));
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingHost(false);
        }
      }
    };

    resolveHost();

    return () => {
      isCancelled = true;
    };
  }, [hostIdentifier, initialData.hasCachedData]);

  // Compute month availability
  const availabilitySummaries = useMemo(() => {
    try {
      return generateMonthAvailability({
        year: currentYear,
        month: currentMonth,
        durationMinutes: selectedDuration,
        workingHours,
        busyIntervals,
        attendeeTimezone,
      });
    } catch {
      return [];
    }
  }, [currentYear, currentMonth, selectedDuration, workingHours, busyIntervals, attendeeTimezone]);

  // Compute daily time slots for selected date
  const dailySlots = useMemo(() => {
    try {
      return generateDailyTimeSlots({
        date: selectedDate,
        durationMinutes: selectedDuration,
        workingHours,
        busyIntervals,
        attendeeTimezone,
      });
    } catch {
      return [];
    }
  }, [selectedDate, selectedDuration, workingHours, busyIntervals, attendeeTimezone]);

  // The chosen slot is looked up by its start time, so it follows time zone changes.
  const selectedSlot = useMemo(
    () => dailySlots.find((slot) => slot.available && slot.start === selectedSlotStart) ?? null,
    [dailySlots, selectedSlotStart]
  );

  // Until the visitor picks a day, show the first day that has open time.
  useEffect(() => {
    if (userPickedDate.current || isLoadingHost) return;
    const current = availabilitySummaries.find((summary) => summary.date === selectedDate);
    if (!current || current.hasAvailableSlots) return;
    const todayKey = formatDateKey(new Date());
    const first = availabilitySummaries.find((summary) => summary.hasAvailableSlots && summary.date >= todayKey);
    if (first) setSelectedDate(first.date);
  }, [availabilitySummaries, selectedDate, isLoadingHost]);

  // The details form opens on its first field.
  useEffect(() => {
    if (!formOpen) return;
    document.getElementById(BOOKING_FORM_ID)?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [formOpen]);

  const clearSelection = () => {
    setSelectedSlotStart(null);
    setFormOpen(false);
  };

  const handleSelectDuration = (duration: number) => {
    setSelectedDuration(duration);
    clearSelection();
  };

  const handleSelectDate = (dateKey: string) => {
    userPickedDate.current = true;
    setSelectedDate(dateKey);
    clearSelection();
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // From tablet width the form opens as soon as a time is chosen; on phones the action bar's "Continue" opens it.
  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlotStart(slot.start);
    setFormOpen(isTabletUp);
  };

  const handleBookAnother = () => {
    setBookingResult(null);
    clearSelection();
  };

  if (hostError) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-ink">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="font-display text-heading-l font-bold text-ink">{t('errors.hostNotFound')}</h1>
        <p role="alert" className="font-sans text-ui text-muted">
          {hostError}
        </p>
      </div>
    );
  }

  const slotParts = selectedSlot ? getDateParts(selectedDate, locale) : null;
  const durationLabel = t('booking.duration.minutes', { minutes: selectedDuration });

  const step3 = bookingResult ? (
    <BookingSuccess
      eventTitle={bookingResult.eventTitle}
      hostName={hostProfile?.displayName || hostIdentifier}
      hostPubkey={hostPubkey || ''}
      hostNip05={hostProfile?.nip05 || hostIdentifier}
      start={bookingResult.start}
      end={bookingResult.end}
      formattedDate={bookingResult.formattedDate}
      formattedStartTime={bookingResult.formattedStartTime}
      formattedEndTime={bookingResult.formattedEndTime}
      attendeeTimezone={bookingResult.attendeeTimezone}
      naddr={bookingResult.naddr}
      guestKeys={bookingResult.guestKeys}
      onBookAnother={handleBookAnother}
    />
  ) : selectedSlot && formOpen ? (
    <BookingForm
      hostPubkey={hostPubkey || ''}
      hostProfile={hostProfile}
      hostNip05={hostProfile?.nip05 || hostIdentifier}
      hostTimezone={workingHours.timezone}
      hostRelays={hostRelays}
      selectedSlot={selectedSlot}
      selectedDuration={selectedDuration}
      selectedDate={selectedDate}
      attendeeTimezone={attendeeTimezone}
      onTimezoneChange={setAttendeeTimezone}
      onSuccess={setBookingResult}
      onChangeSlot={() => setFormOpen(false)}
      formId={BOOKING_FORM_ID}
      onSubmittingChange={setIsSubmitting}
    />
  ) : (
    <TimeSlotGrid
      slots={dailySlots}
      selectedSlot={selectedSlot}
      onSelectSlot={handleSelectSlot}
      attendeeTimezone={attendeeTimezone}
      hostTimezone={workingHours.timezone}
      onTimezoneChange={setAttendeeTimezone}
      selectedDate={selectedDate}
      durationMinutes={selectedDuration}
      isLoading={isLoadingHost}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-8 tablet:px-8 tablet:pt-12 tablet:pb-[72px] desktop:px-20">
      <div className="flex flex-col gap-5 tablet:gap-8">
        <header className="flex flex-col gap-2.5">
          <p className="font-mono text-label leading-ui font-medium tracking-[0.08em] text-muted uppercase">
            {t('booking.intro.eyebrow')}
          </p>
          <h1 className="font-display text-display-s font-extrabold text-ink tablet:text-display-l desktop:text-display-m">
            {t('booking.intro.title')}
          </h1>
          <p className="font-sans text-body text-muted tablet:text-lead">{t('booking.intro.subtitle')}</p>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 tablet:grid-cols-2 tablet:grid-rows-[auto_auto_1fr] tablet:gap-6 desktop:grid-cols-[320px_456px_minmax(0,1fr)] desktop:grid-rows-[auto_1fr]">
          <div className="tablet:col-start-1 tablet:row-start-1">
            <HostCard
              profile={hostProfile}
              nip05Identifier={hostIdentifier}
              timezone={workingHours.timezone}
              isLoading={isLoadingHost}
            />
          </div>

          <div className="tablet:col-start-1 tablet:row-start-2">
            <DurationPicker
              durations={durationOptions}
              extendedDurations={extendedDurationOptions}
              selectedDuration={selectedDuration}
              onSelectDuration={handleSelectDuration}
            />
          </div>

          <div className="tablet:col-start-1 tablet:row-start-3 desktop:col-start-2 desktop:row-span-2 desktop:row-start-1">
            <DatePicker
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              availabilitySummaries={availabilitySummaries}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
            />
          </div>

          <div className="tablet:col-start-2 tablet:row-span-3 tablet:row-start-1 desktop:col-start-3 desktop:row-span-2">
            {step3}
          </div>
        </div>
      </div>

      {!bookingResult && selectedSlot && slotParts && (
        <StickyActionBar
          summary={t('booking.stickyBar.summary', { dayMonth: slotParts.dayMonth, start: selectedSlot.formattedStartTime })}
          meta={t('booking.stickyBar.meta', { duration: durationLabel, timezone: attendeeTimezone })}
          actionLabel={formOpen ? t('booking.form.submit') : t('booking.stickyBar.continue')}
          onAction={() => setFormOpen(true)}
          form={formOpen ? BOOKING_FORM_ID : undefined}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};
