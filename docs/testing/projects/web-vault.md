# Testing `libs/web-vault` and `libs/web-vault-ui`

Jest unit/integration · `babel-jest` + `jsdom` env (React) · `yarn nx test web-vault` / `yarn nx test web-vault-ui`

## Config summary

Same transform as [`libs/web-ui`](./web-ui.md) — babel-jest + `@nx/react/babel` + jsdom.

## Rules

- Do **not** expose plaintext vault data outside of the tested unit.
- Mock `@myorganizer/vault-core` crypto primitives rather than running real crypto in unit tests.
- For import/export flows, stub the `FileReader` / `Blob` API via jsdom or a manual mock.

## Commands

```bash
yarn nx test web-vault
yarn nx test web-vault-ui
yarn nx lint web-vault
yarn nx lint web-vault-ui
```
