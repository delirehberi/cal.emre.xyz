import type { NostrSigner } from './signer';

export interface EncryptedBookingPayload {
  name: string;
  notes?: string;
  email?: string;
  timestamp?: number;
}

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

/**
 * Encrypts sensitive attendee details (name, meeting notes, email) for the host public key.
 */
export async function encryptBookingDetails(
  signer: NostrSigner,
  hostPubkey: string,
  data: { name: string; notes?: string; email?: string }
): Promise<string> {
  const payload: EncryptedBookingPayload = {
    name: data.name.trim(),
    notes: data.notes?.trim() || undefined,
    email: data.email?.trim() || undefined,
    timestamp: Date.now(),
  };

  const plaintext = JSON.stringify(payload);

  if (signer.encrypt) {
    return await signer.encrypt(hostPubkey.toLowerCase(), plaintext);
  }

  throw new Error('Active Nostr signer does not support encryption.');
}

/**
 * Decrypts sensitive booking details (name, meeting notes, email) from an event's content.
 */
export async function decryptBookingDetails(
  signer: NostrSigner,
  senderPubkey: string,
  content?: string
): Promise<EncryptedBookingPayload | null> {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  // If it's unencrypted JSON, parse directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<EncryptedBookingPayload>;
      if (typeof parsed.name === 'string') {
        return {
          name: parsed.name,
          notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
          email: typeof parsed.email === 'string' ? parsed.email : undefined,
        };
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
    const parsed = JSON.parse(decryptedText) as Partial<EncryptedBookingPayload>;

    return {
      name: typeof parsed.name === 'string' ? parsed.name : 'Attendee',
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
    };
  } catch {
    // Decryption failed or not intended for this key
    return null;
  }
}
