import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const NostrEduBanner: React.FC = () => {
  const { t, educationalUrl } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-xs dark:border-stone-800 dark:bg-stone-900/40">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <h4 className="font-semibold text-stone-900 dark:text-stone-100">
          {t('booking.nostrBanner.title')}
        </h4>
        <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
          {t('booking.nostrBanner.description')}
        </p>
        <a
          href={educationalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 pt-0.5 transition-colors"
        >
          <span>{t('booking.nostrBanner.learnMore')}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};
