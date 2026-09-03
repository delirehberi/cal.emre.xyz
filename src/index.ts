import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { APP_CONFIG } from './config';
import { emailRouter } from './api/email';
import { icsRouter } from './api/ics';
import { nip05Router, nip05ProxyRouter } from './api/nip05';

export interface Env {
  DEFAULT_HOST_NIP05?: string;
  DEFAULT_HOST_PUBKEY?: string;
  DEFAULT_RELAYS?: string;
  ENABLE_EMAIL_NOTIFICATIONS?: string;
  SUPPORT_EMAIL?: string;
  ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const app = new Hono<{ Bindings: Env }>();

// Global CORS Middleware
app.use('*', cors());

// Health Check Endpoint
app.get('/api/health', (c) => {
  const emailEnabled = c.env?.ENABLE_EMAIL_NOTIFICATIONS?.toLowerCase() === 'true';
  const hostNip05 = c.env?.DEFAULT_HOST_NIP05 || APP_CONFIG.defaultHostNip05;

  return c.json({
    status: 'ok',
    app: APP_CONFIG.name,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    emailNotificationsEnabled: emailEnabled,
    defaultHostNip05: hostNip05,
  });
});

// Mount Sub-Routers
app.route('/api/email', emailRouter);
app.route('/api/events', icsRouter);
app.route('/api/nip05', nip05ProxyRouter);
app.route('/.well-known', nip05Router);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Application Error:', err);
  return c.json(
    {
      success: false,
      error: err instanceof Error ? err.message : 'Internal Server Error',
    },
    500
  );
});

// Fallback Handler for Cloudflare Workers Static Assets & Single Page Application (SPA)
app.notFound(async (c) => {
  if (c.env?.ASSETS) {
    try {
      const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      // SPA Fallback: serve index.html for client-side routing
      const url = new URL(c.req.url);
      url.pathname = '/index.html';
      return await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    } catch {
      // Fall through to 404 response
    }
  }

  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
    },
    404
  );
});

export default app;
