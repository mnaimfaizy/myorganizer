# Testing `libs/auth`

Jest unit/integration · `ts-jest` + `jsdom` env · `yarn nx test auth`

## Config summary

```ts
testEnvironment: 'jsdom'
transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] }
```

Uses **ts-jest** but under **jsdom**, because auth utilities interact with browser storage.

## Patterns

- Call `clearAuthSession()` in `beforeEach` to reset state.
- Test `localStorage` / `sessionStorage` via the jsdom globals.
- No real network calls.

`@myorganizer/auth` is lazy-loaded — see the [Nx lazy-loading & `jest.mock()` ordering rule](../README.md#nx-lazy-loading--jestmock-ordering).

## Commands

```bash
yarn nx test auth
yarn nx lint auth
```
