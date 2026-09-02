import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoginModal } from '../components/auth/LoginModal';
import { WorkingHoursForm } from '../components/dashboard/WorkingHoursForm';
import { BookedEventsList } from '../components/dashboard/BookedEventsList';
import { getHostWorkingHours } from '../lib/calendar/slots';
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  Link,
  Copy,
  Check,
  ExternalLink,
  LogIn,
  ShieldAlert,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, signer, isLoggedIn } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'availability' | 'appointments'>('availability');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const hostWorkingHours = user?.pubkey ? getHostWorkingHours(user.pubkey) : getHostWorkingHours();

  // Public booking link for the host
  const hostIdentifier = user?.nip05 || user?.npub;
  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#/${hostIdentifier || ''}`
    : `https://cal.emre.xyz/#/${hostIdentifier || ''}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="text-center space-y-6 py-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-xs">
            <ShieldAlert className="h-7 w-7 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {t('dashboard.unauthenticated.title')}
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
              {t('dashboard.unauthenticated.description')}
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsLoginModalOpen(true)}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              {t('dashboard.unauthenticated.loginButton')}
            </Button>
          </div>
        </Card>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
            <LayoutDashboard className="h-6 w-6 text-stone-800 dark:text-stone-200" />
            {t('dashboard.title')}
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Host Identity Badge */}
        <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/70 p-2.5 dark:border-stone-800 dark:bg-stone-900/50">
          {user.profile?.picture ? (
            <img
              src={user.profile.picture}
              alt={user.profile.displayName || user.npub}
              className="h-8 w-8 rounded-full object-cover bg-stone-200 dark:bg-stone-700"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 text-xs font-bold">
              {(user.profile?.displayName || user.npub || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate max-w-[150px]">
              {user.profile?.displayName || user.nip05 || 'Host'}
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 truncate max-w-[150px]">
              {user.npub.slice(0, 10)}...{user.npub.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {/* Shareable Public Booking Link Widget */}
      <Card variant="flat" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-stone-500" />
              {t('dashboard.shareLink.title')}
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {t('dashboard.shareLink.description')}
            </p>
          </div>

          {copiedLink && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              {t('dashboard.shareLink.copied')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={bookingUrl}
            className="block w-full truncate rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-mono text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200 select-all"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            leftIcon={
              copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
          >
            {copiedLink ? t('common.copied') : t('common.copy')}
          </Button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 transition-colors"
            title="Open booking page"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </Card>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('availability')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'availability'
              ? 'border-stone-900 text-stone-900 dark:border-stone-100 dark:text-stone-100'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>{t('dashboard.availabilityTab')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appointments')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'appointments'
              ? 'border-stone-900 text-stone-900 dark:border-stone-100 dark:text-stone-100'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          <span>{t('dashboard.appointmentsTab')}</span>
        </button>
      </div>

      {/* Tab Content Panels */}
      <div>
        {activeTab === 'availability' ? (
          <WorkingHoursForm pubkey={user.pubkey} />
        ) : (
          <BookedEventsList
            pubkey={user.pubkey}
            signer={signer}
            hostTimezone={hostWorkingHours.timezone}
          />
        )}
      </div>
    </div>
  );
};
