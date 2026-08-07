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
