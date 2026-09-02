import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Locale, TranslationDictionary } from './types';
import { en } from './en';
import { tr } from './tr';
import { APP_CONFIG } from '../../config';

const STORAGE_KEY = 'cal_locale';

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  dict: TranslationDictionary;
  educationalUrl: string;
}

const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  tr,
};

export const getInitialLocale = (): Locale => {
  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    if (storage) {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'tr') {
        return saved;
      }
    }
    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language.toLowerCase();
      if (browserLang.startsWith('tr')) {
        return 'tr';
      }
    }
  } catch {
    // Ignore storage errors in restricted sandbox/iframes
  }
  return 'en';
};

export const resolveTranslation = (
  dictionary: TranslationDictionary,
  path: string,
  params?: Record<string, string | number>
): string => {
  const parts = path.split('.');
  let current: unknown = dictionary;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  let result = current;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      result = result.replaceAll(`{${key}}`, String(value));
    }
  }

  return result;
};

const I18nContext = createContext<I18nContextType | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, initialLocale }) => {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale || getInitialLocale());

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      const storage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : typeof localStorage !== 'undefined'
            ? localStorage
            : null;
      if (storage) {
        storage.setItem(STORAGE_KEY, newLocale);
      }
    } catch {
      // Ignore storage errors
    }
    if (typeof window !== 'undefined' && document.documentElement) {
      document.documentElement.lang = newLocale;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && document.documentElement) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const dict = useMemo(() => dictionaries[locale] || en, [locale]);

  const educationalUrl = useMemo(() => {
    return locale === 'tr' ? APP_CONFIG.educationalLinks.tr : APP_CONFIG.educationalLinks.en;
  }, [locale]);

  const t = useMemo(
    () => (path: string, params?: Record<string, string | number>) => {
      return resolveTranslation(dict, path, params);
    },
    [dict]
  );

  const contextValue = useMemo<I18nContextType>(
    () => ({
      locale,
      setLocale,
      t,
      dict,
      educationalUrl,
    }),
    [locale, dict, educationalUrl, t]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
