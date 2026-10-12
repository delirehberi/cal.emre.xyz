import React, { useEffect, useId, useRef, useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Button } from '../ui/Button';
import { LanguageSwitch } from './LanguageSwitch';
import { NavLinks } from './NavLinks';

export interface MobileMenuProps {
  currentPath: string;
  onLogin: () => void;
}

/**
 * Disclosure menu for signed-out visitors below the desktop breakpoint.
 * It holds the nav links; the language switch and login button join it on phones,
 * where the header itself only has room for the theme toggle.
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({ currentPath, onLogin }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  const Icon = open ? X : MenuIcon;

  return (
    <div ref={rootRef} className="desktop:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink"
      >
        <Icon aria-hidden="true" className="h-[22px] w-[22px]" />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-40 flex flex-col gap-3 border-b border-line bg-paper px-4 py-3 tablet:px-8"
        >
          <NavLinks currentPath={currentPath} orientation="stacked" onNavigate={() => setOpen(false)} />
          <div className="flex flex-col gap-3 border-t border-line pt-3 tablet:hidden">
            <LanguageSwitch className="self-start" />
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                onLogin();
              }}
            >
              {t('header.login')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
