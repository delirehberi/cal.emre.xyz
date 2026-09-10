import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Calendar, Check, Clock, Copy, Download, ExternalLink, Key } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTranslation } from '../../i18n';
import { getDateParts } from '../../lib/calendar/format';
import { eventHref } from '../../lib/router';
import {
  generateICS,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from '../../lib/calendar/ics';

export interface BookingSuccessProps {
  eventTitle: string;
  hostName: string;
  hostPubkey: string;
  hostNip05?: string;
  start: number; // Unix timestamp in seconds
  end: number;
  /** The booked day as 'YYYY-MM-DD'. */
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  attendeeTimezone: string;
  naddr: string;
  guestKeys?: { nsec: string; npub: string } | null;
  onBookAnother: () => void;
}

type CopyKind = 'naddr' | 'nsec' | 'link';

const LINK_BUTTON =
  'flex items-center justify-center gap-1.5 rounded-button border border-line bg-card px-3.5 py-2 font-sans text-caption leading-ui font-semibold text-ink transition-colors hover:border-muted';

const READONLY_FIELD =
  'block w-full truncate rounded-button border border-line bg-paper px-3.5 py-2.5 font-mono text-caption leading-ui text-ink select-all';

export const BookingSuccess: React.FC<BookingSuccessProps> = ({
  eventTitle,
  hostName,
  hostPubkey,
  hostNip05,
  start,
  end,
  formattedDate,
  formattedStartTime,
  formattedEndTime,
  attendeeTimezone,
  naddr,
  guestKeys,
  onBookAnother,
}) => {
  const { t, locale } = useTranslation();
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { weekday, dayMonth } = getDateParts(formattedDate, locale);

  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const shareUrl = typeof window === 'undefined' ? eventHref(naddr) : `${window.location.origin}/${eventHref(naddr)}`;

  const description = `Nostr NIP-52 Appointment with ${hostName} (${hostNip05 || hostPubkey}). Coordinate: ${naddr}`;
  const googleUrl = generateGoogleCalendarUrl({ title: eventTitle, description, start, end });
  const outlookUrl = generateOutlookCalendarUrl({ title: eventTitle, description, start, end });

  const handleDownloadIcs = () => {
    const icsContent = generateICS({
      title: eventTitle,
      description: `Nostr NIP-52 Appointment with ${hostName}. Event Coordinate: ${naddr}`,
      start,
      end,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `appointment-${start}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copy = async (kind: CopyKind, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const copyIcon = (kind: CopyKind) =>
    copied === kind ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />;

  return (
    <section
      aria-labelledby="booking-success-title"
      className="flex w-full flex-col gap-5 rounded-card border border-line bg-card p-5 tablet:p-6 desktop:p-7"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-ink">
          <Check className="h-6 w-6" />
        </span>
        <h2
          id="booking-success-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-heading-m font-bold text-ink focus:outline-none"
        >
          {t('booking.success.title')}
        </h2>
        <p className="mx-auto max-w-md font-sans text-caption text-muted">{t('booking.success.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-button border border-line bg-paper p-4">
        <p className="font-sans text-body leading-ui font-semibold text-ink">{eventTitle}</p>
        <div className="flex flex-col gap-2 font-mono text-caption leading-ui text-muted">
          <span className="flex items-center gap-2">
            <Calendar aria-hidden="true" className="h-4 w-4 shrink-0" />
            {`${weekday}, ${dayMonth}`}
          </span>
          <span className="flex items-center gap-2">
            <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
            {formattedStartTime} – {formattedEndTime} ({attendeeTimezone})
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-sans text-caption leading-ui font-medium text-muted">{t('booking.success.addToCalendar')}</h3>
        <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
            {t('booking.success.addToGoogle')}
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
          <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
            {t('booking.success.addToOutlook')}
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
          <button type="button" onClick={handleDownloadIcs} className={`${LINK_BUTTON} cursor-pointer`}>
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            {t('booking.success.downloadIcs')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-naddr" className="font-sans text-caption leading-ui font-medium text-muted">
          {t('booking.success.eventNaddr')}
        </label>
        <div className="flex items-center gap-2">
          <input id="booking-naddr" type="text" readOnly value={naddr} className={READONLY_FIELD} />
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void copy('naddr', naddr)} leftIcon={copyIcon('naddr')}>
            {copied === 'naddr' ? t('common.copied') : t('booking.success.copyNaddr')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-share" className="font-sans text-caption leading-ui font-medium text-muted">
          {t('eventDetails.shareWithOthers')}
        </label>
        <div className="flex items-center gap-2">
          <input id="booking-share" type="text" readOnly value={shareUrl} className={READONLY_FIELD} />
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void copy('link', shareUrl)} leftIcon={copyIcon('link')}>
            {copied === 'link' ? t('common.copied') : t('eventDetails.copyInviteLink')}
          </Button>
        </div>
      </div>

      {guestKeys && (
        <div className="flex flex-col gap-3 rounded-button border border-ink bg-paper p-4">
          <div className="flex items-center gap-2 text-ink">
            <Key aria-hidden="true" className="h-4 w-4 shrink-0" />
            <h3 className="font-sans text-caption leading-ui font-semibold">{t('booking.success.guestKeyWarningTitle')}</h3>
          </div>
          <p className="font-sans text-small text-muted">{t('booking.success.guestKeyWarningText')}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="booking-nsec" className="font-sans text-small leading-ui font-medium text-muted">
              {t('booking.success.privateKeyLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input id="booking-nsec" type="text" readOnly value={guestKeys.nsec} className={READONLY_FIELD} />
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => void copy('nsec', guestKeys.nsec)}
                leftIcon={copyIcon('nsec')}
              >
                {copied === 'nsec' ? t('common.copied') : t('booking.success.copySecretKey')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button variant="secondary" className="w-full" onClick={onBookAnother} rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
        {t('booking.success.bookAnother')}
      </Button>
    </section>
  );
};
