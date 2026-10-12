import React, { useState } from 'react';
import { User, Mail, Calendar, Clock, ArrowLeft, Send, Key } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import type { TimeSlot } from '../../lib/calendar/slots';
import type { HostProfile } from '../../lib/nostr/relays';
import { nostrPool } from '../../lib/nostr/relays';
import { createTimeCalendarEventTemplate } from '../../lib/nostr/nip52';
import { encodeNaddr } from '../../lib/nostr/keys';
import { APP_CONFIG } from '../../../config';

import { generateICS } from '../../lib/calendar/ics';
import { encryptBookingDetails } from '../../lib/nostr/encryption';

export interface BookingFormProps {
  hostPubkey: string;
  hostProfile: HostProfile | null;
  hostNip05?: string;
  hostTimezone: string;
  hostRelays: string[];
  selectedSlot: TimeSlot;
  selectedDuration: number;
  selectedDate: string;
  attendeeTimezone: string;
  onSuccess: (result: {
    eventTitle: string;
    start: number;
    end: number;
    formattedDate: string;
    formattedStartTime: string;
    formattedEndTime: string;
    attendeeTimezone: string;
    naddr: string;
    guestKeys?: { nsec: string; npub: string } | null;
  }) => void;
  onCancel: () => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  hostPubkey,
  hostProfile,
  hostNip05,
  hostTimezone,
  hostRelays,
  selectedSlot,
  selectedDuration,
  selectedDate,
  attendeeTimezone,
  onSuccess,
  onCancel,
}) => {
  const { t, locale } = useTranslation();
  const { user, signer, isLoggedIn, loginAsGuest } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hostDisplayName =
    hostProfile?.displayName || hostProfile?.name || hostNip05 || 'Host';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let activeSigner = signer;
      let guestCredentials: { nsec: string; npub: string } | null = null;
      let attendeePubkey = user?.pubkey;

      // If user is not logged in with Nostr, auto-generate ephemeral guest key
      if (!activeSigner || !attendeePubkey) {
        const guest = loginAsGuest();
        activeSigner = guest.signer;
        attendeePubkey = await activeSigner.getPublicKey();
        guestCredentials = {
          nsec: guest.nsec,
          npub: guest.npub,
        };
      }

      const eventIdentifier = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const publicTitle = `Appointment (${selectedDuration} min)`;
      const emailTitle = `Appointment: ${hostDisplayName} & ${name.trim()}`;

      // Encrypt sensitive attendee details (name, meeting notes, contact email) for the host
      let encryptedContent = '';
      try {
        encryptedContent = await encryptBookingDetails(activeSigner, hostPubkey, {
          name: name.trim(),
          notes: notes.trim() || undefined,
          email: email.trim() || undefined,
        });
      } catch {
        // Fallback to JSON payload if signer doesn't support encryption
        encryptedContent = JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || undefined,
          email: email.trim() || undefined,
        });
      }

      // 1. Construct Kind 31923 Time-Based Event Template with encrypted content
      const eventTemplate = createTimeCalendarEventTemplate({
        identifier: eventIdentifier,
        title: publicTitle,
        summary: `Scheduled appointment (${selectedDuration} min)`,
        content: encryptedContent,
        start: selectedSlot.start,
        end: selectedSlot.end,
        startTzid: hostTimezone,
        endTzid: hostTimezone,
        location: 'Online Nostr Meeting',
        attendees: [
          { pubkey: attendeePubkey, role: 'attendee' },
          { pubkey: hostPubkey, role: 'host' },
        ],
      });

      // 2. Sign Event
      const signedEvent = await activeSigner.signEvent(eventTemplate);

      // 3. Encode naddr coordinate
      const targetRelays = hostRelays.length > 0 ? hostRelays : Array.from(APP_CONFIG.defaultRelays);
      const naddr = encodeNaddr({
        identifier: eventIdentifier,
        pubkey: signedEvent.pubkey,
        kind: 31923,
        relays: targetRelays.slice(0, 3),
      });

      // 4. Publish Event to relays in parallel
      await nostrPool.publishEvent(targetRelays, signedEvent);

      // 5. Send confirmation email if email provided
      if (email.trim()) {
        try {
          const icsContent = generateICS({
            uid: `cal-${eventIdentifier}@cal.emre.xyz`,
            title: emailTitle,
            description: notes.trim() || undefined,
            location: 'Online Nostr Meeting',
            start: selectedSlot.start,
            end: selectedSlot.end,
            url: `https://cal.emre.xyz/e/${naddr}`,
            organizer: {
              name: hostDisplayName,
              email: APP_CONFIG.adminEmail || APP_CONFIG.supportEmail,
              pubkey: hostPubkey,
            },
            attendee: {
              name: name.trim(),
              email: email.trim(),
              pubkey: attendeePubkey,
            },
            status: 'CONFIRMED',
          });

          await fetch('/api/email/booking-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email.trim(),
              hostName: hostDisplayName,
              hostPubkey,
              hostEmail: APP_CONFIG.adminEmail || APP_CONFIG.supportEmail,
              attendeeName: name.trim(),
              attendeePubkey,
              attendeeNsec: guestCredentials?.nsec,
              eventTitle: emailTitle,
              eventDescription: notes.trim() || undefined,
              startTime: selectedSlot.start,
              endTime: selectedSlot.end,
              timezone: attendeeTimezone,
              location: 'Online Nostr Meeting',
              icsContent,
              language: locale === 'tr' ? 'tr' : 'en',
            }),
          });
        } catch {
          // Email dispatch error should not block successful booking UX
        }
      }

      // 6. Complete flow
      onSuccess({
        eventTitle: emailTitle,
        start: selectedSlot.start,
        end: selectedSlot.end,
        formattedDate: selectedDate,
        formattedStartTime: selectedSlot.formattedStartTime,
        formattedEndTime: selectedSlot.formattedEndTime,
        attendeeTimezone,
        naddr,
        guestKeys: guestCredentials,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="space-y-5">
      {/* Selected Slot Recap */}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 dark:border-stone-800 dark:bg-stone-900/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
            <Calendar className="h-4 w-4 text-stone-500" />
            <span>{selectedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
            <Clock className="h-4 w-4 text-stone-500" />
            <span>
              {selectedSlot.formattedStartTime} - {selectedSlot.formattedEndTime} ({attendeeTimezone})
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Change slot"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          {errorMessage}
        </div>
      )}

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('booking.form.nameLabel')}
          placeholder={t('booking.form.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSubmitting}
          leftIcon={<User className="h-4 w-4" />}
          autoFocus
        />

        <Input
          type="email"
          label={t('booking.form.emailLabel')}
          placeholder={t('booking.form.emailPlaceholder')}
          helperText={t('booking.form.emailHint')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          leftIcon={<Mail className="h-4 w-4" />}
        />

        <TextArea
          label={t('booking.form.notesLabel')}
          placeholder={t('booking.form.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
          rows={3}
        />

        {!isLoggedIn && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <Key className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Nostr Sovereign Identity</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pl-6">
              {t('booking.form.guestNotice')}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            isLoading={isSubmitting}
            disabled={!name.trim()}
            rightIcon={<Send className="h-4 w-4" />}
          >
            {isSubmitting
              ? t('booking.form.submitting')
              : t('booking.form.submitButton')}
          </Button>
        </div>
      </form>
    </Card>
  );
};
