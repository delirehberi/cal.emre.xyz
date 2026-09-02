import { describe, it, expect } from 'vitest';
import { generateSecretKey } from 'nostr-tools';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import { Nip07Signer, hasNip07Extension } from '../src/client/lib/nostr/nip07';
import { createTimeCalendarEventTemplate } from '../src/client/lib/nostr/nip52';

describe('signer.ts & nip07.ts: Nostr Signers', () => {
  it('PrivateKeySigner signs event templates properly', async () => {
    const sk = generateSecretKey();
    const signer = new PrivateKeySigner(sk);

    const pubkey = await signer.getPublicKey();
    expect(pubkey).toHaveLength(64);

    const template = createTimeCalendarEventTemplate({
      identifier: 'test-event',
      title: 'Test Event',
      start: 1725285600,
    });

    const signed = await signer.signEvent(template);
    expect(signed.id).toBeDefined();
    expect(signed.sig).toBeDefined();
    expect(signed.pubkey).toBe(pubkey);
    expect(signed.kind).toBe(31923);
  });

  it('Nip07Signer reports availability in non-browser environment gracefully', async () => {
    const signer = new Nip07Signer();
    expect(hasNip07Extension()).toBe(false);
    const available = await signer.isAvailable();
    expect(available).toBe(false);
    await expect(signer.getPublicKey()).rejects.toThrow('No NIP-07 extension detected');
  });
});
