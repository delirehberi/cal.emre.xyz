import type { Event, EventTemplate } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools';
import type { NostrSigner, SignerType } from './signer';

export interface BunkerConnectionOptions {
  clientSecretKey?: Uint8Array;
  onauth?: (url: string) => void;
}

/**
 * NostrSigner implementation for remote Bunker / Nostr Connect (NIP-46).
 */
export class Nip46Signer implements NostrSigner {
  readonly type: SignerType = 'nip46';
  private bunkerPointer: string;
  private signerInstance: BunkerSigner | null = null;
  private clientSecretKey: Uint8Array;
  private onauth?: (url: string) => void;
  private cachedPubkey: string | null = null;

  constructor(bunkerPointer: string, options?: BunkerConnectionOptions) {
    this.bunkerPointer = bunkerPointer.trim();
    this.clientSecretKey = options?.clientSecretKey || generateSecretKey();
    this.onauth = options?.onauth;
  }

  private async getOrCreateBunkerSigner(): Promise<BunkerSigner> {
    if (this.signerInstance) {
      return this.signerInstance;
    }

    const bunkerPointerObj = await parseBunkerInput(this.bunkerPointer);
    if (!bunkerPointerObj) {
      throw new Error(`Invalid Bunker URI or identifier: "${this.bunkerPointer}"`);
    }

    const signer = BunkerSigner.fromBunker(
      this.clientSecretKey,
      bunkerPointerObj,
      { onauth: this.onauth }
    );

    await signer.connect();
    this.signerInstance = signer;
    return signer;
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPubkey) {
      return this.cachedPubkey;
    }

    const signer = await this.getOrCreateBunkerSigner();
    const pubkey = await signer.getPublicKey();
    this.cachedPubkey = pubkey.toLowerCase();
    return this.cachedPubkey;
  }

  async signEvent(eventTemplate: EventTemplate): Promise<Event> {
    const signer = await this.getOrCreateBunkerSigner();
    return await signer.signEvent(eventTemplate);
  }

  async close(): Promise<void> {
    if (this.signerInstance) {
      await this.signerInstance.close();
      this.signerInstance = null;
    }
  }
}
