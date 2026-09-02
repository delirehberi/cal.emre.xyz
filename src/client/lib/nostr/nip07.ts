import type { Event, EventTemplate } from 'nostr-tools';
import type { NostrSigner, SignerType } from './signer';

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: EventTemplate): Promise<Event>;
      getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
      nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

/**
 * Checks if a NIP-07 browser extension (e.g., Alby, nos2x) is present in window.
 */
export function hasNip07Extension(): boolean {
  return typeof window !== 'undefined' && typeof window.nostr !== 'undefined';
}

/**
 * Waits for NIP-07 extension to be injected (some extensions inject asynchronously).
 */
export async function waitForNip07Extension(timeoutMs = 1500): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (hasNip07Extension()) return true;

  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (hasNip07Extension()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * NostrSigner implementation wrapping window.nostr (NIP-07 extension).
 */
export class Nip07Signer implements NostrSigner {
  readonly type: SignerType = 'nip07';
  private cachedPubkey: string | null = null;

  async isAvailable(): Promise<boolean> {
    return waitForNip07Extension();
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPubkey) {
      return this.cachedPubkey;
    }

    const available = await this.isAvailable();
    if (!available || !window.nostr) {
      throw new Error('No NIP-07 extension detected (e.g. Alby, nos2x). Please install an extension or use key login.');
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      this.cachedPubkey = pubkey.toLowerCase();
      return this.cachedPubkey;
    } catch (err) {
      throw new Error(`Extension access rejected or failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async signEvent(eventTemplate: EventTemplate): Promise<Event> {
    const available = await this.isAvailable();
    if (!available || !window.nostr) {
      throw new Error('No NIP-07 extension detected.');
    }

    try {
      return await window.nostr.signEvent(eventTemplate);
    } catch (err) {
      throw new Error(`Signing failed or was cancelled in extension: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
