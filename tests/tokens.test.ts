import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../src/client/index.css');
const css = readFileSync(cssPath, 'utf8');

const readBlock = (selector: string): Record<string, string> => {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  expect(match, `block ${selector}`).not.toBeNull();
  const vars: Record<string, string> = {};
  for (const m of match![1].matchAll(/--kun-([a-z-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
};

describe('Kün design tokens', () => {
  const light = readBlock(':root');
  const dark = readBlock('.dark');

  it('defines the same token names in light and dark', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(Object.keys(light)).toHaveLength(12);
  });

  it('matches the Kün/Light Figma variables', () => {
    expect(light).toEqual({
      ink: '#1c1917',
      paper: '#fafaf9',
      card: '#ffffff',
      line: '#e7e5e4',
      muted: '#78716c',
      slot: '#10b981',
      'slot-soft': '#ecfdf5',
      nostr: '#8b5cf6',
      'nostr-soft': '#f3eeff',
      tile: '#1c1917',
      'tile-fg': '#fafaf9',
      danger: '#dc2626',
    });
  });

  it('matches the Kün/Dark Figma variables', () => {
    expect(dark).toEqual({
      ink: '#f5f5f4',
      paper: '#141210',
      card: '#1c1917',
      line: '#2e2a27',
      muted: '#a8a29e',
      slot: '#34d399',
      'slot-soft': '#0b2e24',
      nostr: '#a78bfa',
      'nostr-soft': '#2a2150',
      tile: '#f5f5f4',
      'tile-fg': '#1c1917',
      danger: '#f87171',
    });
  });

  it('maps every token to a Tailwind colour utility', () => {
    for (const name of Object.keys(light)) {
      expect(css).toContain(`--color-${name}: var(--kun-${name});`);
    }
  });

  it('drives the dark: variant from the .dark class', () => {
    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  });
});

describe('Self-hosted fonts', () => {
  const urls = [...css.matchAll(/url\('\.\/(assets\/fonts\/[^']+\.woff2)'\)/g)].map((m) => m[1]);

  it('declares font files for the three families including latin-ext (Turkish glyphs)', () => {
    expect(urls.length).toBeGreaterThanOrEqual(8);
    for (const family of ['bricolage-grotesque', 'instrument-sans', 'jetbrains-mono']) {
      expect(urls.some((u) => u.includes(`${family}-latin-ext`))).toBe(true);
      expect(urls.some((u) => u.includes(`${family}-latin-`) && !u.includes('latin-ext'))).toBe(true);
    }
  });

  it('ships every referenced font file', () => {
    for (const url of urls) {
      expect(existsSync(resolve(__dirname, '../src/client', url)), url).toBe(true);
    }
  });

  it('never references a third-party font host', () => {
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|use\.typekit/);
  });
});
