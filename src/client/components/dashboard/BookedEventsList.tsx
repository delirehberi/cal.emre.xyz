import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { AppointmentCard, type CopyKind } from './AppointmentCard';
import { useTranslation } from '../../i18n';
import type { NostrSigner } from '../../lib/nostr/signer';
import { nostrPool, type HostAppointment } from '../../lib/nostr/relays';
import { createCalendarRSVPTemplate, createDeletionEventTemplate } from '../../lib/nostr/nip52';
import { encodeNaddr } from '../../lib/nostr/keys';
import { generateICS } from '../../lib/calendar/ics';
import { getAppointmentEnd, groupAppointments } from '../../lib/dashboard/stats';
import {
  decryptBookingDetails,
  type EncryptedBookingPayload,
} from '../../lib/nostr/encryption';

export interface BookedEventsListProps {
  pubkey: string;
  signer: NostrSigner | null;
  relays?: string[];
  hostTimezone?: string;
  appointments: HostAppointment[];
  onAppointmentsChange: React.Dispatch<React.SetStateAction<HostAppointment[]>>;
  isLoading: boolean;
  loadError?: string | null;
  onRefresh: () => void;
}

const SectionHeader: React.FC<{ title: string; count: number; action?: React.ReactNode }> = ({ title, count, action }) => (
  <div className="flex items-center gap-2.5">
    <h2 className="font-display text-heading-s font-bold text-ink tablet:text-heading-l">{title}</h2>
    <span className="rounded-full bg-line px-[9px] py-[3px] font-mono text-small leading-ui font-medium text-ink">
      {count}
    </span>
    {action && <div className="ml-auto">{action}</div>}
  </div>
);

/** The "Randevular ve LCV Yanıtları" tab: appointment cards with RSVP, cancel, invite and decrypt actions. */
export const BookedEventsList: React.FC<BookedEventsListProps> = ({
  pubkey,
  signer,
  relays,
  hostTimezone = 'UTC',
  appointments,
  onAppointmentsChange,
  isLoading,
  loadError = null,
  onRefresh,
}) => {
  const { t } = useTranslation();

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyCoordinate, setBusyCoordinate] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<HostAppointment | null>(null);
  const [copied, setCopied] = useState<{ coordinate: string; kind: CopyKind } | null>(null);
  const [details, setDetails] = useState<Record<string, EncryptedBookingPayload>>({});
  const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
  const attempted = useRef<Set<string>>(new Set());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const { upcoming, past } = useMemo(() => groupAppointments(appointments, nowSeconds), [appointments, nowSeconds]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const decryptAppointment = useCallback(
    async (appointment: HostAppointment) => {
      const { coordinate, content } = appointment.event;
      if (!signer?.decrypt || !content) return;
      setDecrypting((prev) => ({ ...prev, [coordinate]: true }));
      try {
        // The details are encrypted by whoever signed the booking event, so that is the sender.
        const guest = appointment.event.attendees.find((a) => a.pubkey !== pubkey) ?? appointment.event.attendees[0];
        const sender = appointment.event.pubkey || guest?.pubkey || pubkey;
        const result = await decryptBookingDetails(signer, sender, content);
        if (result) setDetails((prev) => ({ ...prev, [coordinate]: result }));
      } catch {
        // The signer declined or the payload is not for this key; the card keeps its decrypt button.
      } finally {
        setDecrypting((prev) => ({ ...prev, [coordinate]: false }));
      }
    },
    [signer, pubkey]
  );

  // Decrypt each appointment once as soon as a signer is available.
  useEffect(() => {
    if (!signer?.decrypt) return;
    for (const appointment of appointments) {
      const { coordinate, content } = appointment.event;
      if (content && !attempted.current.has(coordinate)) {
        attempted.current.add(coordinate);
        void decryptAppointment(appointment);
      }
    }
  }, [appointments, signer, decryptAppointment]);

  const eventLink = (appointment: HostAppointment, kind: CopyKind): string => {
    const { event } = appointment;
    const naddr = encodeNaddr({ pubkey: event.pubkey || pubkey, kind: 31923, identifier: event.identifier });
    if (kind === 'invite') {
      return `${window.location.origin}/api/events/${naddr}/ics`;
    }
    return event.location && /^https?:\/\//i.test(event.location) ? event.location : `nostr:${naddr}`;
  };

  const handleCopy = async (appointment: HostAppointment, kind: CopyKind) => {
    try {
      await navigator.clipboard.writeText(eventLink(appointment, kind));
      setCopied({ coordinate: appointment.event.coordinate, kind });
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setActionError(t('errors.generic'));
    }
  };

  const handleDownloadIcs = (appointment: HostAppointment) => {
    const { event } = appointment;
    const content = generateICS({
      title: event.title,
      description: event.description || event.summary || '',
      location: event.location || '',
      start: event.start,
      end: getAppointmentEnd(appointment),
      url: window.location.href,
    });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment-${event.start}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const publishRsvp = async (coordinate: string, status: 'accepted' | 'declined') => {
    if (!signer) throw new Error(t('errors.signerNotFound'));
    const template = createCalendarRSVPTemplate({
      eventCoordinate: coordinate,
      status,
      freeBusy: status === 'accepted' ? 'busy' : 'free',
      hostPubkey: pubkey,
    });
    const signed = await signer.signEvent(template);
    await nostrPool.publishEvent(nostrPool.getBootstrapRelays(relays), signed);
  };

  const updateAppointment = (coordinate: string, patch: Partial<HostAppointment>) =>
    onAppointmentsChange((prev) => prev.map((item) => (item.event.coordinate === coordinate ? { ...item, ...patch } : item)));

  const handleRsvp = async (appointment: HostAppointment, status: 'accepted' | 'declined') => {
    const { coordinate } = appointment.event;
    setBusyCoordinate(coordinate);
    setActionError(null);
    try {
      await publishRsvp(coordinate, status);
      updateAppointment(coordinate, { effectiveStatus: status });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyCoordinate(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (!signer) {
      setActionError(t('errors.signerNotFound'));
      return;
    }
    const { coordinate, id } = cancelTarget.event;
    setBusyCoordinate(coordinate);
    setActionError(null);
    try {
      const relayUrls = nostrPool.getBootstrapRelays(relays);
      const deletion = await signer.signEvent(
        createDeletionEventTemplate({ eventId: id, coordinate, kind: 31923, reason: 'Appointment canceled by host' })
      );
      await nostrPool.publishEvent(relayUrls, deletion);
      await publishRsvp(coordinate, 'declined');
      updateAppointment(coordinate, { isDeleted: true, effectiveStatus: 'canceled' });
      setCancelTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyCoordinate(null);
    }
  };

  const renderCard = (appointment: HostAppointment, readOnly: boolean) => {
    const { coordinate } = appointment.event;
    return (
      <AppointmentCard
        key={coordinate}
        appointment={appointment}
        hostPubkey={pubkey}
        hostTimezone={hostTimezone}
        details={details[coordinate]}
        isDecrypting={Boolean(decrypting[coordinate])}
        canDecrypt={Boolean(signer?.decrypt)}
        isBusy={busyCoordinate === coordinate}
        copied={copied?.coordinate === coordinate ? copied.kind : null}
        readOnly={readOnly}
        onAccept={() => handleRsvp(appointment, 'accepted')}
        onDecline={() => handleRsvp(appointment, 'declined')}
        onCancel={() => setCancelTarget(appointment)}
        onDecrypt={() => void decryptAppointment(appointment)}
        onDownloadIcs={() => handleDownloadIcs(appointment)}
        onCopy={(kind) => void handleCopy(appointment, kind)}
      />
    );
  };

  const error = actionError ?? loadError;

  return (
    <div className="flex flex-col gap-5 tablet:gap-6">
      <SectionHeader
        title={t('dashboard.appointments.upcomingTitle')}
        count={upcoming.length}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isLoading}
            leftIcon={<RotateCw aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            <span className="sr-only tablet:not-sr-only">{t('dashboard.appointments.refresh')}</span>
          </Button>
        }
      />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-field border border-line bg-card p-3 font-sans text-ui leading-ui font-semibold text-ink">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {isLoading && appointments.length === 0 ? (
        <div className="grid gap-3.5 tablet:gap-6 desktop:grid-cols-2" aria-busy="true">
          <Skeleton className="h-[212px] rounded-card" />
          <Skeleton className="h-[212px] rounded-card" />
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-12 text-center">
          <CalendarDays aria-hidden="true" className="h-7 w-7 text-muted" />
          <p className="font-sans text-body leading-ui font-semibold text-ink">{t('dashboard.appointments.noUpcoming')}</p>
          <p className="font-sans text-ui leading-ui text-muted">{t('dashboard.appointments.noAppointments')}</p>
        </div>
      ) : (
        <div className="grid gap-3.5 tablet:gap-6 desktop:grid-cols-2">{upcoming.map((a) => renderCard(a, false))}</div>
      )}

      {past.length > 0 && (
        <>
          <SectionHeader title={t('dashboard.appointments.pastTitle')} count={past.length} />
          <div className="grid gap-3.5 tablet:gap-6 desktop:grid-cols-2">{past.map((a) => renderCard(a, true))}</div>
        </>
      )}

      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={t('dashboard.appointments.confirmCancelTitle')}
        description={t('dashboard.appointments.confirmCancelText')}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" data-autofocus onClick={() => setCancelTarget(null)}>
            {t('dashboard.appointments.keepMeeting')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={busyCoordinate !== null}
            onClick={() => void handleConfirmCancel()}
            leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            {t('dashboard.appointments.cancelAction')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
