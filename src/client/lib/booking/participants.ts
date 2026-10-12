import { decodeKeyToHex } from '../nostr/keys';

export type Participant =
  | { type: 'npub'; pubkey: string; label: string }
  | { type: 'email'; email: string; label: string };

export type ParticipantError = 'empty' | 'invalid' | 'duplicate';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Reads one invited person: an npub / hex public key, or an e-mail address.
 * Returns the participant, or the reason it was rejected.
 */
export function parseParticipant(
  input: string,
  existing: readonly Participant[] = []
): { ok: true; participant: Participant } | { ok: false; error: ParticipantError } {
  const value = input.trim();
  if (!value) return { ok: false, error: 'empty' };

  let participant: Participant | null = null;

  if (/^npub1[023456789acdefghjklmnpqrstuvwxyz]+$/i.test(value) || /^[0-9a-f]{64}$/i.test(value)) {
    try {
      const pubkey = decodeKeyToHex(value.toLowerCase());
      participant = { type: 'npub', pubkey, label: value.toLowerCase() };
    } catch {
      return { ok: false, error: 'invalid' };
    }
  } else if (EMAIL.test(value)) {
    participant = { type: 'email', email: value.toLowerCase(), label: value.toLowerCase() };
  }

  if (!participant) return { ok: false, error: 'invalid' };

  const key = participant.type === 'npub' ? participant.pubkey : participant.email;
  const duplicate = existing.some((entry) => (entry.type === 'npub' ? entry.pubkey : entry.email) === key);
  return duplicate ? { ok: false, error: 'duplicate' } : { ok: true, participant };
}

/** Public keys of the invited people who have one. */
export const participantPubkeys = (participants: readonly Participant[]): string[] =>
  participants.flatMap((entry) => (entry.type === 'npub' ? [entry.pubkey] : []));

/** E-mail addresses of the invited people who have one. */
export const participantEmails = (participants: readonly Participant[]): string[] =>
  participants.flatMap((entry) => (entry.type === 'email' ? [entry.email] : []));
