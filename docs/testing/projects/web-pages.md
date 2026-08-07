# Testing `libs/web/pages/*`

Jest unit/integration · `babel-jest` + `jsdom` env (React) · `yarn nx test <lib-name>`

## Config summary

Same transform as [`libs/web-ui`](./web-ui.md) — babel-jest + `@nx/react/babel` + jsdom.
Each page library has its own `jest.config.ts` with a path-corrected preset depth
(`../../../../jest.preset.js` for nested pages). Read the owning library's config before writing.

## File naming

```
libs/web/pages/<route>/src/**/<name>.spec.ts(x)
```

## Patterns

- Mock the API client, auth, and vault at the module boundary.
- Use Zod schema `safeParse` directly for form validation tests — no DOM rendering needed.
- Use React Testing Library for component integration.
- Reference form-validation spec: `libs/web/pages/addresses/src/utils/addressForm.spec.ts`.

## Async hook testing pattern

For page libraries exposing custom hooks with async operations (vault saves, API calls):

- Mock all external async functions (`loadDecryptedData`, `saveEncryptedData`, API client methods).
- Call `mockReset()` **inside `beforeEach()`** — never in `beforeAll()`.
- Use `act()` only for direct state-setter calls (e.g. `result.current.setFoo(val)`).
- Use `waitFor()` for **all** assertions that follow an async effect or async state update.

```typescript
jest.mock('@myorganizer/web-vault');
jest.mock('@myorganizer/core');

// Imports AFTER jest.mock() calls — see the Nx lazy-loading rule in ../README.md
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

### Common mistakes

- ❌ Asserting on state immediately after `act()` when the hook has async effects — use `waitFor()`.
- ❌ Using `beforeAll()` for mock setup — mocks retain state between tests.
- ❌ Forgetting `mockReset()` in `beforeEach()` — the previous test's return value bleeds in.
- ❌ Using `mockReturnValueOnce()` queues for async ID generation or multi-call workflows; prefer an order-independent `mockImplementation()`.

### Tracing the error path

When a hook delegates persistence to a helper, trace the error path before writing assertions.
If the helper sets error state and throws, but the public method catches the error, the valid
assertion is usually state/error behavior — not caller-visible throwing.

## Commands

```bash
yarn nx test <lib-name>
yarn nx lint <lib-name>
```
