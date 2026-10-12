import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, LayoutDashboard, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { Menu, type MenuEntry } from '../ui/Menu';
import { NAV_ROUTES, getActiveNav } from './nav';
import { APP_CONFIG } from '../../../config';

const ICON = 'h-4 w-4 shrink-0';

export const shortNpub = (npub: string): string => `${npub.slice(0, 10)}…${npub.slice(-4)}`;

/** Name shown next to the avatar: profile name, else the NIP-05 name part, else a short npub. */
export const getDisplayName = (user: { npub: string; nip05?: string; profile?: { displayName?: string } }): string =>
  user.profile?.displayName || user.nip05?.split('@')[0] || shortNpub(user.npub);

export interface UserMenuProps {
  currentPath: string;
}

/**
 * Avatar pill and account menu for a signed-in host.
 * Below the desktop breakpoint the header has no inline nav or language switch,
 * so those entries are included in this menu and hidden again at desktop width.
 */
export const UserMenu: React.FC<UserMenuProps> = ({ currentPath }) => {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = getActiveNav(currentPath);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  if (!user) return null;

  const copyNpub = async () => {
    try {
      await navigator.clipboard.writeText(user.npub);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const name = getDisplayName(user);
  const picture = user.profile?.picture;

  const items: MenuEntry[] = [
    { id: 'nav-home', label: t('header.home'), href: NAV_ROUTES.home, current: active === 'home', className: 'desktop:hidden' },
    { id: 'nav-about', label: t('header.about'), href: NAV_ROUTES.about, current: active === 'about', className: 'desktop:hidden' },
    { id: 'nav-support', label: t('header.support'), href: `mailto:${APP_CONFIG.supportEmail}`, external: true, className: 'desktop:hidden' },
    { id: 'nav-divider', divider: true, className: 'desktop:hidden' },
    { id: 'lang-en', label: 'English', current: locale === 'en', onSelect: () => setLocale('en'), className: 'tablet:hidden' },
    { id: 'lang-tr', label: 'Türkçe', current: locale === 'tr', onSelect: () => setLocale('tr'), className: 'tablet:hidden' },
    { id: 'lang-divider', divider: true, className: 'tablet:hidden' },
    {
      id: 'identity',
      text: true,
      label: user.nip05 || shortNpub(user.npub),
      icon: <User aria-hidden="true" className={ICON} />,
    },
    {
      id: 'copy-npub',
      label: copied ? t('common.copied') : t('header.copyNpub'),
      icon: copied ? <Check aria-hidden="true" className={ICON} /> : <Copy aria-hidden="true" className={ICON} />,
      onSelect: copyNpub,
      keepOpen: true,
    },
    { id: 'divider-1', divider: true },
    {
      id: 'dashboard',
      label: t('header.dashboard'),
      icon: <LayoutDashboard aria-hidden="true" className={ICON} />,
      href: NAV_ROUTES.dashboard,
      current: active === 'dashboard',
    },
    { id: 'divider-2', divider: true },
    {
      id: 'logout',
      label: t('header.logout'),
      icon: <LogOut aria-hidden="true" className={ICON} />,
      onSelect: logout,
      danger: true,
    },
  ];

  return (
    <Menu
      items={items}
      label={t('header.userMenu')}
      renderTrigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`${t('header.userMenu')}: ${name}`}
          className="flex cursor-pointer items-center gap-2 rounded-full transition-colors desktop:border desktop:border-line desktop:py-1 desktop:pr-3.5 desktop:pl-1 desktop:hover:border-muted"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slot bg-slot-soft font-sans text-body leading-ui font-semibold text-ink desktop:h-[30px] desktop:w-[30px]">
            {picture ? (
              <img src={picture} alt="" className="h-full w-full object-cover" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="hidden font-sans text-ui leading-ui font-medium text-ink desktop:inline">{name}</span>
        </button>
      )}
    />
  );
};
