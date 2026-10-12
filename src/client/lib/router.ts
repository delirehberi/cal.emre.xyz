import { useEffect, useState } from 'react';

/** Hash routes that are pages of the app, not host identifiers. */
export const RESERVED_ROUTES = ['about', 'dashboard'] as const;

export type Route =
  | { name: 'booking'; identifier?: string }
  | { name: 'about' }
  | { name: 'dashboard' };

/**
 * Parses a router path (the part after `#`, e.g. `/delirehberi@emre.xyz`) into a route.
 * `/` and an empty path are the default host; any other first segment is a host identifier
 * (NIP-05 address or npub) unless it is a reserved page name.
 */
export const parseRoute = (path: string): Route => {
  const segment = path.replace(/^\/+/, '').split('/')[0].split('?')[0];
  if (!segment) return { name: 'booking' };

  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep the raw segment when it is not valid percent-encoding.
  }

  const lower = decoded.toLowerCase();
  if (lower === 'about') return { name: 'about' };
  if (lower === 'dashboard') return { name: 'dashboard' };
  return { name: 'booking', identifier: decoded };
};

/** Builds the hash link for a host identifier (NIP-05 or npub). */
export const hostHref = (identifier?: string): string =>
  identifier ? `#/${encodeURIComponent(identifier).replace(/%40/g, '@')}` : '#/';

const STATIC_FILE = /\.(html?|js|mjs|css|svg|png|jpe?g|gif|webp|ico|txt|json|map|woff2?|webmanifest|xml)$/i;

type LocationLike = Pick<Location, 'hash' | 'pathname'>;

/**
 * Current router path. The hash is the source of truth (`/#/<route>`).
 * Returns '/' when there is no hash route.
 */
export const getHashPath = (location: LocationLike): string => {
  if (location.hash.startsWith('#/')) return location.hash.slice(1);
  return '/';
};

/**
 * Old links used real paths (`/alice@example.com`, `/dashboard`). When the page is opened on one,
 * move it to the equivalent hash route so it keeps working. Returns true when a move happened.
 */
export const migrateLegacyPath = (
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>
): boolean => {
  const hasHashRoute = location.hash.startsWith('#/');
  const path = location.pathname.replace(/\/+$/, '');
  // NIP-05 identifiers contain dots (alice@example.com), so only real asset extensions count as files.
  if (hasHashRoute || path === '' || STATIC_FILE.test(path)) return false;
  history.replaceState(null, '', `/${location.search}#${path}`);
  return true;
};

/** Subscribes to hash changes and returns the current router path. */
export const useHashPath = (): string => {
  const read = () => (typeof window === 'undefined' ? '/' : getHashPath(window.location));
  const [path, setPath] = useState<string>(read);

  useEffect(() => {
    const update = () => setPath(read());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    update();
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);

  return path;
};
