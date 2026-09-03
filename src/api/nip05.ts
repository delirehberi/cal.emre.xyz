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
export const nip05ProxyRouter = new Hono<{ Bindings: Nip05Env }>();

/**
 * Validates whether a domain is a safe, valid domain name.
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  // Reject IP addresses or loopback/internal hosts for security
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|0\.)/i.test(domain)) {
    return false;
  }
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(domain);
}

/**
 * Server-side NIP-05 Proxy Resolver (/api/nip05/resolve)
 * Resolves external NIP-05 identifiers on the edge to bypass browser CORS limitations.
 */
nip05ProxyRouter.get('/resolve', async (c) => {
  let identifier = c.req.query('identifier')?.trim();
  const queryName = c.req.query('name')?.trim();
  const queryDomain = c.req.query('domain')?.trim();

  let name = '_';
  let domain = '';

  if (queryName && queryDomain) {
    name = queryName.toLowerCase();
    domain = queryDomain.toLowerCase();
  } else if (identifier) {
    try {
      identifier = decodeURIComponent(identifier).trim().toLowerCase();
    } catch {
      identifier = identifier.trim().toLowerCase();
    }

    if (identifier.includes('@')) {
      const parts = identifier.split('@');
      name = parts[0].trim();
      domain = parts.slice(1).join('@').trim();
    } else {
      name = '_';
      domain = identifier;
    }
  } else {
    return c.json(
      { success: false, error: 'Missing identifier or name/domain parameter' },
      400,
      { 'Access-Control-Allow-Origin': '*' }
    );
  }

  if (!domain || !isValidDomain(domain)) {
    return c.json(
      { success: false, error: `Invalid or untrusted domain: "${domain}"` },
      400,
      { 'Access-Control-Allow-Origin': '*' }
    );
  }

  const targetUrl = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': `${APP_CONFIG.name}/1.0 NIP-05 Resolver`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return c.json(
        {
          success: false,
          error: `Remote domain returned HTTP ${response.status}`,
          domain,
          name,
        },
        502,
        { 'Access-Control-Allow-Origin': '*' }
      );
    }

    const data = (await response.json()) as Nip05Response;

    if (!data || typeof data !== 'object' || !data.names || typeof data.names !== 'object') {
      return c.json(
        {
          success: false,
          error: 'Malformed NIP-05 response from remote domain',
          domain,
          name,
        },
        502,
        { 'Access-Control-Allow-Origin': '*' }
      );
    }

    const pubkey = data.names[name] || (name === '_' ? data.names['_'] : undefined);

    if (!pubkey || typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey.trim())) {
      return c.json(
        {
          success: false,
          error: `Identifier "${name}@${domain}" not found in remote NIP-05 manifest`,
          domain,
          name,
        },
        404,
        { 'Access-Control-Allow-Origin': '*' }
      );
    }

    const normalizedPubkey = pubkey.trim().toLowerCase();
    const relays = data.relays && Array.isArray(data.relays[normalizedPubkey])
      ? data.relays[normalizedPubkey]
      : undefined;

    return c.json(
      {
        success: true,
        pubkey: normalizedPubkey,
        relays,
        name,
        domain,
      },
      200,
      {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      }
    );
  } catch (err) {
    return c.json(
      {
        success: false,
        error: `Failed to resolve NIP-05: ${err instanceof Error ? err.message : String(err)}`,
        domain,
        name,
      },
      502,
      { 'Access-Control-Allow-Origin': '*' }
    );
  }
});

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
