# Tech Stack

> **Single source of truth** for installed package versions and canonical technology choices.
> All agent instruction files and documentation must reference this file rather than declaring versions inline.
> Owned and kept current by the **DepSync** agent/skill — do not edit versions manually.
> Last synced from `package.json` on 2026-06-08.

---

## Runtime Environment

| Tool       | Version  | Notes                                               |
| ---------- | -------- | --------------------------------------------------- |
| Node.js    | ≥ 22.0.0 | Enforced via `engines` in `package.json`            |
| Yarn       | 4.13.0   | Package manager — pinned via `packageManager` field |
| TypeScript | 5.9.3    | Used across all apps and libraries                  |

---

## Frontend — Web App

### Framework

| Package     | Version | Purpose                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `next`      | 16.2.6  | App framework — App Router, server components, routing |
| `react`     | 19.2.3  | UI rendering                                           |
| `react-dom` | 19.2.3  | DOM renderer for React                                 |

### UI Primitives

| Package                         | Version | Purpose                                    |
| ------------------------------- | ------- | ------------------------------------------ |
| `@radix-ui/react-avatar`        | 1.1.11  | Accessible avatar component primitive      |
| `@radix-ui/react-checkbox`      | 1.3.3   | Accessible checkbox primitive              |
| `@radix-ui/react-collapsible`   | 1.1.12  | Accessible collapsible/accordion primitive |
| `@radix-ui/react-dialog`        | 1.1.15  | Accessible modal dialog primitive          |
| `@radix-ui/react-dropdown-menu` | 2.1.16  | Accessible dropdown menu primitive         |
| `@radix-ui/react-label`         | 2.1.8   | Accessible label primitive                 |
| `@radix-ui/react-popover`       | 1.1.15  | Accessible popover primitive               |
| `@radix-ui/react-select`        | 2.2.6   | Accessible select primitive                |
| `@radix-ui/react-separator`     | 1.1.8   | Accessible separator primitive             |
| `@radix-ui/react-slot`          | 1.2.4   | Render delegation (`asChild` pattern)      |
| `@radix-ui/react-toast`         | 1.2.15  | Accessible toast notification primitive    |
| `@radix-ui/react-tooltip`       | 1.2.8   | Accessible tooltip primitive               |
| `cmdk`                          | 1.1.1   | Command palette component                  |
| `lucide-react`                  | 0.562.0 | Icon library                               |
| `react-day-picker`              | 9.13.0  | Date picker component                      |
| `@tanstack/react-table`         | 8.21.3  | Headless table logic                       |

### Styling

| Package                    | Version | Purpose                                                                |
| -------------------------- | ------- | ---------------------------------------------------------------------- |
| `tailwindcss`              | 4.1.18  | Utility-first CSS framework                                            |
| `@tailwindcss/postcss`     | 4.1.18  | PostCSS integration for Tailwind 4                                     |
| `class-variance-authority` | 0.7.1   | Component variant system (CVA) — used in all `libs/web-ui/` components |
| `tailwind-merge`           | 3.4.0   | Merges conflicting Tailwind classes at runtime                         |
| `tailwindcss-animate`      | 1.0.7   | Animation utilities for Tailwind                                       |
| `postcss`                  | 8.5.6   | CSS transformation pipeline                                            |
| `autoprefixer`             | 10.4.23 | Adds vendor prefixes via PostCSS                                       |

### Design Tokens

| Package            | Version | Purpose                                                            |
| ------------------ | ------- | ------------------------------------------------------------------ |
| `style-dictionary` | ^4      | Transforms design token definitions into platform-specific outputs |

### Forms & Validation

| Package               | Version | Purpose                                           |
| --------------------- | ------- | ------------------------------------------------- |
| `react-hook-form`     | 7.71.1  | Form state management                             |
| `@hookform/resolvers` | 5.2.2   | Adapter connecting React Hook Form to Zod schemas |
| `zod`                 | 4.3.5   | Schema declaration and runtime validation         |

### Date Utilities

| Package    | Version | Purpose                          |
| ---------- | ------- | -------------------------------- |
| `date-fns` | 4.1.0   | Date formatting and manipulation |

### HTTP Client

| Package | Version | Purpose                                      |
| ------- | ------- | -------------------------------------------- |
| `axios` | 1.16.0  | HTTP client used by the generated API client |

---

## Backend — API Server

### Framework & Middleware

| Package              | Version | Purpose                               |
| -------------------- | ------- | ------------------------------------- |
| `express`            | 5.2.1   | HTTP server framework                 |
| `body-parser`        | 2.2.2   | Request body parsing                  |
| `compression`        | 1.8.1   | Response compression                  |
| `cookie-parser`      | 1.4.7   | Cookie parsing middleware             |
| `cors`               | 2.8.5   | Cross-origin resource sharing headers |
| `express-rate-limit` | 8.3.2   | Request rate limiting                 |
| `express-session`    | 1.18.2  | Session management                    |
| `helmet`             | 8.1.0   | HTTP security headers                 |

### Authentication

| Package          | Version | Purpose                                 |
| ---------------- | ------- | --------------------------------------- |
| `passport`       | 0.7.0   | Authentication middleware               |
| `passport-jwt`   | 4.0.1   | JWT strategy for Passport               |
| `passport-local` | 1.0.0   | Username/password strategy for Passport |
| `bcrypt`         | 6.0.0   | Password hashing                        |

### API Documentation & Client Generation

| Package                               | Version | Purpose                                                                   |
| ------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `tsoa`                                | 6.6.0   | Generates OpenAPI spec from TypeScript decorators                         |
| `swagger-jsdoc`                       | 6.2.8   | Supplementary JSDoc-based OpenAPI annotations                             |
| `swagger-ui-express`                  | 5.0.1   | Serves the Swagger UI from Express                                        |
| `@openapitools/openapi-generator-cli` | 2.27.0  | Generates typed API client (`libs/app-api-client/`) from the OpenAPI spec |

### Logging

| Package   | Version | Purpose                        |
| --------- | ------- | ------------------------------ |
| `winston` | 3.19.0  | Structured application logging |

### Email

| Package      | Version | Purpose        |
| ------------ | ------- | -------------- |
| `nodemailer` | 8.0.5   | Email delivery |

### Google Integration

| Package      | Version | Purpose                                                |
| ------------ | ------- | ------------------------------------------------------ |
| `googleapis` | 171.4.0 | Google Drive API — used for cloud vault backup feature |

### Utilities

| Package            | Version | Purpose                                          |
| ------------------ | ------- | ------------------------------------------------ |
| `dotenv`           | 17.2.3  | Loads environment variables from `.env` files    |
| `reflect-metadata` | 0.2.2   | Decorator metadata — required by tsoa            |
| `archiver`         | 7.0.1   | File archiving — used for vault export packaging |

---

## Database

| Package              | Version | Purpose                                       |
| -------------------- | ------- | --------------------------------------------- |
| `@prisma/client`     | 7.2.0   | Generated Prisma ORM client                   |
| `prisma`             | 7.2.0   | Prisma CLI — schema management and migrations |
| `@prisma/adapter-pg` | 7.2.0   | PostgreSQL adapter for Prisma                 |

---

## Monorepo

| Package                      | Version | Purpose                                                             |
| ---------------------------- | ------- | ------------------------------------------------------------------- |
| `nx`                         | 22.3.3  | Monorepo build system and task orchestration                        |
| `@nx/next`                   | 22.3.3  | Nx plugin for Next.js                                               |
| `@nx/react`                  | 22.3.3  | Nx plugin for React libraries                                       |
| `@nx/express`                | 22.3.3  | Nx plugin for Express                                               |
| `@nx/node`                   | 22.3.3  | Nx plugin for Node.js                                               |
| `@nx/js`                     | 22.3.3  | Nx plugin for plain TypeScript libraries                            |
| `@nx/webpack`                | 22.3.3  | Nx plugin for Webpack builds                                        |
| `@nx/web`                    | 22.3.3  | Nx plugin for web applications                                      |
| `@nx/eslint`                 | 22.3.3  | Nx plugin for ESLint integration                                    |
| `@nx/playwright`             | 22.3.3  | Nx plugin for Playwright                                            |
| `@nx/storybook`              | 22.3.3  | Nx plugin for Storybook                                             |
| `@nx/vite`                   | 22.3.3  | Nx plugin for Vite (used by Storybook)                              |
| `@nx/vitest`                 | 22.3.3  | Nx plugin for Vitest (available but Jest is the active test runner) |
| `@driimus/nx-plugin-openapi` | 3.1.2   | Nx plugin for OpenAPI code generation tasks                         |

---

## Testing

| Package                  | Version | Purpose                                              |
| ------------------------ | ------- | ---------------------------------------------------- |
| `jest`                   | 30.2.0  | Unit and integration test runner — canonical choice  |
| `@nx/jest`               | 22.3.3  | Nx/Jest integration                                  |
| `jest-environment-jsdom` | 30.2.0  | DOM environment for React component tests            |
| `jest-environment-node`  | 30.2.0  | Node environment for backend tests                   |
| `ts-jest`                | 29.4.9  | TypeScript preprocessor for Jest                     |
| `babel-jest`             | 30.2.0  | Babel transform for Jest                             |
| `@testing-library/react` | 16.3.1  | React component testing utilities                    |
| `@testing-library/dom`   | 10.4.1  | DOM testing utilities                                |
| `@playwright/test`       | 1.57.0  | End-to-end test runner                               |
| `supertest`              | 7.2.2   | HTTP assertion library for Express integration tests |

> **Note**: `@nx/vitest` is installed as part of the Nx plugin suite but Vitest is not in active use. Jest is the canonical test runner.

---

## Storybook & Visual Testing

| Package                  | Version | Purpose                                         |
| ------------------------ | ------- | ----------------------------------------------- |
| `storybook`              | 8.6.17  | UI component development environment            |
| `@storybook/react`       | 8.6.17  | React renderer for Storybook                    |
| `@storybook/react-vite`  | 8.6.17  | Vite-based bundler for Storybook                |
| `@storybook/core-server` | 8.6.17  | Storybook server core                           |
| `@storybook/test`        | 8.6.17  | Storybook testing utilities (interaction tests) |
| `@storybook/test-runner` | 0.23.0  | Runs Storybook stories as tests via Playwright  |
| `chromatic`              | 13.3.5  | Visual regression testing and Storybook hosting |
| `vite`                   | 6.4.2   | Build tool — used exclusively by Storybook      |

---

## Build & Transpilation

| Package               | Version | Purpose                                                    |
| --------------------- | ------- | ---------------------------------------------------------- |
| `@swc/core`           | 1.15.8  | SWC transpiler — faster alternative to Babel for Nx builds |
| `@swc-node/register`  | 1.11.1  | SWC integration for Node.js require hooks                  |
| `@swc/helpers`        | 0.5.18  | SWC runtime helpers                                        |
| `@babel/core`         | 7.28.6  | Babel — used by babel-jest for test transforms             |
| `@babel/preset-react` | 7.28.5  | Babel React preset for test transforms                     |
| `webpack-cli`         | 6.0.1   | Webpack CLI — used by `@nx/webpack` builds                 |

---

## Code Quality

| Package                        | Version | Purpose                                           |
| ------------------------------ | ------- | ------------------------------------------------- |
| `eslint`                       | 9.39.2  | Linter                                            |
| `typescript-eslint`            | 8.53.0  | TypeScript-aware ESLint rules                     |
| `eslint-config-next`           | 16.1.2  | Next.js ESLint config                             |
| `eslint-config-prettier`       | 10.1.8  | Disables ESLint rules that conflict with Prettier |
| `eslint-plugin-import`         | 2.32.0  | Import order and resolution rules                 |
| `eslint-plugin-jsx-a11y`       | 6.10.2  | Accessibility linting for JSX                     |
| `eslint-plugin-react`          | 7.37.5  | React-specific ESLint rules                       |
| `eslint-plugin-react-hooks`    | 7.0.1   | Enforces Rules of Hooks                           |
| `eslint-plugin-unused-imports` | 4.3.0   | Detects and removes unused imports                |
| `prettier`                     | 3.8.0   | Code formatter                                    |
| `husky`                        | 9.1.7   | Git hooks — runs lint and format checks on commit |

---

## AI Orchestration

| Package               | Version | Purpose                                                                      |
| --------------------- | ------- | ---------------------------------------------------------------------------- |
| `@ai-hero/sandcastle` | 0.7.0   | Runs Claude Code agents in Docker sandboxes — used by `yarn dispatch-agents` |
