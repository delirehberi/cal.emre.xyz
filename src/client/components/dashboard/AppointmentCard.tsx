import React from 'react';
import { Check, Download, Link2, Mail, UserPlus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge, type StatusKind } from '../ui/StatusBadge';
import { useTranslation } from '../../i18n';
import { encodeNpub } from '../../lib/nostr/keys';
import { formatSlotTime } from '../../lib/calendar/slots';
import { getAppointmentEnd } from '../../lib/dashboard/stats';
import { isLikelyEncrypted, type EncryptedBookingPayload } from '../../lib/nostr/encryption';
import type { HostAppointment } from '../../lib/nostr/relays';
import { cn } from '../../lib/cn';

export type CopyKind = 'link' | 'invite';

export interface AppointmentCardProps {
  appointment: HostAppointment;
  hostPubkey: string;
  hostTimezone: string;
  /** Booking details after a successful decryption. */
  details?: EncryptedBookingPayload;
  isDecrypting: boolean;
  canDecrypt: boolean;
  isBusy: boolean;
  /** Which copy action just succeeded, for inline feedback. */
  copied?: CopyKind | null;
  /** Past and closed appointments only offer the calendar file. */
  readOnly: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onDecrypt: () => void;
  onDownloadIcs: () => void;
  onCopy: (kind: CopyKind) => void;
}

const ACTION_BASE = 'gap-1.5 rounded-control px-3 py-2 text-caption leading-ui';

const STATUS_KIND: Record<HostAppointment['effectiveStatus'], StatusKind> = {
  accepted: 'confirmed',
  tentative: 'pending',
  declined: 'declined',
  canceled: 'cancelled',
};

const STATUS_KEY = {
  accepted: 'dashboard.appointments.statusAccepted',
  tentative: 'dashboard.appointments.statusPending',
  declined: 'dashboard.appointments.statusDeclined',
  canceled: 'dashboard.appointments.statusCancelled',
} as const;

const shortNpub = (pubkey: string): string => {
  const npub = encodeNpub(pubkey);
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
};

/** One appointment: date block, title, time line, guest, status badges and the actions that apply to its state. */
export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  hostPubkey,
  hostTimezone,
  details,
  isDecrypting,
  canDecrypt,
  isBusy,
  copied = null,
  readOnly,
  onAccept,
  onDecline,
  onCancel,
  onDecrypt,
  onDownloadIcs,
  onCopy,
}) => {
  const { t, locale } = useTranslation();
  const { event, effectiveStatus, isDeleted } = appointment;
  const intlLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const end = getAppointmentEnd(appointment);
  const startDate = new Date(event.start * 1000);

  const day = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', timeZone: hostTimezone }).format(startDate);
  const month = new Intl.DateTimeFormat(intlLocale, { month: 'short', timeZone: hostTimezone })
    .format(startDate)
    .replace('.', '')
    .toLocaleUpperCase(intlLocale);
  const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: 'short', timeZone: hostTimezone }).format(startDate);
  const timeLine = t('dashboard.appointments.timeLine', {
    weekday,
    start: formatSlotTime(event.start, hostTimezone, intlLocale, true),
    end: formatSlotTime(end, hostTimezone, intlLocale, true),
    minutes: Math.round((end - event.start) / 60),
  });

  const guestPubkey = event.attendees.find((a) => a.pubkey !== hostPubkey)?.pubkey ?? event.attendees[0]?.pubkey;
  const guestName = details?.name || (guestPubkey ? shortNpub(guestPubkey) : t('dashboard.hostFallback'));
  const title = details?.name ? t('dashboard.appointments.defaultTitle', { name: details.name }) : event.title;

  const status = isDeleted ? 'canceled' : effectiveStatus;
  const confirmed = status === 'accepted';
  const pending = status === 'tentative';
  const open = !readOnly && (confirmed || pending);
  const encrypted = isLikelyEncrypted(event.content);
  const meetingUrl = event.location && /^https?:\/\//i.test(event.location) ? event.location : null;

  return (
    <article
      aria-label={title}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-5',
        (status === 'canceled' || status === 'declined') && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center rounded-field',
            confirmed ? 'bg-slot-soft' : 'border border-line'
          )}
        >
          <span className="font-display text-date font-extrabold text-ink">{day}</span>
          <span className="font-mono text-eyebrow font-medium text-muted">{month}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-display text-card-title font-bold break-words text-ink">{title}</h3>
          <p className="font-mono text-small leading-ui font-medium text-muted">{timeLine}</p>
          <p className="flex min-w-0 items-center gap-2 font-sans text-ui leading-ui text-muted">
            <span
              aria-hidden="true"
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-line font-sans text-small font-semibold text-ink"
            >
              {guestName.slice(0, 1).toLocaleUpperCase(intlLocale)}
            </span>
            <span className="truncate">{guestName}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind={STATUS_KIND[status]}>{t(STATUS_KEY[status])}</StatusBadge>
            {encrypted && <StatusBadge kind="encrypted">{t('dashboard.appointments.encrypted')}</StatusBadge>}
            {encrypted && !details && canDecrypt && (
              <button
                type="button"
                onClick={onDecrypt}
                disabled={isDecrypting}
                className="cursor-pointer font-sans text-small leading-ui font-semibold text-muted underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed"
              >
                {isDecrypting ? t('dashboard.appointments.decrypting') : t('dashboard.appointments.decryptAction')}
              </button>
            )}
          </div>
        </div>
      </div>

      {details && (details.email || details.notes) && (
        <div className="space-y-2 rounded-field border border-line bg-paper p-3 font-sans text-ui leading-ui">
          {details.email && (
            <p className="flex items-center gap-2 text-ink">
              <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="text-muted">{t('dashboard.appointments.attendeeEmail')}</span>
              <a href={`mailto:${details.email}`} className="truncate font-mono text-small underline underline-offset-2">
                {details.email}
              </a>
            </p>
          )}
          {details.notes && (
            <div>
              <p className="text-caption font-semibold text-muted">{t('dashboard.appointments.privateNotes')}</p>
              <p className="whitespace-pre-wrap text-ink">{details.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="h-px w-full bg-line" aria-hidden="true" />

      <div className="flex flex-wrap items-start gap-2">
        {open && pending && (
          <>
            <Button
              size="sm"
              variant="primary"
              className={ACTION_BASE}
              isLoading={isBusy}
              onClick={onAccept}
              leftIcon={<Check aria-hidden="true" className="h-[15px] w-[15px]" />}
            >
              {t('dashboard.appointments.acceptAction')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={ACTION_BASE}
              disabled={isBusy}
              onClick={onDecline}
              leftIcon={<X aria-hidden="true" className="h-[15px] w-[15px]" />}
            >
              {t('dashboard.appointments.declineAction')}
            </Button>
          </>
        )}
        {(confirmed || readOnly) && (
          <Button
            size="sm"
            variant="secondary"
            className={ACTION_BASE}
            onClick={onDownloadIcs}
            leftIcon={<Download aria-hidden="true" className="h-[15px] w-[15px]" />}
          >
            {t('dashboard.appointments.downloadIcs')}
          </Button>
        )}
        {open && confirmed && (
          <Button
            size="sm"
            variant="secondary"
            className={ACTION_BASE}
            onClick={() => onCopy('link')}
            leftIcon={<Link2 aria-hidden="true" className="h-[15px] w-[15px]" />}
          >
            {copied === 'link' ? t('dashboard.appointments.linkCopied') : t('dashboard.appointments.copyLink')}
          </Button>
        )}
        {open && (
          <Button
            size="sm"
            variant="secondary"
            className={ACTION_BASE}
            onClick={() => onCopy('invite')}
            leftIcon={<UserPlus aria-hidden="true" className="h-[15px] w-[15px]" />}
          >
            {copied === 'invite' ? t('dashboard.appointments.inviteCopied') : t('dashboard.appointments.invite')}
          </Button>
        )}
        {open && (
          <Button
            size="sm"
            variant="danger"
            className={ACTION_BASE}
            disabled={isBusy}
            onClick={onCancel}
          >
            {t('dashboard.appointments.cancelAction')}
          </Button>
        )}
        {meetingUrl && !readOnly && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-1 py-2 font-sans text-caption leading-ui font-semibold text-muted underline underline-offset-2 hover:text-ink"
          >
            {t('dashboard.appointments.joinMeeting')}
          </a>
        )}
      </div>
    </article>
  );
};
