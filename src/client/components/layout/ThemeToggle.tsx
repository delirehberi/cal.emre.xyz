import React from 'react';
import { clsx } from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../i18n';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const Icon = theme === 'light' ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? t('header.themeDark') : t('header.themeLight')}
      className={clsx(
        'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-muted',
        className
      )}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
    </button>
  );
};
