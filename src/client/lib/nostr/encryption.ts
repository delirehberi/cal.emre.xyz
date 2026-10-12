import type { NostrSigner } from './signer';

export interface EncryptedBookingPayload {
  name: string;
  notes?: string;
  email?: string;
  /** The title the attendee typed. Only readable by the people the details are encrypted for. */
  title?: string;
  /** Invited people as typed: npub or e-mail address. */
  participants?: string[];
  timestamp?: number;
}

export interface BookingDetails {
  name: string;
  notes?: string;
  email?: string;
  title?: string;
  participants?: string[];
}

/**
 * Tag that carries a copy of the details encrypted for one invited pubkey:
 * ["enc", <invitee pubkey hex>, <ciphertext>]. The event content keeps the host's copy, unchanged.
 */
export const ENCRYPTED_COPY_TAG = 'enc';

/**
 * Checks if a content string appears to be encrypted ciphertext (NIP-44 or NIP-04).
 */
export function isLikelyEncrypted(content?: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed) return false;

  // NIP-04: base64 ciphertext followed by ?iv=base64
  if (trimmed.includes('?iv=')) {
    return true;
  }

  // If it starts with JSON syntax, it's unencrypted
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return false;
  }

  // NIP-44: Base64 payload without JSON whitespace
  if (/^[A-Za-z0-9+/=_-]{20,}$/.test(trimmed)) {
    return true;
  }

  return false;
}

const clean = (value?: string): string | undefined => value?.trim() || undefined;

const buildPayload = (data: BookingDetails): EncryptedBookingPayload => ({
  name: data.name.trim(),
  notes: clean(data.notes),
  email: clean(data.email),
  title: clean(data.title),
  participants: data.participants && data.participants.length > 0 ? data.participants : undefined,
  timestamp: Date.now(),
});

const readPayload = (parsed: Partial<EncryptedBookingPayload>, fallbackName: string): EncryptedBookingPayload => ({
  name: typeof parsed.name === 'string' ? parsed.name : fallbackName,
  notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
  email: typeof parsed.email === 'string' ? parsed.email : undefined,
  title: typeof parsed.title === 'string' ? parsed.title : undefined,
  participants: Array.isArray(parsed.participants)
    ? parsed.participants.filter((entry): entry is string => typeof entry === 'string')
    : undefined,
  timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
});

/**
 * Encrypts sensitive attendee details (name, meeting notes, email) for the host public key.
 */
export async function encryptBookingDetails(
  signer: NostrSigner,
  hostPubkey: string,
  data: BookingDetails
): Promise<string> {
  const plaintext = JSON.stringify(buildPayload(data));

  if (signer.encrypt) {
    return await signer.encrypt(hostPubkey.toLowerCase(), plaintext);
  }

  throw new Error('Active Nostr signer does not support encryption.');
}

export interface EncryptedBookingEnvelope {
  /** Ciphertext for the host, to be used as the event content. */
  content: string;
  /** One ["enc", pubkey, ciphertext] tag per invited pubkey. */
  tags: string[][];
}

/**
 * Encrypts the details for the host and, separately, for every invited pubkey.
 * Each recipient gets its own NIP-44 ciphertext, so no one can read a copy that is not theirs.
 * The host and the author are skipped as invitees and duplicates are removed.
 */
export async function encryptBookingForRecipients(
  signer: NostrSigner,
  hostPubkey: string,
  inviteePubkeys: readonly string[],
  data: BookingDetails
): Promise<EncryptedBookingEnvelope> {
  if (!signer.encrypt) {
    throw new Error('Active Nostr signer does not support encryption.');
  }

  const plaintext = JSON.stringify(buildPayload(data));
  const host = hostPubkey.toLowerCase();
  const author = (await signer.getPublicKey()).toLowerCase();
  const recipients = Array.from(new Set(inviteePubkeys.map((key) => key.toLowerCase()))).filter(
    (key) => key !== host && key !== author
  );

  const content = await signer.encrypt(host, plaintext);
  const tags: string[][] = [];
  for (const recipient of recipients) {
    tags.push([ENCRYPTED_COPY_TAG, recipient, await signer.encrypt(recipient, plaintext)]);
  }

  return { content, tags };
}

/**
 * Event content for a public booking: readable JSON, no e-mail address.
 * The e-mail is only used to send the confirmation and is never published to relays.
 */
export function buildPublicBookingContent(data: BookingDetails): string {
  return JSON.stringify({ ...buildPayload({ ...data, email: undefined }), email: undefined });
}

/** The ciphertext addressed to `viewerPubkey` in an event's tags, if there is one. */
export function findEncryptedCopy(tags: readonly string[][] | undefined, viewerPubkey: string): string | null {
  const viewer = viewerPubkey.toLowerCase();
  const tag = tags?.find((entry) => entry[0] === ENCRYPTED_COPY_TAG && entry[1]?.toLowerCase() === viewer);
  return tag?.[2] || null;
}

export interface DecryptOptions {
  /** The event's tags; lets an invited viewer read the copy encrypted for them. */
  tags?: readonly string[][];
  /** Who is reading. Needed together with `tags`. */
  viewerPubkey?: string;
}

/**
 * Decrypts booking details (name, meeting notes, email, title, invitees) from an event.
 * `senderPubkey` is the author of the event (the person who booked).
 * The host reads the event content; an invited viewer reads the copy addressed to them.
 */
export async function decryptBookingDetails(
  signer: NostrSigner,
  senderPubkey: string,
  content?: string,
  options: DecryptOptions = {}
): Promise<EncryptedBookingPayload | null> {
  const ownCopy = options.viewerPubkey ? findEncryptedCopy(options.tags, options.viewerPubkey) : null;
  const trimmed = (ownCopy ?? content ?? '').trim();
  if (!trimmed) return null;

  // If it's unencrypted JSON, parse directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<EncryptedBookingPayload>;
      if (typeof parsed.name === 'string') {
        return readPayload(parsed, 'Attendee');
      }
    } catch {
      // Continue to decryption attempt
    }
  }

  if (!signer.decrypt) {
    return null;
  }

  try {
    const decryptedText = await signer.decrypt(senderPubkey.toLowerCase(), trimmed);
    return readPayload(JSON.parse(decryptedText) as Partial<EncryptedBookingPayload>, 'Attendee');
  } catch {
    // Decryption failed or not intended for this key
    return null;
  }
}
