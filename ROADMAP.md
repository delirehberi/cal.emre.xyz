# Project Roadmap: Nostr NIP-52 Appointment System (`cal.emre.xyz`)

An open-source, decentralized scheduling application implementing [NIP-52](https://nostrhub.io/nip/52) (Calendar Events) deployed on Cloudflare Workers with Hono, React, Tailwind CSS, and Resend.

---

## Phase Overview & Progress Matrix

| Phase | Description | Status | Target Output |
|---|---|---|---|
| **Phase 1** | Project Scaffolding & Tooling | 🟢 Completed | `.nvmrc`, `Makefile`, `package.json`, `wrangler.jsonc`, `vite.config.ts`, `tsconfig.json` |
| **Phase 2** | Nostr Protocol Core (NIP-52, NIP-65, Keys, Relays) | 🟢 Completed | `nip52.ts`, `nip65.ts`, `keys.ts`, `nip07.ts`, `nip46.ts`, `relays.ts` + Vitest tests |
| **Phase 3** | Calendar Math & Dynamic Timespan Blocking | 🟢 Completed | `slots.ts` (busy blocking algorithm), `ics.ts` (RFC 5545 generator) + Vitest tests |
| **Phase 4** | Multilingual i18n & Theming System | 🟢 Completed | `i18n/` (EN default, TR), `ThemeContext.tsx` (Light mode default, dark toggle) |
| **Phase 5** | Cloudflare Worker Hono API & Resend Service | 🟢 Completed | `index.ts`, `email.ts` (feature-flagged Resend sender), `ics.ts` endpoint, NIP-05 resolver |
| **Phase 6** | UI Components & Two-Column Layout | 🟢 Completed | Header (Logo, Home, Support `z@emre.xyz`, Login/Avatar dropdown), Left/Right Booking Columns, Footer |
| **Phase 7** | Host Dashboard & Availability Manager | 🟢 Completed | `DashboardPage.tsx`, `WorkingHoursForm.tsx`, `BookedEventsList.tsx` + Vitest tests |
| **Phase 8** | End-to-End Verification & Production Readiness | 🟢 Completed | Vitest test suite passing, zero type errors (`make typecheck`), successful `make build` |
| **Phase 9** | Kün Redesign | 🟢 Completed | New brand, tokens, header/footer, booking page, dashboard, About page (`/#/about`), hash routing, relay-published availability |

---

## Detailed Phase Breakdown

### Phase 1: Environment & Tooling Setup
- [x] **1.1** Create `.nvmrc` (`v26.2.0`).
- [x] **1.2** Create `Makefile` with targets:
  - `make install`: Install dependencies with node check (`nvm use`).
  - `make dev`: Start local Hono + Vite development server.
  - `make test`: Run Vitest automated test suite.
  - `make typecheck`: Run TypeScript compiler check (`tsc --noEmit`).
  - `make build`: Build production worker and static client assets.
  - `make deploy`: Build production assets and deploy worker with `wrangler deploy`.
- [x] **1.3** Initialize `package.json` with strict dependencies:
  - Runtime: `hono`, `nostr-tools`, `resend`, `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`.
  - Dev: `vite`, `@vitejs/plugin-react`, `@cloudflare/workers-types`, `wrangler`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `vitest`.
- [x] **1.4** Configure `wrangler.jsonc`:
  - Worker entry point: `src/index.ts`.
  - `compatibility_date`: `2026-09-01`.
  - `compatibility_flags`: `["nodejs_compat"]`.
  - Environment variables: `DEFAULT_HOST_NIP05`, `DEFAULT_HOST_PUBKEY`, `ENABLE_EMAIL_NOTIFICATIONS`, `SUPPORT_EMAIL`.
  - Static asset binding / bucket mapping for Vite client bundle.
  - [x] **1.5** Configure `tsconfig.json`, `tsconfig.node.json`, and `vite.config.ts`.
- [x] **1.6** Create `src/config.ts` holding global defaults (relays, support email `z@emre.xyz`, feature flags).

---

### Phase 2: Nostr Protocol Core (NIP-52, NIP-65, Keys, Relays)
- [x] **2.1** Implement `src/client/lib/nostr/keys.ts`:
  - Client-side key generation (`generateSecretKey`, `getPublicKey`).
  - NIP-19 encoding/decoding (`npub`, `nsec`, `naddr`, `note`, `nprofile`).
  - NIP-05 validation and resolution.
- [x] **2.2** Implement `src/client/lib/nostr/nip65.ts`:
  - Query and parse Kind `10002` (Relay List Metadata) and Kind `3` (Contact List relay tags).
  - Extract read/write relay endpoints for any host pubkey.
- [x] **2.3** Implement `src/client/lib/nostr/nip52.ts`:
  - Kind `31923`: Time-based Calendar Event constructor & parser (`d`, `title`, `summary`, `description`, `start`, `end`, `start_tzid`, `end_tzid`, `location`, `p` tags).
  - Kind `31922`: Date-based Calendar Event constructor & parser.
  - Kind `31925`: Calendar Event RSVP constructor & parser (`a`, `p`, `status`: `accepted` | `declined` | `tentative`, `fb`: `busy` | `free`).
  - Kind `31924`: Calendar collection constructor & parser.
- [x] **2.4** Implement `src/client/lib/nostr/relays.ts`:
  - Relay pool manager using `nostr-tools/pool`.
  - Querying with fallback bootstrap relays (`wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, `wss://nostr.mom`).
  - Multi-relay event publishing and confirmation.
- [x] **2.5** Implement Signer Adapters:
  - `src/client/lib/nostr/nip07.ts`: Browser extension signer (`window.nostr`).
  - `src/client/lib/nostr/nip46.ts`: Nostr Connect / Bunker client signer.
  - `src/client/lib/nostr/signer.ts`: Ephemeral / Guest local key signer.
- [x] **2.6** Unit Tests:
  - `tests/nip52.test.ts`: Verify tag structures, serialization, and validation.
  - `tests/nip65.test.ts`: Test relay list extraction.
  - `tests/keys.test.ts`: Test key generation and NIP-19 format conversions.
  - `tests/signer.test.ts`: Test NostrSigner implementations.

---

### Phase 3: Calendar Engine & Dynamic Timespan Blocking
- [x] **3.1** Implement `src/client/lib/calendar/slots.ts`:
  - Host availability configuration (weekly recurring time ranges, slot duration e.g. 15m, 30m, 60m, buffer times).
  - Timezone conversion between host timezone and attendee's local browser timezone.
  - **Timespan Blocking Algorithm**:
    - Input: host working hours + existing Kind 31923 events + accepted/busy Kind 31925 RSVPs for selected date.
    - Compute overlapping intervals.
    - Filter out blocked slots so attendees cannot double-book.
- [x] **3.2** Implement `src/client/lib/calendar/ics.ts`:
  - Client and server side RFC 5545 `.ics` generator.
  - Formats VEVENT with UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, STATUS, and ALARM.
  - Generates web links for Google Calendar, Apple Calendar, and Outlook.
- [x] **3.3** Unit Tests:
  - `tests/slots.test.ts`: Test slot interval generation, timezone shift across DST, and collision blocking.
  - `tests/ics.test.ts`: Test RFC 5545 compliance, line folding, escaping, and calendar URL generators.

---

### Phase 4: Multilingual i18n & Theming System
- [x] **4.1** Implement `src/client/i18n/`:
  - `en.ts`: Complete English dictionary (default).
  - `tr.ts`: Complete Turkish dictionary (second language).
  - `index.ts`: Type-safe translation provider, React hook `useTranslation()`, and locale switcher with `localStorage` persistence.
  - Educational copy for Nostr onboarding ([nostr.com](https://nostr.com) for EN, [nostr.org.tr](https://nostr.org.tr) for TR).
- [x] **4.2** Implement `src/client/context/ThemeContext.tsx`:
  - Light mode default with dark mode toggle.
  - Persists preference in `localStorage`.
  - Clean CSS theme variables for borders, cards, text, accents, and inputs.

---

### Phase 5: Cloudflare Worker Hono API & Resend Service
- [x] **5.1** Implement `src/index.ts` (Hono Application):
  - Health check endpoint `/api/health`.
  - Static asset serving for client bundle.
  - Error handling middleware and CORS.
  - `GET /api/events/:naddr/ics`: Fetch NIP-52 event from relays and serve `.ics` file.
  - `GET /.well-known/nostr.json`: Resolve NIP-05 identifiers.
- [x] **5.2** Implement `src/api/email.ts`:
  - Checks `ENABLE_EMAIL_NOTIFICATIONS` flag and `RESEND_API_KEY`.
  - Dispatches transactional booking confirmation email with `.ics` file attachment.
  - If guest attendee, formats email with generated `nsec` / `npub` and educational links.
- [x] **5.3** Unit Tests:
  - `tests/api.test.ts`: Test Hono routes, flag handling, and email payload serialization.

---

### Phase 6: Frontend UI Components & Booking Flows
- [x] **6.1** Implement UI Primitives (`src/client/components/ui/`):
  - Accessible Button, Card, Modal, Input, Badge, Skeleton loader, Dropdown.
- [x] **6.2** Implement Header (`src/client/components/layout/Header.tsx`):
  - Brand Logo & Title (`cal.emre.xyz`).
  - Menu Items: `Home` (`/`), `Support` (`mailto:z@emre.xyz`), `Login` button / Logged-in Avatar & Dropdown.
  - Language Switcher (`EN` / `TR`).
  - Theme Switcher (Light / Dark).
- [x] **6.3** Implement Two-Column Booking Layout (`src/client/pages/BookingPage.tsx`):
  - **Left Column**:
    - `HostCard.tsx`: Host avatar, display name, NIP-05 verification badge, bio, and time zone.
    - `DurationPicker.tsx`: 15m, 30m, 60m meeting duration pills.
    - `DatePicker.tsx`: Month navigation calendar picker with indicator for days with open slots.
  - **Right Column**:
    - `TimeSlotGrid.tsx`: Available time slots with busy collision indicators.
    - `BookingForm.tsx`: Attendee name, contact email, meeting notes, Nostr login or 1-click Guest keygen.
    - `NostrEduBanner.tsx`: Friendly explanation of sovereign identity with [nostr.com](https://nostr.com) (EN) / [nostr.org.tr](https://nostr.org.tr) (TR).
    - `BookingSuccess.tsx`: Confirmation screen with direct `.ics` download, Google Calendar link, and `naddr` event coordinate.
- [x] **6.4** Implement Auth Modals (`src/client/components/auth/`):
  - `LoginModal.tsx`: NIP-07 extension, NIP-46 Bunker URI, or nsec input.
  - Guest key generation moved into `LoginModal.tsx` ("Generate a new key") and the booking form; the standalone `GuestKeyModal.tsx` was removed in Phase 9.
- [x] **6.5** Implement Footer (`src/client/components/layout/Footer.tsx`):
  - GitHub repository link, NIP-52 specification, Nostr portals ([nostr.com](https://nostr.com) & [nostr.org.tr](https://nostr.org.tr)), open-source license.

---

### Phase 7: Host Dashboard & Availability Settings
- [x] **7.1** Implement `src/client/pages/DashboardPage.tsx`:
  - Authenticated host view.
  - `WorkingHoursForm.tsx`: Configure working days, start/end hours, default meeting duration, timezone, and meeting link (Jitsi / Google Meet / physical location).
  - `BookedEventsList.tsx`: List of upcoming and past booked appointments queried via Kind `31923` & `31925`.
  - Actions: Accept, Decline, or Cancel events with real-time relay publishing.


---

### Phase 8: Verification & Production Polish
- [x] **8.1** Execute automated test suite: `make test`.
- [x] **8.2** Execute strict type check: `make typecheck`.
- [x] **8.3** Execute production build: `make build`.
- [x] **8.4** Verify all edge cases:
  - Root `/` renders default host calendar.
  - Custom `/:npub` / `/:nip05` loads external host calendar.
  - Busy event timespans are correctly blocked.
  - Guest booking generates keys and triggers Resend email (or gracefully skips if flag is disabled).
  - Header links (`Support` to `z@emre.xyz`), language toggle, theme toggle, and auth dropdown function seamlessly.

---

### Phase 9: Kün Redesign
Tracked in issues #1–#10; design source of truth is the Kün Figma file.
- [x] **9.1** Brand and tokens: Kün mark, wordmark and lockup (no domain or NIP number in the lockup), self-hosted Bricolage Grotesque / Instrument Sans / JetBrains Mono, semantic colour tokens for light and dark, type, radius and shadow tokens.
- [x] **9.2** UI primitives: Button, Chip, Input/Select/TimeField, StatusBadge, Card, Toggle, Menu, Modal, Tabs (segmented and underline), Skeleton.
- [x] **9.3** Layout: header (nav, EN/TR switch, theme toggle, user menu, mobile menu), footer, hash routing (`/#/<nip05|npub>`, `/#/about`, `/#/dashboard`) with legacy path migration.
- [x] **9.4** Booking page: host card, durations (15/30/45/60, longer on demand), month picker, time zone select, details form, encrypted-by-default bookings for the host and invited npubs (NIP-44), success screen.
- [x] **9.5** Dashboard: link bar, stats, appointment cards (accept, decline, cancel, invite, copy link, `.ics`), per-day working hours, offered durations, gap and minimum notice; availability is published to relays as a NIP-78 event (kind `30078`) and read by the booking page.
- [x] **9.6** About page: open source and self-hosting pitch, example page card, setup steps, code card.
- [x] **9.7** QA: keyboard pass (no traps, visible focus rings on every control), WCAG AA contrast tests for both themes, TR/EN key parity test, `make test` / `make typecheck` / `make build`.
- [x] **9.8** Accepted as designed: the Nostr badge text (`nostr` on `nostr-soft`) is 3.73:1 in light mode, below AA for 13px text. `tests/contrast.test.ts` pins it at that floor.
