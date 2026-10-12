import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './i18n';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { BookingPage } from './pages/BookingPage';
import { DashboardPage } from './pages/DashboardPage';
import { APP_CONFIG } from '../config';

export const MainLayout: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('/');

  useEffect(() => {
    const handleLocationChange = () => {
      let path = window.location.pathname;
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        path = window.location.hash.slice(1);
      }
      setCurrentPath(path);
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    if (window.history.pushState) {
      window.history.pushState(null, '', path);
    }
  };

  const isDashboard = currentPath === '/dashboard' || currentPath === 'dashboard' || currentPath.startsWith('/dashboard');

  // Determine host identifier from route path (e.g. /npub1... or /alice@domain.com)
  const getIdentifierFromPath = (path: string): string | undefined => {
    const clean = path.replace(/^\/+/, '').split('/')[0];
    if (!clean || clean === 'dashboard') {
      return undefined;
    }
    return clean;
  };

  const identifier = getIdentifierFromPath(currentPath);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink transition-colors">
      <Header currentPath={currentPath} onNavigate={handleNavigate} />
      <main className="flex-1">
        {isDashboard ? (
          <DashboardPage />
        ) : (
          <BookingPage identifier={identifier || APP_CONFIG.defaultHostNip05} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};
