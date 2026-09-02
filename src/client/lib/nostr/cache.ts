import { APP_CONFIG } from '../../../config';
import type { HostProfile } from './relays';
import type { RelayList } from './nip65';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export const CACHE_TTL = {
  PROFILE: 60 * 60 * 1000, // 1 hour
  RELAYS: 24 * 60 * 60 * 1000, // 24 hours
  NIP05: 24 * 60 * 60 * 1000, // 24 hours
} as const;

const STORAGE_PREFIX = {
  PROFILE: 'cal_cache_profile_',
  RELAYS: 'cal_cache_relays_',
  NIP05: 'cal_cache_nip05_',
} as const;

/**
 * Multi-tier persistent cache for host metadata, relays, and NIP-05 resolutions.
 * Combines in-memory L1 cache with localStorage L2 cache.
 */
class HostDataCacheManager {
  private memoryCache = new Map<string, CacheEntry<unknown>>();

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch {
      // Storage access blocked or unavailable
    }
    return null;
  }

  private getItem<T>(key: string, allowStale = false): T | null {
    // 1. Check in-memory L1 cache
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      const isExpired = Date.now() - memEntry.timestamp > memEntry.ttlMs;
      if (!isExpired || allowStale) {
        return memEntry.data;
      }
    }

    // 2. Check localStorage L2 cache
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(key);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (!entry || typeof entry.timestamp !== 'number' || typeof entry.ttlMs !== 'number') {
        return null;
      }

      // Populate L1 cache
      this.memoryCache.set(key, entry);

      const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
      if (!isExpired || allowStale) {
        return entry.data;
      }

      return null;
    } catch {
      return null;
    }
  }

  private setItem<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };

    // 1. Set L1 cache
    this.memoryCache.set(key, entry);

    // 2. Set L2 cache
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(entry));
      } catch {
        // Quota exceeded or storage disabled
      }
    }
  }

  private removeItem(key: string): void {
    this.memoryCache.delete(key);
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Storage access error
      }
    }
  }

  /**
   * Retrieves cached host profile metadata (Kind 0).
   */
  getCachedProfile(pubkey: string, allowStale = false): HostProfile | null {
    const normalizedPubkey = pubkey.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.PROFILE}${normalizedPubkey}`;
    const cached = this.getItem<HostProfile>(key, allowStale);
    if (cached) return cached;

    // Master user fallback pre-seed
    if (normalizedPubkey === APP_CONFIG.defaultHostPubkey.toLowerCase()) {
      const defaultProfile: HostProfile = {
        pubkey: APP_CONFIG.defaultHostPubkey,
        name: 'delirehberi',
        displayName: 'delirehberi',
        nip05: APP_CONFIG.defaultHostNip05,
        about: 'Sovereign Nostr scheduling and appointments',
      };
      return defaultProfile;
    }

    return null;
  }

  /**
   * Saves host profile metadata to persistent cache.
   */
  setCachedProfile(pubkey: string, profile: HostProfile, ttlMs = CACHE_TTL.PROFILE): void {
    const normalizedPubkey = pubkey.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.PROFILE}${normalizedPubkey}`;
    this.setItem(key, profile, ttlMs);
  }

  /**
   * Retrieves cached host relay list (Kind 10002 / Kind 3).
   */
  getCachedRelays(pubkey: string, allowStale = false): RelayList | null {
    const normalizedPubkey = pubkey.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.RELAYS}${normalizedPubkey}`;
    const cached = this.getItem<RelayList>(key, allowStale);
    if (cached) return cached;

    // Master user fallback relays
    if (normalizedPubkey === APP_CONFIG.defaultHostPubkey.toLowerCase()) {
      return {
        read: [...APP_CONFIG.defaultRelays],
        write: [...APP_CONFIG.defaultRelays],
        all: [...APP_CONFIG.defaultRelays],
      };
    }

    return null;
  }

  /**
   * Saves host relay list to persistent cache.
   */
  setCachedRelays(pubkey: string, relays: RelayList, ttlMs = CACHE_TTL.RELAYS): void {
    const normalizedPubkey = pubkey.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.RELAYS}${normalizedPubkey}`;
    this.setItem(key, relays, ttlMs);
  }

  /**
   * Retrieves cached NIP-05 identifier resolution.
   */
  getCachedNip05(identifier: string, allowStale = false): { pubkey: string; relays?: string[] } | null {
    const normalized = identifier.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.NIP05}${normalized}`;
    const cached = this.getItem<{ pubkey: string; relays?: string[] }>(key, allowStale);
    if (cached) return cached;

    // Master host fallback
    if (
      normalized === APP_CONFIG.defaultHostNip05.toLowerCase() ||
      normalized === 'delirehberi' ||
      normalized === 'delirehberi@emre.xyz'
    ) {
      return {
        pubkey: APP_CONFIG.defaultHostPubkey,
        relays: [...APP_CONFIG.defaultRelays],
      };
    }

    return null;
  }

  /**
   * Saves NIP-05 resolution to persistent cache.
   */
  setCachedNip05(
    identifier: string,
    data: { pubkey: string; relays?: string[] },
    ttlMs = CACHE_TTL.NIP05
  ): void {
    const normalized = identifier.toLowerCase().trim();
    const key = `${STORAGE_PREFIX.NIP05}${normalized}`;
    this.setItem(key, data, ttlMs);
  }

  /**
   * Invalidates cached data for a specific host pubkey.
   */
  invalidateHostCache(pubkey: string): void {
    const normalizedPubkey = pubkey.toLowerCase().trim();
    this.removeItem(`${STORAGE_PREFIX.PROFILE}${normalizedPubkey}`);
    this.removeItem(`${STORAGE_PREFIX.RELAYS}${normalizedPubkey}`);
  }

  /**
   * Clears all cached host data from memory and storage.
   */
  clearAllHostCache(): void {
    this.memoryCache.clear();
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith(STORAGE_PREFIX.PROFILE) ||
            key.startsWith(STORAGE_PREFIX.RELAYS) ||
            key.startsWith(STORAGE_PREFIX.NIP05))
        ) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        storage.removeItem(k);
      }
    } catch {
      // Storage access error
    }
  }
}

export const hostDataCache = new HostDataCacheManager();
