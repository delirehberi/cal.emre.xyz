import React from 'react';
import { useTranslation } from '../../i18n';
import { Code, BookOpen, Globe2, Shield } from 'lucide-react';
import { APP_CONFIG } from '../../../config';

export const Footer: React.FC = () => {
  const { t, educationalUrl } = useTranslation();

  return (
    <footer className="mt-auto w-full border-t border-stone-200 bg-stone-50/50 py-8 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-400 transition-colors">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="font-medium text-stone-700 dark:text-stone-300">
            {t('footer.description')}
          </p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            {t('footer.license')} • {APP_CONFIG.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
          <a
            href="https://nostrhub.io/nip/52"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{t('footer.nip52Spec')}</span>
          </a>

          <a
            href={educationalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{t('footer.whatIsNostr')}</span>
          </a>

          <a
            href="https://nostr.org.tr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
          >
            <Globe2 className="h-3.5 w-3.5" />
            <span>{t('footer.nostrOrgTr')}</span>
          </a>

          <a
            href="https://github.com/delirehberi/cal.emre.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
          >
            <Code className="h-3.5 w-3.5" />
            <span>{t('footer.githubRepo')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
