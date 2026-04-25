# Web UI Agent Guide

## Scope

Shared React component library styled with Tailwind and developed with Storybook.

## Commands

- Test: `yarn nx test web-ui`.
- Storybook: `yarn storybook`.
- Build Storybook: `yarn build-storybook`.

## Do

- Use accessible Radix-based patterns and existing component conventions.
- Add or update `.stories.tsx` files for reusable visual components.
- Export public components from `src/index.ts`.

## Do Not

- Do not put page-specific business logic in shared UI primitives.
- Do not create inaccessible custom controls when Radix or existing components fit.
