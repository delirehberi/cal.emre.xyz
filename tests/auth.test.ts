import { describe, it, expect } from 'vitest';
import { generateSecretKey, encodeNpub, encodeNsec, encodeNaddr } from '../src/client/lib/nostr/keys';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import { createTimeCalendarEventTemplate } from '../src/client/lib/nostr/nip52';

describe('Auth & Signer Core Integration Tests', () => {
  it('generates guest credentials and initializes PrivateKeySigner', async () => {
    const secretKey = generateSecretKey();
    const signer = new PrivateKeySigner(secretKey);
    const pubkey = await signer.getPublicKey();
    const npub = encodeNpub(pubkey);
    const nsec = encodeNsec(signer.getSecretKeyHex());

    expect(pubkey).toHaveLength(64);
    expect(npub.startsWith('npub1')).toBe(true);
    expect(nsec.startsWith('nsec1')).toBe(true);
    expect(signer.type).toBe('privateKey');
  });

  it('signs a NIP-52 appointment event correctly with PrivateKeySigner', async () => {
    const hostSecret = generateSecretKey();
    const guestSecret = generateSecretKey();

    const hostSigner = new PrivateKeySigner(hostSecret);
    const guestSigner = new PrivateKeySigner(guestSecret);

    const hostPubkey = await hostSigner.getPublicKey();
    const guestPubkey = await guestSigner.getPublicKey();

    const template = createTimeCalendarEventTemplate({
      identifier: 'booking-test-123',
      title: 'Strategy Session',
      summary: '30 minute meeting',
      start: 1789470000,
      end: 1789471800,
      startTzid: 'UTC',
      endTzid: 'UTC',
      attendees: [
        { pubkey: guestPubkey, role: 'attendee' },
        { pubkey: hostPubkey, role: 'host' },
      ],
    });

    const signedEvent = await guestSigner.signEvent(template);
    expect(signedEvent.kind).toBe(31923);
    expect(signedEvent.pubkey).toBe(guestPubkey);
    expect(signedEvent.sig).toHaveLength(128);

    const naddr = encodeNaddr({
      identifier: 'booking-test-123',
      pubkey: guestPubkey,
      kind: 31923,
      relays: ['wss://relay.damus.io'],
    });
    expect(naddr.startsWith('naddr1')).toBe(true);
  });
});
