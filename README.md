<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/myorganizer/public/images/logo-shield-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="apps/myorganizer/public/images/logo-shield.svg" />
    <img src="apps/myorganizer/public/images/logo-shield.svg" alt="MyOrganizer logo" width="220" />
  </picture>
</p>

<h1 align="center">MyOrganizer</h1>

<p align="center">
  A full-stack, privacy-first personal organizer with end-to-end encrypted storage.
</p>

<p align="center">
  <a href="https://myorganizer-seven.vercel.app" target="_blank"><strong>Live Demo →</strong></a>
  &nbsp;·&nbsp;
  <a href="DEVELOPMENT.md">Developer Guide</a>
  &nbsp;·&nbsp;
  <a href="docs/features/README.md">Feature Docs</a>
</p>

<p align="center">
  <a href="https://github.com/mnaimfaizy/myorganizer/actions/workflows/ci.yml">
    <img src="https://github.com/mnaimfaizy/myorganizer/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://myorganizer-seven.vercel.app">
    <img src="https://img.shields.io/badge/demo-live-brightgreen?logo=vercel" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?logo=node.js" alt="Node >=22" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/yarn-4.x-2C8EBB?logo=yarn" alt="Yarn 4" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Frontend Architecture](#frontend-architecture)
- [E2E Encrypted Vault](#e2e-encrypted-vault)
- [Production Checklist](#production-checklist)
- [Documentation](#documentation)

---

## Overview

MyOrganizer is a full-stack personal organizer built as an **Nx monorepo**. It lets you securely manage your todos, addresses, phone numbers, subscriptions, and YouTube watchlist — with sensitive data protected by a client-side end-to-end encrypted vault (the server only ever stores ciphertext).

The application is deployed at **[myorganizer-seven.vercel.app](https://myorganizer-seven.vercel.app)** (frontend on Vercel, backend on cPanel/VPS).

---

## Features

| Area                 | Details                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Authentication**   | JWT access + refresh tokens, email verification, password reset, session management  |
| **E2EE Vault**       | Client-side AES-GCM encryption — todos, addresses, mobile numbers, subscriptions     |
| **Vault Backup**     | Export/import vault blob; optional Google Drive cloud backup (browser-side GIS flow) |
| **Subscriptions**    | Track recurring subscriptions with currency + country preferences                    |
| **YouTube**          | OAuth server-side sync of YouTube subscriptions and cached video feed                |
| **Account Settings** | Preferred country + currency stored server-side for vault-backed views               |
| **UI Library**       | Storybook-driven Radix UI component library with design tokens                       |
| **API Docs**         | Auto-generated Swagger/OpenAPI via TSOA, viewable at `/docs`                         |

---

## Technology Stack

### Frontend

| Technology                                                                       | Purpose                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| [Next.js 16](https://nextjs.org) (App Router)                                    | React framework — SSR, routing, metadata |
| [React 19](https://react.dev)                                                    | UI rendering                             |
| [TypeScript](https://www.typescriptlang.org)                                     | Type safety across the stack             |
| [Tailwind CSS](https://tailwindcss.com)                                          | Utility-first styling                    |
| [Radix UI](https://www.radix-ui.com)                                             | Accessible headless component primitives |
| [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev)          | Form management and validation           |
| [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) | Client-side AES-GCM vault encryption     |

### Backend

| Technology                                           | Purpose                                      |
| ---------------------------------------------------- | -------------------------------------------- |
| [Express.js](https://expressjs.com)                  | REST API framework                           |
| [TypeScript](https://www.typescriptlang.org)         | Typed server-side code                       |
| [TSOA](https://tsoa-community.github.io/docs/)       | Decorator-based routing + OpenAPI generation |
| [Prisma](https://www.prisma.io)                      | Type-safe ORM and migrations                 |
| [PostgreSQL](https://www.postgresql.org)             | Relational database                          |
| [Passport.js](https://www.passportjs.org)            | Authentication (local + JWT strategies)      |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing                             |
| [Winston](https://github.com/winstonjs/winston)      | Structured logging                           |
| [Nodemailer](https://nodemailer.com)                 | Transactional email                          |
| [Zod](https://zod.dev)                               | Runtime schema validation                    |
| [Helmet.js](https://helmetjs.github.io)              | HTTP security headers                        |

### Monorepo & Tooling

| Technology                                                     | Purpose                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [Nx](https://nx.dev)                                           | Monorepo build system, task orchestration, affected detection |
| [Yarn 4](https://yarnpkg.com) (Corepack)                       | Package manager                                               |
| [Node.js 22](https://nodejs.org)                               | JavaScript runtime                                            |
| [Jest](https://jestjs.io)                                      | Unit testing                                                  |
| [Playwright](https://playwright.dev)                           | End-to-end testing                                            |
| [Storybook](https://storybook.js.org)                          | UI component development and documentation                    |
| [Docker](https://www.docker.com)                               | Local PostgreSQL and MailHog services                         |
| [ESLint](https://eslint.org) + [Prettier](https://prettier.io) | Code linting and formatting                                   |

---

## Project Structure

```
myorganizer/
├── apps/
│   ├── backend/          # Express.js REST API (TypeScript, TSOA, Prisma)
│   ├── myorganizer/      # Next.js 16 frontend (App Router)
│   └── myorganizer-e2e/  # Playwright end-to-end tests
├── libs/
│   ├── api-specs/        # OpenAPI spec source of truth
│   ├── app-api-client/   # Auto-generated API client (do not edit manually)
│   ├── auth/             # Shared auth helpers (JWT, session)
│   ├── core/             # Shared utilities and types
│   ├── design-tokens/    # W3C DTCG design tokens → CSS + TypeScript + Tailwind
│   ├── vault-core/       # Encryption primitives (AES-GCM, WebCrypto)
│   ├── web/
│   │   └── pages/        # One Nx library per route (e.g. todos, subscriptions)
│   ├── web-ui/           # Shared Radix UI component library
│   ├── web-vault/        # Browser vault state and sync logic
│   └── web-vault-ui/     # Vault-specific UI components
├── docs/                 # Architecture and feature documentation
├── openspec/             # Spec-driven change proposals
└── tools/                # Build and release scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **Yarn** ≥ 4 (via [Corepack](https://nodejs.org/api/corepack.html))
- **Docker** (for local Postgres + MailHog)

Enable Corepack if not already done:

```sh
corepack enable
```

### Installation

1. **Clone the repository**

   ```sh
   git clone https://github.com/mnaimfaizy/myorganizer.git
   cd myorganizer
   ```

2. **Copy the environment file**

   ```sh
   cp .env.example .env
   ```

   Edit `.env` and fill in your local values (database credentials, JWT secrets, etc.).

3. **Install dependencies**

   ```sh
   corepack yarn install --immutable
   ```

4. **Start local services** (Postgres + MailHog)

   ```sh
   docker-compose up -d
   ```

5. **Run database migrations**

   ```sh
   yarn nx run backend:migrate
   ```

6. **Start the applications** (separate terminals)

   ```sh
   yarn start:backend       # http://localhost:3000
   yarn start:myorganizer   # http://localhost:4200
   ```

   API docs are available at **http://localhost:3000/docs** once the backend is running.

---

## Available Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `yarn start:backend`     | Start backend in development mode            |
| `yarn start:myorganizer` | Start frontend in development mode           |
| `yarn build:backend`     | Production build of the backend              |
| `yarn build:myorganizer` | Production build of the frontend             |
| `yarn nx test <project>` | Run unit tests for a project                 |
| `yarn nx lint <project>` | Lint a project                               |
| `yarn format:write`      | Format all files with Prettier               |
| `yarn storybook`         | Launch Storybook on http://localhost:6006    |
| `yarn api-docs:generate` | Regenerate OpenAPI spec from TSOA decorators |
| `yarn api:generate`      | Regenerate the API client from the spec      |
| `yarn openapi:check`     | Check for drift between spec and client      |
| `yarn nx dep-graph`      | Visualize the project dependency graph       |

---

## Frontend Architecture

This repo enforces a strict **thin-wrapper** pattern for the Next.js App Router:

- `apps/myorganizer/src/app/**` — route wrappers only (routing, metadata, layout composition).
- `libs/web/pages/<route>/` — all page logic, imported via `@myorganizer/web-pages/<route>`.
- `libs/**` — all shared cross-cutting code (vault, UI components, auth helpers).

Never put feature logic or shared helpers inside `apps/myorganizer/src/lib/**`.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full architecture guide.

---

## E2E Encrypted Vault

MyOrganizer stores sensitive personal data in a **client-side encrypted vault** using the browser's native WebCrypto API (AES-256-GCM). The server receives and stores only opaque ciphertext — plaintext never leaves the browser.

**Vault-backed features:**

| Route                       | Data                       |
| --------------------------- | -------------------------- |
| `/dashboard/todo`           | Todos                      |
| `/dashboard/addresses`      | Addresses                  |
| `/dashboard/mobile-numbers` | Mobile phone numbers       |
| `/dashboard/subscriptions`  | Recurring subscriptions    |
| `/dashboard/vault-export`   | Full vault export / import |

**Optional cloud backup:** The vault blob can be backed up to your personal Google Drive using the browser-side Google Identity Services (GIS) flow. See [vault-cloud-backup-google-drive.md](docs/features/vault-cloud-backup-google-drive.md).

---

## Production Checklist

Before deploying, ensure these environment variables are set in your hosting provider (do **not** commit them to git):

| Variable                   | Notes                                                |
| -------------------------- | ---------------------------------------------------- |
| `NODE_ENV`                 | Set to `production`                                  |
| `SESSION_SECRET`           | Strong random string                                 |
| `ACCESS_JWT_SECRET`        | Strong random string                                 |
| `REFRESH_JWT_SECRET`       | Strong random string                                 |
| `VERIFY_JWT_SECRET`        | Strong random string                                 |
| `RESET_JWT_SECRET`         | Strong random string                                 |
| `DATABASE_URL`             | PostgreSQL connection string                         |
| `CORS_ORIGINS`             | Comma-separated allowed origins, no trailing slashes |
| `TRUST_PROXY`              | Set when behind a reverse proxy or load balancer     |
| `ENABLE_GLOBAL_RATE_LIMIT` | `true` to enable API rate limiting                   |

See [`.env.example`](.env.example) for the full list and [apps/backend/README.md](apps/backend/README.md) for deployment notes.

---

## Documentation

| Document                                                                                             | Description                                              |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                                                     | Complete developer guide — setup, workflow, architecture |
| [apps/backend/README.md](apps/backend/README.md)                                                     | Backend API reference and deployment                     |
| [docs/authentication/README.md](docs/authentication/README.md)                                       | JWT + session auth strategy                              |
| [docs/storybook/README.md](docs/storybook/README.md)                                                 | Storybook and Chromatic setup                            |
| [docs/features/README.md](docs/features/README.md)                                                   | Feature integration index                                |
| [docs/features/vault-cloud-backup-google-drive.md](docs/features/vault-cloud-backup-google-drive.md) | Google Drive vault backup                                |
| [docs/features/google-youtube-oauth-setup.md](docs/features/google-youtube-oauth-setup.md)           | Google / YouTube OAuth setup                             |
| [docs/features/youtube-integration.md](docs/features/youtube-integration.md)                         | YouTube subscription sync architecture                   |
| [libs/design-tokens/DESIGN.md](libs/design-tokens/DESIGN.md)                                         | Design system and token reference                        |

---

<p align="center">
  <a href="https://nx.dev" target="_blank" rel="noreferrer">
    <img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="32" alt="Nx" />
  </a>
  &nbsp; Built with <a href="https://nx.dev">Nx</a> · Licensed under <a href="LICENSE">MIT</a>
</p>
