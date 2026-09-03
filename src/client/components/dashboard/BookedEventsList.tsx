import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useTranslation } from '../../i18n';
import type { NostrSigner } from '../../lib/nostr/signer';
import { nostrPool, type HostAppointment } from '../../lib/nostr/relays';
import {
  createCalendarRSVPTemplate,
  createDeletionEventTemplate,
} from '../../lib/nostr/nip52';
import { formatSlotTime } from '../../lib/calendar/slots';
import { generateICS } from '../../lib/calendar/ics';
import { encodeNpub } from '../../lib/nostr/keys';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RotateCw,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Lock,
  Mail,
} from 'lucide-react';
import {
  decryptBookingDetails,
  isLikelyEncrypted,
  type EncryptedBookingPayload,
} from '../../lib/nostr/encryption';

export interface BookedEventsListProps {
  pubkey: string;
  signer: NostrSigner | null;
  relays?: string[];
  hostTimezone?: string;
}

export const BookedEventsList: React.FC<BookedEventsListProps> = ({
  pubkey,
  signer,
  relays,
  hostTimezone = 'UTC',
}) => {
  const { t, locale } = useTranslation();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<HostAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<HostAppointment | null>(null);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, EncryptedBookingPayload>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});

  const nowSeconds = Math.floor(Date.now() / 1000);

  const decryptAppointment = useCallback(
    async (appointment: HostAppointment) => {
      const coord = appointment.event.coordinate;
      if (!signer?.decrypt || !appointment.event.content || decryptedMap[coord] || decryptingIds[coord]) {
        return;
      }

      setDecryptingIds((prev) => ({ ...prev, [coord]: true }));
      try {
        const attendee =
          appointment.event.attendees.find((a) => a.pubkey !== pubkey) ||
          appointment.event.attendees[0];
        const senderPubkey = attendee?.pubkey || appointment.event.pubkey || pubkey;
        const decrypted = await decryptBookingDetails(signer, senderPubkey, appointment.event.content);
        if (decrypted) {
          setDecryptedMap((prev) => ({ ...prev, [coord]: decrypted }));
        }
      } catch {
        // Decryption failed or cancelled
      } finally {
        setDecryptingIds((prev) => ({ ...prev, [coord]: false }));
      }
    },
    [signer, pubkey, decryptedMap, decryptingIds]
  );

  const fetchAppointments = useCallback(async () => {
    if (!pubkey) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await nostrPool.fetchHostAppointments(pubkey, { relays });
      setAppointments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [pubkey, relays]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Auto-decrypt appointments when list or signer changes
  useEffect(() => {
    if (!signer?.decrypt || appointments.length === 0) return;
    appointments.forEach((apt) => {
      if (apt.event.content && !decryptedMap[apt.event.coordinate]) {
        decryptAppointment(apt);
      }
    });
  }, [appointments, signer, decryptAppointment, decryptedMap]);

  // Separate upcoming and past appointments
  const upcomingAppointments = useMemo(() => {
    return appointments.filter((a) => (a.event.end || a.event.start + 1800) >= nowSeconds);
  }, [appointments, nowSeconds]);

  const pastAppointments = useMemo(() => {
    return appointments.filter((a) => (a.event.end || a.event.start + 1800) < nowSeconds);
  }, [appointments, nowSeconds]);

  const currentList = activeTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  const handleCopyNpub = async (attendeePubkey: string) => {
    try {
      const npub = encodeNpub(attendeePubkey);
      await navigator.clipboard.writeText(npub);
      setCopiedKey(attendeePubkey);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadIcs = (appointment: HostAppointment) => {
    const { event } = appointment;
    const end = event.end && event.end > event.start ? event.end : event.start + 1800;

    const icsContent = generateICS({
      title: event.title,
      description: event.description || event.summary || '',
      location: event.location || '',
      start: event.start,
      end,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `appointment-${event.start}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRsvpStatus = async (appointment: HostAppointment, status: 'accepted' | 'declined') => {
    if (!signer) {
      setError(t('errors.signerNotFound'));
      return;
    }

    const coordinate = appointment.event.coordinate;
    setActionLoadingId(coordinate);
    setError(null);

    try {
      const template = createCalendarRSVPTemplate({
        eventCoordinate: coordinate,
        status,
        freeBusy: status === 'accepted' ? 'busy' : 'free',
        hostPubkey: pubkey,
      });

      const signedEvent = await signer.signEvent(template);
      const targetRelays = nostrPool.getBootstrapRelays(relays);
      await nostrPool.publishEvent(targetRelays, signedEvent);

      // Optimistically update status
      setAppointments((prev) =>
        prev.map((item) => {
          if (item.event.coordinate === coordinate) {
            return {
              ...item,
              effectiveStatus: status,
            };
          }
          return item;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !signer) return;

    const coordinate = cancelTarget.event.coordinate;
    const eventId = cancelTarget.event.id;
    setActionLoadingId(coordinate);
    setError(null);

    try {
      const targetRelays = nostrPool.getBootstrapRelays(relays);

      // 1. Kind 5 Deletion Event
      const delTemplate = createDeletionEventTemplate({
        eventId,
        coordinate,
        kind: 31923,
        reason: 'Appointment canceled by host',
      });
      const signedDeletion = await signer.signEvent(delTemplate);
      await nostrPool.publishEvent(targetRelays, signedDeletion);

      // 2. RSVP Declined event
      const rsvpTemplate = createCalendarRSVPTemplate({
        eventCoordinate: coordinate,
        status: 'declined',
        freeBusy: 'free',
        hostPubkey: pubkey,
      });
      const signedRsvp = await signer.signEvent(rsvpTemplate);
      await nostrPool.publishEvent(targetRelays, signedRsvp);

      // Update state
      setAppointments((prev) =>
        prev.map((item) => {
          if (item.event.coordinate === coordinate) {
            return {
              ...item,
              isDeleted: true,
              effectiveStatus: 'canceled',
            };
          }
          return item;
        })
      );

      setCancelTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: HostAppointment['effectiveStatus']) => {
    switch (status) {
      case 'accepted':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('dashboard.appointments.statusAccepted')}
          </Badge>
        );
      case 'tentative':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('dashboard.appointments.statusTentative')}
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="danger" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('dashboard.appointments.statusDeclined')}
          </Badge>
        );
      case 'canceled':
        return (
          <Badge variant="neutral" className="gap-1 line-through opacity-75">
            <Trash2 className="h-3 w-3" />
            {t('dashboard.appointments.cancelAction')}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-stone-900 text-white shadow-xs dark:bg-stone-100 dark:text-stone-900'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {t('dashboard.appointments.upcomingTitle')} ({upcomingAppointments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'past'
                ? 'bg-stone-900 text-white shadow-xs dark:bg-stone-100 dark:text-stone-900'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {t('dashboard.appointments.pastTitle')} ({pastAppointments.length})
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchAppointments}
          isLoading={isLoading}
          leftIcon={<RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          {locale === 'tr' ? 'Yenile' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Appointments List */}
      {isLoading && appointments.length === 0 ? (
        <div className="space-y-4 py-8 text-center text-stone-500 dark:text-stone-400">
          <RotateCw className="mx-auto h-6 w-6 animate-spin text-stone-400" />
          <p className="text-xs">{t('common.loading')}</p>
        </div>
      ) : currentList.length === 0 ? (
        <Card variant="flat" className="py-12 text-center space-y-2">
          <Calendar className="mx-auto h-8 w-8 text-stone-400 opacity-60" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            {activeTab === 'upcoming'
              ? t('dashboard.appointments.noUpcoming')
              : t('dashboard.appointments.noPast')}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t('dashboard.appointments.noAppointments')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {currentList.map((appointment) => {
            const { event, effectiveStatus, isDeleted } = appointment;
            const isActionLoading = actionLoadingId === event.coordinate;
            const end = event.end && event.end > event.start ? event.end : event.start + 1800;

            const dateStr = new Date(event.start * 1000).toLocaleDateString(
              locale === 'tr' ? 'tr-TR' : 'en-US',
              {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: hostTimezone,
              }
            );

            const startTimeStr = formatSlotTime(event.start, hostTimezone, locale === 'tr' ? 'tr-TR' : 'en-US', true);
            const endTimeStr = formatSlotTime(end, hostTimezone, locale === 'tr' ? 'tr-TR' : 'en-US', true);

            const attendee = event.attendees.find((a) => a.pubkey !== pubkey) || event.attendees[0];
            const attendeeNpub = attendee?.pubkey ? encodeNpub(attendee.pubkey) : null;
            const isUrlLocation = event.location && /^https?:\/\//i.test(event.location);

            const decrypted = decryptedMap[event.coordinate];
            const hasEncryptedContent = isLikelyEncrypted(event.content);
            const isDecrypting = decryptingIds[event.coordinate];

            const displayTitle = decrypted?.name
              ? `Appointment with ${decrypted.name}`
              : event.title;

            return (
              <Card
                key={event.coordinate}
                className={`transition-all space-y-4 ${
                  isDeleted ? 'opacity-60 bg-stone-50 dark:bg-stone-950/40' : ''
                }`}
              >
                {/* Top Row: Title, Decryption Badge, & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {displayTitle}
                      </h4>
                      {decrypted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
                          <Lock className="h-3 w-3" />
                          <span>{t('dashboard.appointments.decryptedBadge')}</span>
                        </span>
                      ) : hasEncryptedContent ? (
                        <button
                          type="button"
                          onClick={() => decryptAppointment(appointment)}
                          disabled={isDecrypting || !signer?.decrypt}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-0.5 rounded-md hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer disabled:opacity-50"
                        >
                          <Lock className={`h-3 w-3 ${isDecrypting ? 'animate-spin' : ''}`} />
                          <span>
                            {isDecrypting
                              ? t('dashboard.appointments.decrypting')
                              : t('dashboard.appointments.decryptAction')}
                          </span>
                        </button>
                      ) : null}
                    </div>

                    {/* Unencrypted legacy description if present */}
                    {event.description && !decrypted && (
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 max-w-2xl whitespace-pre-wrap">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">{getStatusBadge(effectiveStatus)}</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600 dark:text-stone-400 pt-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-stone-400 shrink-0" />
                    <span>{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-stone-400 shrink-0" />
                    <span>
                      {startTimeStr} - {endTimeStr} ({hostTimezone})
                    </span>
                  </div>

                  {attendeeNpub && (
                    <div className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 text-stone-400 shrink-0" />
                      <span className="font-mono text-[11px] truncate">
                        {decrypted?.name ? `${decrypted.name} (${attendeeNpub.slice(0, 8)}...)` : `${attendeeNpub.slice(0, 10)}...${attendeeNpub.slice(-4)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyNpub(attendee.pubkey)}
                        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                        title="Copy npub"
                      >
                        {copiedKey === attendee.pubkey ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Decrypted Attendee Email & Notes */}
                {decrypted && (decrypted.notes || decrypted.email) && (
                  <div className="space-y-2 rounded-xl bg-stone-50/80 dark:bg-stone-900/60 p-3 border border-stone-200/80 dark:border-stone-800 text-xs">
                    {decrypted.email && (
                      <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                        <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        <span className="font-medium">{t('dashboard.appointments.attendeeEmail')}:</span>
                        <a
                          href={`mailto:${decrypted.email}`}
                          className="font-mono text-stone-900 dark:text-stone-100 hover:underline"
                        >
                          {decrypted.email}
                        </a>
                      </div>
                    )}

                    {decrypted.notes && (
                      <div className="space-y-1 pt-1 border-t border-stone-200/60 dark:border-stone-800/80">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Lock className="h-3 w-3" />
                          <span>{t('dashboard.appointments.privateNotes')}</span>
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                          {decrypted.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Location / Meeting link */}
                {event.location && (
                  <div className="flex items-center gap-2 rounded-lg bg-stone-50 dark:bg-stone-950 p-2 text-xs">
                    <MapPin className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                    <span className="truncate flex-1 font-mono text-[11px]">{event.location}</span>
                    {isUrlLocation ? (
                      <a
                        href={event.location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-semibold text-stone-900 dark:text-stone-100 hover:underline shrink-0"
                      >
                        <span>{t('dashboard.appointments.joinMeeting')}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadIcs(appointment)}
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                  >
                    .ICS
                  </Button>

                  {!isDeleted && (
                    <div className="flex items-center gap-2">
                      {effectiveStatus !== 'accepted' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={isActionLoading}
                          onClick={() => handleRsvpStatus(appointment, 'accepted')}
                          leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                        >
                          {t('dashboard.appointments.acceptAction')}
                        </Button>
                      )}

                      {effectiveStatus !== 'declined' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={isActionLoading}
                          onClick={() => handleRsvpStatus(appointment, 'declined')}
                          leftIcon={<XCircle className="h-3.5 w-3.5" />}
                        >
                          {t('dashboard.appointments.declineAction')}
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isActionLoading}
                        onClick={() => setCancelTarget(appointment)}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        {t('dashboard.appointments.cancelAction')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Canceling Appointment */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t('dashboard.appointments.confirmCancelTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t('dashboard.appointments.confirmCancelText')}
          </p>

          {cancelTarget && (
            <div className="rounded-lg bg-stone-50 dark:bg-stone-900 p-3 text-xs space-y-1">
              <div className="font-semibold text-stone-900 dark:text-stone-100">
                {cancelTarget.event.title}
              </div>
              <div className="text-stone-500 dark:text-stone-400">
                {new Date(cancelTarget.event.start * 1000).toLocaleString(
                  locale === 'tr' ? 'tr-TR' : 'en-US'
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setCancelTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={!!actionLoadingId}
              onClick={handleConfirmCancel}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              {t('dashboard.appointments.cancelAction')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
