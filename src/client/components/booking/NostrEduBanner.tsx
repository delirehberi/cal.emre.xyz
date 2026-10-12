import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';

/**
 * One line shown to visitors without a Nostr account: a key is generated for the booking,
 * with a link to the Nostr introduction (nostr.com in English, nostr.org.tr in Turkish).
 */
export const NostrEduBanner: React.FC = () => {
  const { t, educationalUrl } = useTranslation();

  return (
    <p className="font-sans text-small text-muted">
      {t('booking.form.guestNote')}{' '}
      <a
        href={educationalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-ink hover:underline"
      >
        {t('booking.form.learnMore')}
        <ExternalLink aria-hidden="true" className="h-3 w-3" />
      </a>
    </p>
  );
};
