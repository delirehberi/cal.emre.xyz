import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { encodeNpub } from '../src/client/lib/nostr/keys';
import { parseParticipant, participantEmails, participantPubkeys } from '../src/client/lib/booking/participants';

describe('parseParticipant', () => {
  const pubkey = getPublicKey(generateSecretKey());
  const npub = encodeNpub(pubkey);

  it('reads an npub', () => {
    const result = parseParticipant(`  ${npub}  `);
    expect(result).toEqual({ ok: true, participant: { type: 'npub', pubkey, label: npub } });
  });

  it('reads a hex public key', () => {
    const result = parseParticipant(pubkey.toUpperCase());
    expect(result.ok && result.participant.type === 'npub' && result.participant.pubkey).toBe(pubkey);
  });

  it('reads an e-mail address and lowercases it', () => {
    expect(parseParticipant('Mehmet@Example.COM')).toEqual({
      ok: true,
      participant: { type: 'email', email: 'mehmet@example.com', label: 'mehmet@example.com' },
    });
  });

  it('rejects empty, malformed and secret-key input', () => {
    expect(parseParticipant('   ')).toEqual({ ok: false, error: 'empty' });
    expect(parseParticipant('not an address')).toEqual({ ok: false, error: 'invalid' });
    expect(parseParticipant('a@b')).toEqual({ ok: false, error: 'invalid' });
    expect(parseParticipant('npub1notavalidkey')).toEqual({ ok: false, error: 'invalid' });
    expect(parseParticipant('nsec1' + 'q'.repeat(58))).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects duplicates across the same kind', () => {
    const first = parseParticipant(npub);
    const existing = first.ok ? [first.participant] : [];
    expect(parseParticipant(pubkey, existing)).toEqual({ ok: false, error: 'duplicate' });
    const mail = parseParticipant('a@example.com');
    expect(parseParticipant('A@example.com', mail.ok ? [mail.participant] : [])).toEqual({ ok: false, error: 'duplicate' });
  });

  it('splits participants into pubkeys and e-mails', () => {
    const list = [parseParticipant(npub), parseParticipant('a@example.com'), parseParticipant('b@example.com')].flatMap((r) =>
      r.ok ? [r.participant] : []
    );
    expect(participantPubkeys(list)).toEqual([pubkey]);
    expect(participantEmails(list)).toEqual(['a@example.com', 'b@example.com']);
  });
});
