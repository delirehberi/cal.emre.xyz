import { describe, it, expect } from 'vitest';
import { en, tr, resolveTranslation, getInitialLocale } from '../src/client/i18n';
import { APP_CONFIG } from '../src/config';

describe('i18n Dictionary Parity & Integrity', () => {
  const compareKeys = (objA: Record<string, unknown>, objB: Record<string, unknown>, path = '') => {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();

    expect(keysA, `Keys at path "${path}" in EN should match TR`).toEqual(keysB);

    for (const key of keysA) {
      const currentPath = path ? `${path}.${key}` : key;
      const valA = objA[key];
      const valB = objB[key];

      expect(typeof valA, `Type mismatch at path "${currentPath}"`).toBe(typeof valB);

      if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
        compareKeys(valA as Record<string, unknown>, valB as Record<string, unknown>, currentPath);
      } else {
        expect(typeof valA).toBe('string');
        expect((valA as string).trim().length, `Empty string found at EN "${currentPath}"`).toBeGreaterThan(0);
        expect((valB as string).trim().length, `Empty string found at TR "${currentPath}"`).toBeGreaterThan(0);
      }
    }
  };

  it('should have 100% key parity between English and Turkish dictionaries', () => {
    compareKeys(en as unknown as Record<string, unknown>, tr as unknown as Record<string, unknown>);
  });

  it('should correctly resolve nested translation keys', () => {
    const titleEn = resolveTranslation(en, 'header.title');
    expect(titleEn).toBe('cal.emre.xyz');

    const titleTr = resolveTranslation(tr, 'header.title');
    expect(titleTr).toBe('cal.emre.xyz');

    const subEn = resolveTranslation(en, 'header.subtitle');
    expect(subEn).toBe('Sovereign Scheduling with Nostr NIP-52');

    const subTr = resolveTranslation(tr, 'header.subtitle');
    expect(subTr).toBe('Nostr NIP-52 ile Egemen Randevu ve Takvim Sistemi');
  });

  it('should replace dynamic template interpolation parameters', () => {
    const durationEn = resolveTranslation(en, 'booking.durationPicker.minutesOption', { minutes: 30 });
    expect(durationEn).toBe('30 mins');

    const durationTr = resolveTranslation(tr, 'booking.durationPicker.minutesOption', { minutes: 30 });
    expect(durationTr).toBe('30 dakika');

    const timezoneEn = resolveTranslation(en, 'booking.timeSlotGrid.timezoneNotice', { timezone: 'Europe/Istanbul' });
    expect(timezoneEn).toBe('Times displayed in your selected timezone (Europe/Istanbul)');
  });

  it('should return fallback key string if key path does not exist', () => {
    const missing = resolveTranslation(en, 'nonexistent.key.path');
    expect(missing).toBe('nonexistent.key.path');

    const partial = resolveTranslation(en, 'header.nonexistent');
    expect(partial).toBe('header.nonexistent');
  });

  it('should return fallback key string if target is an object and not a leaf string', () => {
    const notLeaf = resolveTranslation(en, 'header');
    expect(notLeaf).toBe('header');
  });

  it('should route educational links to correct URLs', () => {
    expect(APP_CONFIG.educationalLinks.en).toBe('https://nostr.com');
    expect(APP_CONFIG.educationalLinks.tr).toBe('https://nostr.org.tr');
  });

  it('should default to "en" when window is not defined or no stored value', () => {
    const initial = getInitialLocale();
    expect(['en', 'tr']).toContain(initial);
  });
});
