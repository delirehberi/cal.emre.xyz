import React, { useRef, useState } from 'react';
import { Link2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Tabs, getPanelId, getTabId } from '../components/ui/Tabs';
import { LoginModal } from '../components/auth/LoginModal';
import { WorkingHoursForm } from '../components/dashboard/WorkingHoursForm';
import { BookedEventsList } from '../components/dashboard/BookedEventsList';
import { getDisplayName } from '../components/layout/UserMenu';
import { getHostWorkingHours } from '../lib/calendar/slots';
import { computeAppointmentStats } from '../lib/dashboard/stats';
import { useHostAppointments } from '../lib/dashboard/useHostAppointments';

type DashboardTab = 'availability' | 'appointments';

const TABS_ID = 'dashboard';

const StatCard: React.FC<{ label: string; value: number; sub: string }> = ({ label, value, sub }) => (
  <div className="flex min-w-0 flex-col gap-1.5 rounded-card border border-line bg-card p-[22px]">
    <p className="font-sans text-ui leading-ui font-medium text-muted">{label}</p>
    <p className="font-display text-stat font-extrabold text-ink">{value}</p>
    <p className="font-sans text-caption leading-ui text-muted">{sub}</p>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { user, signer, isLoggedIn } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<DashboardTab>('availability');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { appointments, setAppointments, isLoading, error, reload } = useHostAppointments(user?.pubkey);

  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 tablet:px-6">
        <Card className="space-y-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-field bg-line text-ink"
          >
            <ShieldAlert className="h-7 w-7" />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-heading-m font-bold text-ink">{t('dashboard.unauthenticated.title')}</h1>
            <p className="mx-auto max-w-md font-sans text-ui leading-ui text-muted">
              {t('dashboard.unauthenticated.description')}
            </p>
          </div>
          <Button size="md" onClick={() => setIsLoginModalOpen(true)} leftIcon={<LogIn aria-hidden="true" className="h-4 w-4" />}>
            {t('dashboard.unauthenticated.loginButton')}
          </Button>
        </Card>
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      </div>
    );
  }

  const hostTimezone = getHostWorkingHours(user.pubkey).timezone;
  const stats = computeAppointmentStats(appointments, Math.floor(Date.now() / 1000), hostTimezone);

  const identifier = user.nip05 || user.npub;
  const bookingUrl = `${window.location.origin}/#/${identifier}`;
  const displayUrl = `${window.location.host}/#/${identifier}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const monthSub =
    stats.monthDelta === 0
      ? t('dashboard.stats.monthSubSame')
      : stats.monthDelta > 0
        ? t('dashboard.stats.monthSubUp', { count: stats.monthDelta })
        : t('dashboard.stats.monthSubDown', { count: Math.abs(stats.monthDelta) });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pt-6 pb-8 tablet:px-8 tablet:pt-12 tablet:pb-[72px] desktop:px-20">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-label leading-ui font-medium text-muted uppercase">{t('dashboard.eyebrow')}</p>
        <h1 className="font-display text-display-s font-extrabold break-words text-ink tablet:text-display-ml">
          {t('dashboard.greeting', { name: getDisplayName(user) })}
        </h1>
      </header>

      <section
        aria-label={t('dashboard.shareLink.label')}
        className="flex flex-col gap-4 rounded-card border border-line bg-card p-5 tablet:flex-row tablet:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-slot-soft text-ink"
          >
            <Link2 className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-sans text-caption leading-ui text-muted">{t('dashboard.shareLink.label')}</p>
            <p className="truncate font-mono text-body-l leading-ui font-medium text-ink">{displayUrl}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="md" onClick={() => void handleCopy()}>
            {copied ? t('dashboard.shareLink.copied') : t('dashboard.shareLink.copy')}
          </Button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-button border border-line bg-card px-5 py-3 font-sans text-body leading-ui font-semibold whitespace-nowrap text-ink transition-colors hover:border-muted"
          >
            {t('dashboard.shareLink.open')}
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 tablet:grid-cols-3" aria-label={t('dashboard.eyebrow')}>
        <StatCard
          label={t('dashboard.stats.upcoming')}
          value={stats.upcoming}
          sub={t('dashboard.stats.upcomingSub', { count: stats.upcomingThisWeek })}
        />
        <StatCard label={t('dashboard.stats.pending')} value={stats.pending} sub={t('dashboard.stats.pendingSub')} />
        <StatCard label={t('dashboard.stats.month')} value={stats.thisMonth} sub={monthSub} />
      </section>

      <Tabs<DashboardTab>
        variant="underline"
        idBase={TABS_ID}
        label={t('dashboard.tabsLabel')}
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'availability', label: t('dashboard.availabilityTab') },
          { value: 'appointments', label: t('dashboard.appointmentsTab') },
        ]}
      />

      <div
        role="tabpanel"
        id={getPanelId(TABS_ID, activeTab)}
        aria-labelledby={getTabId(TABS_ID, activeTab)}
      >
        {activeTab === 'availability' ? (
          <WorkingHoursForm pubkey={user.pubkey} signer={signer} />
        ) : (
          <BookedEventsList
            pubkey={user.pubkey}
            signer={signer}
            hostTimezone={hostTimezone}
            appointments={appointments}
            onAppointmentsChange={setAppointments}
            isLoading={isLoading}
            loadError={error}
            onRefresh={() => void reload()}
          />
        )}
      </div>
    </div>
  );
};
