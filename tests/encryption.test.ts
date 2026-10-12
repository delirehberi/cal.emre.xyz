import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { PrivateKeySigner } from '../src/client/lib/nostr/signer';
import {
  encryptBookingDetails,
  decryptBookingDetails,
  encryptBookingForRecipients,
  buildPublicBookingContent,
  findEncryptedCopy,
  isLikelyEncrypted,
  ENCRYPTED_COPY_TAG,
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

describe('Encryption for invited people', () => {
  const hostSecret = generateSecretKey();
  const hostPubkey = getPublicKey(hostSecret);
  const hostSigner = new PrivateKeySigner(hostSecret);

  const bookerSecret = generateSecretKey();
  const bookerPubkey = getPublicKey(bookerSecret);
  const bookerSigner = new PrivateKeySigner(bookerSecret);

  const inviteeSecret = generateSecretKey();
  const inviteePubkey = getPublicKey(inviteeSecret);
  const inviteeSigner = new PrivateKeySigner(inviteeSecret);

  const otherInviteeSecret = generateSecretKey();
  const otherInviteePubkey = getPublicKey(otherInviteeSecret);
  const otherInviteeSigner = new PrivateKeySigner(otherInviteeSecret);

  const outsiderSigner = new PrivateKeySigner(generateSecretKey());

  const details = {
    name: 'Ayşe Demir',
    notes: 'Gündem: yeni takvim tasarımı',
    email: 'ayse@example.com',
    title: 'Proje görüşmesi',
    participants: ['mehmet@example.com'],
  };

  it('keeps the host copy in the content, readable exactly as before', async () => {
    const { content } = await encryptBookingForRecipients(bookerSigner, hostPubkey, [inviteePubkey], details);
    const read = await decryptBookingDetails(hostSigner, bookerPubkey, content);
    expect(read).toMatchObject({ name: 'Ayşe Demir', title: 'Proje görüşmesi', email: 'ayse@example.com' });
    expect(read?.participants).toEqual(['mehmet@example.com']);
  });

  it('adds one separate ciphertext tag per invited pubkey', async () => {
    const { content, tags } = await encryptBookingForRecipients(
      bookerSigner,
      hostPubkey,
      [inviteePubkey, otherInviteePubkey],
      details
    );
    expect(tags.map((tag) => tag[0])).toEqual([ENCRYPTED_COPY_TAG, ENCRYPTED_COPY_TAG]);
    expect(tags.map((tag) => tag[1])).toEqual([inviteePubkey, otherInviteePubkey]);
    expect(new Set([content, tags[0][2], tags[1][2]]).size).toBe(3);
  });

  it('lets each invited person read their own copy and nobody else', async () => {
    const { content, tags } = await encryptBookingForRecipients(
      bookerSigner,
      hostPubkey,
      [inviteePubkey, otherInviteePubkey],
      details
    );

    const asInvitee = await decryptBookingDetails(inviteeSigner, bookerPubkey, content, { tags, viewerPubkey: inviteePubkey });
    expect(asInvitee?.name).toBe('Ayşe Demir');
    expect(asInvitee?.notes).toBe('Gündem: yeni takvim tasarımı');

    const asOther = await decryptBookingDetails(otherInviteeSigner, bookerPubkey, content, {
      tags,
      viewerPubkey: otherInviteePubkey,
    });
    expect(asOther?.title).toBe('Proje görüşmesi');

    // Without the tags an invitee only sees the host's ciphertext, which they cannot open.
    expect(await decryptBookingDetails(inviteeSigner, bookerPubkey, content)).toBeNull();
    // A person who was not invited has no copy and cannot open the host's.
    expect(
      await decryptBookingDetails(outsiderSigner, bookerPubkey, content, { tags, viewerPubkey: await outsiderSigner.getPublicKey() })
    ).toBeNull();
  });

  it('does not let one invitee open another invitee copy', async () => {
    const { tags } = await encryptBookingForRecipients(bookerSigner, hostPubkey, [inviteePubkey, otherInviteePubkey], details);
    const copyForOther = findEncryptedCopy(tags, otherInviteePubkey)!;
    expect(await decryptBookingDetails(inviteeSigner, bookerPubkey, copyForOther)).toBeNull();
  });

  it('skips the host and the author as invitees and removes duplicates', async () => {
    const { tags } = await encryptBookingForRecipients(
      bookerSigner,
      hostPubkey,
      [hostPubkey, bookerPubkey, inviteePubkey, inviteePubkey.toUpperCase()],
      details
    );
    expect(tags).toHaveLength(1);
    expect(tags[0][1]).toBe(inviteePubkey);
  });

  it('adds no tags when nobody is invited', async () => {
    const { tags } = await encryptBookingForRecipients(bookerSigner, hostPubkey, [], details);
    expect(tags).toEqual([]);
  });

  it('refuses to encrypt with a signer that cannot encrypt', async () => {
    const noEncrypt = { type: 'privateKey', getPublicKey: async () => bookerPubkey, signEvent: async () => { throw new Error('unused'); } };
    await expect(
      encryptBookingForRecipients(noEncrypt as unknown as PrivateKeySigner, hostPubkey, [inviteePubkey], details)
    ).rejects.toThrow(/does not support encryption/);
  });

  it('finds the copy for a viewer case-insensitively and returns null when there is none', () => {
    const tags = [['p', 'x'], [ENCRYPTED_COPY_TAG, inviteePubkey, 'cipher']];
    expect(findEncryptedCopy(tags, inviteePubkey.toUpperCase())).toBe('cipher');
    expect(findEncryptedCopy(tags, otherInviteePubkey)).toBeNull();
    expect(findEncryptedCopy(undefined, inviteePubkey)).toBeNull();
  });

  it('builds public content that anyone can read and that never contains the e-mail', async () => {
    const content = buildPublicBookingContent(details);
    expect(isLikelyEncrypted(content)).toBe(false);
    expect(content).not.toContain('ayse@example.com');
    const read = await decryptBookingDetails(outsiderSigner, bookerPubkey, content);
    expect(read).toMatchObject({ name: 'Ayşe Demir', title: 'Proje görüşmesi', notes: 'Gündem: yeni takvim tasarımı' });
    expect(read?.email).toBeUndefined();
  });
});
