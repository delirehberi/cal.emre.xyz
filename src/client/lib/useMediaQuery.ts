import { useEffect, useState } from 'react';

/** Tracks a CSS media query. False where `matchMedia` is unavailable. */
export const useMediaQuery = (query: string): boolean => {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
};

/** True from the tablet breakpoint (640 px) up. Below it the booking page is a single column. */
export const useIsTabletUp = (): boolean => useMediaQuery('(min-width: 640px)');
