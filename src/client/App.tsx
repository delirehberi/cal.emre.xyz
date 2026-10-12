import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './i18n';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { BookingPage } from './pages/BookingPage';
import { DashboardPage } from './pages/DashboardPage';
import { APP_CONFIG } from '../config';
import { parseRoute, useHashPath } from './lib/router';

export const MainLayout: React.FC = () => {
  const path = useHashPath();
  const route = parseRoute(path);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink transition-colors">
      <Header currentPath={path} />
      <main className="flex-1">
        {route.name === 'dashboard' ? (
          <DashboardPage />
        ) : (
          <BookingPage
            identifier={(route.name === 'booking' && route.identifier) || APP_CONFIG.defaultHostNip05}
          />
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
