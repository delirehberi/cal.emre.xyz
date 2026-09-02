import { describe, it, expect, vi } from 'vitest';
import app from '../src/index';
import {
  validateBookingPayload,
  formatEmailDateTime,
  generateEmailTemplates,
  sendBookingConfirmationEmail,
  type BookingConfirmationPayload,
} from '../src/api/email';
import { generateGuestKeyPair, encodeNaddr } from '../src/client/lib/nostr/keys';
import { nostrPool } from '../src/client/lib/nostr/relays';
import { Resend } from 'resend';

describe('Phase 5: Cloudflare Worker API & Email Service', () => {
  const dummyEnv = {
    DEFAULT_HOST_NIP05: 'delirehberi@emre.xyz',
    DEFAULT_HOST_PUBKEY: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
    ENABLE_EMAIL_NOTIFICATIONS: 'false',
    SUPPORT_EMAIL: 'z@emre.xyz',
    DEFAULT_RELAYS: 'wss://relay.damus.io,wss://nos.lol',
  };

  const samplePayload: BookingConfirmationPayload = {
    to: 'attendee@example.com',
    hostName: 'Emre Yilmaz',
    hostPubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
    attendeeName: 'Alice Guest',
    attendeePubkey: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9u8r5z',
    attendeeNsec: 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9u8r5z',
    eventTitle: '30 Min Strategy Consultation',
    eventDescription: 'Discussing Nostr NIP-52 integration',
    startTime: 1770000000,
    endTime: 1770001800,
    timezone: 'UTC',
    location: 'https://meet.jit.si/cal-emre-xyz',
    icsContent: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//cal.emre.xyz//NIP-52//EN\r\nEND:VCALENDAR',
    language: 'en',
  };

  describe('Health Check Endpoint (/api/health)', () => {
    it('returns status ok and app information with environment bindings', async () => {
      const res = await app.request('/api/health', {}, dummyEnv);
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json.status).toBe('ok');
      expect(json.app).toBe('cal.emre.xyz');
      expect(json.version).toBe('1.0.0');
      expect(json.emailNotificationsEnabled).toBe(false);
      expect(json.defaultHostNip05).toBe('delirehberi@emre.xyz');
      expect(typeof json.timestamp).toBe('string');
    });

    it('returns status ok even without explicit env bindings', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json.status).toBe('ok');
      expect(json.emailNotificationsEnabled).toBe(false);
      expect(json.defaultHostNip05).toBe('delirehberi@emre.xyz');
    });
  });

  describe('NIP-05 Identity Resolution Endpoint (/.well-known/nostr.json)', () => {
    it('returns empty names object if host pubkey is not configured', async () => {
      const res = await app.request('/.well-known/nostr.json?name=delirehberi', {}, {
        DEFAULT_HOST_PUBKEY: '',
      });
      expect(res.status).toBe(200);
      const json = await res.json() as { names: Record<string, string> };
      expect(json.names).toEqual({});
    });

    it('resolves default host username matching DEFAULT_HOST_NIP05', async () => {
      const res = await app.request('/.well-known/nostr.json?name=delirehberi', {}, dummyEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as { names: Record<string, string>; relays: Record<string, string[]> };
      expect(json.names['delirehberi']).toBe(dummyEnv.DEFAULT_HOST_PUBKEY);
      expect(json.names['_']).toBe(dummyEnv.DEFAULT_HOST_PUBKEY);
      expect(json.relays[dummyEnv.DEFAULT_HOST_PUBKEY]).toContain('wss://relay.damus.io');
    });

    it('resolves root alias "_" matching host pubkey', async () => {
      const res = await app.request('/.well-known/nostr.json?name=_', {}, dummyEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as { names: Record<string, string> };
      expect(json.names['_']).toBe(dummyEnv.DEFAULT_HOST_PUBKEY);
    });

    it('returns empty names if non-existent name is queried', async () => {
      const res = await app.request('/.well-known/nostr.json?name=unknownuser', {}, dummyEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as { names: Record<string, string> };
      expect(json.names).toEqual({});
    });
  });

  describe('Email Service & Template Generator', () => {
    it('validates booking payload and catches missing required fields', () => {
      expect(validateBookingPayload(null).valid).toBe(false);
      expect(validateBookingPayload({}).valid).toBe(false);
      expect(validateBookingPayload({ ...samplePayload, to: 'invalid-email' }).valid).toBe(false);
      expect(validateBookingPayload({ ...samplePayload, startTime: 1770001800, endTime: 1770000000 }).valid).toBe(false);
      expect(validateBookingPayload({ ...samplePayload, eventTitle: '' }).valid).toBe(false);
      expect(validateBookingPayload({ ...samplePayload, icsContent: '' }).valid).toBe(false);

      const validResult = validateBookingPayload(samplePayload);
      expect(validResult.valid).toBe(true);
      expect(validResult.data?.to).toBe('attendee@example.com');
    });

    it('formats date, time, and duration across locales', () => {
      const en = formatEmailDateTime(1770000000, 1770001800, 'UTC', 'en');
      expect(en.durationMinutes).toBe(30);
      expect(en.timeStr).toContain('UTC');

      const tr = formatEmailDateTime(1770000000, 1770001800, 'UTC', 'tr');
      expect(tr.durationMinutes).toBe(30);
      expect(tr.timeStr).toContain('UTC');
    });

    it('generates English email templates with guest sovereign identity onboarding section', () => {
      const { subject, html, text } = generateEmailTemplates(samplePayload);

      expect(subject).toContain('Confirmed: 30 Min Strategy Consultation with Emre Yilmaz');
      expect(html).toContain('Alice Guest');
      expect(html).toContain('Your Sovereign Nostr Identity Was Created');
      expect(html).toContain(samplePayload.attendeeNsec!);
      expect(html).toContain('https://nostr.com');
      expect(text).toContain('YOUR SOVEREIGN NOSTR IDENTITY');
      expect(text).toContain(samplePayload.attendeeNsec!);
    });

    it('generates Turkish email templates with guest onboarding section', () => {
      const trPayload: BookingConfirmationPayload = {
        ...samplePayload,
        language: 'tr',
      };
      const { subject, html, text } = generateEmailTemplates(trPayload);

      expect(subject).toContain('Onaylandı: 30 Min Strategy Consultation (Emre Yilmaz)');
      expect(html).toContain('Nostr Egemen Kimliğiniz Oluşturuldu');
      expect(html).toContain('https://nostr.org.tr');
      expect(text).toContain('NOSTR EGEMEN KİMLİĞİNİZ');
      expect(text).toContain('https://nostr.org.tr');
    });

    it('omits sovereign identity section when attendee is already authenticated (no nsec)', () => {
      const authPayload: BookingConfirmationPayload = {
        ...samplePayload,
        attendeeNsec: undefined,
      };
      const { html, text } = generateEmailTemplates(authPayload);

      expect(html).not.toContain('Your Sovereign Nostr Identity Was Created');
      expect(text).not.toContain('YOUR SOVEREIGN NOSTR IDENTITY');
    });

    it('skips email dispatch gracefully when ENABLE_EMAIL_NOTIFICATIONS is false', async () => {
      const result = await sendBookingConfirmationEmail(samplePayload, {
        ENABLE_EMAIL_NOTIFICATIONS: 'false',
      });
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled via configuration');
    });

    it('skips email dispatch gracefully when RESEND_API_KEY is not configured', async () => {
      const result = await sendBookingConfirmationEmail(samplePayload, {
        ENABLE_EMAIL_NOTIFICATIONS: 'true',
        RESEND_API_KEY: '',
      });
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('RESEND_API_KEY is not set');
    });

    it('handles POST /api/email/booking-confirmation HTTP endpoint', async () => {
      const invalidRes = await app.request(
        '/api/email/booking-confirmation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: 'invalid' }),
        },
        dummyEnv
      );
      expect(invalidRes.status).toBe(400);

      const validRes = await app.request(
        '/api/email/booking-confirmation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(samplePayload),
        },
        dummyEnv
      );
      expect(validRes.status).toBe(200);
      const json = await validRes.json() as { success: boolean; skipped?: boolean };
      expect(json.success).toBe(true);
      expect(json.skipped).toBe(true);
    });

    it('handles POST /api/email route alias endpoint', async () => {
      const validRes = await app.request(
        '/api/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(samplePayload),
        },
        dummyEnv
      );
      expect(validRes.status).toBe(200);
      const json = await validRes.json() as { success: boolean; skipped?: boolean };
      expect(json.success).toBe(true);
      expect(json.skipped).toBe(true);
    });

    it('includes admin email (z@emre.xyz) in BCC when email notifications are dispatched', async () => {
      let capturedSendPayload: any = null;
      const dummyResend = new Resend('re_mock_api_key');
      const sendSpy = vi
        .spyOn(Object.getPrototypeOf(dummyResend.emails), 'send')
        .mockImplementation(async (payload: any) => {
          capturedSendPayload = payload;
          return { data: { id: 'msg_12345' }, error: null } as any;
        });

      const result = await sendBookingConfirmationEmail(samplePayload, {
        ENABLE_EMAIL_NOTIFICATIONS: 'true',
        RESEND_API_KEY: 're_mock_api_key',
        ADMIN_EMAIL: 'z@emre.xyz',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_12345');
      expect(capturedSendPayload).not.toBeNull();
      expect(capturedSendPayload.to).toEqual(['attendee@example.com']);
      expect(capturedSendPayload.bcc).toEqual(['z@emre.xyz']);
      expect(capturedSendPayload.replyTo).toEqual(['attendee@example.com']);
      expect(capturedSendPayload.attachments).toHaveLength(1);
      expect(capturedSendPayload.attachments[0].filename).toBe('invite.ics');

      sendSpy.mockRestore();
    });
  });

  describe('ICS Subscription Endpoint (/api/events/:naddr/ics)', () => {
    it('returns 400 for invalid naddr format', async () => {
      const res = await app.request('/api/events/invalid-naddr/ics', {}, dummyEnv);
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-calendar event kind', async () => {
      const keys = generateGuestKeyPair();
      const naddrKind1 = encodeNaddr({
        kind: 1,
        pubkey: keys.publicKeyHex,
        identifier: 'some-post',
      });

      const res = await app.request(`/api/events/${naddrKind1}/ics`, {}, dummyEnv);
      expect(res.status).toBe(400);
    });

    it('queries relays and returns 404 when event is not found', async () => {
      const keys = generateGuestKeyPair();
      const naddr31923 = encodeNaddr({
        kind: 31923,
        pubkey: keys.publicKeyHex,
        identifier: 'non-existent-slot-12345',
      });

      // Mock pool get returning null
      const pool = nostrPool.getPool();
      vi.spyOn(pool, 'get').mockResolvedValueOnce(null as any);

      const res = await app.request(`/api/events/${naddr31923}/ics`, {}, dummyEnv);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain('not found');

      vi.restoreAllMocks();
    });

    it('queries relays and returns .ics file when 31923 event is found', async () => {
      const keys = generateGuestKeyPair();
      const identifier = 'strategy-consultation-test';
      const naddr31923 = encodeNaddr({
        kind: 31923,
        pubkey: keys.publicKeyHex,
        identifier,
      });

      const mockEvent = {
        id: 'eventid1234567890abcdef',
        pubkey: keys.publicKeyHex,
        created_at: 1770000000,
        kind: 31923,
        tags: [
          ['d', identifier],
          ['title', 'Strategy Consultation Test'],
          ['start', '1770000000'],
          ['end', '1770001800'],
          ['start_tzid', 'UTC'],
          ['location', 'https://meet.jit.si/cal-emre-xyz'],
          ['summary', 'Strategy meeting summary'],
        ],
        content: 'Strategy meeting description',
        sig: 'mockedsig',
      };

      const pool = nostrPool.getPool();
      vi.spyOn(pool, 'get').mockResolvedValueOnce(mockEvent as any);

      const res = await app.request(`/api/events/${naddr31923}/ics`, {}, dummyEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/calendar');
      expect(res.headers.get('Content-Disposition')).toContain(`${identifier}.ics`);

      const icsText = await res.text();
      expect(icsText).toContain('BEGIN:VCALENDAR');
      expect(icsText).toContain('SUMMARY:Strategy Consultation Test');
      expect(icsText).toContain('END:VCALENDAR');

      vi.restoreAllMocks();
    });
  });
});
