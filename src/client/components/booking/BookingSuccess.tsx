import React, { useState } from 'react';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Download,
  Copy,
  Check,
  Key,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTranslation } from '../../i18n';
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
  formattedDate: string;
  formattedStartTime: string;
  formattedEndTime: string;
  attendeeTimezone: string;
  naddr: string;
  guestKeys?: { nsec: string; npub: string } | null;
  onBookAnother: () => void;
}

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
  const { t } = useTranslation();
  const [copiedNaddr, setCopiedNaddr] = useState(false);
  const [copiedNsec, setCopiedNsec] = useState(false);

  const googleUrl = generateGoogleCalendarUrl({
    title: eventTitle,
    description: `Nostr NIP-52 Appointment with ${hostName} (${hostNip05 || hostPubkey}). Coordinate: ${naddr}`,
    start,
    end,
  });

  const outlookUrl = generateOutlookCalendarUrl({
    title: eventTitle,
    description: `Nostr NIP-52 Appointment with ${hostName} (${hostNip05 || hostPubkey}). Coordinate: ${naddr}`,
    start,
    end,
  });

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

  const handleCopyNaddr = async () => {
    try {
      await navigator.clipboard.writeText(naddr);
      setCopiedNaddr(true);
      setTimeout(() => setCopiedNaddr(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyNsec = async () => {
    if (!guestKeys?.nsec) return;
    try {
      await navigator.clipboard.writeText(guestKeys.nsec);
      setCopiedNsec(true);
      setTimeout(() => setCopiedNsec(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Card className="space-y-6">
      {/* Header Badge */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          {t('booking.success.title')}
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          {t('booking.success.subtitle')}
        </p>
      </div>

      {/* Appointment Summary Box */}
      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/50 space-y-3">
        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          {eventTitle}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-stone-500" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-stone-500" />
            <span>
              {formattedStartTime} - {formattedEndTime} ({attendeeTimezone})
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Quick Add Links */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
          Add to your calendar
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 transition-colors"
          >
            <span>{t('booking.success.addToGoogle')}</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          <a
            href={outlookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 transition-colors"
          >
            <span>{t('booking.success.addToOutlook')}</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadIcs}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            {t('booking.success.downloadIcs')}
          </Button>
        </div>
      </div>

      {/* Nostr Event Coordinate (naddr) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
          {t('booking.success.eventNaddr')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={naddr}
            className="block w-full truncate rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 select-all"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyNaddr}
            leftIcon={
              copiedNaddr ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
          >
            {copiedNaddr ? t('common.copied') : t('booking.success.copyNaddr')}
          </Button>
        </div>
      </div>

      {/* Guest Key Credentials Section */}
      {guestKeys && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Key className="h-4 w-4" />
            <h4 className="text-xs font-bold">{t('booking.success.guestKeyWarningTitle')}</h4>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            {t('booking.success.guestKeyWarningText')}
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
              Private Key (nsec)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={guestKeys.nsec}
                className="block w-full truncate rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono text-amber-900 dark:border-amber-800 dark:bg-stone-950 dark:text-amber-200 select-all"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyNsec}
                leftIcon={
                  copiedNsec ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {copiedNsec ? t('common.copied') : t('booking.success.copySecretKey')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Book Another Appointment */}
      <div className="pt-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={onBookAnother}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {t('booking.success.bookAnother')}
        </Button>
      </div>
    </Card>
  );
};
