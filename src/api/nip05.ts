import { Hono } from 'hono';
import { APP_CONFIG } from '../config';

export interface Nip05Env {
  DEFAULT_HOST_NIP05?: string;
  DEFAULT_HOST_PUBKEY?: string;
  DEFAULT_RELAYS?: string;
}

export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

export const nip05Router = new Hono<{ Bindings: Nip05Env }>();

/**
 * NIP-05 Identity Resolution Endpoint (/.well-known/nostr.json)
 */
nip05Router.get('/nostr.json', (c) => {
  const queryName = c.req.query('name')?.toLowerCase().trim();
  const configuredNip05 = c.env.DEFAULT_HOST_NIP05 !== undefined ? c.env.DEFAULT_HOST_NIP05 : APP_CONFIG.defaultHostNip05;
  const configuredPubkey = c.env.DEFAULT_HOST_PUBKEY !== undefined ? c.env.DEFAULT_HOST_PUBKEY.trim() : APP_CONFIG.defaultHostPubkey;

  // Extract username part from default NIP-05 (e.g., "z" from "z@emre.xyz")
  const defaultUsername = configuredNip05.split('@')[0].toLowerCase().trim();

  // Relays list
  const configuredRelays = c.env.DEFAULT_RELAYS
    ? c.env.DEFAULT_RELAYS.split(',').map((r) => r.trim()).filter(Boolean)
    : [...APP_CONFIG.defaultRelays];

  // If no pubkey configured, return empty response
  if (!configuredPubkey) {
    return c.json<Nip05Response>({ names: {} }, 200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    });
  }

  // If no specific name requested or requested name matches configured username or root alias "_"
  const matches =
    !queryName ||
    queryName === defaultUsername ||
    queryName === '_' ||
    queryName === configuredNip05.toLowerCase();

  if (!matches) {
    return c.json<Nip05Response>({ names: {} }, 200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    });
  }

  const resolvedName = queryName || defaultUsername;
  const response: Nip05Response = {
    names: {
      [resolvedName]: configuredPubkey,
      [defaultUsername]: configuredPubkey,
      _: configuredPubkey,
    },
    relays: {
      [configuredPubkey]: configuredRelays,
    },
  };

  return c.json<Nip05Response>(response, 200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});
