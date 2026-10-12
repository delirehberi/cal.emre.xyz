import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { hostHref } from '../lib/router';
import { Button } from '../components/ui/Button';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { decodeNaddr, encodeNpub, type NaddrParams } from '../lib/nostr/keys';
import { parseTimeCalendarEvent, createCalendarRSVPTemplate, type TimeCalendarEvent, type CalendarRSVP } from '../lib/nostr/nip52';
import { nostrPool, type HostProfile } from '../lib/nostr/relays';
import type { Event } from 'nostr-tools';
import { RelayReport } from '../components/ui/RelayReport';
import { formatSlotTime } from '../lib/calendar/slots';
import { generateICS, generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '../lib/calendar/ics';
import { decryptBookingDetails, isLikelyEncrypted, type EncryptedBookingPayload } from '../lib/nostr/encryption';
import { APP_CONFIG } from '../../config';
import { cn } from '../lib/cn';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Globe,
  Lock,
  Download,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCw,
  ExternalLink,
  Share2,
} from 'lucide-react';

export interface EventDetailsPageProps {
  naddr: string;
}

const INTL_LOCALE = { en: 'en-US', tr: 'tr-TR', es: 'es-ES' } as const;

const COPY_FEEDBACK_MS = 2000;
const DEFAULT_EVENT_SECONDS = 30 * 60;
const ICON = 'h-3.5 w-3.5';
const SECTION_TITLE = 'font-sans text-label leading-ui font-medium tracking-[0.08em] text-muted uppercase';
const LINK_BUTTON =
  'flex items-center justify-center gap-1.5 rounded-button border border-line bg-card px-3.5 py-2 font-sans text-caption leading-ui font-semibold text-ink transition-colors hover:border-muted';

export const EventDetailsPage: React.FC<EventDetailsPageProps> = ({ naddr }) => {
  const { t, locale } = useTranslation();
  const { user, signer, loginAsGuest } = useAuth();

  const [event, setEvent] = useState<TimeCalendarEvent | null>(null);
  const [signedEvent, setSignedEvent] = useState<Event | null>(null);
  const [, setRsvps] = useState<CalendarRSVP[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, HostProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [decrypted, setDecrypted] = useState<EncryptedBookingPayload | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [userRsvpStatus, setUserRsvpStatus] = useState<'accepted' | 'declined' | 'tentative' | null>(null);
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNpub, setCopiedNpub] = useState<string | null>(null);

  const viewerTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  // Decode naddr coordinate
  const decodedNaddr = useMemo<NaddrParams | null>(() => {
    try {
      return decodeNaddr(naddr);
    } catch {
      return null;
    }
  }, [naddr]);

  const fetchEventDetails = useCallback(async () => {
    if (!decodedNaddr) {
      setError(t('eventDetails.notFoundDesc'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const targetRelays = Array.from(
      new Set([...(decodedNaddr.relays || []), ...APP_CONFIG.defaultRelays])
    );
    const readRelays = nostrPool.getReadRelays(targetRelays);

    try {
      const pool = nostrPool.getPool();
      const rawEvent = await pool.get(readRelays, {
        kinds: [31923],
        authors: [decodedNaddr.pubkey],
        '#d': [decodedNaddr.identifier],
        limit: 1,
      });

      if (!rawEvent) {
        setError(t('eventDetails.notFoundDesc'));
        setIsLoading(false);
        return;
      }

      const parsed = parseTimeCalendarEvent(rawEvent);
      setEvent(parsed);
      setSignedEvent(rawEvent);

      // Fetch RSVPs
      const fetchedRsvps = await nostrPool.fetchCalendarRSVPs([parsed.coordinate], targetRelays);
      setRsvps(fetchedRsvps);

      // Check current user's RSVP if logged in
      if (user?.pubkey) {
        const myRsvp = fetchedRsvps.find(
          (r) => r.pubkey?.toLowerCase() === user.pubkey.toLowerCase()
        );
        if (myRsvp) {
          setUserRsvpStatus(myRsvp.status);
        }
      }

      // Fetch profiles for all attendees and event author
      const pubkeysToFetch = new Set<string>();
      if (parsed.pubkey) pubkeysToFetch.add(parsed.pubkey);
      for (const att of parsed.attendees) {
        if (att.pubkey) pubkeysToFetch.add(att.pubkey);
      }

      const profilePromises = Array.from(pubkeysToFetch).map(async (pk) => {
        try {
          const profile = await nostrPool.fetchHostProfile(pk, targetRelays);
          return profile ? { pubkey: pk, profile } : null;
        } catch {
          return null;
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const newMap: Record<string, HostProfile> = {};
      for (const res of profileResults) {
        if (res) newMap[res.pubkey] = res.profile;
      }
      setProfilesMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [decodedNaddr, user?.pubkey, t]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  const attemptedDecryptionRef = useRef(false);

  // Decryption handler for participants
  const handleDecrypt = useCallback(async (force = false) => {
    if (!signer?.decrypt || !event?.content || !event.pubkey) return;
    if (!force && attemptedDecryptionRef.current) return;
    attemptedDecryptionRef.current = true;

    // decryptBookingDetails also reads plain JSON payloads, so no separate check is needed.
    setIsDecrypting(true);
    try {
      const dec = await decryptBookingDetails(signer, event.pubkey, event.content);
      if (dec) {
        setDecrypted(dec);
      }
    } catch {
      // Decryption failed or not recipient
    } finally {
      setIsDecrypting(false);
    }
  }, [signer, event]);

  useEffect(() => {
    if (signer?.decrypt && event?.content && !decrypted && !attemptedDecryptionRef.current) {
      handleDecrypt();
    }
  }, [signer, event, decrypted, handleDecrypt]);

  const handleRsvp = async (status: 'accepted' | 'declined' | 'tentative') => {
    if (!event) return;

    setIsSubmittingRsvp(true);
    setRsvpMessage(null);

    try {
      let activeSigner = signer;
      let attendeePubkey = user?.pubkey;

      if (!activeSigner || !attendeePubkey) {
        const guest = loginAsGuest();
        activeSigner = guest.signer;
        attendeePubkey = await activeSigner.getPublicKey();
      }

      const template = createCalendarRSVPTemplate({
        eventCoordinate: event.coordinate,
        status,
        freeBusy: status === 'accepted' ? 'busy' : 'free',
        hostPubkey: event.pubkey,
      });

      const signedRsvp = await activeSigner.signEvent(template);
      const targetRelays = Array.from(
        new Set([...(decodedNaddr?.relays || []), ...APP_CONFIG.defaultRelays])
      );
      await nostrPool.publishEvent(targetRelays, signedRsvp);

      setUserRsvpStatus(status);
      setRsvpMessage(t('eventDetails.rsvpSubmitted'));
    } catch (err) {
      setRsvpMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : `https://cal.emre.xyz/e/${naddr}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), COPY_FEEDBACK_MS);
    } catch {
      setRsvpMessage(t('errors.generic'));
    }
  };

  const handleCopyNpub = async (pubkey: string) => {
    try {
      await navigator.clipboard.writeText(encodeNpub(pubkey));
      setCopiedNpub(pubkey);
      setTimeout(() => setCopiedNpub(null), COPY_FEEDBACK_MS);
    } catch {
      setRsvpMessage(t('errors.generic'));
    }
  };

  const handleDownloadIcs = () => {
    if (!event) return;
    const end = event.end && event.end > event.start ? event.end : event.start + DEFAULT_EVENT_SECONDS;
    const icsString = generateICS({
      title: event.title,
      description: decrypted?.notes || event.description || event.summary || '',
      location: event.location || 'Online Nostr Meeting',
      start: event.start,
      end,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      status: 'CONFIRMED',
    });

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `event-${event.start}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center" aria-busy="true">
        <RotateCw aria-hidden="true" className="h-8 w-8 animate-spin text-muted" />
        <p className="font-sans text-ui leading-ui text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-ink">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h2 className="font-display text-heading-l font-bold text-ink">{t('eventDetails.notFound')}</h2>
        <p role="alert" className="font-sans text-ui leading-ui text-muted">
          {error || t('eventDetails.notFoundDesc')}
        </p>
        <a href={hostHref()} className={LINK_BUTTON}>
          {t('common.back')}
        </a>
      </div>
    );
  }

  const end = event.end && event.end > event.start ? event.end : event.start + DEFAULT_EVENT_SECONDS;
  const durationMinutes = Math.round((end - event.start) / 60);
  const intlLocale = INTL_LOCALE[locale];

  const dateStr = new Date(event.start * 1000).toLocaleDateString(intlLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: viewerTimezone,
  });

  const startTimeStr = formatSlotTime(event.start, viewerTimezone, intlLocale, true);
  const endTimeStr = formatSlotTime(end, viewerTimezone, intlLocale, true);

  const hasEncryptedContent = isLikelyEncrypted(event.content);
  const isPublic = event.visibility === 'public' || (!hasEncryptedContent && Boolean(event.content));

  const hostProfile = event.pubkey ? profilesMap[event.pubkey] : undefined;
  const hostDisplayName =
    hostProfile?.displayName ||
    hostProfile?.name ||
    hostProfile?.nip05 ||
    (event.pubkey ? `${encodeNpub(event.pubkey).slice(0, 10)}...` : t('dashboard.hostFallback'));

  const notes = decrypted?.notes || event.description || event.summary || '';
  const googleUrl = generateGoogleCalendarUrl({ title: event.title, description: notes, start: event.start, end });
  const outlookUrl = generateOutlookCalendarUrl({ title: event.title, description: notes, start: event.start, end });

  const rsvpStatusLabel: Record<'accepted' | 'declined' | 'tentative', string> = {
    accepted: t('dashboard.appointments.statusAccepted'),
    declined: t('dashboard.appointments.statusDeclined'),
    tentative: t('dashboard.appointments.statusPending'),
  };

  const rsvpOptions: ReadonlyArray<{ status: 'accepted' | 'tentative' | 'declined'; label: string; icon: React.ReactNode }> = [
    { status: 'accepted', label: t('eventDetails.rsvpGoing'), icon: <CheckCircle aria-hidden="true" className={ICON} /> },
    { status: 'tentative', label: t('eventDetails.rsvpMaybe'), icon: <Clock aria-hidden="true" className={ICON} /> },
    { status: 'declined', label: t('eventDetails.rsvpNotGoing'), icon: <XCircle aria-hidden="true" className={ICON} /> },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 tablet:px-8 tablet:py-10">
      <Card className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-line px-2.5 py-1 font-sans text-small leading-ui font-semibold text-ink">
                {isPublic ? <Globe aria-hidden="true" className="h-3 w-3" /> : <Lock aria-hidden="true" className="h-3 w-3" />}
                {isPublic ? t('eventDetails.publicBadge') : t('eventDetails.privateBadge')}
              </span>
              {decrypted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-line px-2.5 py-1 font-sans text-small leading-ui font-semibold text-ink">
                  <Lock aria-hidden="true" className="h-3 w-3" />
                  {t('eventDetails.decryptedBadge')}
                </span>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleCopyLink()}
              leftIcon={copiedLink ? <Check aria-hidden="true" className={ICON} /> : <Share2 aria-hidden="true" className={ICON} />}
            >
              {copiedLink ? t('eventDetails.inviteCopied') : t('eventDetails.copyInviteLink')}
            </Button>
          </div>

          <h1 className="font-display text-heading-xl font-bold text-ink">{event.title}</h1>

          <p className="font-sans text-caption leading-ui text-muted">
            {t('eventDetails.hostedBy')} <strong className="font-semibold text-ink">{hostDisplayName}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-button border border-line bg-paper p-4 font-sans text-caption leading-ui text-ink tablet:grid-cols-2">
          <div className="flex items-center gap-2.5">
            <Calendar aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="font-semibold">{dateStr}</div>
              <div className="text-muted">{t('booking.duration.minutes', { minutes: durationMinutes })}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="font-semibold">
                {startTimeStr} – {endTimeStr}
              </div>
              <div className="font-mono text-small text-muted">{viewerTimezone}</div>
            </div>
          </div>

          {event.location && (
            <div className="col-span-full flex items-center gap-2 border-t border-line pt-3">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
              <span className="flex-1 truncate font-mono text-small">{event.location}</span>
              {/^https?:\/\//i.test(event.location) && (
                <a
                  href={event.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-control font-semibold text-ink hover:underline"
                >
                  {t('dashboard.appointments.joinMeeting')}
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {(decrypted?.notes || event.description || (!hasEncryptedContent && event.content)) && (
          <div className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE}>{t('eventDetails.agenda')}</h2>
            <div className="rounded-button border border-line bg-paper p-4 font-sans text-ui leading-ui whitespace-pre-wrap text-ink">
              {decrypted?.notes || event.description || event.content}
            </div>
          </div>
        )}

        {hasEncryptedContent && !decrypted && (
          <div className="flex flex-col gap-2 rounded-button border border-line bg-paper p-4 font-sans text-caption leading-ui text-muted">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Lock aria-hidden="true" className="h-4 w-4 text-muted" />
              <span>{t('eventDetails.privateNotice')}</span>
            </div>
            {signer?.decrypt && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => void handleDecrypt(true)}
                isLoading={isDecrypting}
                leftIcon={<Lock aria-hidden="true" className={ICON} />}
              >
                {t('dashboard.appointments.decryptAction')}
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h2 className={cn(SECTION_TITLE, 'flex items-center gap-1.5')}>
            <Users aria-hidden="true" className="h-4 w-4" />
            {t('eventDetails.participants')} ({event.attendees.length})
          </h2>

          <ul className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
            {event.attendees.map((att) => {
              const pProfile = profilesMap[att.pubkey];
              const pName = pProfile?.displayName || pProfile?.name || pProfile?.nip05 || `${encodeNpub(att.pubkey).slice(0, 10)}...`;
              const isCoHost = att.role === 'host';

              return (
                <li key={att.pubkey} className="flex items-center justify-between rounded-button border border-line bg-card p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tile font-mono text-small font-medium text-tile-fg"
                    >
                      {pName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-sans text-caption leading-ui font-semibold text-ink">{pName}</div>
                      <div className="font-sans text-small text-muted">
                        {isCoHost ? t('eventDetails.roleHost') : t('eventDetails.roleAttendee')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyNpub(att.pubkey)}
                    className="cursor-pointer rounded-control p-1.5 text-muted transition-colors hover:text-ink"
                    aria-label={t('header.copyNpub')}
                  >
                    {copiedNpub === att.pubkey ? (
                      <Check aria-hidden="true" className={ICON} />
                    ) : (
                      <Copy aria-hidden="true" className={ICON} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className={SECTION_TITLE}>RSVP</h2>
            {userRsvpStatus && (
              <span className="font-sans text-caption leading-ui text-muted">
                {t('eventDetails.yourResponse')}{' '}
                <strong className="font-semibold text-ink">{rsvpStatusLabel[userRsvpStatus]}</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
            {rsvpOptions.map(({ status, label, icon }) => (
              <Button
                key={status}
                variant={userRsvpStatus === status ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={userRsvpStatus === status}
                onClick={() => void handleRsvp(status)}
                isLoading={isSubmittingRsvp}
                leftIcon={icon}
              >
                {label}
              </Button>
            ))}
          </div>

          {rsvpMessage && (
            <p role="status" className="font-sans text-caption leading-ui font-semibold text-ink">
              {rsvpMessage}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <h2 className={SECTION_TITLE}>{t('eventDetails.downloadCalendar')}</h2>
          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
              {t('booking.success.addToGoogle')}
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
            <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
              {t('booking.success.addToOutlook')}
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
            <button type="button" onClick={handleDownloadIcs} className={cn(LINK_BUTTON, 'cursor-pointer')}>
              <Download aria-hidden="true" className={ICON} />
              .ICS
            </button>
          </div>
        </div>

        {/* Relay broadcast: re-publish the signed event to host, creator, attendee and default relays */}
        {signedEvent && (
          <RelayReport
            results={[]}
            allowExtraRelay
            onBroadcast={(extraRelay) =>
              nostrPool.broadcastEvent(signedEvent, extraRelay ? [extraRelay] : undefined)
            }
          />
        )}
      </Card>
    </div>
  );
};
