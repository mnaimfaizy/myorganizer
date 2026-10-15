# Testing `apps/web`

Jest unit/integration · `babel-jest` + `jsdom` env · `yarn nx test web`

## Config summary

```ts
// apps/web/jest.config.ts
transform: {
  '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
}
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx']
// environment defaults to jsdom via Nx preset
```

The Next.js app uses **babel-jest** with the `@nx/next/babel` preset and implicitly runs under **jsdom**.

## File naming

```
apps/web/src/app/<route>/SomePage.spec.tsx
```

## App wrappers are thin — test the page library instead

Route files under `apps/web/src/app/**` are intentionally thin (metadata + composition only).
**Test the page library** (`libs/web/pages/<route>`, see [web-pages.md](./web-pages.md)) — it holds all the actual logic.

## Mocking patterns

| Dependency         | How to mock                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- |
| **API client**     | `jest.mock('@myorganizer/app-api-client', () => ({ ... }))`                        |
| **Next.js router** | `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))` |
| **Auth/session**   | `jest.mock('@myorganizer/auth', ...)` — return a fixed token or null               |
| **Vault**          | `jest.mock('@myorganizer/web-vault', ...)` — stub unlock/read/write                |

See the [Nx lazy-loading & `jest.mock()` ordering rule](../README.md#nx-lazy-loading--jestmock-ordering) — it applies here.

## Commands

```bash
yarn nx test web
yarn nx lint web
```
