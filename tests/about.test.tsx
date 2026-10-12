// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../src/client/i18n';
import { AuthProvider } from '../src/client/context/AuthContext';
import { APP_CONFIG } from '../src/config';
import { parseRoute } from '../src/client/lib/router';

vi.mock('../src/client/lib/nostr/relays', () => ({
  nostrPool: {
    fetchHostProfile: vi.fn().mockResolvedValue(null),
    fetchHostRelays: vi.fn().mockResolvedValue({ all: [], read: [], write: [] }),
    fetchHostAvailability: vi.fn().mockResolvedValue(null),
    fetchCalendarEvents: vi.fn().mockResolvedValue({ timeEvents: [] }),
    fetchCalendarRSVPs: vi.fn().mockResolvedValue([]),
  },
}));

import { AboutPage } from '../src/client/pages/AboutPage';
import { App } from '../src/client/App';

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('cal_locale', 'en');
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  vi.unstubAllGlobals();
});

describe('AboutPage', () => {
  const renderPage = () => render(
      <I18nProvider>
        <AuthProvider>
          <AboutPage />
        </AuthProvider>
      </I18nProvider>
    );

  it('has one h1 and an h2/h3 outline that follows it', () => {
    const { container } = renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Your calendar.');

    const levels = Array.from(container.querySelectorAll('h1, h2, h3')).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, index) => {
      expect(level - levels[index]).toBeLessThanOrEqual(1);
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Your address or npub becomes the link.' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Open source',
      'Your own key',
      'Your own server',
      'Get your link',
      'Write your availability',
      'Share',
    ]);
  });

  it('links to the repository, the issues and the Lightning address', () => {
    renderPage();
    const repo = APP_CONFIG.repoUrl;
    expect(screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')).toBe(repo);
    expect(screen.getByRole('link', { name: 'Star on GitHub' }).getAttribute('href')).toBe(repo);
    expect(screen.getByRole('link', { name: 'Open issues' }).getAttribute('href')).toBe(`${repo}/issues`);
    expect(screen.getByRole('link', { name: 'Support the project over Lightning' }).getAttribute('href')).toBe(
      'lightning:delirehberi@emre.xyz'
    );
    expect(screen.getByRole('link', { name: 'Open your page' }).getAttribute('href')).toBe('#/dashboard');
  });

  it('does not claim a first home for the nostr.org.tr community', () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/ilk evi|first home/i);
  });

  it('shows the self-hosting commands in a code block and copies them', async () => {
    const user = userEvent.setup();
    renderPage();

    const block = screen.getByLabelText('Self-hosting commands');
    expect(block.tagName).toBe('PRE');
    expect(block.querySelector('code')).toBeTruthy();
    const text = block.textContent ?? '';
    expect(text).toContain('DEFAULT_HOST_NIP05=you@example.com');
    expect(text).toContain('DEFAULT_HOST_PUBKEY=<hex public key>');
    expect(text).toContain('make install && make deploy');
    expect(text.split('\n')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(text);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('renders the Turkish copy', () => {
    window.localStorage.setItem('cal_locale', 'tr');
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Takvimin senin.');
    expect(screen.getByRole('link', { name: 'Projeye Lightning ile destek ol' })).toBeTruthy();
    expect(screen.getByText('# kendi bilgilerini yaz')).toBeTruthy();
  });
});

describe('/#/about route', () => {
  it('is reserved and never parsed as a host identifier', () => {
    expect(parseRoute('/about')).toEqual({ name: 'about' });
    expect(parseRoute('/about/')).toEqual({ name: 'about' });
  });

  it('renders the About page with the nav entry marked as current', async () => {
    window.location.hash = '#/about';
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Your calendar.');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });
});
