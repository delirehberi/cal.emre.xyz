import { Hono } from 'hono';
import { APP_CONFIG } from '../config';
import { decodeNaddr, type NaddrParams } from '../client/lib/nostr/keys';
import { parseTimeCalendarEvent, parseDateCalendarEvent } from '../client/lib/nostr/nip52';
import { generateICS, type ICSEventParams } from '../client/lib/calendar/ics';
import { nostrPool } from '../client/lib/nostr/relays';

export const icsRouter = new Hono();

/**
 * Resolves a NIP-52 calendar event by its naddr and generates an RFC 5545 .ics file.
 */
icsRouter.get('/:naddr/ics', async (c) => {
  const naddr = c.req.param('naddr');
  if (!naddr) {
    return c.text('Missing naddr parameter', 400);
  }

  let decoded: NaddrParams;
  try {
    decoded = decodeNaddr(naddr);
  } catch (err) {
    return c.text(`Invalid naddr format: ${err instanceof Error ? err.message : String(err)}`, 400);
  }

  const { kind, pubkey, identifier, relays: naddrRelays } = decoded;

  if (kind !== 31923 && kind !== 31922) {
    return c.text(`Unsupported calendar event kind: ${kind}. Expected 31923 or 31922.`, 400);
  }

  // Parse any extra relays passed via query params (e.g. ?relays=wss://relay1,wss://relay2)
  const queryRelaysParam = c.req.query('relays');
  const queryRelays = queryRelaysParam
    ? queryRelaysParam.split(',').map((r) => r.trim()).filter(Boolean)
    : [];

  const targetRelays = Array.from(
    new Set([
      ...queryRelays,
      ...(naddrRelays || []),
      ...APP_CONFIG.defaultRelays,
    ])
  );

  try {
    const pool = nostrPool.getPool();
    const event = await pool.get(targetRelays, {
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier],
      limit: 1,
    });

    if (!event) {
      return c.text(`Calendar event "${identifier}" not found on queried relays.`, 404);
    }

    let icsOptions: ICSEventParams;

    if (kind === 31923) {
      const parsed = parseTimeCalendarEvent(event);
      icsOptions = {
        uid: `${event.id}@${APP_CONFIG.name}`,
        title: parsed.title,
        description: parsed.description || parsed.summary,
        start: parsed.start,
        end: parsed.end || parsed.start + 1800,
        location: parsed.location,
        url: parsed.coordinate,
        status: 'CONFIRMED',
      };
    } else {
      const parsed = parseDateCalendarEvent(event);
      // For date-based event, default start of day to end of day in UTC
      const startDate = new Date(`${parsed.start}T00:00:00Z`);
      const endDate = parsed.end
        ? new Date(`${parsed.end}T23:59:59Z`)
        : new Date(`${parsed.start}T23:59:59Z`);

      icsOptions = {
        uid: `${event.id}@${APP_CONFIG.name}`,
        title: parsed.title,
        description: parsed.description || parsed.summary,
        start: Math.floor(startDate.getTime() / 1000),
        end: Math.floor(endDate.getTime() / 1000),
        location: parsed.location,
        status: 'CONFIRMED',
      };
    }

    const icsString = generateICS(icsOptions);
    const sanitizedFilename = (identifier || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');

    return new Response(icsString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}.ics"`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return c.text(
      `Failed to fetch or parse calendar event: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
});
