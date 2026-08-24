# Testing `libs/web-ui`

Jest unit/integration · `babel-jest` + `jsdom` env (React) · `yarn nx test web-ui`

## Config summary

```ts
transform: { '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }] }
moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx']
// jsdom environment
```

## File naming

```
libs/web-ui/src/lib/<Component>.spec.tsx
```

Storybook configuration under `libs/web-ui/.storybook/` is covered by colocated `*.test.ts` files:

```
libs/web-ui/.storybook/<module>.test.ts
```

These are plain Node-environment unit tests for the pure helpers the Storybook config depends on — they must not import React, a story, or `@storybook/test-runner` itself. They are picked up by the Nx preset `testMatch` and declared in `libs/web-ui/tsconfig.spec.json`.

## Patterns

- Use **React Testing Library** (`@testing-library/react`).
- Prefer `getByRole`, `getByLabel`, `getByText` over `querySelector`.
- Test user interactions via `userEvent` or `fireEvent`.
- Do not test implementation internals — test observable output.

```ts
import { render, screen, fireEvent } from '@testing-library/react';
```

## Commands

```bash
yarn nx test web-ui
yarn nx lint web-ui
```
