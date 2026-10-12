// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../src/client/components/layout/Header';
import { getDisplayName, shortNpub } from '../src/client/components/layout/UserMenu';
import { getActiveNav, NAV_ROUTES } from '../src/client/components/layout/nav';
import { I18nProvider } from '../src/client/i18n';
import { ThemeProvider } from '../src/client/context/ThemeContext';
import { AuthProvider, useAuth } from '../src/client/context/AuthContext';

const SignIn: React.FC = () => {
  const { loginAsGuest } = useAuth();
  useEffect(() => {
    loginAsGuest();
  }, [loginAsGuest]);
  return null;
};

const renderHeader = (options: { path?: string; signedIn?: boolean } = {}) => {
  const tree = (path: string) => (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          {options.signedIn && <SignIn />}
          <Header currentPath={path} />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
  const utils = render(tree(options.path ?? '/'));
  return { ...utils, rerenderAt: (path: string) => utils.rerender(tree(path)) };
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('nav helpers', () => {
  it('maps router paths to the active section', () => {
    expect(getActiveNav('/')).toBe('home');
    expect(getActiveNav('')).toBe('home');
    expect(getActiveNav('/delirehberi@emre.xyz')).toBe('home');
    expect(getActiveNav('/npub1abc')).toBe('home');
    expect(getActiveNav('/about')).toBe('about');
    expect(getActiveNav('/About/')).toBe('about');
    expect(getActiveNav('/dashboard')).toBe('dashboard');
    expect(NAV_ROUTES).toEqual({ home: '#/', about: '#/about', dashboard: '#/dashboard' });
  });

  it('derives the avatar name from profile, NIP-05 or npub', () => {
    const npub = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4kz2';
    expect(getDisplayName({ npub, profile: { displayName: 'Emre' } })).toBe('Emre');
    expect(getDisplayName({ npub, nip05: 'delirehberi@emre.xyz' })).toBe('delirehberi');
    expect(getDisplayName({ npub })).toBe(shortNpub(npub));
    expect(shortNpub(npub)).toBe('npub1qqqqq…4kz2');
  });
});

describe('Header (signed out)', () => {
  it('shows the Kün lockup without the domain or protocol name', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('img', { name: 'Kün' })).toBeTruthy();
    expect(header.textContent).not.toMatch(/cal\.emre\.xyz|NIP-52/i);
  });

  it('has Home, About and Support links with the right targets', () => {
    renderHeader();
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
    expect((within(nav).getByRole('link', { name: 'Home' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/');
    expect((within(nav).getByRole('link', { name: 'About' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/about');
    const support = within(nav).getByRole('link', { name: 'Support' }) as HTMLAnchorElement;
    expect(support.getAttribute('href')).toBe('mailto:z@emre.xyz');
    expect(support.querySelector('svg')).not.toBeNull();
  });

  it('marks the current page with aria-current', () => {
    const { rerenderAt } = renderHeader({ path: '/' });
    const nav = () => screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
    expect(within(nav()).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav()).getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBeNull();

    rerenderAt('/about');
    expect(within(nav()).getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav()).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('switches between English and Turkish and keeps the choice', async () => {
    const user = userEvent.setup();
    renderHeader();
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).queryByRole('button', { name: /español|ES/ })).toBeNull();

    await user.click(within(group).getByRole('button', { name: 'Türkçe' }));
    expect(screen.getAllByRole('link', { name: 'Ana Sayfa' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Hakkında' }).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('cal_locale')).toBe('tr');
    expect(within(screen.getByRole('group', { name: 'Dil' })).getByRole('button', { name: 'Türkçe' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the theme and persists it', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('cal_theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('opens the login modal from the Log in button', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getAllByRole('button', { name: 'Log in' })[0]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('opens and closes the mobile menu with the keyboard and on navigation', async () => {
    const user = userEvent.setup();
    const { rerenderAt } = renderHeader();
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await user.click(button);
    expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open menu' }));

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await act(async () => rerenderAt('/about'));
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Header (signed in)', () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    const trigger = await screen.findByRole('button', { name: /^Account menu:/ });
    await user.click(trigger);
    return { trigger, menu: screen.getByRole('menu', { name: 'Account menu' }) };
  };

  it('shows the avatar pill instead of the Log in button', async () => {
    renderHeader({ signedIn: true });
    const trigger = await screen.findByRole('button', { name: /^Account menu:/ });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('lists the account actions and only Log out is danger-styled', async () => {
    const user = userEvent.setup();
    renderHeader({ signedIn: true });
    const { menu } = await openMenu(user);
    const names = within(menu).getAllByRole('menuitem').map((item) => item.textContent);
    expect(names).toContain('Copy npub');
    expect(names).toContain('Dashboard');
    expect(names[names.length - 1]).toBe('Log out');
    const danger = within(menu).getAllByRole('menuitem').filter((item) => item.className.includes('text-danger'));
    expect(danger.map((item) => item.textContent)).toEqual(['Log out']);
    expect((within(menu).getByRole('menuitem', { name: 'Dashboard' }) as HTMLAnchorElement).getAttribute('href')).toBe('#/dashboard');
  });

  it('highlights the dashboard entry on the dashboard page', async () => {
    const user = userEvent.setup();
    renderHeader({ signedIn: true, path: '/dashboard' });
    const { menu } = await openMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
  });

  it('navigates the menu with arrow keys, Home and End, then closes with Escape', async () => {
    const user = userEvent.setup();
    renderHeader({ signedIn: true });
    const trigger = await screen.findByRole('button', { name: /^Account menu:/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu', { name: 'Account menu' });
    const items = within(menu).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside click and on Tab', async () => {
    const user = userEvent.setup();
    renderHeader({ signedIn: true });
    await openMenu(user);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();

    await openMenu(user);
    await user.keyboard('{ArrowDown}{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('copies the npub and confirms without closing the menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderHeader({ signedIn: true });
    const { menu } = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Copy npub' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/^npub1/);
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Copied!' })).toBeTruthy();
  });

  it('logs out from the menu', async () => {
    const user = userEvent.setup();
    renderHeader({ signedIn: true });
    const { menu } = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
