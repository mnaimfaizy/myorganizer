# Testing `libs/vault-core`

Jest unit/integration · `babel-jest` + `jsdom` env · `yarn nx test vault-core`

## Config summary

```ts
transform: { '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }] }
// jsdom environment
```

## Patterns

- Use `Buffer.alloc(n).toString('base64')` for stub IV/ciphertext values.
- Never test with real encryption keys — use a deterministic test key.
- Use the `makeEnvelope()` builder pattern (see `vaultExportEnvelope.spec.ts`) for envelope tests.

## Security checks (in scope for this library)

Assert that each of these is **rejected**, not silently accepted:

- corrupted ciphertext;
- wrong schema version;
- oversized payloads.

`@myorganizer/vault-core` is lazy-loaded — see the
[Nx lazy-loading & `jest.mock()` ordering rule](../README.md#nx-lazy-loading--jestmock-ordering).

## Commands

```bash
yarn nx test vault-core
yarn nx lint vault-core
```
