import React, { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { useTranslation } from '../../i18n';
import type { HostProfile } from '../../lib/nostr/relays';
import { APP_CONFIG } from '../../../config';

export interface HostCardProps {
  profile: HostProfile | null;
  nip05Identifier?: string;
  timezone: string;
  isLoading?: boolean;
}

const CARD = 'flex w-full flex-col gap-4 rounded-card border border-line bg-card p-5 tablet:p-6 desktop:p-7';

/** Names of the placeholder bios that should be replaced by the localized default. */
const isPlaceholderBio = (about?: string): boolean =>
  !about ||
  about === 'Sovereign Nostr scheduling and appointments' ||
  about.includes('Schedule a meeting with me') ||
  about.includes('You can schedule a meeting') ||
  about === APP_CONFIG.defaultHostBio.en ||
  about === APP_CONFIG.defaultHostBio.tr;

const resolvePictureUrl = (picture?: string): string | null => {
  if (!picture) return null;
  return /^(https?:|data:)/.test(picture) ? picture : `https://${picture}`;
};

export const HostCard: React.FC<HostCardProps> = ({ profile, nip05Identifier, timezone, isLoading = false }) => {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);

  if (isLoading) {
    return (
      <div className={CARD} aria-busy="true">
        <Skeleton variant="text" className="h-3 w-28" />
        <div className="flex items-center gap-3.5">
          <Skeleton variant="circular" className="h-[60px] w-[60px] shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" className="h-5 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const displayName = profile?.displayName || profile?.name || nip05Identifier?.split('@')[0] || 'Host';
  const displayNip05 = profile?.nip05 || nip05Identifier;
  const pictureUrl = resolvePictureUrl(profile?.picture);
  const bioText = isPlaceholderBio(profile?.about) ? t('booking.hostCard.defaultBio') : profile?.about;

  return (
    <section aria-label={t('booking.hostCard.eyebrow')} className={CARD}>
      <p className="font-mono text-[11px] leading-ui font-medium tracking-[0.08em] text-muted uppercase">
        {t('booking.hostCard.eyebrow')}
      </p>

      <div className="flex items-center gap-3.5">
        {pictureUrl && !imageError ? (
          <img
            src={pictureUrl}
            alt=""
            onError={() => setImageError(true)}
            className="h-[60px] w-[60px] shrink-0 rounded-full border border-slot object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-slot bg-slot-soft font-display text-[30px] leading-none font-extrabold text-ink"
          >
            {displayName.charAt(0).toLowerCase()}
          </span>
        )}

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-display text-heading-m font-bold text-ink">{displayName}</h2>
            {displayNip05 && (
              <span title={t('booking.hostCard.verifiedBadge')} className="shrink-0 text-slot">
                <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                <span className="sr-only">{t('booking.hostCard.verifiedBadge')}</span>
              </span>
            )}
          </div>
          {displayNip05 && <p className="truncate font-mono text-label leading-ui text-muted">{displayNip05}</p>}
        </div>
      </div>

      {bioText && <p className="font-sans text-ui text-muted">{bioText}</p>}

      <div className="flex items-center gap-2 text-muted">
        <Globe aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="font-mono text-label leading-ui">{timezone}</span>
      </div>
    </section>
  );
};
