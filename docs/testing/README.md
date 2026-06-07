# Testing Guide

This document is the canonical testing reference for the MyOrganizer Nx monorepo.
All agents (automated and human) must use this as the source of truth for deciding what tools, configs, and patterns to apply when creating or editing tests.

## Quick Reference

| Target                 | Test type             | Runner                             | Command                       |
| ---------------------- | --------------------- | ---------------------------------- | ----------------------------- |
| `apps/backend`         | Jest unit/integration | `ts-jest` + `node` env             | `yarn nx test backend`        |
| `apps/myorganizer`     | Jest unit/integration | `babel-jest` + `jsdom` env         | `yarn nx test myorganizer`    |
| `libs/web-ui`          | Jest unit/integration | `babel-jest` + `jsdom` env (React) | `yarn nx test web-ui`         |
| `libs/auth`            | Jest unit/integration | `ts-jest` + `jsdom` env            | `yarn nx test auth`           |
| `libs/core`            | Jest unit             | `ts-jest` or `babel-jest`          | `yarn nx test core`           |
| `libs/vault-core`      | Jest unit/integration | `babel-jest` + `jsdom` env         | `yarn nx test vault-core`     |
| `libs/web-vault`       | Jest unit/integration | `babel-jest` + `jsdom` env (React) | `yarn nx test web-vault`      |
| `libs/web-vault-ui`    | Jest unit/integration | `babel-jest` + `jsdom` env (React) | `yarn nx test web-vault-ui`   |
| `libs/web/pages/*`     | Jest unit/integration | `babel-jest` + `jsdom` env (React) | `yarn nx test <lib-name>`     |
| `apps/myorganizer-e2e` | Playwright E2E        | `@playwright/test`                 | `yarn nx e2e myorganizer-e2e` |

## Test Generation Contract

Any agent or human creating tests must analyze first, scope second, write third, and validate last. This applies to Jest unit tests, Jest integration tests, React hook/component integration tests, and Playwright E2E specs.

### 1. Analyze the implementation

Read the full code under test before writing assertions. Do not infer behavior from exported types, names, or a generic testing template.

For hooks, async workflows, services, and controllers, trace:

- where state is set;
- which helper sets `error`, `loading`, or status values;
- whether public methods throw, catch, swallow, or rethrow;
- which collaborators are called and with what payload shape;
- whether retry, timeout, cancellation, or concurrency behavior actually exists;
- what should remain unchanged on failure.

### 2. Build a behavior matrix

Create a compact matrix before editing tests:

| Operation/flow | Inputs/preconditions | Observable output/state | Side effects/collaborators | Error behavior | Unsupported behavior |
| -------------- | -------------------- | ----------------------- | -------------------------- | -------------- | -------------------- |

Only write tests for scenarios that are possible through the public surface. If requested behavior is not implemented, record it as out of scope or a follow-up instead of asserting it.

### 3. Scope by test type

| Type             | Purpose                                                                                                                                                  | Boundaries                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Unit             | Isolate one function, component, hook, service, or utility                                                                                               | Mock external dependencies and assert local behavior precisely              |
| Jest integration | Verify connected local behavior such as hook + vault adapter boundary, component + form validation, controller + service, or service + mocked repository | Mock network, DB, email, Google, and other infrastructure                   |
| Playwright E2E   | Verify a user-visible browser journey                                                                                                                    | Use deterministic auth/data/network setup; no live third-party dependencies |

For one focused Jest integration suite, 8-15 tests is usually enough. More tests require a behavior-matrix reason. More than 20 tests or multiple files should be split into batches.

### 4. Avoid unsupported scenarios

Do not test these unless the implementation explicitly supports them:

- retry or recovery flows;
- concurrent `Promise.all()` mutations;
- timeout or timing-window behavior;
- thrown errors from public methods that catch and swallow;
- real network, database, email, Google, or third-party behavior.

### 5. Validate output structure

Before accepting generated tests, check for:

- duplicate helper functions;
- duplicate `describe` blocks;
- appended second copies of the suite;
- unused mock casts or imports;
- assertions that contradict the behavior matrix;
- tests that would pass if the implementation were broken.

TestScaffold delegations must follow `.github/agents/test-scaffold.agent.md` and `.github/skills/unit-test-delegation-workflow/references/delegation-runbook.md`.

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
- ❌ Testing retry or recovery paths unless the hook exposes a retry entry point or documented repeat-call behavior.
- ❌ Testing concurrent `Promise.all()` mutations unless the hook implements concurrency handling.
- ❌ Using `mockReturnValueOnce()` queues for async ID generation or multi-call workflows; prefer an order-independent `mockImplementation()`.
- ❌ Expecting a public hook method to throw when the implementation catches and logs the error.

When a hook delegates persistence to a helper, trace the error path before writing assertions. If the helper sets error state and throws, but the public method catches the error, the valid assertion is usually state/error behavior, not caller-visible throwing.

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

### Pre-test Requirements

Before writing E2E tests, verify:

1. **Component implementation is complete** — Manually test the flow end-to-end
2. **Semantic HTML roles are defined** — All interactive elements have proper roles (`role="article"`, `role="button"`, etc.)
3. **API contracts are stable** — All endpoints used in the flow are defined and can be mocked
4. **Vault architecture is documented** — For vault-backed features, confirm unlock/decrypt patterns

### Rules

- Use `@playwright/test` (`test`, `expect`) — not Jest.
- Read the component code first — inspect `libs/web/pages/<route>` to understand interactive patterns.
- Prefer `getByRole`, `getByLabel`, `getByText` selectors.
- Build a flow matrix before writing the spec: route, preconditions, user steps, selectors, network/data expectations, side effects, and unsupported behavior to avoid.
- Trace the route wrapper into the owning page library before choosing selectors or assertions.
- Keep auth, vault unlock state, seed data, and network boundaries deterministic.
- Test on all three browsers (Chromium, Firefox, WebKit) — browser-specific patterns exist and must be validated.
- Do not commit traces, screenshots, or generated artifacts.
- For vault flows, the full unlock/lock cycle must be included in preconditions.
- Do not test retry, recovery, timeout, or concurrency behavior unless the UI implements it.
- See `.github/skills/playwright-e2e-workflow/SKILL.md` for selector and mocking rules.

### E2E-Specific Patterns

#### Context Menus (Radix DropdownMenu)

Radix DropdownMenu buttons are hidden by default with TailwindCSS `opacity-0` and become visible on `group-hover`. Use hover + click, not native context menu dispatch:

```typescript
// ❌ Wrong — won't find the hidden button
await page.dispatchEvent('contextmenu');

// ✅ Correct — hover reveals the button, then click
const card = page.locator('xpath=//div[contains(., "Item Name")]').first();
await card.hover();
const menuButton = card.locator('button').first();
await menuButton.click();
```

#### Vault Unlock (Firefox-Compatible)

Vault decryption is asynchronous. Firefox requires explicit button clicks and additional delays:

```typescript
// ✅ Correct pattern
await page.getByRole('button', { name: 'Use passphrase' }).click();
await page.waitForTimeout(1000); // Firefox animation delay

const input = page.locator('#unlock-passphrase');
await input.fill(passphrase);

// ❌ Don't use .press('Enter') — Firefox doesn't reliably submit forms this way
// ✅ Click the button instead
await page.getByRole('button', { name: /^Unlock$/i }).click();

// Wait for unlock to complete
await page.locator('#unlock-passphrase').isHidden({ timeout: 30000 });
```

#### Async Component Initialization

Vault and Next.js hydration introduce client-side async delays. Don't rely on network waits:

```typescript
// ❌ Wrong — network might be idle but React still initializing
await page.waitForLoadState('networkidle');

// ✅ Correct — wait for actual content
await page.waitForFunction(
  () => {
    const emptyState = document.querySelector('h2')?.textContent?.includes('No items yet');
    const items = document.querySelectorAll('div[role="article"]').length > 0;
    return emptyState || items;
  },
  { timeout: 30000 },
);
```

#### API Mocking with CORS Preflight

Mocked endpoints must handle OPTIONS (CORS preflight) requests:

```typescript
await page.route(/\/auth\/login\/?(\?.*)?$/, async (route) => {
  const request = route.request();
  const origin = new URL(page.url()).origin;

  if (request.method() === 'OPTIONS') {
    // Preflight response
    await route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,if-match',
      },
    });
    return;
  }

  // Actual response
  await route.fulfill({
    status: 200,
    body: JSON.stringify({ token: 'fake-jwt', ... }),
  });
});
```

#### Parallel Test Execution

Multiple tests running concurrently can saturate the network. Use resilient wait strategies:

```typescript
// ❌ Wrong in parallel execution — multiple tests block on networkidle
await page.waitForLoadState('networkidle');

// ✅ Correct — timeout + fallback
try {
  await page.waitForLoadState('networkidle', { timeout: 10000 });
} catch {
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch {
    // Continue — page is ready enough
  }
}
```

#### Playwright API Boundaries

`page.waitForFunction()` executes in the browser context — only browser-native APIs are available:

```typescript
// ❌ Wrong — Playwright APIs not available in browser context
await page.waitForFunction(() => {
  return page.locator('#input').isVisible();
});

// ✅ Correct — use browser-native APIs only
await page.waitForFunction(() => {
  return !!document.querySelector('#input');
});
```

### E2E Anti-Patterns to Avoid

| Anti-Pattern                                            | Why It's Wrong                                         | Correct Approach                               |
| ------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Using `role="button"` for non-buttons                   | Semantic HTML violation; breaks accessibility          | Use `role="article"` for cards with checkboxes |
| Relying on `input.press('Enter')` for form submission   | Firefox doesn't reliably trigger; breaks cross-browser | Explicitly click the submit button             |
| Calling `page.locator()` inside `waitForFunction()`     | Browser context has no Playwright APIs                 | Use `document` API only in browser context     |
| Assuming standard HTML context menus                    | Radix DropdownMenu is not native; buttons are hidden   | Use hover + click pattern                      |
| Using `waitForLoadState('networkidle')` for async React | Client-side async (vault, hydration) not captured      | Use content-based `waitForFunction()`          |
| Strict networkidle in parallel test suites              | Network saturation blocks all tests                    | Use timeout + fallback strategy                |
| Testing on one browser only                             | Firefox and WebKit have different patterns             | Test on all three browsers                     |
| Not mocking CORS preflight                              | Tests fail with CORS errors                            | Handle OPTIONS requests in route mocks         |

### Form-Based E2E Flows (React Hook Form + Zod)

**Background:** Production incidents with form-based E2E tests revealed gaps between test expectations and component implementation. This section documents best practices to prevent failures at the component lifecycle layer.

#### Pre-Implementation Checklist

Before writing form-based E2E tests, verify these with the component developer:

- [ ] Form library specified (react-hook-form, formik, etc.)
- [ ] Form validation mode specified (onChange vs onSubmit vs onBlur)
- [ ] Component remounting strategy documented (e.g., `key={itemId}` for dialogs)
- [ ] Form reset behavior documented (useEffect watching which dependencies?)
- [ ] When each button becomes enabled/disabled (conditions like `!isDirty || !isValid`)
- [ ] How validation errors appear (timing and visibility)

#### MyOrganizer Form Defaults

```typescript
// All editable forms in MyOrganizer use these patterns:

// EditItemDialog pattern
const form = useForm<ItemData>({
  mode: 'onChange',  // ← Real-time validation; REQUIRED for save button UX
  resolver: zodResolver(itemSchema),
  defaultValues: itemData,
});

// Parent component ensures form state resets per item
<EditItemDialog
  key={editingItemId ?? 'none'}  // ← Forces remount per item; REQUIRED
  item={editingItem || null}
  // ...
/>

// EditItemDialog useEffect for fresh defaultValues and validation
useEffect(() => {
  if (item) {
    form.reset(itemData, { keepDirty: false, keepErrors: false });
    form.trigger(); // Run validation immediately
  }
}, [item?.id, form]);

// Save button logic
<Button
  disabled={isLoading || !form.formState.isDirty || !form.formState.isValid}
>
  Save
</Button>
```

#### Common E2E Test Patterns for Forms

**Pattern 1: Verify button enable/disable on field change**

```typescript
it('should enable Save button when valid field is modified', async () => {
  await page.click('[aria-label="Edit Item"]');
  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"]');

  // Get initial button state
  const saveButton = page.locator('button', { hasText: 'Save' });
  const initiallyDisabled = await saveButton.isDisabled();
  expect(initiallyDisabled).toBe(true); // Form not dirty yet

  // Modify a field
  const nameInput = page.locator('input[placeholder="Item Name"]');
  await nameInput.fill('Updated Item');

  // ✅ CRITICAL: Assert button becomes enabled, don't just wait and hope
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
});
```

**Pattern 2: Verify form validation errors block submission**

```typescript
it('should prevent save when required field is empty', async () => {
  await page.click('[aria-label="Edit Item"]');
  await page.waitForSelector('[role="dialog"]');

  // Clear required field
  const nameInput = page.locator('input[aria-label="Item Name *"]');
  await nameInput.fill('');

  // ✅ Assert validation error appears and button stays disabled
  const errorMsg = page.locator('text=/Item name is required/');
  await expect(errorMsg).toBeVisible({ timeout: 5000 });

  const saveButton = page.locator('button', { hasText: 'Save' });
  await expect(saveButton).toBeDisabled();
});
```

**Pattern 3: Verify form resets when switching items**

```typescript
it('should reset form when editing different item', async () => {
  // Edit first item
  await page.click('[aria-label="Edit Item 1"]');
  await page.waitForSelector('[role="dialog"]');
  const nameInput = page.locator('input[placeholder="Item Name"]');
  await nameInput.fill('Modified Name');

  // Save and close
  await page.click('button:has-text("Save")');
  await page.waitForSelector('[role="dialog"]', { state: 'hidden' });

  // Edit second item
  await page.click('[aria-label="Edit Item 2"]');
  await page.waitForSelector('[role="dialog"]');

  // ✅ Form should have fresh defaultValues for item 2, not modified name
  const nameInput2 = page.locator('input[placeholder="Item Name"]');
  const currentValue = await nameInput2.inputValue();
  expect(currentValue).toBe('Item 2 Original Name'); // Not "Modified Name"
});
```

**Pattern 4: Create form state verification helper**

```typescript
// Reusable helper for form state checks
async function waitForFormValid(page: Page, timeout = 5000) {
  const button = page.locator('button[type="submit"]:not(:disabled)');
  await expect(button).toBeEnabled({ timeout });
}

async function waitForFormInvalid(page: Page, timeout = 5000) {
  const button = page.locator('button[type="submit"]');
  await expect(button).toBeDisabled({ timeout });
}

// Usage in tests
it('should enable and disable save button correctly', async () => {
  await openEditDialog(page, 'Item 1');
  await waitForFormValid(page); // Should be disabled initially, then timeout

  await page.fill('input[aria-label="Category"]', 'Dairy');
  await waitForFormValid(page); // Now enabled
});
```

#### Debugging Form State Issues

When form buttons don't change state as expected:

1. **Do NOT try different interaction patterns** (keyboard vs fill vs selectAll+type) — wrong layer
2. **Do investigate component architecture:**
   - Is dialog remounting per item? Check for `key={itemId}` in parent
   - Does form reset on item change? Check useEffect watching `item?.id`
   - Is form mode set to 'onChange'? Check useForm config
3. **Add debug output:**
   - Take screenshot of dialog state: `await page.screenshot({ path: 'dialog.png' })`
   - Log button disabled state: `console.log('Save disabled:', await button.isDisabled())`
   - Check for validation errors: `expect(page.locator('[aria-invalid="true"]')).toBeVisible()`

#### Cross-Browser Considerations for Forms

- **Firefox:** Add extra timeout after form state changes before asserting button enable status
- **Firefox:** Use explicit button clicks, not Enter key for form submission
- **WebKit:** Be generous with timeouts (may be slower on some systems)
- **All browsers:** Verify button enable/disable state works consistently by running tests on all three browsers

### Commands

```bash
yarn nx e2e myorganizer-e2e             # headless, all browsers
yarn nx e2e myorganizer-e2e --ui        # interactive UI mode
yarn nx e2e-ci myorganizer-e2e          # CI mode (no reuse of existing server)
yarn nx e2e myorganizer-e2e --testFile=<path>.spec.ts  # single test file
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
- Avoid relying on mock queue order inside async or concurrent operations. Use `mockImplementation()` when multiple calls need deterministic dynamic values.
- Mock the external boundary first. For example, prefer mocking vault load/save behavior over asserting incidental ID-generation details unless IDs are part of the behavior contract.
- Mock every module whose functions are configured or cast in the test. If a test configures `randomId`, explicitly mock `@myorganizer/core` before imports.
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
