# Testing `libs/email-shell`

Jest unit · `ts-jest` + `node` env · `yarn nx test email-shell`

## Config summary

```ts
testEnvironment: 'node'
transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] }
```

## Patterns

- Pure function under test (`renderEmailShell`) — no network, filesystem, or DB collaborators to mock.
- Assert on the returned `{ html, text }` strings directly (substring/regex checks), not snapshots —
  the shell's markup is expected to change as blocks are added, and a snapshot would hide exactly
  the regressions this suite exists to catch.
- `options.emailClass` is the load-bearing input (ADR 0034): cover both `'transactional'` and
  `'notification'`, plus the missing/invalid-class rejection.
- Design-token values (`@myorganizer/design-tokens`) are real, not mocked — asserting the literal
  token values (e.g. `colorPrimary`) in output is how "colours come from tokens, not literal hex" is
  actually verified.

## Security checks (in scope for this library)

Assert that each of these is **escaped**, not passed through:

- `<`, `>`, `"`, `&`, `'` in heading/paragraph/button/list text and URLs;
- a script-tag-shaped string in any interpolated field never appears unescaped in `html`.

## Commands

```bash
yarn nx test email-shell
yarn nx lint email-shell
```
