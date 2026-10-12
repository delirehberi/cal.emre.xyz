import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Event } from 'nostr-tools';
import {
  normalizeRelayUrl,
  filterHealthyRelays,
  buildPublishTargets,
  pickRelayHints,
  MAX_PUBLISH_RELAYS,
  parseRelayList,
  parseContactRelays,
  createRelayListEventTemplate,
} from '../src/client/lib/nostr/nip65';

describe('nip65.ts: NIP-65 Relay Metadata Operations', () => {
  it('normalizes relay URLs correctly', () => {
    expect(normalizeRelayUrl('wss://relay.damus.io/')).toBe('wss://relay.damus.io');
    expect(normalizeRelayUrl('  wss://NOS.LOL/  ')).toBe('wss://nos.lol');
    expect(normalizeRelayUrl('ws://localhost:8080/')).toBe('ws://localhost:8080');
    expect(normalizeRelayUrl('http://invalid.com')).toBe('');
    expect(normalizeRelayUrl('')).toBe('');
  });

  it('filters and deduplicates relay URLs', () => {
    const raw = [
      'wss://relay.damus.io/',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'invalid-protocol://test',
      'wss://NOS.LOL/',
    ];
    const filtered = filterHealthyRelays(raw);
    expect(filtered).toEqual(['wss://relay.damus.io', 'wss://nos.lol']);
  });

  it('parses Kind 10002 relay list metadata correctly', () => {
    const mockEvent: Event = {
      id: 'mock-id-1',
      pubkey: '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473',
      created_at: 1725285600,
      kind: 10002,
      tags: [
        ['r', 'wss://read-only.relay.org', 'read'],
        ['r', 'wss://write-only.relay.org', 'write'],
        ['r', 'wss://both.relay.org'],
      ],
      content: '',
      sig: 'mock-sig',
    };

    const parsed = parseRelayList(mockEvent);
    expect(parsed.read).toEqual(['wss://read-only.relay.org', 'wss://both.relay.org']);
    expect(parsed.write).toEqual(['wss://write-only.relay.org', 'wss://both.relay.org']);
    expect(parsed.all).toEqual([
      'wss://read-only.relay.org',
      'wss://write-only.relay.org',
      'wss://both.relay.org',
    ]);
  });

  it('parses Kind 3 legacy contact list relays', () => {
    const mockKind3: Event = {
      id: 'mock-id-2',
      pubkey: '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473',
      created_at: 1725285600,
      kind: 3,
      tags: [],
      content: JSON.stringify({
        'wss://relay1.com': { read: true, write: false },
        'wss://relay2.com': { read: false, write: true },
        'wss://relay3.com': { read: true, write: true },
      }),
      sig: 'mock-sig',
    };

    const parsed = parseContactRelays(mockKind3);
    expect(parsed.read).toEqual(['wss://relay1.com', 'wss://relay3.com']);
    expect(parsed.write).toEqual(['wss://relay2.com', 'wss://relay3.com']);
    expect(parsed.all).toEqual(['wss://relay1.com', 'wss://relay2.com', 'wss://relay3.com']);
  });

  it('creates Kind 10002 event template correctly', () => {
    const template = createRelayListEventTemplate([
      { url: 'wss://relay1.com', usage: 'read' },
      { url: 'wss://relay2.com', usage: 'write' },
      { url: 'wss://relay3.com', usage: 'both' },
    ]);

    expect(template.kind).toBe(10002);
    expect(template.tags).toEqual([
      ['r', 'wss://relay1.com', 'read'],
      ['r', 'wss://relay2.com', 'write'],
      ['r', 'wss://relay3.com'],
    ]);
  });
});

describe('relays.ts: RelayPoolManager Read vs Write Relay Resolution', () => {
  it('resolves read relays directly from the bootstrap relays without a cache relay', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');

    const bootstrapRelays = nostrPool.getBootstrapRelays();
    expect(bootstrapRelays.length).toBeGreaterThan(0);

    const readRelays = nostrPool.getReadRelays();
    expect(readRelays).toEqual(bootstrapRelays);
    for (const relay of readRelays) {
      expect(relay).not.toContain('?relays=');
    }
  });

  it('incorporates custom relays into read relays', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');
    const custom = ['wss://custom.relay.org'];
    const readRelays = nostrPool.getReadRelays(custom);

    expect(readRelays[0]).toBe('wss://custom.relay.org');
    expect(readRelays).toEqual(nostrPool.getBootstrapRelays(custom));
  });

  it('resolves publish targets from host, creator, attendee, extra and default relays', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');
    const { APP_CONFIG } = await import('../src/config');

    vi.spyOn(nostrPool, 'fetchHostRelays').mockImplementation(async (pubkey: string) => {
      if (pubkey === 'creator') {
        return { read: ['wss://creator-read.org'], write: ['wss://nostr.mom'], all: ['wss://creator-read.org', 'wss://nostr.mom'] };
      }
      return { read: ['wss://attendee-inbox.org'], write: ['wss://attendee-out.org'], all: [] };
    });

    const targets = await nostrPool.resolvePublishTargets({
      hostRelays: ['wss://host.relay.org'],
      creatorPubkey: 'creator',
      attendeePubkeys: ['attendee'],
      extraRelays: ['wss://extra.org'],
    });
    const urls = targets.map((t) => t.url);

    expect(urls.slice(0, 4)).toEqual([
      'wss://host.relay.org',
      'wss://nostr.mom',
      'wss://attendee-inbox.org',
      'wss://extra.org',
    ]);
    expect(urls).not.toContain('wss://creator-read.org');
    expect(urls).not.toContain('wss://attendee-out.org');
    for (const relay of APP_CONFIG.defaultRelays) {
      expect(urls).toContain(relay);
    }
    expect(targets.find((t) => t.url === 'wss://nostr.mom')?.sources).toEqual(['creator', 'default']);
  });

  it('broadcasts the original signed event untouched to host, creator, attendee and default relays', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');

    vi.spyOn(nostrPool, 'fetchHostRelays').mockImplementation(async (pubkey: string) => {
      const relay = `wss://${pubkey}.relay.org`;
      return { read: [relay], write: [relay], all: [relay] };
    });
    const publishSpy = vi.spyOn(nostrPool, 'publishEvent').mockImplementation(async (relays: string[]) =>
      relays.map((relay) => ({ relay, success: true }))
    );

    const event: Event = {
      id: 'id',
      pubkey: 'guest',
      created_at: 1,
      kind: 31923,
      tags: [
        ['d', 'booking-1'],
        ['p', 'guest', '', 'attendee'],
        ['p', 'host', '', 'host'],
      ],
      content: '',
      sig: 'sig',
    };
    const snapshot = structuredClone(event);

    const results = await nostrPool.broadcastEvent(event, ['wss://nostr.mom']);

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy.mock.calls[0][1]).toBe(event);
    expect(event).toEqual(snapshot);
    const urls = results.map((r) => r.relay);
    expect(urls).toEqual(expect.arrayContaining(['wss://host.relay.org', 'wss://guest.relay.org', 'wss://nostr.mom']));
    expect(results.find((r) => r.relay === 'wss://host.relay.org')?.sources).toEqual(['host']);
  });
});

describe('nip65.ts: buildPublishTargets', () => {
  it('unions, normalizes and deduplicates relays across groups, tracking all sources', () => {
    const targets = buildPublishTargets([
      { source: 'host', relays: ['wss://A.org/', 'wss://b.org'] },
      { source: 'creator', relays: ['wss://a.org', 'wss://c.org', 'http://invalid.org'] },
      { source: 'default', relays: ['wss://c.org'] },
    ]);

    expect(targets).toEqual([
      { url: 'wss://a.org', sources: ['host', 'creator'] },
      { url: 'wss://b.org', sources: ['host'] },
      { url: 'wss://c.org', sources: ['creator', 'default'] },
    ]);
  });

  it('returns no targets for empty groups', () => {
    expect(buildPublishTargets([{ source: 'host', relays: [] }])).toEqual([]);
  });

  it('caps the relay count and keeps earlier groups first', () => {
    const many = Array.from({ length: MAX_PUBLISH_RELAYS + 5 }, (_, i) => `wss://r${i}.org`);
    const targets = buildPublishTargets([
      { source: 'host', relays: many },
      { source: 'default', relays: ['wss://late.org', 'wss://r0.org'] },
    ]);

    expect(targets).toHaveLength(MAX_PUBLISH_RELAYS);
    expect(targets.map((t) => t.url)).not.toContain('wss://late.org');
    expect(targets[0].sources).toEqual(['host', 'default']);
  });
});

describe('nip65.ts: pickRelayHints', () => {
  it('prefers one relay per source before filling with the remaining targets', () => {
    const hints = pickRelayHints([
      { url: 'wss://host1.org', sources: ['host'] },
      { url: 'wss://host2.org', sources: ['host'] },
      { url: 'wss://mom.org', sources: ['creator', 'default'] },
      { url: 'wss://def.org', sources: ['default'] },
    ]);
    expect(hints).toEqual(['wss://host1.org', 'wss://mom.org', 'wss://host2.org']);
  });

  it('returns nothing for no targets', () => {
    expect(pickRelayHints([])).toEqual([]);
  });
});

describe('relays.ts: host appointment queries use the provided host relays', () => {
  it('queries authored and p-tagged bookings on the host relays plus defaults', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');
    const querySync = vi.spyOn(nostrPool.getPool(), 'querySync').mockResolvedValue([]);

    await nostrPool.fetchHostAppointments('host-pubkey', { relays: ['wss://host-only.relay.org'] });

    expect(querySync).toHaveBeenCalled();
    for (const call of querySync.mock.calls) {
      expect(call[0]).toContain('wss://host-only.relay.org');
      expect(call[0]).toContain('wss://nostr.mom');
    }
    expect(querySync.mock.calls.some((call) => '#p' in call[1])).toBe(true);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
