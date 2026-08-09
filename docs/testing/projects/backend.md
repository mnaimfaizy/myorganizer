# Testing `apps/backend`

Jest unit/integration · `ts-jest` + `node` env · `yarn nx test backend`

## Config summary

```ts
// apps/backend/jest.config.ts
testEnvironment: 'node'
transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] }
moduleFileExtensions: ['ts', 'js', 'html']
```

The backend uses **ts-jest** with a dedicated `tsconfig.spec.json` that includes `module: "commonjs"`.
It runs in a **Node.js environment** — do **not** use `jsdom` globals, `window`, `document`, or `localStorage`.

## File naming

```
apps/backend/src/services/MyService.spec.ts
apps/backend/src/controllers/MyController.spec.ts
```

## Mocking patterns

| Dependency                                       | How to mock                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prisma**                                       | `jest.mock('../prisma', () => { ... })` — factory must be inline (hoisting); export `__mockPrisma` from the factory for test access. See `YouTubeSyncService.spec.ts` for the canonical pattern. |
| **External SDKs** (googleapis, nodemailer, etc.) | `jest.mock('googleapis', () => ({ ... }))` — fake the whole module.                                                                                                                              |
| **Encryption helpers**                           | `jest.mock('./YouTubeTokenEncryption', ...)` — stub `encryptToken`/`decryptToken` to return deterministic values.                                                                                |
| **Environment variables**                        | Set in `beforeEach`; restore or `delete` in `afterAll`.                                                                                                                                          |
| **HTTP**                                         | Use `supertest` for controller-level integration tests; pass the Express app directly without starting a server.                                                                                 |

## Backend-specific rules

- Use `async/await` with `expect(...).rejects.toThrow(...)` for error paths.
- Do **not** start a real server or connect to a real database.
- Do **not** call real third-party APIs.
- Do **not** use `window` / `document` / browser globals.
- Wrap Prisma mocks in inline factory functions — `jest.mock` is hoisted above imports.
- Security tests: assert that auth/permission guards reject unauthorized calls and that sensitive data (passwords, tokens) is never returned in plain text.

## Commands

```bash
yarn nx test backend
yarn nx test backend --coverage      # report: coverage/apps/backend/index.html
yarn nx lint backend
```
