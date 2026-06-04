# Testing Guide

This document is the canonical testing reference for the MyOrganizer Nx monorepo.
All agents (automated and human) must use this as the source of truth for deciding what tools, configs, and patterns to apply when creating or editing tests.

## Quick Reference

| Target                 | Test type      | Runner                             | Command                       |
| ---------------------- | -------------- | ---------------------------------- | ----------------------------- |
| `apps/backend`         | Jest unit      | `ts-jest` + `node` env             | `yarn nx test backend`        |
| `apps/myorganizer`     | Jest unit      | `babel-jest` + `jsdom` env         | `yarn nx test myorganizer`    |
| `libs/web-ui`          | Jest unit      | `babel-jest` + `jsdom` env (React) | `yarn nx test web-ui`         |
| `libs/auth`            | Jest unit      | `ts-jest` + `jsdom` env            | `yarn nx test auth`           |
| `libs/core`            | Jest unit      | `ts-jest` or `babel-jest`          | `yarn nx test core`           |
| `libs/vault-core`      | Jest unit      | `babel-jest` + `jsdom` env         | `yarn nx test vault-core`     |
| `libs/web-vault`       | Jest unit      | `babel-jest` + `jsdom` env (React) | `yarn nx test web-vault`      |
| `libs/web-vault-ui`    | Jest unit      | `babel-jest` + `jsdom` env (React) | `yarn nx test web-vault-ui`   |
| `libs/web/pages/*`     | Jest unit      | `babel-jest` + `jsdom` env (React) | `yarn nx test <lib-name>`     |
| `apps/myorganizer-e2e` | Playwright E2E | `@playwright/test`                 | `yarn nx e2e myorganizer-e2e` |

## How to Identify the Right Config

Before writing any test, read the owning project's `jest.config.ts` (or `playwright.config.ts`). The config determines:

1. **Test environment** (`testEnvironment: 'node'` vs `jsdom`)
2. **Transformer** (`ts-jest` vs `babel-jest`)
3. **Module extensions** (`.ts` only vs `.ts,.tsx,.js,.jsx`)
4. **tsconfig** override path (backend uses `tsconfig.spec.json`)

Detection order for agents:

1. Read `<project>/jest.config.ts` (or `playwright.config.ts`) first.
2. Fall back to `jest.preset.js` at the repo root.
3. Fall back to `package.json` `scripts` for available targets.

---

## `apps/backend`

### Config summary

```ts
// apps/backend/jest.config.ts
testEnvironment: 'node'
transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] }
moduleFileExtensions: ['ts', 'js', 'html']
```

The backend uses **ts-jest** with a dedicated `tsconfig.spec.json` that includes `module: "commonjs"`.  
It runs in a **Node.js environment** — do **not** use `jsdom` globals, `window`, `document`, or `localStorage`.

### File naming

```
apps/backend/src/services/MyService.spec.ts
apps/backend/src/controllers/MyController.spec.ts
```

### Mocking patterns

| Dependency                                       | How to mock                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prisma**                                       | `jest.mock('../prisma', () => { ... })` — factory must be inline (hoisting); export `__mockPrisma` from the factory for test access. See `YouTubeSyncService.spec.ts` for the canonical pattern. |
| **External SDKs** (googleapis, nodemailer, etc.) | `jest.mock('googleapis', () => ({ ... }))` — fake the whole module.                                                                                                                              |
| **Encryption helpers**                           | `jest.mock('./YouTubeTokenEncryption', ...)` — stub `encryptToken`/`decryptToken` to return deterministic values.                                                                                |
| **Environment variables**                        | Set in `beforeEach`; restore or `delete` in `afterAll`.                                                                                                                                          |
| **HTTP**                                         | Use `supertest` for controller-level integration tests; pass the Express app directly without starting a server.                                                                                 |

### Backend-specific rules

- Use `async/await` with `expect(...).rejects.toThrow(...)` for error paths.
- Do **not** start a real server or connect to a real database.
- Do **not** call real third-party APIs.
- Do **not** use `window` / `document` / browser globals.
- Wrap Prisma mocks in inline factory functions — jest.mock is hoisted above imports.
- Security tests: assert that auth/permission guards reject unauthorized calls and that sensitive data (passwords, tokens) is never returned in plain text.

### Coverage commands

```bash
yarn nx test backend --coverage
# Report: coverage/apps/backend/index.html
```

---

## `apps/myorganizer`

### Config summary

```ts
// apps/myorganizer/jest.config.ts
transform: {
  '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
}
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx']
// environment defaults to jsdom via Nx preset
```

The Next.js app uses **babel-jest** with `@nx/next/babel` preset and implicitly runs under **jsdom**.

### File naming

```
apps/myorganizer/src/app/<route>/SomePage.spec.tsx
```

### App wrappers are thin — test the page library

Route files under `apps/myorganizer/src/app/**` are intentionally thin (metadata + composition only).  
**Test the page library** (`libs/web/pages/<route>`) instead — it holds all the actual logic.

### Mocking patterns

| Dependency         | How to mock                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- |
| **API client**     | `jest.mock('@myorganizer/app-api-client', () => ({ ... }))`                        |
| **Next.js router** | `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))` |
| **Auth/session**   | `jest.mock('@myorganizer/auth', ...)` — return a fixed token or null               |
| **Vault**          | `jest.mock('@myorganizer/web-vault', ...)` — stub unlock/read/write                |

---

## `libs/web-ui`

### Config summary

```ts
transform: { '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }] }
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx']
// jsdom environment
```

### File naming

```
libs/web-ui/src/lib/<Component>.spec.tsx
```

### Patterns

- Use **React Testing Library** (`@testing-library/react`).
- Prefer `getByRole`, `getByLabel`, `getByText` over `querySelector`.
- Test user interactions via `userEvent` or `fireEvent`.
- Do not test implementation internals — test observable output.

```ts
import { render, screen, fireEvent } from '@testing-library/react';
```

---

## `libs/auth`

### Config summary

```ts
testEnvironment: 'jsdom'
transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] }
```

Uses **ts-jest** but under **jsdom** because auth utilities interact with browser storage.

### Patterns

- `clearAuthSession()` in `beforeEach` to reset state.
- Test `localStorage`/`sessionStorage` via the jsdom globals.
- No real network calls.

---

## `libs/vault-core`

### Config summary

```ts
transform: { '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }] }
// jsdom environment
```

### Patterns

- Use `Buffer.alloc(n).toString('base64')` for stub IV/ciphertext values.
- Never test with real encryption keys — use a deterministic test key.
- Use the `makeEnvelope()` builder pattern (see `vaultExportEnvelope.spec.ts`) for envelope tests.
- Vault-specific security checks: assert that corrupted ciphertext, wrong schema version, and oversized payloads are all rejected.

---

## `libs/web-vault` and `libs/web-vault-ui`

Same transform as `libs/web-ui` (babel-jest + React + jsdom).

### Additional rules

- Do **not** expose plaintext vault data outside of the tested unit.
- Mock `@myorganizer/vault-core` crypto primitives rather than running real crypto in unit tests.
- For import/export flows, stub the `FileReader`/`Blob` API via jsdom or a manual mock.

---

## `libs/web/pages/*`

Same transform as `libs/web-ui` (babel-jest + React + jsdom).  
Each page library has its own `jest.config.ts` with a path-corrected preset depth (`../../../../jest.preset.js` for nested pages).

### Patterns

- Mock the API client, auth, and vault at the module boundary.
- Use Zod schema `safeParse` directly for form validation tests — no DOM rendering needed.
- Use React Testing Library for component integration.
- See `libs/web/pages/addresses/src/utils/addressForm.spec.ts` for a reference form-validation spec.

### Async Hook Testing Pattern (libs/web/pages/\*)

For page libraries that expose custom hooks with async operations (e.g., vault saves, API calls):

**Requirements:**

- Mock all external async functions (`loadDecryptedData`, `saveEncryptedData`, API client methods, etc.).
- Call `mockReset()` **inside `beforeEach()`** — never in `beforeAll()`.
- Use `act()` only for direct state-setter calls (e.g. `result.current.setFoo(val)`).
- Use `waitFor()` for **all** assertions that follow an async effect or async state update.

```typescript
jest.mock('@myorganizer/web-vault');
jest.mock('@myorganizer/core');

// Imports AFTER jest.mock() calls (see Nx lazy-loading rule below)
import { renderHook, act, waitFor } from '@testing-library/react';
import { loadDecryptedData, saveEncryptedData } from '@myorganizer/web-vault';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  beforeEach(() => {
    (loadDecryptedData as jest.Mock).mockReset();
    (loadDecryptedData as jest.Mock).mockResolvedValue([]);
    (saveEncryptedData as jest.Mock).mockReset();
    (saveEncryptedData as jest.Mock).mockResolvedValue(undefined);
  });

  it('should load and update state', async () => {
    (loadDecryptedData as jest.Mock).mockResolvedValue([{ id: '1', name: 'Item' }]);
    const { result } = renderHook(() => useMyHook({ masterKeyBytes: new Uint8Array(32) }));

    // Wait for async load effect to settle
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
  });

  it('should persist on mutation and update state', async () => {
    const { result } = renderHook(() => useMyHook({ masterKeyBytes: new Uint8Array(32) }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addItem('New Item');
    });

    // Wait for both state update AND the async persist side effect
    await waitFor(() => {
      expect(result.current.items).toContainEqual(expect.objectContaining({ name: 'New Item' }));
    });
    await waitFor(() => {
      expect(saveEncryptedData as jest.Mock).toHaveBeenCalled();
    });
  });
});
```

**Common mistakes:**

- ❌ Asserting on state immediately after `act()` when the hook has async effects — use `waitFor()`.
- ❌ Using `beforeAll()` for mock setup — mocks retain state between tests.
- ❌ Forgetting `mockReset()` in `beforeEach()` — previous test's mock return value bleeds in.

---

### Nx Lazy-Loading & jest.mock() Ordering

Nx enforces module boundary rules at **lint time** (before Jest transformation). jest.mock() hoisting only takes effect at **runtime**. This creates a subtle trap:

**Rule: Place ALL `jest.mock()` calls before any imports — including `import type`.**

```typescript
// ❌ WRONG — linting flags the static import as a boundary violation
import type { GroceryList } from '@myorganizer/core';
jest.mock('@myorganizer/core');

// ✅ CORRECT — mocks first, then imports
jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(),
}));
jest.mock('@myorganizer/web-vault');

import type { GroceryList } from '@myorganizer/core';
import { loadDecryptedData } from '@myorganizer/web-vault';
import { useMyHook } from './useMyHook';
```

Known lazy-loaded libraries (verify against `nx.json` when new libs are added):

- `@myorganizer/core`
- `@myorganizer/auth`
- `@myorganizer/vault-core`

---

## `apps/myorganizer-e2e`

### Config summary

```ts
// apps/myorganizer-e2e/playwright.config.ts
nxE2EPreset(__filename, { testDir: './src/e2e' })
baseURL: process.env.BASE_URL || 'http://localhost:4200'
webServer: { command: 'npx nx run myorganizer:serve:development', ... }
browsers: chromium, firefox, webkit
```

### File naming

```
apps/myorganizer-e2e/src/e2e/<flow>.spec.ts
```

### Rules

- Use `@playwright/test` (`test`, `expect`) — not Jest.
- Prefer `getByRole`, `getByLabel`, `getByText` selectors.
- Do not commit traces, screenshots, or generated artifacts.
- For vault flows, the full unlock/lock cycle must be included in preconditions.
- See `.github/skills/playwright-e2e-workflow/SKILL.md` for selector and mocking rules.

### Commands

```bash
yarn nx e2e myorganizer-e2e             # headless
yarn nx e2e myorganizer-e2e --ui        # interactive UI mode
yarn nx e2e-ci myorganizer-e2e          # CI mode (no reuse of existing server)
```

---

## Shared patterns across all projects

### Naming

```ts
describe('MyService', () => {
  describe('methodName', () => {
    it('should <expected outcome> when <condition>', () => { ... });
  });
});
```

### Assertion quality

| Avoid                    | Prefer                                   |
| ------------------------ | ---------------------------------------- |
| `expect(x).toBeTruthy()` | `expect(x).toBe('exact-value')`          |
| Generic snapshots        | Structural assertions on specific fields |
| `toBeDefined()` alone    | `expect(x).toBe(...)` or `toEqual(...)`  |

### Mock discipline

- Keep mocks minimal — only stub what the unit under test actually calls.
- Reset mocks in `beforeEach` — use `jest.clearAllMocks()` or call `mockReset()` on each mock individually. **Never** use `beforeAll()` for mock setup; it prevents per-test isolation.
- Never rely on mock call order across test cases.
- Only type-cast mocks that are explicitly referenced in assertions or setup: `const mockFn = fn as jest.Mock;`. Delete unused casts to avoid `no-unused-vars` linting errors.

### Mock state isolation

Mocks retain their `.mockResolvedValue()` / `.mockReturnValue()` implementations across tests unless explicitly reset. Signs of state leakage:

- A test passes in isolation (`yarn nx test <project> --testNamePattern="My Test"`) but fails when run with others.
- Tests pass on a fresh `--clearCache` run but fail on the second run.

**Fix:**

```typescript
// ✅ Reset all mocks before every test
beforeEach(() => {
  jest.clearAllMocks();
  // Then apply test-specific return values
  (mockFn as jest.Mock).mockResolvedValue(defaultData);
});
```

### Dead code detection during testing

When implementing or reviewing a hook or utility, flag any state or functions that:

- Are declared but never returned from the hook.
- Are never referenced in any test assertion.
- Are never exported or called externally.

These are dead code and must be removed before committing. ESLint's `no-unused-vars` rule will surface them — run `yarn nx lint <project> --fix` to confirm.

### Coverage target

Aim for meaningful coverage, not high percentages. Priority order:

1. Error/rejection paths
2. Side effects and collaborator calls
3. Boundary conditions
4. Happy path

### Security baseline (apply when in scope)

- Unauthorized/missing credentials → assert rejection, not silent pass-through.
- Sensitive fields (passwords, tokens, plaintext vault data) → assert never returned in plain text.
- Tampered input (corrupted ciphertext, oversized payloads, invalid schema versions) → assert throws, not silent corruption.
- Input sanitization → assert invalid characters/formats are rejected at the boundary.
