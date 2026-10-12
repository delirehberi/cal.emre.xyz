import React from 'react';
import { useTranslation } from '../../i18n';
import { APP_CONFIG } from '../../../config';

const GITHUB_URL = APP_CONFIG.repoUrl;
const NIP52_URL = 'https://nostrhub.io/nip/52';
const NOSTR_ORG_TR_URL = 'https://nostr.org.tr';

const LINK_CLASS = 'rounded-control transition-colors hover:text-ink';

export const Footer: React.FC = () => {
  const { t, educationalUrl } = useTranslation();
  const educationalLabel = new URL(educationalUrl).hostname;

  return (
    <footer className="mt-auto flex w-full flex-col items-start gap-4 border-t border-line px-4 py-6 transition-colors tablet:flex-row tablet:items-center tablet:justify-between tablet:px-8 tablet:py-7 desktop:px-10">
      <a
        href={NOSTR_ORG_TR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-nostr-soft py-[7px] pr-3.5 pl-3 font-sans text-caption leading-ui font-semibold text-nostr"
      >
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-nostr" />
        {t('footer.nostrBadge')}
      </a>
      <nav aria-label={t('footer.linksLabel')} className="flex gap-5 font-sans text-caption leading-ui font-medium text-muted">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          GitHub
        </a>
        <a href={NIP52_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          NIP-52
        </a>
        <a href={educationalUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {educationalLabel}
        </a>
      </nav>
    </footer>
  );
};
