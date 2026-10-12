import React, { useState } from 'react';
import { AlertCircle, Eye, Lock, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { StepCard } from './StepCard';
import { TimezoneSelect } from './TimeSlotGrid';
import { NostrEduBanner } from './NostrEduBanner';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import type { TimeSlot } from '../../lib/calendar/slots';
import { getDateParts } from '../../lib/calendar/format';
import type { HostProfile } from '../../lib/nostr/relays';
import { nostrPool, type PublishResult } from '../../lib/nostr/relays';
import { pickRelayHints } from '../../lib/nostr/nip65';
import type { Event } from 'nostr-tools';
import { createTimeCalendarEventTemplate } from '../../lib/nostr/nip52';
import { encodeNaddr } from '../../lib/nostr/keys';
import { APP_CONFIG } from '../../../config';
import { generateICS } from '../../lib/calendar/ics';
import { buildPublicBookingContent, encryptBookingForRecipients } from '../../lib/nostr/encryption';
import {
  parseParticipant,
  participantEmails,
  participantPubkeys,
  type Participant,
  type ParticipantError,
} from '../../lib/booking/participants';

export type BookingPrivacy = 'encrypted' | 'public';

export interface BookingResult {
  eventTitle: string;
  start: number;
  end: number;
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  attendeeTimezone: string;
  naddr: string;
  guestKeys?: { nsec: string; npub: string } | null;
  /** The signed event, kept so the success view can re-broadcast it. */
  signedEvent: Event;
  /** Per-relay outcome of the first publish. */
  publishResults: PublishResult[];
}

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
  onTimezoneChange: (timezone: string) => void;
  onSuccess: (result: BookingResult) => void;
  /** "Change": back to the list of times. */
  onChangeSlot: () => void;
  /** Id of the `<form>`, so a button outside it (the mobile action bar) can submit it. */
  formId?: string;
  /** Reports whether a submission is in flight. */
  onSubmittingChange?: (submitting: boolean) => void;
}

const PRIVACY_OPTIONS: ReadonlyArray<{ value: BookingPrivacy; icon: typeof Lock; title: string; hint: string }> = [
  { value: 'encrypted', icon: Lock, title: 'booking.form.encryptedTitle', hint: 'booking.form.encryptedHint' },
  { value: 'public', icon: Eye, title: 'booking.form.publicTitle', hint: 'booking.form.publicHint' },
];

/** Step 3 once a time is chosen: the booking details, in place of the list of times. */
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
  onTimezoneChange,
  onSuccess,
  onChangeSlot,
  formId = 'booking-form',
  onSubmittingChange,
}) => {
  const { t, locale } = useTranslation();
  const { user, signer, isLoggedIn, loginAsGuest } = useAuth();

  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState<BookingPrivacy>('encrypted');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [participantError, setParticipantError] = useState<ParticipantError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hostDisplayName = hostProfile?.displayName || hostProfile?.name || hostNip05 || 'Host';
  const { weekday, dayMonth } = getDateParts(selectedDate, locale);
  const participantErrorText =
    participantError === 'duplicate'
      ? t('booking.form.participantDuplicate')
      : participantError
        ? t('booking.form.participantInvalid')
        : undefined;

  const setSubmitting = (value: boolean) => {
    setIsSubmitting(value);
    onSubmittingChange?.(value);
  };

  const addParticipant = (): Participant[] | null => {
    if (!participantInput.trim()) return participants;
    const result = parseParticipant(participantInput, participants);
    if (!result.ok) {
      setParticipantError(result.error);
      return null;
    }
    const next = [...participants, result.participant];
    setParticipants(next);
    setParticipantInput('');
    setParticipantError(null);
    return next;
  };

  const sendConfirmation = async (params: {
    to: string;
    recipientName: string;
    recipientPubkey?: string;
    recipientNsec?: string;
    eventTitle: string;
    eventIdentifier: string;
    naddr: string;
    description?: string;
  }) => {
    const icsContent = generateICS({
      uid: `cal-${params.eventIdentifier}@cal.emre.xyz`,
      title: params.eventTitle,
      description: params.description,
      location: 'Online Nostr Meeting',
      start: selectedSlot.start,
      end: selectedSlot.end,
      url: `https://cal.emre.xyz/e/${params.naddr}`,
      organizer: {
        name: hostDisplayName,
        email: APP_CONFIG.adminEmail || APP_CONFIG.supportEmail,
        pubkey: hostPubkey,
      },
      attendee: { name: params.recipientName, email: params.to, pubkey: params.recipientPubkey },
      status: 'CONFIRMED',
    });

    await fetch('/api/email/booking-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: params.to,
        hostName: hostDisplayName,
        hostPubkey,
        hostEmail: APP_CONFIG.adminEmail || APP_CONFIG.supportEmail,
        attendeeName: params.recipientName,
        attendeePubkey: params.recipientPubkey,
        attendeeNsec: params.recipientNsec,
        eventTitle: params.eventTitle,
        eventDescription: params.description,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        timezone: attendeeTimezone,
        location: 'Online Nostr Meeting',
        icsContent,
        language: locale === 'tr' ? 'tr' : 'en',
      }),
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || isSubmitting) return;

    const invited = addParticipant();
    if (!invited) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let activeSigner = signer;
      let guestCredentials: { nsec: string; npub: string } | null = null;
      let attendeePubkey = user?.pubkey;
      // A freshly generated guest key has no relay list to look up.
      let hasPublishedRelayList = true;

      // Visitors without a Nostr identity get an ephemeral guest key.
      if (!activeSigner || !attendeePubkey) {
        const guest = loginAsGuest();
        activeSigner = guest.signer;
        attendeePubkey = await activeSigner.getPublicKey();
        hasPublishedRelayList = false;
        guestCredentials = { nsec: guest.nsec, npub: guest.npub };
      }

      const eventIdentifier = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const typedTitle = title.trim();
      const fallbackTitle = t('booking.form.titleFallback', { minutes: selectedDuration });
      const emailTitle = typedTitle || `${hostDisplayName} & ${name.trim()}`;
      const details = {
        name: name.trim(),
        notes: notes.trim() || undefined,
        email: email.trim() || undefined,
        title: typedTitle || undefined,
        participants: invited.map((entry) => entry.label),
      };

      // Encrypted bookings keep the typed title inside the ciphertext; public ones publish it.
      let content: string;
      let extraTags: string[][] = [];
      if (privacy === 'encrypted') {
        const envelope = await encryptBookingForRecipients(activeSigner, hostPubkey, participantPubkeys(invited), details);
        content = envelope.content;
        extraTags = envelope.tags;
      } else {
        content = buildPublicBookingContent(details);
      }

      const eventTemplate = createTimeCalendarEventTemplate({
        identifier: eventIdentifier,
        title: privacy === 'public' && typedTitle ? typedTitle : fallbackTitle,
        summary: `Scheduled appointment (${selectedDuration} min)`,
        content,
        extraTags,
        start: selectedSlot.start,
        end: selectedSlot.end,
        startTzid: hostTimezone,
        endTzid: hostTimezone,
        location: 'Online Nostr Meeting',
        attendees: [
          { pubkey: attendeePubkey, role: 'attendee' },
          { pubkey: hostPubkey, role: 'host', relay: hostRelays[0] },
          ...participantPubkeys(invited).map((pubkey) => ({ pubkey, role: 'attendee' as const })),
        ],
      });

      const signedEvent = await activeSigner.signEvent(eventTemplate);

      // Host relays + the booker's relays + invited participants' relays + app defaults.
      const targets = await nostrPool.resolvePublishTargets({
        hostRelays,
        creatorPubkey: hasPublishedRelayList ? attendeePubkey : undefined,
        attendeePubkeys: participantPubkeys(invited),
      });
      const naddr = encodeNaddr({
        identifier: eventIdentifier,
        pubkey: signedEvent.pubkey,
        kind: 31923,
        relays: pickRelayHints(targets),
      });

      const publishResults = await nostrPool.publishToTargets(targets, signedEvent);
      if (!publishResults.some((result) => result.success)) {
        throw new Error(t('relayReport.allFailed'));
      }

      // Confirmation e-mails never block a booking that is already published.
      const recipients: Array<{ to: string; recipientName: string; own: boolean }> = [
        ...(email.trim() ? [{ to: email.trim(), recipientName: name.trim(), own: true }] : []),
        ...participantEmails(invited).map((to) => ({ to, recipientName: to.split('@')[0], own: false })),
      ];
      await Promise.allSettled(
        recipients.map((recipient) =>
          sendConfirmation({
            to: recipient.to,
            recipientName: recipient.recipientName,
            recipientPubkey: recipient.own ? attendeePubkey : undefined,
            recipientNsec: recipient.own ? guestCredentials?.nsec : undefined,
            eventTitle: emailTitle,
            eventIdentifier,
            naddr,
            description: notes.trim() || undefined,
          })
        )
      );

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
        signedEvent,
        publishResults,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepCard step={3} title={t('booking.steps.details')}>
      <TimezoneSelect value={attendeeTimezone} hostTimezone={hostTimezone} onChange={onTimezoneChange} />

      <div className="flex items-center gap-2.5 rounded-button border border-slot bg-slot-soft px-3.5 py-3">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-slot" />
        <p className="min-w-0 flex-1 font-mono text-caption leading-ui font-medium text-ink">
          {t('booking.form.selectedTime', {
            weekday,
            dayMonth,
            start: selectedSlot.formattedStartTime,
            end: selectedSlot.formattedEndTime,
          })}
        </p>
        <button
          type="button"
          onClick={onChangeSlot}
          className="shrink-0 cursor-pointer rounded-control font-sans text-caption leading-ui font-semibold text-ink hover:underline"
        >
          {t('booking.form.change')}
        </button>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-button border border-ink bg-paper p-3 font-sans text-caption leading-ui font-semibold text-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        <Input
          label={t('booking.form.titleLabel')}
          placeholder={t('booking.form.titlePlaceholder')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSubmitting}
          maxLength={120}
          data-autofocus=""
        />

        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 block p-0 font-sans text-caption leading-ui font-medium text-muted">
            {t('booking.form.privacyLabel')}
          </legend>
          <div className="flex gap-2.5">
            {PRIVACY_OPTIONS.map(({ value, icon: Icon, title: titleKey, hint }) => (
              <label
                key={value}
                className={cn(
                  'relative flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-button border bg-card p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                  privacy === value ? 'border-ink ring-1 ring-ink ring-inset' : 'border-line hover:border-muted'
                )}
              >
                <input
                  type="radio"
                  name={`${formId}-privacy`}
                  value={value}
                  checked={privacy === value}
                  onChange={() => setPrivacy(value)}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <span className="flex items-center gap-1.5 font-sans text-ui leading-ui font-semibold text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {t(titleKey)}
                </span>
                <span className="font-sans text-small text-muted">{t(hint)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          label={t('booking.form.nameLabel')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={isSubmitting}
          autoComplete="name"
        />

        <Input
          type="email"
          label={t('booking.form.emailLabel')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          helperText={privacy === 'public' ? t('booking.form.emailPublicNote') : undefined}
          disabled={isSubmitting}
          autoComplete="email"
        />

        <TextArea
          label={t('booking.form.notesLabel')}
          placeholder={t('booking.form.notesPlaceholder')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSubmitting}
          rows={3}
        />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label={t('booking.form.participantsLabel')}
                placeholder={t('booking.form.participantsPlaceholder')}
                value={participantInput}
                onChange={(event) => {
                  setParticipantInput(event.target.value);
                  setParticipantError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addParticipant();
                  }
                }}
                error={participantErrorText}
                disabled={isSubmitting}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <Button
              variant="secondary"
              className="mt-[22px] shrink-0"
              onClick={() => addParticipant()}
              disabled={isSubmitting || !participantInput.trim()}
            >
              {t('booking.form.participantsAdd')}
            </Button>
          </div>

          {participants.length > 0 && (
            <ul aria-label={t('booking.form.participantsListLabel')} className="flex flex-wrap gap-2">
              {participants.map((participant) => (
                <li
                  key={participant.label}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-line bg-paper py-1 pr-1.5 pl-3 font-mono text-small text-ink"
                >
                  <span className="truncate">{participant.label}</span>
                  <button
                    type="button"
                    aria-label={t('booking.form.participantsRemove', { name: participant.label })}
                    onClick={() => setParticipants((current) => current.filter((entry) => entry.label !== participant.label))}
                    disabled={isSubmitting}
                    className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isLoggedIn && <NostrEduBanner />}

        <Button type="submit" className="hidden w-full tablet:inline-flex" isLoading={isSubmitting}>
          {isSubmitting ? t('booking.form.submitting') : t('booking.form.submit')}
        </Button>
      </form>
    </StepCard>
  );
};
