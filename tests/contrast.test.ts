import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../src/client/index.css'), 'utf8');

const readTokens = (selector: RegExp): Record<string, string> => {
  const block = css.match(selector)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/--kun-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]])
  );
};

const themes = {
  light: readTokens(/:root \{([^}]*)\}/),
  dark: readTokens(/\.dark \{([^}]*)\}/),
} as const;

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Text pairs the UI actually renders, both themes, WCAG AA for normal text. */
const AA_TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['ink', 'paper'],
  ['ink', 'card'],
  ['ink', 'line'],
  ['ink', 'slot-soft'],
  ['muted', 'paper'],
  ['muted', 'card'],
  ['muted', 'slot-soft'],
  ['danger', 'card'],
  ['danger', 'paper'],
  ['paper', 'ink'],
  ['tile-fg', 'tile'],
];

describe('theme contrast (WCAG AA)', () => {
  for (const [theme, tokens] of Object.entries(themes)) {
    describe(theme, () => {
      it('defines every token used below', () => {
        for (const [foreground, background] of AA_TEXT_PAIRS) {
          expect(tokens[foreground], foreground).toMatch(/^#/);
          expect(tokens[background], background).toMatch(/^#/);
        }
      });

      for (const [foreground, background] of AA_TEXT_PAIRS) {
        it(`${foreground} on ${background} is at least 4.5:1`, () => {
          expect(contrast(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  it('keeps the dark Nostr badge at AA', () => {
    expect(contrast(themes.dark.nostr, themes.dark['nostr-soft'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the green on the dark code tile readable in light mode', () => {
    expect(contrast(themes.light.slot, themes.light.tile)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Known gap: the Figma purple on its soft purple is 3.73:1 in light mode (13px semibold badge text),
   * below the 4.5:1 AA threshold for normal text. It stays as designed until the design owner picks a darker
   * text token; this floor stops it from getting any worse.
   */
  it('does not let the light Nostr badge drop below its current 3.7:1', () => {
    expect(contrast(themes.light.nostr, themes.light['nostr-soft'])).toBeGreaterThanOrEqual(3.7);
  });
});

describe('focus rings', () => {
  it('never pairs focus:outline-none with focus-visible:outline-*, which would hide the keyboard ring', () => {
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : [];
      });
    const offenders = walk(join(__dirname, '../src/client')).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /focus:outline-none[^'"`]*focus-visible:outline-\d|focus-visible:outline-\d[^'"`]*focus:outline-none/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
