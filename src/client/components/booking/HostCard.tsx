import React from 'react';
import { BadgeCheck, Globe } from 'lucide-react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useTranslation } from '../../i18n';
import type { HostProfile } from '../../lib/nostr/relays';

export interface HostCardProps {
  profile: HostProfile | null;
  nip05Identifier?: string;
  timezone: string;
  isLoading?: boolean;
}

export const HostCard: React.FC<HostCardProps> = ({
  profile,
  nip05Identifier,
  timezone,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" className="h-16 w-16" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  const displayName =
    profile?.displayName ||
    profile?.name ||
    nip05Identifier?.split('@')[0] ||
    'Host';

  const displayNip05 = profile?.nip05 || nip05Identifier;

  const pictureUrl = profile?.picture
    ? profile.picture.startsWith('http://') ||
      profile.picture.startsWith('https://') ||
      profile.picture.startsWith('data:')
      ? profile.picture
      : `https://${profile.picture}`
    : null;

  const [imageError, setImageError] = React.useState(false);

  // Use localized explanation if about matches default or is empty
  const isDefaultBio =
    !profile?.about ||
    profile.about === 'Sovereign Nostr scheduling and appointments' ||
    profile.about.includes('Schedule a meeting with me') ||
    profile.about.includes('You can schedule a meeting');

  const bioText = isDefaultBio ? t('booking.hostCard.defaultBio') : profile?.about;

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-4">
        {pictureUrl && !imageError ? (
          <img
            src={pictureUrl}
            alt={displayName}
            onError={() => setImageError(true)}
            className="h-16 w-16 rounded-2xl object-cover border border-stone-200 dark:border-stone-800 shadow-xs"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-xl font-bold shadow-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 truncate">
              {displayName}
            </h2>
            {displayNip05 && (
              <span
                title={t('booking.hostCard.verifiedBadge')}
                className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400"
              >
                <BadgeCheck className="h-4 w-4" />
              </span>
            )}
          </div>

          {displayNip05 && (
            <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate">
              {displayNip05}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              <span className="truncate">{timezone}</span>
            </div>
          </div>
        </div>
      </div>

      {bioText && (
        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed border-t border-stone-100 dark:border-stone-800/80 pt-3">
          {bioText}
        </p>
      )}
    </Card>
  );
};
