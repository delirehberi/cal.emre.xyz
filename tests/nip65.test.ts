import { describe, it, expect } from 'vitest';
import type { Event } from 'nostr-tools';
import {
  normalizeRelayUrl,
  filterHealthyRelays,
  buildCacheRelayUrl,
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

  it('builds cache relay URL with comma-separated upstream relays', () => {
    const upstreams = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
    ];
    const cacheUrl = buildCacheRelayUrl(upstreams, 'wss://cache.nostr.org.tr');
    expect(cacheUrl).toBe('wss://cache.nostr.org.tr?relays=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net');
  });

  it('builds cache relay URL and normalizes/filters invalid upstreams', () => {
    const upstreams = [
      '  wss://RELAY.DAMUS.IO/ ',
      'http://invalid-protocol.com',
      'wss://nos.lol/',
      '',
    ];
    const cacheUrl = buildCacheRelayUrl(upstreams, 'wss://cache.nostr.org.tr/');
    expect(cacheUrl).toBe('wss://cache.nostr.org.tr?relays=wss://relay.damus.io,wss://nos.lol');
  });

  it('returns base cache relay if upstream list is empty', () => {
    expect(buildCacheRelayUrl([], 'wss://cache.nostr.org.tr/')).toBe('wss://cache.nostr.org.tr');
  });

  it('returns empty string if cache relay base is empty or omitted', () => {
    expect(buildCacheRelayUrl(['wss://relay.damus.io'], '')).toBe('');
    expect(buildCacheRelayUrl(['wss://relay.damus.io'], undefined)).toBe('');
  });
});

describe('relays.ts: RelayPoolManager Read vs Write Relay Resolution', () => {
  it('resolves read relays bundled into the cache relay endpoint while bootstrap relays stay unbundled', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');
    const { APP_CONFIG } = await import('../src/config');

    const bootstrapRelays = nostrPool.getBootstrapRelays();
    expect(bootstrapRelays.length).toBeGreaterThan(0);
    expect(bootstrapRelays[0]).not.toContain('?relays=');

    const readRelays = nostrPool.getReadRelays();
    expect(readRelays).toHaveLength(1);
    expect(readRelays[0]).toContain(APP_CONFIG.cacheRelayUrl);
    expect(readRelays[0]).toContain('?relays=');
    for (const upstream of bootstrapRelays) {
      expect(readRelays[0]).toContain(upstream);
    }
  });

  it('incorporates custom relays into read relay bundling', async () => {
    const { nostrPool } = await import('../src/client/lib/nostr/relays');
    const custom = ['wss://custom.relay.org'];
    const readRelays = nostrPool.getReadRelays(custom);

    expect(readRelays).toHaveLength(1);
    expect(readRelays[0]).toContain('wss://custom.relay.org');
  });
});
