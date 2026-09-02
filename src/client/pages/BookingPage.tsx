import React, { useState, useEffect, useMemo } from 'react';
import { HostCard } from '../components/booking/HostCard';
import { DurationPicker } from '../components/booking/DurationPicker';
import { DatePicker } from '../components/booking/DatePicker';
import { TimeSlotGrid } from '../components/booking/TimeSlotGrid';
import { BookingForm } from '../components/booking/BookingForm';
import { BookingSuccess } from '../components/booking/BookingSuccess';
import { NostrEduBanner } from '../components/booking/NostrEduBanner';
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
import { AlertCircle } from 'lucide-react';

import { hostDataCache } from '../lib/nostr/cache';

export interface BookingPageProps {
  identifier?: string;
}

export const BookingPage: React.FC<BookingPageProps> = ({ identifier }) => {
  const { t } = useTranslation();

  const hostIdentifier = identifier || APP_CONFIG.defaultHostNip05;

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

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [bookingResult, setBookingResult] = useState<{
    eventTitle: string;
    start: number;
    end: number;
    formattedDate: string;
    formattedStartTime: string;
    formattedEndTime: string;
    attendeeTimezone: string;
    naddr: string;
    guestKeys?: { nsec: string; npub: string } | null;
  } | null>(null);

  // Attendee's chosen viewing timezone (defaults to browser local or UTC)
  const [attendeeTimezone, setAttendeeTimezone] = useState<string>(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return detected || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  const workingHours: WorkingHoursConfig = useMemo(() => {
    return getHostWorkingHours(hostPubkey || undefined);
  }, [hostPubkey]);

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

  const handleSelectDuration = (duration: number) => {
    setSelectedDuration(duration);
    setSelectedSlot(null);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleCancelSlotSelection = () => {
    setSelectedSlot(null);
  };

  const handleBookAnother = () => {
    setBookingResult(null);
    setSelectedSlot(null);
  };

  if (hostError) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center space-y-4 px-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          {t('errors.hostNotFound')}
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">{hostError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Host Profile, Duration & Date Picker */}
        <div className="lg:col-span-5 space-y-5">
          <HostCard
            profile={hostProfile}
            nip05Identifier={hostIdentifier}
            timezone={workingHours.timezone}
            isLoading={isLoadingHost}
          />

          <DurationPicker
            durations={APP_CONFIG.allowedDurationsMinutes}
            selectedDuration={selectedDuration}
            onSelectDuration={handleSelectDuration}
          />

          <DatePicker
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            availabilitySummaries={availabilitySummaries}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* Right Column: Time Slot Selection / Booking Form / Success Confirmation */}
        <div className="lg:col-span-7 space-y-5">
          {bookingResult ? (
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
          ) : selectedSlot ? (
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
              onSuccess={(result) => setBookingResult(result)}
              onCancel={handleCancelSlotSelection}
            />
          ) : (
            <TimeSlotGrid
              slots={dailySlots}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              attendeeTimezone={attendeeTimezone}
              onTimezoneChange={setAttendeeTimezone}
              selectedDate={selectedDate}
              isLoading={isLoadingHost}
            />
          )}

          <NostrEduBanner />
        </div>
      </div>
    </div>
  );
};
