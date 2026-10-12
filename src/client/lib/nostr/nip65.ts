import type { Event, EventTemplate } from 'nostr-tools';

export type RelayUsage = 'read' | 'write' | 'both';

export interface RelayMetadata {
  url: string;
  usage: RelayUsage;
}

export interface RelayList {
  read: string[];
  write: string[];
  all: string[];
}

/**
 * Normalizes a relay URL by trimming whitespace, validating ws/wss, and removing trailing slashes.
 */
export function normalizeRelayUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
      return '';
    }
    // Remove trailing slash if path is only '/'
    let normalized = parsed.origin + parsed.pathname;
    if (normalized.endsWith('/') && parsed.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Filters and deduplicates a list of relay URLs.
 */
export function filterHealthyRelays(relays: string[]): string[] {
  const seen = new Set<string>();
  const healthy: string[] = [];

  for (const r of relays) {
    const normalized = normalizeRelayUrl(r);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      healthy.push(normalized);
    }
  }

  return healthy;
}

export type RelaySource = 'host' | 'creator' | 'attendee' | 'extra' | 'default';

export interface RelaySourceGroup {
  source: RelaySource;
  relays: string[];
}

export interface PublishTarget {
  url: string;
  sources: RelaySource[];
}

/** Upper bound on relays an event is fanned out to, keeping publish latency and traffic bounded. */
export const MAX_PUBLISH_RELAYS = 12;

/**
 * Merges relay groups into a deduplicated, capped publish target list.
 * Groups are consumed in the given order, so earlier groups win when the cap is reached.
 * Every group that references a relay is recorded on that target, even if it was first added by another group.
 */
export function buildPublishTargets(
  groups: RelaySourceGroup[],
  maxRelays: number = MAX_PUBLISH_RELAYS
): PublishTarget[] {
  const targets = new Map<string, PublishTarget>();

  for (const group of groups) {
    for (const relay of filterHealthyRelays(group.relays)) {
      const existing = targets.get(relay);
      if (existing) {
        if (!existing.sources.includes(group.source)) {
          existing.sources.push(group.source);
        }
        continue;
      }
      if (targets.size >= maxRelays) {
        continue;
      }
      targets.set(relay, { url: relay, sources: [group.source] });
    }
  }

  return Array.from(targets.values());
}

/** Number of relay hints embedded in a shared naddr. */
export const MAX_RELAY_HINTS = 3;

/**
 * Picks relay hints for an naddr: one relay per distinct source first (host, creator, ...),
 * so a viewer can find the event on the host's or the creator's relays, then fills with remaining targets.
 */
export function pickRelayHints(targets: PublishTarget[], maxHints: number = MAX_RELAY_HINTS): string[] {
  const hints: string[] = [];
  const coveredSources = new Set<RelaySource>();

  for (const target of targets) {
    if (hints.length >= maxHints) break;
    if (target.sources.every((source) => coveredSources.has(source))) continue;
    hints.push(target.url);
    target.sources.forEach((source) => coveredSources.add(source));
  }
  for (const target of targets) {
    if (hints.length >= maxHints) break;
    if (!hints.includes(target.url)) hints.push(target.url);
  }
  return hints;
}

/**
 * Parses a Kind 10002 Relay List Metadata event.
 */
export function parseRelayList(event: Event): RelayList {
  if (event.kind !== 10002) {
    throw new Error(`Expected kind 10002 event, got kind ${event.kind}`);
  }

  const readRelays = new Set<string>();
  const writeRelays = new Set<string>();
  const allRelays = new Set<string>();

  for (const tag of event.tags) {
    if (tag[0] === 'r' && tag[1]) {
      const normalized = normalizeRelayUrl(tag[1]);
      if (!normalized) continue;

      allRelays.add(normalized);
      const marker = tag[2]; // 'read', 'write', or undefined (both)

      if (marker === 'read') {
        readRelays.add(normalized);
      } else if (marker === 'write') {
        writeRelays.add(normalized);
      } else {
        readRelays.add(normalized);
        writeRelays.add(normalized);
      }
    }
  }

  return {
    read: Array.from(readRelays),
    write: Array.from(writeRelays),
    all: Array.from(allRelays),
  };
}

/**
 * Parses Kind 3 Contact List event content for legacy relay maps.
 */
export function parseContactRelays(event: Event): RelayList {
  if (event.kind !== 3) {
    throw new Error(`Expected kind 3 event, got kind ${event.kind}`);
  }

  const readRelays = new Set<string>();
  const writeRelays = new Set<string>();
  const allRelays = new Set<string>();

  if (event.content) {
    try {
      const relayMap = JSON.parse(event.content) as Record<string, { read?: boolean; write?: boolean }>;
      if (typeof relayMap === 'object' && relayMap !== null) {
        for (const [url, perms] of Object.entries(relayMap)) {
          const normalized = normalizeRelayUrl(url);
          if (!normalized) continue;

          allRelays.add(normalized);
          const isRead = perms.read ?? true;
          const isWrite = perms.write ?? true;

          if (isRead) readRelays.add(normalized);
          if (isWrite) writeRelays.add(normalized);
        }
      }
    } catch {
      // Ignore JSON parse errors in content
    }
  }

  return {
    read: Array.from(readRelays),
    write: Array.from(writeRelays),
    all: Array.from(allRelays),
  };
}

/**
 * Creates an unsigned Kind 10002 Relay List Metadata event template.
 */
export function createRelayListEventTemplate(relays: RelayMetadata[]): EventTemplate {
  const tags: string[][] = [];

  for (const relay of relays) {
    const normalized = normalizeRelayUrl(relay.url);
    if (!normalized) continue;

    if (relay.usage === 'read') {
      tags.push(['r', normalized, 'read']);
    } else if (relay.usage === 'write') {
      tags.push(['r', normalized, 'write']);
    } else {
      tags.push(['r', normalized]);
    }
  }

  return {
    kind: 10002,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  };
}
