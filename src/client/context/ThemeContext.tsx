import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cal_theme';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const getInitialTheme = (): Theme => {
  try {
    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    if (storage) {
      const saved = storage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
  } catch {
    // Ignore storage access errors in restricted sandbox/iframes
  }
  return 'light';
};

export const applyTheme = (theme: Theme, root: HTMLElement | undefined = typeof document !== 'undefined' ? document.documentElement : undefined): void => {
  if (!root) return;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme }) => {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme || getInitialTheme());

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      const storage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : typeof localStorage !== 'undefined'
            ? localStorage
            : null;
      if (storage) {
        storage.setItem(THEME_STORAGE_KEY, newTheme);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
