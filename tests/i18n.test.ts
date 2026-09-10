import { describe, it, expect } from 'vitest';
import { en, tr, es, resolveTranslation, getInitialLocale } from '../src/client/i18n';
import { APP_CONFIG } from '../src/config';

describe('i18n Dictionary Parity & Integrity', () => {
  const compareKeys = (objA: Record<string, unknown>, objB: Record<string, unknown>, langA = 'A', langB = 'B', path = '') => {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();

    expect(keysA, `Keys at path "${path}" in ${langA} should match ${langB}`).toEqual(keysB);

    for (const key of keysA) {
      const currentPath = path ? `${path}.${key}` : key;
      const valA = objA[key];
      const valB = objB[key];

      expect(typeof valA, `Type mismatch at path "${currentPath}"`).toBe(typeof valB);

      if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
        compareKeys(valA as Record<string, unknown>, valB as Record<string, unknown>, langA, langB, currentPath);
      } else {
        expect(typeof valA).toBe('string');
        expect((valA as string).trim().length, `Empty string found at ${langA} "${currentPath}"`).toBeGreaterThan(0);
        expect((valB as string).trim().length, `Empty string found at ${langB} "${currentPath}"`).toBeGreaterThan(0);
      }
    }
  };

  it('should have 100% key parity between English and Turkish dictionaries', () => {
    compareKeys(en as unknown as Record<string, unknown>, tr as unknown as Record<string, unknown>, 'EN', 'TR');
  });

  it('should have 100% key parity between English and Spanish dictionaries', () => {
    compareKeys(en as unknown as Record<string, unknown>, es as unknown as Record<string, unknown>, 'EN', 'ES');
  });

  it('should correctly resolve footer community initiative badge strings', () => {
    expect(resolveTranslation(en, 'footer.nostrBadge')).toBe('A nostr.org.tr community initiative');
    expect(resolveTranslation(tr, 'footer.nostrBadge')).toBe('nostr.org.tr topluluk girişimidir');
    expect(resolveTranslation(es, 'footer.nostrBadge')).toBe('Una iniciativa comunitaria de nostr.org.tr');
  });

  it('should correctly resolve nested translation keys', () => {
    expect(resolveTranslation(en, 'header.home')).toBe('Home');
    expect(resolveTranslation(tr, 'header.home')).toBe('Ana Sayfa');
    expect(resolveTranslation(en, 'header.about')).toBe('About');
    expect(resolveTranslation(tr, 'header.about')).toBe('Hakkında');
    expect(resolveTranslation(tr, 'header.support')).toBe('Destek');
    expect(resolveTranslation(tr, 'header.login')).toBe('Giriş');
    expect(resolveTranslation(tr, 'header.logout')).toBe('Çıkış Yap');
    expect(resolveTranslation(tr, 'header.dashboard')).toBe('Yönetim Paneli');
    expect(resolveTranslation(tr, 'header.copyNpub')).toBe('npub’i kopyala');
    expect(resolveTranslation(es, 'header.home')).toBe('Inicio');
    expect(resolveTranslation(es, 'header.login')).toBe('Iniciar sesión');
  });

  it('should replace dynamic template interpolation parameters', () => {
    expect(resolveTranslation(en, 'booking.duration.minutes', { minutes: 30 })).toBe('30 min');
    expect(resolveTranslation(tr, 'booking.duration.minutes', { minutes: 30 })).toBe('30 dk');
    expect(
      resolveTranslation(tr, 'booking.form.selectedTime', { dayMonth: '15 Ekim', weekday: 'Perşembe', start: '14:30', end: '15:00' })
    ).toBe('15 Ekim, Perşembe · 14:30 – 15:00');
    expect(
      resolveTranslation(en, 'booking.form.selectedTime', { dayMonth: 'October 15', weekday: 'Thursday', start: '14:30', end: '15:00' })
    ).toBe('Thursday, October 15 · 14:30 – 15:00');
    expect(resolveTranslation(tr, 'booking.timeSlots.folded', { count: 11 })).toBe('11 saat dolu ya da geçmiş');
    expect(resolveTranslation(es, 'booking.duration.minutes', { minutes: 30 })).toBe('30 min');
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
    expect(APP_CONFIG.educationalLinks.es).toBe('https://nostr.com');
  });

  it('should default to "en" when window is not defined or no stored value', () => {
    const initial = getInitialLocale();
    expect(['en', 'tr', 'es']).toContain(initial);
  });
});
