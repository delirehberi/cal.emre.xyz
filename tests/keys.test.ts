import { describe, it, expect, vi } from 'vitest';
import {
  generateGuestKeyPair,
  isValidHexPubkey,
  encodeNpub,
  decodeNpub,
  encodeNsec,
  decodeNsec,
  encodeNaddr,
  decodeNaddr,
  encodeNprofile,
  decodeNprofile,
  parseIdentifier,
  resolveParticipantKey,
} from '../src/client/lib/nostr/keys';

describe('keys.ts: Nostr Key & NIP-19 Operations', () => {
  it('generates a valid guest keypair with correct formats', () => {
    const keypair = generateGuestKeyPair();
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey.length).toBe(32);
    expect(keypair.secretKeyHex).toHaveLength(64);
    expect(keypair.publicKeyHex).toHaveLength(64);
    expect(isValidHexPubkey(keypair.publicKeyHex)).toBe(true);
    expect(keypair.npub.startsWith('npub1')).toBe(true);
    expect(keypair.nsec.startsWith('nsec1')).toBe(true);
  });

  it('correctly validates hex public keys', () => {
    expect(isValidHexPubkey('3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473')).toBe(true);
    expect(isValidHexPubkey('3BF0C63FCB93463407AF97B5E0928885E819FA96A44BF43EAC75537E87BA1473')).toBe(true);
    expect(isValidHexPubkey('invalid-hex')).toBe(false);
    expect(isValidHexPubkey('3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba147')).toBe(false); // 63 chars
  });

  it('encodes and decodes npub accurately', () => {
    const pubkeyHex = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';
    const npub = encodeNpub(pubkeyHex);
    expect(npub.startsWith('npub1')).toBe(true);
    const decoded = decodeNpub(npub);
    expect(decoded).toBe(pubkeyHex);
  });

  it('encodes and decodes nsec accurately', () => {
    const keypair = generateGuestKeyPair();
    const encoded = encodeNsec(keypair.secretKey);
    expect(encoded).toBe(keypair.nsec);
    const decoded = decodeNsec(encoded);
    expect(decoded.secretKeyHex).toBe(keypair.secretKeyHex);
  });

  it('encodes and decodes naddr for calendar event coordinate', () => {
    const pubkeyHex = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';
    const naddr = encodeNaddr({
      identifier: '30m-intro-call',
      pubkey: pubkeyHex,
      kind: 31923,
      relays: ['wss://relay.damus.io', 'wss://nos.lol'],
    });

    expect(naddr.startsWith('naddr1')).toBe(true);
    const decoded = decodeNaddr(naddr);
    expect(decoded.identifier).toBe('30m-intro-call');
    expect(decoded.pubkey).toBe(pubkeyHex);
    expect(decoded.kind).toBe(31923);
    expect(decoded.relays).toEqual(['wss://relay.damus.io', 'wss://nos.lol']);
  });

  it('encodes and decodes nprofile accurately', () => {
    const pubkeyHex = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';
    const nprofile = encodeNprofile(pubkeyHex, ['wss://relay.damus.io']);
    expect(nprofile.startsWith('nprofile1')).toBe(true);
    const decoded = decodeNprofile(nprofile);
    expect(decoded.pubkey).toBe(pubkeyHex);
    expect(decoded.relays).toEqual(['wss://relay.damus.io']);
  });

  it('parses different identifier formats properly', () => {
    const pubkeyHex = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';
    const npub = encodeNpub(pubkeyHex);
    const naddr = encodeNaddr({ identifier: 'meet', pubkey: pubkeyHex, kind: 31923 });

    expect(parseIdentifier(pubkeyHex)).toMatchObject({ type: 'pubkey', pubkey: pubkeyHex });
    expect(parseIdentifier(npub)).toMatchObject({ type: 'npub', pubkey: pubkeyHex });
    expect(parseIdentifier(naddr)).toMatchObject({ type: 'naddr', pubkey: pubkeyHex, identifier: 'meet', kind: 31923 });
    expect(parseIdentifier('z@emre.xyz')).toMatchObject({ type: 'nip05', raw: 'z@emre.xyz' });
    expect(parseIdentifier('emre.xyz')).toMatchObject({ type: 'nip05', raw: 'emre.xyz' });
    expect(parseIdentifier('fadim%40nostr.org.tr')).toMatchObject({ type: 'nip05', raw: 'fadim@nostr.org.tr' });
    expect(parseIdentifier('some-invalid-string')).toMatchObject({ type: 'unknown' });
  });

  it('resolves NIP-05 identifiers using edge proxy fallback when direct query fails', async () => {
    const { resolveNip05 } = await import('../src/client/lib/nostr/keys');

    const mockProxyResponse = {
      success: true,
      pubkey: '628b2c9aedcf9da47f42128402f3fd82787dac75c3595db1bccf3b7baab0452f',
      relays: ['wss://relay.nostr.org.tr'],
      name: 'fadim',
      domain: 'nostr.org.tr',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('.well-known/nostr.json')) {
        // Simulate CORS browser failure
        throw new TypeError('Failed to fetch (CORS Error)');
      }
      if (url.includes('/api/nip05/resolve')) {
        return new Response(JSON.stringify(mockProxyResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await resolveNip05('fadim@nostr.org.tr', true);
    expect(result).not.toBeNull();
    expect(result?.pubkey).toBe('628b2c9aedcf9da47f42128402f3fd82787dac75c3595db1bccf3b7baab0452f');
    expect(result?.relays).toContain('wss://relay.nostr.org.tr');

    fetchSpy.mockRestore();
  });

  describe('resolveParticipantKey', () => {
    const pubkeyHex = '3bf0c63fcb93463407af97b5e0928885e819fa96a44bf43eac75537e87ba1473';

    it('resolves valid hex pubkey directly', async () => {
      const res = await resolveParticipantKey(pubkeyHex);
      expect(res).not.toBeNull();
      expect(res?.pubkey).toBe(pubkeyHex);
      expect(res?.npub).toBe(encodeNpub(pubkeyHex));
    });

    it('resolves valid npub format directly', async () => {
      const npub = encodeNpub(pubkeyHex);
      const res = await resolveParticipantKey(npub);
      expect(res).not.toBeNull();
      expect(res?.pubkey).toBe(pubkeyHex);
      expect(res?.npub).toBe(npub);
    });

    it('rejects on invalid garbage input', async () => {
      await expect(resolveParticipantKey('not-a-valid-identifier-xyz')).rejects.toThrow(
        'Could not resolve participant identifier'
      );
    });
  });
});
