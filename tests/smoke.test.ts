import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '../src/config';
import app from '../src/index';

describe('Project Tooling & Config Smoke Test', () => {
  it('loads configuration constants with required properties', () => {
    expect(APP_CONFIG.name).toBe('cal.emre.xyz');
    expect(APP_CONFIG.supportEmail).toBe('z@emre.xyz');
    expect(APP_CONFIG.defaultRelays.length).toBeGreaterThan(0);
    expect(APP_CONFIG.allowedDurationsMinutes).toContain(15);
    expect(APP_CONFIG.allowedDurationsMinutes).toContain(30);
    expect(APP_CONFIG.allowedDurationsMinutes).toContain(60);
  });

  it('handles GET /api/health with ok status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = await res.json() as { status: string; app: string; version: string; timestamp: string };
    expect(data.status).toBe('ok');
    expect(data.app).toBe('cal.emre.xyz');
    expect(data.version).toBe('1.0.0');
    expect(typeof data.timestamp).toBe('string');
  });
});
