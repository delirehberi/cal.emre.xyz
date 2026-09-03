import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import type { Locale } from '../../i18n/types';

const LOCALES: ReadonlyArray<{ code: Locale; label: string; name: string }> = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'tr', label: 'TR', name: 'Türkçe' },
  { code: 'es', label: 'ES', name: 'Español' },
];

/** Segmented EN / TR / ES control. Language names stay in their own language. */
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('header.language')}
      className={clsx('flex items-center rounded-full border border-line p-[3px]', className)}
    >
      {LOCALES.map(({ code, label, name }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-label={name}
            aria-pressed={active}
            onClick={() => setLocale(code)}
            className={clsx(
              'cursor-pointer rounded-full px-2.5 py-[5px] font-mono text-label leading-ui font-medium transition-colors',
              active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
