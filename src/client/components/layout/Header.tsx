import React, { useState } from 'react';
import { Calendar, Sun, Moon, LogIn, User, Copy, Check, ExternalLink, LogOut, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Dropdown, type DropdownItem } from '../ui/Dropdown';
import { LoginModal } from '../auth/LoginModal';
import { APP_CONFIG } from '../../../config';

export interface HeaderProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/', onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const { user, isLoggedIn, logout } = useAuth();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [copiedNpub, setCopiedNpub] = useState(false);

  const handleCopyNpub = async () => {
    if (!user?.npub) return;
    try {
      await navigator.clipboard.writeText(user.npub);
      setCopiedNpub(true);
      setTimeout(() => setCopiedNpub(false), 2000);
    } catch {
      // Fallback
    }
  };

  const dropdownItems: (DropdownItem | 'divider')[] = [
    {
      id: 'profile',
      label: user?.nip05 || (user?.npub ? `${user.npub.slice(0, 10)}...${user.npub.slice(-4)}` : 'Nostr User'),
      icon: <User className="h-4 w-4" />,
      onClick: () => {},
      disabled: true,
    },
    {
      id: 'copy-npub',
      label: copiedNpub ? t('common.copied') : t('common.copy') + ' npub',
      icon: copiedNpub ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />,
      onClick: handleCopyNpub,
    },
    'divider',
    {
      id: 'dashboard',
      label: t('header.dashboard'),
      icon: <LayoutDashboard className="h-4 w-4" />,
      onClick: () => {
        if (onNavigate) {
          onNavigate('/dashboard');
        } else if (typeof window !== 'undefined') {
          window.location.hash = '/dashboard';
        }
      },
    },
    'divider',
    {
      id: 'logout',
      label: t('header.logout'),
      icon: <LogOut className="h-4 w-4" />,
      onClick: logout,
      danger: true,
    },
  ];

  const handleNavClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      if (path === '/') {
        window.location.pathname = '/';
        window.location.hash = '';
      } else {
        window.location.hash = path;
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-white/85 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-900/85 transition-colors">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo */}
          <div
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-100 dark:text-stone-900 transition-transform group-hover:scale-105">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-50">
                cal.emre.xyz
              </span>
              <span className="text-[10px] -mt-1 font-mono text-stone-500 dark:text-stone-400">
                NIP-52
              </span>
            </div>
          </div>

          {/* Navigation Links & Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="hidden md:flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={() => handleNavClick('/')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  currentPath === '/'
                    ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-50'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800/50'
                }`}
              >
                {t('header.home')}
              </button>

              <a
                href={`mailto:${APP_CONFIG.supportEmail}`}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800/50 transition-colors"
              >
                <span>{t('header.support')}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </nav>

            {/* Language Switcher */}
            <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-stone-800 dark:bg-stone-950">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  locale === 'en'
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-50'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                }`}
                aria-label="English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('tr')}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  locale === 'tr'
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-50'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                }`}
                aria-label="Turkish"
              >
                TR
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors cursor-pointer"
              aria-label={theme === 'light' ? t('header.themeDark') : t('header.themeLight')}
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4 text-amber-400" />
              )}
            </button>

            {/* Auth Dropdown or Login Button */}
            {isLoggedIn && user ? (
              <Dropdown
                align="right"
                trigger={
                  <div className="flex items-center gap-2 rounded-full border border-stone-200 p-1 pr-2.5 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60 transition-colors">
                    {user.profile?.picture ? (
                      <img
                        src={user.profile.picture}
                        alt={user.profile.displayName || user.npub}
                        className="h-7 w-7 rounded-full object-cover bg-stone-200 dark:bg-stone-700"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold">
                        {(user.profile?.displayName || user.npub || 'U').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-xs font-medium text-stone-700 dark:text-stone-300 max-w-[90px] truncate">
                      {user.profile?.displayName || user.nip05 || `${user.npub.slice(0, 8)}...`}
                    </span>
                  </div>
                }
                items={dropdownItems}
              />
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsLoginModalOpen(true)}
                leftIcon={<LogIn className="h-3.5 w-3.5" />}
              >
                {t('header.login')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
