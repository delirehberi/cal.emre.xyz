import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import {
  encryptBookingDetails,
  decryptBookingDetails,
  isLikelyEncrypted,
} from '../src/client/lib/nostr/encryption';

describe('End-to-End Encryption for Host (NIP-44 / NIP-04)', () => {
  const hostSecretKey = generateSecretKey();
  const hostPubkey = getPublicKey(hostSecretKey);
  const hostSigner = new PrivateKeySigner(hostSecretKey);

  const attendeeSecretKey = generateSecretKey();
  const attendeePubkey = getPublicKey(attendeeSecretKey);
  const attendeeSigner = new PrivateKeySigner(attendeeSecretKey);

  const thirdPartySecretKey = generateSecretKey();
  const thirdPartySigner = new PrivateKeySigner(thirdPartySecretKey);

  describe('isLikelyEncrypted Helper', () => {
    it('identifies NIP-04 ciphertext with ?iv=', () => {
      expect(isLikelyEncrypted('dGhpcyBpcyBhIHRlc3Q=?iv=MTIzNDU2Nzg5MA==')).toBe(true);
    });

    it('identifies NIP-44 base64 ciphertext', () => {
      expect(isLikelyEncrypted('AQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJic=')).toBe(true);
    });

    it('returns false for plaintext JSON strings', () => {
      expect(isLikelyEncrypted('{"name":"Alice","notes":"Secret meeting"}')).toBe(false);
    });

    it('returns false for empty or falsy strings', () => {
      expect(isLikelyEncrypted('')).toBe(false);
      expect(isLikelyEncrypted(undefined)).toBe(false);
    });
  });

  describe('PrivateKeySigner Encryption & Decryption', () => {
    it('encrypts plaintext from attendee to host and host successfully decrypts', async () => {
      const secretMessage = 'Private meeting notes about Nostr NIP-52 scaling.';
      const ciphertext = await attendeeSigner.encrypt(hostPubkey, secretMessage);

      expect(ciphertext).not.toBe(secretMessage);
      expect(ciphertext.length).toBeGreaterThan(20);

      // Host decrypts ciphertext from attendee
      const decrypted = await hostSigner.decrypt(attendeePubkey, ciphertext);
      expect(decrypted).toBe(secretMessage);
    });

    it('fails when a third party attempts to decrypt message intended for host', async () => {
      const secretMessage = 'Top secret strategy discussion';
      const ciphertext = await attendeeSigner.encrypt(hostPubkey, secretMessage);

      await expect(
        thirdPartySigner.decrypt(attendeePubkey, ciphertext)
      ).rejects.toThrow();
    });
  });

  describe('Booking Details Encryption & Decryption Flow', () => {
    it('encrypts name, notes, and email for the host and decrypts accurately', async () => {
      const bookingData = {
        name: 'Satoshi Nakamoto',
        notes: 'Reviewing calendar collision algorithm and NIP-52 RSVP protocol.',
        email: 'satoshi@gmx.com',
      };

      const ciphertext = await encryptBookingDetails(attendeeSigner, hostPubkey, bookingData);

      expect(isLikelyEncrypted(ciphertext)).toBe(true);
      expect(ciphertext).not.toContain('Satoshi');
      expect(ciphertext).not.toContain('Reviewing calendar');

      // Host decrypts the booking details
      const decrypted = await decryptBookingDetails(hostSigner, attendeePubkey, ciphertext);

      expect(decrypted).not.toBeNull();
      expect(decrypted?.name).toBe('Satoshi Nakamoto');
      expect(decrypted?.notes).toBe('Reviewing calendar collision algorithm and NIP-52 RSVP protocol.');
      expect(decrypted?.email).toBe('satoshi@gmx.com');
    });

    it('handles legacy unencrypted JSON content gracefully without failing', async () => {
      const plainJson = JSON.stringify({
        name: 'Legacy User',
        notes: 'Unencrypted appointment note',
        email: 'legacy@example.com',
      });

      const parsed = await decryptBookingDetails(hostSigner, attendeePubkey, plainJson);

      expect(parsed).not.toBeNull();
      expect(parsed?.name).toBe('Legacy User');
      expect(parsed?.notes).toBe('Unencrypted appointment note');
      expect(parsed?.email).toBe('legacy@example.com');
    });

    it('returns null when content is empty or signer cannot decrypt', async () => {
      expect(await decryptBookingDetails(hostSigner, attendeePubkey, '')).toBeNull();
      expect(await decryptBookingDetails(hostSigner, attendeePubkey, undefined)).toBeNull();

      const ciphertext = await attendeeSigner.encrypt(hostPubkey, 'secret');
      const unauthorized = await decryptBookingDetails(thirdPartySigner, attendeePubkey, ciphertext);
      expect(unauthorized).toBeNull();
    });
  });
});
