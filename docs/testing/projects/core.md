# Testing `libs/core`

Jest unit · `ts-jest` or `babel-jest` · `yarn nx test core`

## Config summary

Read `libs/core/jest.config.ts` for the active transformer. `libs/core` holds framework-free
domain types and utilities, so tests are plain unit tests with no DOM and no module mocking.

## Patterns

- Test pure functions directly — no `jest.mock()` should be needed inside this library.
- Assert exact values (`toBe` / `toEqual`), not shape checks.
- Non-deterministic helpers (`randomId`, timestamp generators) are the exception: assert the
  contract (format, uniqueness, length), not a fixed value.

## Note for consumers

`@myorganizer/core` is lazy-loaded, so **downstream** libraries mocking it must place
`jest.mock('@myorganizer/core', ...)` before every import — see the
[Nx lazy-loading & `jest.mock()` ordering rule](../README.md#nx-lazy-loading--jestmock-ordering).

## Commands

```bash
yarn nx test core
yarn nx lint core
```
