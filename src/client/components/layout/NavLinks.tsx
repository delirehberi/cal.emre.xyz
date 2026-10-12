import React from 'react';
import { clsx } from 'clsx';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { APP_CONFIG } from '../../../config';
import { NAV_ROUTES, getActiveNav } from './nav';

export interface NavLinksProps {
  currentPath: string;
  /** `inline` is the desktop row; `stacked` is the list inside the mobile menu. */
  orientation?: 'inline' | 'stacked';
  /** Called after a link is chosen (used to close the mobile menu). */
  onNavigate?: () => void;
  className?: string;
}

const LINK_BASE =
  'flex items-center gap-[5px] rounded-[8px] px-3 py-[7px] font-sans text-body leading-ui font-medium whitespace-nowrap transition-colors';

export const NavLinks: React.FC<NavLinksProps> = ({ currentPath, orientation = 'inline', onNavigate, className }) => {
  const { t } = useTranslation();
  const active = getActiveNav(currentPath);

  const linkClass = (isActive: boolean) =>
    clsx(LINK_BASE, isActive ? 'bg-line text-ink' : 'text-muted hover:text-ink');

  return (
    <nav
      aria-label={t('header.primaryNav')}
      className={clsx('flex gap-1.5', orientation === 'stacked' ? 'flex-col' : 'items-center', className)}
    >
      <a
        href={NAV_ROUTES.home}
        aria-current={active === 'home' ? 'page' : undefined}
        onClick={onNavigate}
        className={linkClass(active === 'home')}
      >
        {t('header.home')}
      </a>
      <a
        href={NAV_ROUTES.about}
        aria-current={active === 'about' ? 'page' : undefined}
        onClick={onNavigate}
        className={linkClass(active === 'about')}
      >
        {t('header.about')}
      </a>
      <a href={`mailto:${APP_CONFIG.supportEmail}`} onClick={onNavigate} className={linkClass(false)}>
        {t('header.support')}
        <ExternalLink aria-hidden="true" className="h-[13px] w-[13px]" />
      </a>
    </nav>
  );
};
