import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getInitialTheme } from '../src/client/context/ThemeContext';

describe('Theme Context & Helpers', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocalStorage) {
      global.localStorage = originalLocalStorage;
    }
  });

  it('should return "light" as the default initial theme when localStorage is empty', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    expect(getInitialTheme()).toBe('light');
  });

  it('should return stored theme from localStorage if valid', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dark');
    expect(getInitialTheme()).toBe('dark');

    vi.mocked(localStorage.getItem).mockReturnValue('light');
    expect(getInitialTheme()).toBe('light');
  });

  it('should ignore invalid values in localStorage and fallback to "light"', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('invalid-theme');
    expect(getInitialTheme()).toBe('light');
  });
});
