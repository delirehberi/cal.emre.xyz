# Contributing to cal.emre.xyz

Thank you for your interest in contributing to **cal.emre.xyz**! This project is an open-source, decentralized Nostr NIP-52 scheduling application.

---

## 📜 Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating in discussions or submitting contributions.

---

## ⚙️ Development Setup

### Prerequisites
- **Node.js**: `v26.2.0` (as specified in `.nvmrc`)
- **npm**: `v11.13.0` or newer
- **nvm** (Node Version Manager)
- **Make**

### Quick Setup
1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/cal.emre.xyz.git
   cd cal.emre.xyz
   ```
2. **Switch to the required Node version**:
   ```bash
   nvm use
   ```
3. **Install dependencies**:
   ```bash
   make install
   ```
4. **Start the development server**:
   ```bash
   make dev
   ```

---

## 📐 Engineering Principles & Code Quality

To maintain high standards across the codebase, all contributions must adhere to these rules:

1. **Product-Grade Code Quality**:
   - Never commit placeholder comments or `TODO` markers. Every function and component must be fully implemented, type-safe, and robust.
2. **Stepped & Function-by-Function**:
   - Build and verify logic incrementally. Ensure tests and typechecks pass at each step.
3. **Strict TypeScript & Zero Build Warnings**:
   - All code must pass `make typecheck` (`tsc --noEmit`) without any compilation or typing errors.
4. **Comprehensive Test Coverage**:
   - Add unit/integration tests in the `tests/` directory for any new logic, parsing functions, or UI components.
   - Run `make test` to verify that all existing and new tests pass.
5. **Decentralized First (NIP-52 / NIP-65)**:
   - Relays are the source of truth. Avoid introducing centralized backend dependencies or state stores unless strictly necessary.
6. **Internationalization & Accessibility**:
   - All UI copy must be parameterized in `src/client/i18n/` for both English (`en`) and Turkish (`tr`).
   - Components should support keyboard navigation and clean light/dark theming.

---

## 🛠️ Essential Makefile Commands

Always run tooling through the provided `Makefile`:

```bash
# Install dependencies with Node version verification
make install

# Launch local dev server (Vite + Hono)
make dev

# Run full Vitest test suite
make test

# Run tests in watch mode
make test-watch

# Validate TypeScript types
make typecheck

# Build client production bundle
make build
```

---

## 🌿 Branching & Pull Request Process

1. **Create a topic branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Commit your changes**:
   - Use descriptive commit messages (e.g. `feat(nip52): add timezone offset validation to time slots`).
3. **Verify all checks pass locally**:
   ```bash
   make typecheck && make test && make build
   ```
4. **Submit a Pull Request**:
   - Clearly explain the problem and the proposed solution.
   - Link any relevant GitHub issues or NIP specifications.

---

## 📬 Need Help?

If you have questions or need assistance, feel free to open a GitHub Discussion / Issue or contact `z@emre.xyz`.
