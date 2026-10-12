import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Called when the item is chosen. */
  onSelect?: () => void;
  /** Renders the item as a link instead of a button. */
  href?: string;
  /** Opens `href` in a new tab and shows an external-link icon. */
  external?: boolean;
  /** Reserved for "Log out"; the only red item. */
  danger?: boolean;
  /** Marks the item for the page the user is on (`aria-current`). */
  current?: boolean;
  /** Plain text row (e.g. the signed-in identity); not focusable. */
  text?: boolean;
  /** Keep the menu open after choosing the item. */
  keepOpen?: boolean;
  /** Extra classes, e.g. `desktop:hidden` for entries that duplicate controls shown in the header. */
  className?: string;
}

export interface MenuDivider {
  id: string;
  divider: true;
  className?: string;
}

export type MenuEntry = MenuItem | MenuDivider;

export interface MenuTriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export interface MenuProps {
  items: ReadonlyArray<MenuEntry>;
  renderTrigger: (props: MenuTriggerProps, state: { open: boolean }) => React.ReactElement;
  /** Accessible name of the menu. */
  label: string;
  align?: 'left' | 'right';
  className?: string;
}

const ITEM_BASE =
  'flex w-full items-center gap-2.5 rounded-control px-2.5 py-[9px] text-left font-sans text-ui leading-ui font-medium transition-colors';

const itemClasses = (item: MenuItem): string =>
  clsx(
    ITEM_BASE,
    item.text ? 'text-muted' : 'cursor-pointer focus:outline-none focus-visible:bg-line',
    !item.text && (item.danger ? 'text-danger' : 'text-ink'),
    !item.text && 'hover:bg-line',
    item.current && 'bg-line',
    item.className
  );

const FOCUSABLE = '[role="menuitem"]';

/** False when the node or an ancestor inside the panel is `display: none` (e.g. hidden by a breakpoint class). */
const isRendered = (node: HTMLElement, boundary: HTMLElement | null): boolean => {
  for (let el: HTMLElement | null = node; el && el !== boundary; el = el.parentElement) {
    if (window.getComputedStyle(el).display === 'none') return false;
  }
  return true;
};

/**
 * Accessible menu button + popover (WAI-ARIA menu button pattern).
 * Arrow keys / Home / End move between items, Escape closes and returns focus to the trigger,
 * Tab and outside clicks close it.
 */
export const Menu: React.FC<MenuProps> = ({ items, renderTrigger, label, align = 'right', className }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const triggerId = `${reactId}-trigger`;
  const panelId = `${reactId}-menu`;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const focusItem = useCallback((target: 'first' | 'last' | 'next' | 'prev') => {
    // Entries hidden by responsive classes cannot take focus, so keyboard navigation skips them.
    const panel = panelRef.current;
    const nodes = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((node) =>
      isRendered(node, panel)
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next =
      target === 'first'
        ? 0
        : target === 'last'
          ? nodes.length - 1
          : target === 'next'
            ? (index + 1) % nodes.length
            : (index - 1 + nodes.length) % nodes.length;
    nodes[next].focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pendingFocus = useRef<'first' | 'last' | null>(null);
  useEffect(() => {
    if (open && pendingFocus.current) {
      focusItem(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [open, focusItem]);

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const target = event.key === 'ArrowDown' ? 'first' : 'last';
        if (open) {
          focusItem(target);
        } else {
          pendingFocus.current = target;
          setOpen(true);
        }
      } else if (event.key === 'Tab' && open) {
        setOpen(false);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    },
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem('next');
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem('prev');
        break;
      case 'Home':
        event.preventDefault();
        focusItem('first');
        break;
      case 'End':
        event.preventDefault();
        focusItem('last');
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const choose = (item: MenuItem) => {
    item.onSelect?.();
    if (!item.keepOpen) close(true);
  };

  return (
    <div ref={rootRef} className={clsx('relative inline-block text-left', className)}>
      {renderTrigger(triggerProps, { open })}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={label}
          onKeyDown={handlePanelKeyDown}
          className={clsx(
            'absolute z-50 mt-4 flex w-[220px] flex-col gap-0.5 rounded-[16px] border border-line bg-card p-1.5 shadow-popover',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item) => {
            if ('divider' in item) {
              return <div key={item.id} role="separator" className={clsx('my-0.5 h-px w-full bg-line', item.className)} />;
            }
            if (item.text) {
              return (
                <div key={item.id} role="none" className={itemClasses(item)}>
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }
            const content = (
              <>
                {item.icon}
                <span className="truncate">{item.label}</span>
                {item.external && <ExternalLink aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" />}
              </>
            );
            return item.href ? (
              <a
                key={item.id}
                role="menuitem"
                tabIndex={-1}
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => choose(item)}
                className={itemClasses(item)}
              >
                {content}
              </a>
            ) : (
              <button
                key={item.id}
                role="menuitem"
                tabIndex={-1}
                type="button"
                aria-current={item.current ? 'page' : undefined}
                onClick={() => choose(item)}
                className={itemClasses(item)}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
