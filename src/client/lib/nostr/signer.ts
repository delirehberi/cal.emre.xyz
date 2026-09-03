import type { Event, EventTemplate } from 'nostr-tools';
import { finalizeEvent, getPublicKey, nip04, nip44 } from 'nostr-tools';
import { hexToBytes, bytesToHex } from 'nostr-tools/utils';

export type SignerType = 'nip07' | 'nip46' | 'privateKey';

export interface NostrSigner {
  type: SignerType;
  getPublicKey(): Promise<string>;
  signEvent(eventTemplate: EventTemplate): Promise<Event>;
  encrypt?(recipientPubkey: string, plaintext: string): Promise<string>;
  decrypt?(senderPubkey: string, ciphertext: string): Promise<string>;
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

  async encrypt(recipientPubkey: string, plaintext: string): Promise<string> {
    try {
      const key = nip44.getConversationKey(this.secretKey, recipientPubkey.toLowerCase());
      return nip44.encrypt(plaintext, key);
    } catch {
      return nip04.encrypt(this.secretKey, recipientPubkey.toLowerCase(), plaintext);
    }
  }

  async decrypt(senderPubkey: string, ciphertext: string): Promise<string> {
    try {
      const key = nip44.getConversationKey(this.secretKey, senderPubkey.toLowerCase());
      return nip44.decrypt(ciphertext, key);
    } catch {
      return nip04.decrypt(this.secretKey, senderPubkey.toLowerCase(), ciphertext);
    }
  }

  getSecretKeyHex(): string {
    return bytesToHex(this.secretKey);
  }
}
