/**
 * Global Configuration for cal.emre.xyz (Nostr NIP-52 Appointment System)
 */

export const APP_CONFIG = {
  name: 'cal.emre.xyz',
  title: 'cal.emre.xyz - Sovereign Scheduling',
  description: 'Decentralized Nostr NIP-52 Calendar & Appointment System',
  supportEmail: 'z@emre.xyz',
  adminEmail: 'z@emre.xyz',
  repoUrl: 'https://github.com/delirehberi/cal.emre.xyz',
  /** Lightning address that receives support for the project. */
  lightningAddress: 'delirehberi@emre.xyz',
  defaultHostNip05: 'delirehberi@emre.xyz',
  defaultHostPubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
  defaultHostPicture: 'https://emre.xyz/me.jpg',
  defaultHostBio: {
    en: 'You can schedule a meeting with me directly using this tool. Select your preferred duration and time slot below to book an appointment.',
    tr: 'Bu aracı kullanarak doğrudan benimle bir toplantı planlayabilirsiniz. Randevu oluşturmak için aşağıdan uygun süreyi ve saat aralığını seçin.',
    es: 'Puedes programar una reunión conmigo directamente con esta herramienta. Selecciona tu duración y horario preferidos a continuación para reservar una cita.',
  },
  cacheRelayUrl: 'wss://cache.nostr.org.tr',
  defaultRelays: [
    'wss://relay.emre.xyz',
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.mom',
  ] as const,
  allowedDurationsMinutes: [15, 30, 45, 60] as const,
  /** Offered behind the "longer…" chip on the booking page. */
  extendedDurationsMinutes: [90, 120] as const,
  /** Only a host can switch these on, in the dashboard's meeting lengths. */
  longDurationsMinutes: [180, 240, 360] as const,
  defaultDurationMinutes: 30,
  defaultWorkingHours: {
    startHour: 9,
    endHour: 17,
    workingDays: [1, 2, 3, 4, 5], // Monday - Friday (0 is Sunday, 1 is Monday)
    timezone: 'UTC',
  },
  educationalLinks: {
    en: 'https://nostr.com',
    tr: 'https://nostr.org.tr',
    es: 'https://nostr.com',
  } as const,
} as const;

export type AppConfig = typeof APP_CONFIG;
