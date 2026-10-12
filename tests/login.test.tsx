// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../src/client/i18n';
import { ThemeProvider } from '../src/client/context/ThemeContext';
import { getNextTabIndex } from '../src/client/components/ui/Tabs';

const auth = vi.hoisted(() => ({
  loginWithExtension: vi.fn(),
  loginWithBunker: vi.fn(),
  loginWithNsec: vi.fn(),
  clearError: vi.fn(),
  error: null as string | null,
}));

vi.mock('../src/client/context/AuthContext', () => ({
  useAuth: () => auth,
}));

import { LoginModal } from '../src/client/components/auth/LoginModal';

const Harness: React.FC<{ onSuccess?: () => void; onClosed?: () => void }> = ({ onSuccess, onClosed }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open login
      </button>
      <LoginModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClosed?.();
        }}
        onSuccess={onSuccess}
      />
    </>
  );
};

const setup = async (props: { onSuccess?: () => void; onClosed?: () => void } = {}) => {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <I18nProvider>
        <Harness {...props} />
      </I18nProvider>
    </ThemeProvider>
  );
  await user.click(screen.getByRole('button', { name: 'Open login' }));
  return { user, dialog: await screen.findByRole('dialog') };
};

beforeEach(() => {
  window.localStorage.clear();
  auth.loginWithExtension.mockReset().mockResolvedValue(undefined);
  auth.loginWithBunker.mockReset().mockResolvedValue(undefined);
  auth.loginWithNsec.mockReset().mockResolvedValue(undefined);
  auth.clearError.mockReset();
  auth.error = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('tab keyboard helper', () => {
  it('moves between tabs with wrap-around and Home/End', () => {
    expect(getNextTabIndex(3, 0, 'ArrowRight')).toBe(1);
    expect(getNextTabIndex(3, 2, 'ArrowRight')).toBe(0);
    expect(getNextTabIndex(3, 0, 'ArrowLeft')).toBe(2);
    expect(getNextTabIndex(3, 1, 'Home')).toBe(0);
    expect(getNextTabIndex(3, 0, 'End')).toBe(2);
    expect(getNextTabIndex(3, 0, 'ArrowDown')).toBeNull();
    expect(getNextTabIndex(0, 0, 'ArrowRight')).toBeNull();
  });
});

describe('LoginModal', () => {
  it('opens as a labelled dialog with the three methods and the extension tab first', async () => {
    const { dialog } = await setup();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: 'Connect with Nostr' })).toBeTruthy();
    expect(dialog.getAttribute('aria-labelledby')).toBe(within(dialog).getByRole('heading', { name: 'Connect with Nostr' }).id);
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Extension', 'Bunker', 'Key']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(within(dialog).getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(within(dialog).getByRole('button', { name: 'Connect with extension' })).toBeTruthy();
  });

  it('switches tabs with click and arrow keys, moving focus with the selection', async () => {
    const { user, dialog } = await setup();
    const tabs = () => within(dialog).getAllByRole('tab');
    await user.click(tabs()[1]);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(within(dialog).getByRole('textbox', { name: 'Bunker link' })).toBeTruthy();

    await user.keyboard('{ArrowRight}');
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs()[2]);
    expect(tabs()[2].getAttribute('tabindex')).toBe('0');
    expect(tabs()[0].getAttribute('tabindex')).toBe('-1');

    await user.keyboard('{ArrowRight}');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('connects with the extension and closes on success', async () => {
    const onSuccess = vi.fn();
    const { user, dialog } = await setup({ onSuccess });
    await user.click(within(dialog).getByRole('button', { name: 'Connect with extension' }));
    expect(auth.loginWithExtension).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows an extension error in an alert that is not red and stays open', async () => {
    auth.loginWithExtension.mockRejectedValue(new Error('No NIP-07 extension found'));
    const { user, dialog } = await setup();
    await user.click(within(dialog).getByRole('button', { name: 'Connect with extension' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('No NIP-07 extension found');
    expect(alert.className).not.toMatch(/red|danger/);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows an error that comes from the auth context', async () => {
    auth.error = 'Invalid bunker URI';
    const { dialog } = await setup();
    expect(within(dialog).getByRole('alert').textContent).toContain('Invalid bunker URI');
  });

  it('only submits a bunker link when one is entered and trims it', async () => {
    const { user, dialog } = await setup();
    await user.click(within(dialog).getByRole('tab', { name: 'Bunker' }));
    const submit = within(dialog).getByRole('button', { name: 'Connect with bunker' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.type(within(dialog).getByRole('textbox', { name: 'Bunker link' }), '  bunker://abc?relay=wss://r  ');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await user.click(submit);
    expect(auth.loginWithBunker).toHaveBeenCalledWith('bunker://abc?relay=wss://r');
  });

  it('keeps the secret key masked until revealed and submits it', async () => {
    const { user, dialog } = await setup();
    await user.click(within(dialog).getByRole('tab', { name: 'Key' }));
    const field = within(dialog).getByLabelText('Secret key') as HTMLInputElement;
    expect(field.type).toBe('password');
    expect(field.autocomplete).toBe('off');

    const reveal = within(dialog).getByRole('button', { name: 'Show key' });
    expect(reveal.getAttribute('aria-pressed')).toBe('false');
    await user.click(reveal);
    expect(field.type).toBe('text');
    expect(within(dialog).getByRole('button', { name: 'Hide key' }).getAttribute('aria-pressed')).toBe('true');

    await user.type(field, 'nsec1testkey');
    await user.click(within(dialog).getByRole('button', { name: 'Connect with key' }));
    expect(auth.loginWithNsec).toHaveBeenCalledWith('nsec1testkey');
  });

  it('generates a fresh key, reveals it, offers a copy button and connects with it', async () => {
    const { user, dialog } = await setup();
    await user.click(within(dialog).getByRole('tab', { name: 'Key' }));
    await user.click(within(dialog).getByRole('button', { name: 'No key yet? Generate a new one' }));

    const field = within(dialog).getByLabelText('Secret key') as HTMLInputElement;
    expect(field.value).toMatch(/^nsec1[a-z0-9]{58}$/);
    expect(field.type).toBe('text');
    expect(within(dialog).getByText(/A new key was generated/)).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(field.value);
    expect(await within(dialog).findByRole('button', { name: 'Copied!' })).toBeTruthy();

    const first = field.value;
    await user.click(within(dialog).getByRole('button', { name: 'No key yet? Generate a new one' }));
    expect((within(dialog).getByLabelText('Secret key') as HTMLInputElement).value).not.toBe(first);

    await user.click(within(dialog).getByRole('button', { name: 'Connect with key' }));
    expect(auth.loginWithNsec).toHaveBeenCalledTimes(1);
    expect(auth.loginWithNsec.mock.calls[0][0]).toMatch(/^nsec1/);
  });

  it('closes on Escape and gives focus back to the opener', async () => {
    const onClosed = vi.fn();
    const { user } = await setup({ onClosed });
    await user.keyboard('{Escape}');
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open login' }));
  });

  it('closes from the close button and from the scrim', async () => {
    const onClosed = vi.fn();
    const { user, dialog } = await setup({ onClosed });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClosed).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Open login' }));
    const scrim = (await screen.findByRole('dialog')).parentElement!.firstElementChild as HTMLElement;
    await user.click(scrim);
    expect(onClosed).toHaveBeenCalledTimes(2);
  });

  it('traps Tab inside the dialog and starts with focus on the first tab', async () => {
    const { user, dialog } = await setup();
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    expect(focusable.length).toBeGreaterThan(2);
    expect(document.activeElement).toBe(within(dialog).getAllByRole('tab')[0]);

    const last = focusable[focusable.length - 1];
    last.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);

    focusable[0].focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('locks page scroll while open and releases it on close', async () => {
    const { user } = await setup();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('clears typed secrets when the dialog closes', async () => {
    const { user, dialog } = await setup();
    await user.click(within(dialog).getByRole('tab', { name: 'Key' }));
    await user.type(within(dialog).getByLabelText('Secret key'), 'nsec1secret');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open login' }));
    const reopened = await screen.findByRole('dialog');
    await user.click(within(reopened).getByRole('tab', { name: 'Key' }));
    expect((within(reopened).getByLabelText('Secret key') as HTMLInputElement).value).toBe('');
  });

  it('renders the Turkish copy from the design', async () => {
    window.localStorage.setItem('cal_locale', 'tr');
    const { user, dialog } = await setup();
    expect(within(dialog).getByRole('heading', { name: 'Nostr ile Bağlan' })).toBeTruthy();
    expect(within(dialog).getByText('Tercih ettiğin Nostr imzalama yöntemini seç.')).toBeTruthy();
    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Eklenti', 'Bunker', 'Anahtar']);
    expect(within(dialog).getByRole('button', { name: 'Eklenti ile Bağlan' })).toBeTruthy();
    await user.click(within(dialog).getByRole('tab', { name: 'Anahtar' }));
    expect(within(dialog).getByRole('button', { name: 'Anahtarın yok mu? Yeni anahtar üret' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Anahtarla Bağlan' })).toBeTruthy();
  });
});
