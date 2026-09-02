import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hostDataCache } from '../src/client/lib/nostr/cache';
import { APP_CONFIG } from '../src/config';
import type { HostProfile } from '../src/client/lib/nostr/relays';
import type { RelayList } from '../src/client/lib/nostr/nip65';

describe('HostDataCacheManager', () => {
  const samplePubkey = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const sampleProfile: HostProfile = {
    pubkey: samplePubkey,
    name: 'alice',
    displayName: 'Alice Nostr',
    about: 'Decentralized scheduling enthusiast',
    nip05: 'alice@nostr.example',
  };

  const sampleRelays: RelayList = {
    read: ['wss://relay.damus.io', 'wss://nos.lol'],
    write: ['wss://relay.damus.io'],
    all: ['wss://relay.damus.io', 'wss://nos.lol'],
  };

  beforeEach(() => {
    hostDataCache.clearAllHostCache();
  });

  describe('Master User Data Defaults', () => {
    it('returns pre-seeded master profile when no custom profile is in cache', () => {
      const masterProfile = hostDataCache.getCachedProfile(APP_CONFIG.defaultHostPubkey);
      expect(masterProfile).not.toBeNull();
      expect(masterProfile?.pubkey).toBe(APP_CONFIG.defaultHostPubkey);
      expect(masterProfile?.name).toBe('delirehberi');
      expect(masterProfile?.nip05).toBe(APP_CONFIG.defaultHostNip05);
    });

    it('returns default master relays when no custom relays are cached', () => {
      const masterRelays = hostDataCache.getCachedRelays(APP_CONFIG.defaultHostPubkey);
      expect(masterRelays).not.toBeNull();
      expect(masterRelays?.all).toEqual(expect.arrayContaining([...APP_CONFIG.defaultRelays]));
    });

    it('returns master pubkey for default NIP-05 identifier', () => {
      const masterNip05 = hostDataCache.getCachedNip05(APP_CONFIG.defaultHostNip05);
      expect(masterNip05).not.toBeNull();
      expect(masterNip05?.pubkey).toBe(APP_CONFIG.defaultHostPubkey);
    });
  });

  describe('Host Profile Caching', () => {
    it('stores and retrieves host profile accurately', () => {
      hostDataCache.setCachedProfile(samplePubkey, sampleProfile);
      const retrieved = hostDataCache.getCachedProfile(samplePubkey);
      expect(retrieved).toEqual(sampleProfile);
    });

    it('respects TTL expiration and returns null for expired profiles', () => {
      // Set with 50ms TTL
      hostDataCache.setCachedProfile(samplePubkey, sampleProfile, 50);

      expect(hostDataCache.getCachedProfile(samplePubkey)).toEqual(sampleProfile);

      // Advance time beyond TTL
      vi.setSystemTime(Date.now() + 100);
      expect(hostDataCache.getCachedProfile(samplePubkey)).toBeNull();

      // But allowStale=true returns the expired data
      expect(hostDataCache.getCachedProfile(samplePubkey, true)).toEqual(sampleProfile);

      vi.useRealTimers();
    });

    it('invalidates host cache correctly', () => {
      hostDataCache.setCachedProfile(samplePubkey, sampleProfile);
      hostDataCache.setCachedRelays(samplePubkey, sampleRelays);

      hostDataCache.invalidateHostCache(samplePubkey);

      expect(hostDataCache.getCachedProfile(samplePubkey)).toBeNull();
      expect(hostDataCache.getCachedRelays(samplePubkey)).toBeNull();
    });
  });

  describe('Host Relay List Caching', () => {
    it('stores and retrieves relay lists accurately', () => {
      hostDataCache.setCachedRelays(samplePubkey, sampleRelays);
      const retrieved = hostDataCache.getCachedRelays(samplePubkey);
      expect(retrieved).toEqual(sampleRelays);
    });
  });

  describe('NIP-05 Resolution Caching', () => {
    it('stores and retrieves NIP-05 resolutions', () => {
      const nip05Data = {
        pubkey: samplePubkey,
        relays: ['wss://relay.example.com'],
      };
      hostDataCache.setCachedNip05('alice@nostr.example', nip05Data);

      const retrieved = hostDataCache.getCachedNip05('alice@nostr.example');
      expect(retrieved).toEqual(nip05Data);

      // Case-insensitive lookup
      const retrievedUpper = hostDataCache.getCachedNip05('Alice@Nostr.Example');
      expect(retrievedUpper).toEqual(nip05Data);
    });
  });

  describe('Storage Resilience', () => {
    it('handles clearAllHostCache properly', () => {
      hostDataCache.setCachedProfile(samplePubkey, sampleProfile);
      hostDataCache.setCachedRelays(samplePubkey, sampleRelays);
      hostDataCache.setCachedNip05('alice@example.com', { pubkey: samplePubkey });

      hostDataCache.clearAllHostCache();

      expect(hostDataCache.getCachedProfile(samplePubkey)).toBeNull();
      expect(hostDataCache.getCachedRelays(samplePubkey)).toBeNull();
      expect(hostDataCache.getCachedNip05('alice@example.com')).toBeNull();
    });
  });
});
