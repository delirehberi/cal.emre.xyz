import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { LoginModal } from '../auth/LoginModal';
import { Lockup } from '../brand';
import { LanguageSwitch } from './LanguageSwitch';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { NAV_ROUTES } from './nav';

export interface HeaderProps {
  /** Router path (the part after `#`), used to mark the current page. */
  currentPath?: string;
}

/**
 * Site header. 72 / 68 / 60 px tall at desktop / tablet / mobile.
 * Desktop: lockup, nav, language, theme, login or avatar pill.
 * Tablet: lockup, language, theme, login or avatar; nav lives in the menu.
 * Mobile: lockup, theme and a single menu (signed out) or avatar (signed in).
 */
export const Header: React.FC<HeaderProps> = ({ currentPath = '/' }) => {
  const { t } = useTranslation();
  const { isLoggedIn, user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-[60px] w-full items-center gap-2.5 border-b border-line bg-paper px-4 tablet:h-[68px] tablet:gap-3.5 tablet:px-8 desktop:h-[72px] desktop:gap-5 desktop:px-10">
        <a href={NAV_ROUTES.home} aria-label={t('header.homeAria')} className="shrink-0 rounded-control">
          <Lockup />
        </a>

        <div className="flex-1" />

        <NavLinks currentPath={currentPath} className="hidden desktop:flex" />
        <LanguageSwitch className="hidden tablet:flex" />
        <ThemeToggle />

        {isLoggedIn && user ? (
          <UserMenu currentPath={currentPath} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="hidden cursor-pointer rounded-control border border-line px-4 py-2 font-sans text-ui leading-ui font-semibold text-ink transition-colors hover:border-muted tablet:block"
            >
              {t('header.login')}
            </button>
            <MobileMenu currentPath={currentPath} onLogin={() => setIsLoginOpen(true)} />
          </>
        )}
      </header>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
};
