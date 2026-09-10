// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { getHashPath, eventHref, hostHref, migrateLegacyPath, parseRoute, useHashPath, RESERVED_ROUTES } from '../src/client/lib/router';

describe('parseRoute', () => {
  it('treats the root and empty paths as the default host', () => {
    expect(parseRoute('/')).toEqual({ name: 'booking' });
    expect(parseRoute('')).toEqual({ name: 'booking' });
    expect(parseRoute('//')).toEqual({ name: 'booking' });
  });

  it('parses NIP-05 and npub host identifiers', () => {
    expect(parseRoute('/delirehberi@emre.xyz')).toEqual({ name: 'booking', identifier: 'delirehberi@emre.xyz' });
    expect(parseRoute('/npub1abc')).toEqual({ name: 'booking', identifier: 'npub1abc' });
    expect(parseRoute('/delirehberi%40emre.xyz')).toEqual({ name: 'booking', identifier: 'delirehberi@emre.xyz' });
    expect(parseRoute('/alice@example.com/extra')).toEqual({ name: 'booking', identifier: 'alice@example.com' });
  });

  it('recognises the reserved pages case-insensitively and never as a host', () => {
    expect(parseRoute('/about')).toEqual({ name: 'about' });
    expect(parseRoute('/About/')).toEqual({ name: 'about' });
    expect(parseRoute('/dashboard')).toEqual({ name: 'dashboard' });
    expect(parseRoute('/dashboard/anything')).toEqual({ name: 'dashboard' });
    expect(RESERVED_ROUTES).toEqual(['about', 'dashboard', 'e']);
  });

  it('routes /e/<naddr> to the event page and decodes the naddr', () => {
    expect(parseRoute('/e/naddr1abc')).toEqual({ name: 'event', naddr: 'naddr1abc' });
    expect(parseRoute('/E/naddr1abc?x=1')).toEqual({ name: 'event', naddr: 'naddr1abc' });
    expect(parseRoute('/e')).toEqual({ name: 'booking', identifier: 'e' });
  });

  it('keeps an identifier that is not valid percent-encoding', () => {
    expect(parseRoute('/100%')).toEqual({ name: 'booking', identifier: '100%' });
  });

  it('builds event links', () => {
    expect(eventHref('naddr1abc')).toBe('#/e/naddr1abc');
  });

  it('builds host links', () => {
    expect(hostHref()).toBe('#/');
    expect(hostHref('delirehberi@emre.xyz')).toBe('#/delirehberi@emre.xyz');
    expect(hostHref('npub1abc')).toBe('#/npub1abc');
  });
});

describe('getHashPath', () => {
  it('reads the hash route and defaults to /', () => {
    expect(getHashPath({ hash: '#/about', pathname: '/' })).toBe('/about');
    expect(getHashPath({ hash: '#/a@b.co', pathname: '/' })).toBe('/a@b.co');
    expect(getHashPath({ hash: '', pathname: '/' })).toBe('/');
    expect(getHashPath({ hash: '#top', pathname: '/' })).toBe('/');
  });
});

describe('migrateLegacyPath', () => {
  const run = (location: { hash: string; pathname: string; search: string }) => {
    const calls: unknown[][] = [];
    const moved = migrateLegacyPath(location, { replaceState: (...args: unknown[]) => void calls.push(args) });
    return { moved, calls };
  };

  it('moves old path links to the hash route', () => {
    const { moved, calls } = run({ hash: '', pathname: '/alice@example.com', search: '' });
    expect(moved).toBe(true);
    expect(calls[0][2]).toBe('/#/alice@example.com');
    expect(run({ hash: '', pathname: '/dashboard/', search: '' }).calls[0][2]).toBe('/#/dashboard');
  });

  it('keeps the query string', () => {
    expect(run({ hash: '', pathname: '/about', search: '?ref=x' }).calls[0][2]).toBe('/?ref=x#/about');
  });

  it('leaves the root, hash routes and file paths alone', () => {
    expect(run({ hash: '', pathname: '/', search: '' }).moved).toBe(false);
    expect(run({ hash: '#/about', pathname: '/legacy', search: '' }).moved).toBe(false);
    expect(run({ hash: '', pathname: '/index.html', search: '' }).moved).toBe(false);
    expect(run({ hash: '', pathname: '/favicon.svg', search: '' }).moved).toBe(false);
  });
});

describe('useHashPath', () => {
  afterEach(() => {
    cleanup();
    window.location.hash = '';
  });

  const Probe: React.FC = () => <p data-testid="path">{useHashPath()}</p>;

  it('follows hash changes', async () => {
    window.location.hash = '#/about';
    render(<Probe />);
    expect(screen.getByTestId('path').textContent).toBe('/about');

    await act(async () => {
      window.location.hash = '#/dashboard';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');

    await act(async () => {
      window.location.hash = '';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('path').textContent).toBe('/');
  });
});
