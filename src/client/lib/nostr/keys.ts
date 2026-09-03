import {
  generateSecretKey,
  getPublicKey,
  nip19,
  nip05,
} from 'nostr-tools';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { APP_CONFIG } from '../../../config';

export { generateSecretKey, getPublicKey };

export interface GuestKeyPair {
  secretKey: Uint8Array;
  secretKeyHex: string;
  publicKeyHex: string;
  npub: `npub1${string}`;
  nsec: `nsec1${string}`;
}

export interface NaddrParams {
  identifier: string;
  pubkey: string;
  kind: number;
  relays?: string[];
}

export interface ParsedIdentifier {
  type: 'pubkey' | 'npub' | 'nprofile' | 'naddr' | 'nip05' | 'unknown';
  pubkey?: string;
  relays?: string[];
  identifier?: string; // For naddr 'd' tag
  kind?: number; // For naddr kind
  raw: string;
}

/**
 * Generates a fresh client-side cryptographic keypair for guest or new user bookings.
 */
export function generateGuestKeyPair(): GuestKeyPair {
  const secretKey = generateSecretKey();
  const secretKeyHex = bytesToHex(secretKey);
  const publicKeyHex = getPublicKey(secretKey);
  const npub = nip19.npubEncode(publicKeyHex);
  const nsec = nip19.nsecEncode(secretKey);

  return {
    secretKey,
    secretKeyHex,
    publicKeyHex,
    npub,
    nsec,
  };
}

/**
 * Validates whether a given string is a 64-character lowercase hex public key.
 */
export function isValidHexPubkey(hex: string): boolean {
  return /^[0-9a-f]{64}$/i.test(hex);
}

/**
 * Encodes a hex public key to NIP-19 npub format.
 */
export function encodeNpub(pubkeyHex: string): `npub1${string}` {
  if (!isValidHexPubkey(pubkeyHex)) {
    throw new Error(`Invalid hex public key format: "${pubkeyHex}"`);
  }
  return nip19.npubEncode(pubkeyHex.toLowerCase());
}

/**
 * Decodes an npub to a 64-char hex public key.
 */
export function decodeNpub(npub: string): string {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type !== 'npub') {
      throw new Error(`Expected npub, got type: ${decoded.type}`);
    }
    return decoded.data;
  } catch (err) {
    throw new Error(`Failed to decode npub "${npub}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Encodes secret key bytes or hex string to NIP-19 nsec format.
 */
export function encodeNsec(secretKey: Uint8Array | string): `nsec1${string}` {
  const bytes = typeof secretKey === 'string' ? hexToBytes(secretKey) : secretKey;
  if (bytes.length !== 32) {
    throw new Error(`Secret key must be 32 bytes, got ${bytes.length}`);
  }
  return nip19.nsecEncode(bytes);
}

/**
 * Decodes an nsec to a 32-byte Uint8Array and hex string.
 */
export function decodeNsec(nsec: string): { secretKey: Uint8Array; secretKeyHex: string } {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error(`Expected nsec, got type: ${decoded.type}`);
    }
    const secretKey = decoded.data;
    return {
      secretKey,
      secretKeyHex: bytesToHex(secretKey),
    };
  } catch (err) {
    throw new Error(`Failed to decode nsec: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Encodes calendar event coordinate to NIP-19 naddr format.
 */
export function encodeNaddr(params: NaddrParams): `naddr1${string}` {
  if (!isValidHexPubkey(params.pubkey)) {
    throw new Error(`Invalid hex pubkey for naddr: "${params.pubkey}"`);
  }
  return nip19.naddrEncode({
    identifier: params.identifier,
    pubkey: params.pubkey.toLowerCase(),
    kind: params.kind,
    relays: params.relays,
  });
}

/**
 * Decodes an naddr to its components.
 */
export function decodeNaddr(naddr: string): NaddrParams {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') {
      throw new Error(`Expected naddr, got type: ${decoded.type}`);
    }
    return {
      identifier: decoded.data.identifier,
      pubkey: decoded.data.pubkey,
      kind: decoded.data.kind,
      relays: decoded.data.relays,
    };
  } catch (err) {
    throw new Error(`Failed to decode naddr "${naddr}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Encodes public key and optional relays to NIP-19 nprofile format.
 */
export function encodeNprofile(pubkey: string, relays?: string[]): `nprofile1${string}` {
  if (!isValidHexPubkey(pubkey)) {
    throw new Error(`Invalid hex pubkey for nprofile: "${pubkey}"`);
  }
  return nip19.nprofileEncode({
    pubkey: pubkey.toLowerCase(),
    relays: relays && relays.length > 0 ? relays : undefined,
  });
}

/**
 * Decodes an nprofile to public key and relay list.
 */
export function decodeNprofile(nprofile: string): { pubkey: string; relays?: string[] } {
  try {
    const decoded = nip19.decode(nprofile);
    if (decoded.type !== 'nprofile') {
      throw new Error(`Expected nprofile, got type: ${decoded.type}`);
    }
    return {
      pubkey: decoded.data.pubkey,
      relays: decoded.data.relays,
    };
  } catch (err) {
    throw new Error(`Failed to decode nprofile "${nprofile}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Intelligently classifies and extracts Nostr identifiers (npub, nprofile, naddr, hex, NIP-05).
 */
export function parseIdentifier(input: string): ParsedIdentifier {
  let trimmed = input.trim();
  try {
    trimmed = decodeURIComponent(trimmed).trim();
  } catch {
    // Keep as is if decode fails
  }

  if (isValidHexPubkey(trimmed)) {
    return {
      type: 'pubkey',
      pubkey: trimmed.toLowerCase(),
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('npub1')) {
    try {
      const pubkey = decodeNpub(trimmed);
      return {
        type: 'npub',
        pubkey,
        raw: trimmed,
      };
    } catch {
      return { type: 'unknown', raw: trimmed };
    }
  }

  if (trimmed.startsWith('nprofile1')) {
    try {
      const decoded = decodeNprofile(trimmed);
      return {
        type: 'nprofile',
        pubkey: decoded.pubkey,
        relays: decoded.relays,
        raw: trimmed,
      };
    } catch {
      return { type: 'unknown', raw: trimmed };
    }
  }

  if (trimmed.startsWith('naddr1')) {
    try {
      const decoded = decodeNaddr(trimmed);
      return {
        type: 'naddr',
        pubkey: decoded.pubkey,
        identifier: decoded.identifier,
        kind: decoded.kind,
        relays: decoded.relays,
        raw: trimmed,
      };
    } catch {
      return { type: 'unknown', raw: trimmed };
    }
  }

  // NIP-05: name@domain.com or domain.com (_@domain.com)
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return {
      type: 'nip05',
      raw: trimmed,
    };
  }

  return {
    type: 'unknown',
    raw: trimmed,
  };
}

import { hostDataCache } from './cache';

/**
 * Resolves a NIP-05 identifier (e.g. delirehberi@emre.xyz or emre.xyz) to a public key and optional relays.
 * Supports direct client lookup with automatic Edge proxy fallback if CORS or network restrictions occur.
 */
export async function resolveNip05(
  identifier: string,
  forceRefresh = false
): Promise<{ pubkey: string; relays?: string[] } | null> {
  let normalized = identifier.trim().toLowerCase();
  try {
    normalized = decodeURIComponent(normalized).trim().toLowerCase();
  } catch {
    // Keep normalized as is
  }

  if (!forceRefresh) {
    const cached = hostDataCache.getCachedNip05(normalized);
    if (cached) {
      return cached;
    }
  }

  // 1. Primary path: Direct client-side NIP-05 lookup via nostr-tools
  try {
    const profile = await nip05.queryProfile(normalized);
    if (profile && profile.pubkey && isValidHexPubkey(profile.pubkey)) {
      const result = {
        pubkey: profile.pubkey.toLowerCase(),
        relays: profile.relays,
      };
      hostDataCache.setCachedNip05(normalized, result);
      return result;
    }
  } catch {
    // Network or CORS failure — proceed to Edge proxy fallback below
  }

  // 2. Secondary fallback path: Server-side Edge Resolver (/api/nip05/resolve)
  try {
    const proxyUrl = `/api/nip05/resolve?identifier=${encodeURIComponent(normalized)}`;
    const response = await fetch(proxyUrl, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        success?: boolean;
        pubkey?: string;
        relays?: string[];
      };
      if (data && data.success && data.pubkey && isValidHexPubkey(data.pubkey)) {
        const result = {
          pubkey: data.pubkey.toLowerCase(),
          relays: data.relays,
        };
        hostDataCache.setCachedNip05(normalized, result);
        return result;
      }
    }
  } catch {
    // Edge proxy unreachable or failed
  }

  // 3. Stale cache fallback if available
  const staleOrFallback = hostDataCache.getCachedNip05(normalized, true);
  if (staleOrFallback) {
    return staleOrFallback;
  }

  // 4. Built-in fallback for configured default host
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
 * Resolves a NIP-05 identifier to its public key string.
 */
export async function queryNip05Pubkey(identifier: string, forceRefresh = false): Promise<string | null> {
  const res = await resolveNip05(identifier, forceRefresh);
  return res ? res.pubkey : null;
}

/**
 * Decodes any key format (hex, npub, nsec) to hex string.
 */
export function decodeKeyToHex(input: string): string {
  const trimmed = input.trim();
  if (isValidHexPubkey(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith('npub1')) {
    return decodeNpub(trimmed);
  }
  if (trimmed.startsWith('nsec1')) {
    return decodeNsec(trimmed).secretKeyHex;
  }
  throw new Error(`Invalid key format: ${input}`);
}

