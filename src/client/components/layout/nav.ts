/** Hash routes used by the header and its menus. The app is routed with `/#/<route>`. */
export const NAV_ROUTES = {
  home: '#/',
  about: '#/about',
  dashboard: '#/dashboard',
} as const;

export type NavKey = 'home' | 'about' | 'dashboard';

/**
 * Which top-level section a router path belongs to.
 * Anything that is not /about or /dashboard is a booking page (home or a host identifier).
 */
export const getActiveNav = (path: string): NavKey => {
  const segment = path.replace(/^\/+/, '').split('/')[0].toLowerCase();
  if (segment === 'about') return 'about';
  if (segment === 'dashboard') return 'dashboard';
  return 'home';
};
