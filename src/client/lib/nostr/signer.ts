import type { Event, EventTemplate } from 'nostr-tools';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { hexToBytes, bytesToHex } from 'nostr-tools/utils';

export type SignerType = 'nip07' | 'nip46' | 'privateKey';

export interface NostrSigner {
  type: SignerType;
  getPublicKey(): Promise<string>;
  signEvent(eventTemplate: EventTemplate): Promise<Event>;
}

/**
 * Signer using a local secret key (Uint8Array or hex string).
 * Ideal for guest 1-click booking or user-provided nsec.
 */
export class PrivateKeySigner implements NostrSigner {
  readonly type: SignerType = 'privateKey';
  private secretKey: Uint8Array;
  private pubkey: string;

  constructor(secretKey: Uint8Array | string) {
    this.secretKey = typeof secretKey === 'string' ? hexToBytes(secretKey) : secretKey;
    if (this.secretKey.length !== 32) {
      throw new Error(`Secret key must be exactly 32 bytes, got ${this.secretKey.length}`);
    }
    this.pubkey = getPublicKey(this.secretKey);
  }

  async getPublicKey(): Promise<string> {
    return this.pubkey;
  }

  async signEvent(eventTemplate: EventTemplate): Promise<Event> {
    return finalizeEvent(eventTemplate, this.secretKey);
  }

  getSecretKeyHex(): string {
    return bytesToHex(this.secretKey);
  }
}
