# GitHub Copilot Instructions for MyOrganizer

This file provides custom instructions for GitHub Copilot when working on the MyOrganizer monorepo.

## Project Overview

MyOrganizer is a full-stack web application built as an Nx monorepo with:

- **Frontend**: Next.js 14 with React 18, TypeScript, and Tailwind CSS
- **Backend**: Express.js REST API with TypeScript, Prisma ORM, and TSOA
- **Shared Libraries**: Reusable components, utilities, and auto-generated API clients
- **Development Tools**: Storybook for UI development, Docker for local services

## Code Style and Formatting

### General

- Use **TypeScript** for all new code
- Use **single quotes** for strings (Prettier config)
- Follow existing code patterns and conventions
- Use **ES6+ features** (async/await, arrow functions, destructuring)
- Target **ES2015** (configured in tsconfig)

### Naming Conventions

- Use **PascalCase** for classes, interfaces, types, and React components
- Use **camelCase** for variables, functions, and methods
- Use **UPPER_SNAKE_CASE** for constants and environment variables
- Prefix interfaces with `I` only when necessary for clarity

### Import Organization

- Remove unused imports automatically (enforced by ESLint)
- Group imports: external packages first, then internal modules
- Use path aliases from `tsconfig.base.json`:
  - `@myorganizer/api-specs`
  - `@myorganizer/app-api-client`
  - `@myorganizer/auth`
  - `@myorganizer/core`
  - `@myorganizer/web-ui`
  - `@myorganizer/web-pages/*` (one per route/page library, e.g. `@myorganizer/web-pages/todos`)
  - `@myorganizer/web-vault`
  - `@myorganizer/web-vault-ui`

### Comments

- Write clear, concise comments for complex logic
- Use JSDoc comments for public APIs and exported functions
- Avoid obvious comments that just restate the code

## Architecture and Patterns

### Monorepo Structure

- **apps/**: Applications (backend, frontend, e2e tests)
- **libs/**: Shared libraries organized by domain
- Follow Nx module boundaries (enforced by ESLint)
- Keep libraries focused and single-purpose

### Backend (Express.js + Prisma)

- Use **TSOA decorators** for API endpoints and documentation
- Controllers in `apps/backend/src/controllers/`
- Services in `apps/backend/src/services/`
- Middleware in `apps/backend/src/middleware/`
- Follow **repository pattern** for data access
- Use Prisma for all database operations
- Router prefix: `/api/v1` (configurable via `ROUTER_PREFIX`)

### Frontend (Next.js)

- Use **App Router** (Next.js 14)
- Server components by default, client components when needed
- Use `'use client'` directive only when necessary (interactivity, hooks)
- Route wrappers live in `apps/myorganizer/src/app/`
- **Thin wrapper rule**: files under `apps/myorganizer/src/app/**` must stay minimal (routing + metadata + composition) and delegate page logic to Nx libraries
- Page implementations live in `libs/web/pages/<route>/` and are imported via `@myorganizer/web-pages/<route>`
- Shared UI components in `libs/web-ui/`
- Use **React Hook Form** with **Zod** for form validation
- Use **Radix UI** components as the base for custom components

Common dashboard page libraries:

- `@myorganizer/web-pages/account` (preferred country/currency settings)
- `@myorganizer/web-pages/subscriptions` (vault-backed subscriptions)

#### Adding a new frontend page

- Create a new page library under `libs/web/pages/<route>/` (React library, Jest enabled)
- Ensure it has an import path of `@myorganizer/web-pages/<route>` (so app wrappers can import it cleanly)
- Add a thin route wrapper at `apps/myorganizer/src/app/<route>/page.tsx` that exports/uses the page from the library
- Do not create shared helpers under the app (avoid `apps/myorganizer/src/lib/**`); shared code must go in `libs/**`

### API Client

- Use the **auto-generated API client** from `@myorganizer/app-api-client`
- Never manually write API calls if the client exists
- Regenerate client after backend API changes: `yarn api:generate`

When consuming the generated client:

- Avoid depending on brittle, versioned type aliases that can change during regeneration.
- Prefer local minimal response types for UI needs, or derive types from the client method return type.

### Database

- Prisma schemas in `apps/backend/src/prisma/schema/`
- Prefer Nx targets for Prisma workflows: `yarn nx run backend:generate-types` and `yarn nx run backend:migrate`
- If running Prisma manually, run from `apps/backend/src` and include schema path:
  - `npx prisma generate --schema prisma/schema`
  - `npx prisma migrate dev --schema prisma/schema --name description`
- Never edit migration files manually

## Testing

### Jest Unit and Integration Tests

- Write tests alongside source files with `.spec.ts` or `.test.ts` extensions
- Use **Jest** for unit and local integration testing
- Test files should mirror the structure of source files
- Mock external dependencies
- Aim for meaningful test coverage, not just high percentages
- When a task requires creating or changing Jest unit or integration tests, route through `.github/skills/unit-test-delegation-workflow/SKILL.md` and delegate implementation to `TestScaffold`.
- Test delegation briefs must include a behavior matrix from reading the actual implementation, plus explicit in-scope and out-of-scope scenarios. Do not ask for vague "comprehensive tests".
- Review TestScaffold output for behavior correctness, side effects, reachable failure paths, boundaries, security-sensitive behavior, deterministic mocks, duplicate generated content, and validation results. Use `docs/testing/README.md` for per-project tooling, integration scope, environments, and mock patterns.
- When a task requires creating or changing Storybook stories (`*.stories.tsx`), route through `.github/skills/storybook-delegation-workflow/SKILL.md` and delegate implementation to `StorybookCurator`; require requirement-readiness analysis first, then review for UX/a11y coverage, scenario completeness, and clarification gaps before finalizing.

### E2E Tests

- Use **Playwright** for end-to-end testing
- E2E tests in `apps/myorganizer-e2e/`
- Test critical user flows and happy paths
- Build a flow matrix before creating or changing specs: route, preconditions, user steps, selectors, network/data expectations, side effects, and unsupported behavior to avoid.
- Use `.github/skills/playwright-e2e-workflow/SKILL.md`; use `E2EPlanner` for broad flows and delegate implementation to `TestScaffold` only with a precise E2E brief.
- Run E2E tests before merging significant features

### Test Naming

- Use descriptive test names: `it('should create a user with valid credentials', ...)`
- Group related tests with `describe()` blocks
- Use `beforeEach()` for test setup

## Design & Planning

### Grilling Sessions with Documentation

When designing new features or making architectural decisions, use the **grill-with-docs** skill (`.github/skills/grill-with-docs/SKILL.md`) to:

- Stress-test plans against the project's existing domain model and terminology
- Sharpen fuzzy language and resolve ambiguous concepts
- Challenge assumptions through concrete scenario discussions
- Create or update `CONTEXT.md` to document domain language and glossary
- Create Architecture Decision Records (ADRs) in `docs/adr/` for major decisions

**When to use:**
- You have a plan and want to validate it against MyOrganizer's language and architecture
- You're designing a new feature that introduces new domain terms or concepts
- You want to capture why architectural decisions were made

**Key artifacts:**
- `CONTEXT.md` — Single source of truth for domain language (what terms mean, what to avoid)
- `docs/adr/` — Records of hard-to-reverse decisions with trade-off context

See `.github/skills/grill-with-docs/` for templates and detailed guidance.

## Security Best Practices

### Environment Variables

- Never commit secrets to source code
- Use `.env` for local development (copy from `.env.example`)
- Validate required environment variables at startup
- Use different secrets for each environment (dev/staging/prod)

### Authentication

- JWT-based authentication (access + refresh tokens)
- Session management with `express-session`
- Passport.js for auth strategies
- See `docs/authentication/README.md` for details

### API Security

- Use **Helmet.js** for security headers
- Enable **CORS** with explicit origins (no `*` in production)
- Implement **rate limiting** for sensitive endpoints
- Validate all user inputs with Zod or class-validator
- Sanitize outputs to prevent XSS

### Database Security

- Use **parameterized queries** (Prisma handles this)
- Never construct raw SQL with string concatenation
- Hash passwords with **bcrypt** (never store plain text)
- Use database transactions for multi-step operations

### Vault-backed features (E2EE)

- The server stores **ciphertext only**; plaintext must never leave the client.
- Adding a new vault blob type requires updates across `libs/web-vault`, `libs/vault-core`, backend vault allowlists/validation, and vault export/import + migration.
- Current blob types include: `addresses`, `mobileNumbers`, `subscriptions`, `todos`.
- Todos are **vault-backed** (encrypted blob type `todos`); do not add or resurrect plaintext Todo REST endpoints or a Prisma `Todo` model/table.

## Common Patterns

### Error Handling

- Use **try-catch** blocks for async operations
- Return appropriate HTTP status codes
- Log errors with Winston logger
- Don't expose internal errors to clients in production

### Validation

- Use **Zod** for runtime validation
- Validate at API boundaries (controllers)
- Use TSOA's `@ValidateError` for consistent error responses

### Async/Await

- Always use `async/await` instead of `.then()` chains
- Handle errors with try-catch
- Don't mix callbacks and promises

### React Components

- Prefer **functional components** over class components
- Use hooks for state and side effects
- Extract reusable logic into custom hooks
- Keep components small and focused

### Styling

- Use **Tailwind CSS** utility classes
- Use `clsx` or `cn` helper for conditional classes
- Use `class-variance-authority` for component variants
- Follow mobile-first responsive design

## Build and Development

### Running the Application

- Backend: `yarn start:backend` (runs on http://localhost:3000)
- Frontend: `yarn start:myorganizer` (runs on http://localhost:4200)
- Storybook: `yarn storybook` (runs on http://localhost:6006)
- Docker services: `docker-compose up -d`

### Build Commands

- Build backend: `yarn build:backend`
- Build frontend: `yarn build:myorganizer`
- Build Storybook: `yarn build-storybook`
- Lint: `yarn nx lint`
- Format: `yarn format:write`
- Tests: `yarn nx test <project-name>`

### Code Quality

- Run `yarn format:write` before committing
- Fix linting issues: `yarn nx lint --fix`
- Ensure tests pass: `yarn nx test`
- Check TypeScript types (automatic during build)

### Commit And PR Workflows

- When the user asks to commit changes, use the repo-local commit workflow skill and the existing `Commit` sub-agent together:
  - The `Commit` sub-agent drafts the Conventional Commit message only.
  - The actual commit must run through `corepack yarn ai:commit`.
- The commit workflow must wait for `git commit` to finish. Do not cancel, background, or move on while Husky pre-commit checks are still running.
- If Husky fails because of linting, tests, formatting, or another validation issue, fix the reported problem first, rerun the narrow validation for that slice, and only then retry the commit.
- Commit-time Nx output should remain readable. The Husky hook uses static output for Nx task execution; preserve that behavior when editing the hook.
- When the user asks to open or create a PR, use `corepack yarn ai:create-pr` unless an IDE-native integration can satisfy the exact same behavior.
- PR creation should gather the commit history from the current branch, push upstream if needed, assign the authenticated GitHub user, keep reviewers empty unless the user explicitly names one, and return only success plus the PR link.

## API Development

### Adding New Endpoints

1. Define controller with TSOA decorators in `apps/backend/src/controllers/`
2. Implement service logic in `apps/backend/src/services/`
3. Generate API docs: `yarn api-docs:generate`
4. Sync OpenAPI spec: `yarn openapi:sync`
5. Regenerate API client: `yarn api:generate`

### API Documentation

- Use TSOA decorators for automatic Swagger generation
- Document request/response types with TypeScript interfaces
- Add descriptions to endpoints with `@Example` and `@Description`
- View docs at http://localhost:3000/docs

## Design Tokens

The single source of truth for colors, typography, spacing, radii, and shadows lives in `libs/design-tokens/src/tokens.json` (W3C DTCG format). Do **not** hard-code hex colors, font stacks, or magic spacing values in components.

- Edit `libs/design-tokens/src/tokens.json` to change any design value.
- Rebuild with `yarn nx run design-tokens:build-tokens` — this regenerates:
  - `src/generated/tokens.css` — CSS custom properties on `:root` (`--color-primary`, `--space-md`, etc.) imported by `apps/myorganizer/src/app/global.css`.
  - `src/generated/tokens.ts` — typed constants (`colorPrimary`, `colorPrimaryVar`) re-exported from `@myorganizer/design-tokens`.
  - `src/generated/tailwind-preset.js` — optional Tailwind preset using the CSS variables.
- Never edit anything under `src/generated/` — it is regenerated from `tokens.json`.
- Prefer importing TS constants from `@myorganizer/design-tokens` over inline literals.

## Commit Messages

## Common Anti-Patterns to Avoid

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Build process or auxiliary tool changes

Examples:

- `feat: add user profile settings page`
- `fix: resolve database connection timeout`
- `docs: update API documentation for auth endpoints`

## Common Anti-Patterns to Avoid

### Don't

- ❌ Use `any` type in TypeScript (use `unknown` or proper types)
- ❌ Ignore TypeScript errors with `@ts-ignore` without good reason
- ❌ Commit `node_modules`, `dist`, or generated files
- ❌ Use `console.log` for logging (use Winston logger)
- ❌ Store secrets in code or commit history
- ❌ Write tests that depend on external services (mock them)
- ❌ Create circular dependencies between modules
- ❌ Modify auto-generated code (like API client or Prisma client)
- ❌ Put shared logic in app-local folders (e.g. `apps/myorganizer/src/lib/**`); create or extend Nx libraries in `libs/**` instead
- ❌ Use `var` (use `const` or `let`)
- ❌ Mutate React state directly (use setState or hooks)

### Do

- ✅ Use strict TypeScript types
- ✅ Write meaningful tests
- ✅ Follow the Single Responsibility Principle
- ✅ Use environment variables for configuration
- ✅ Document complex logic
- ✅ Handle errors gracefully
- ✅ Use semantic HTML
- ✅ Make components accessible (ARIA attributes)
- ✅ Optimize for performance (lazy loading, memoization)
- ✅ Keep dependencies up to date

## Resources

For more detailed information, see:

- [DEVELOPMENT.md](../DEVELOPMENT.md) - Complete development guide
- [README.md](../README.md) - Project overview and quick start
- [apps/backend/README.md](../apps/backend/README.md) - Backend documentation
- [docs/authentication/README.md](../docs/authentication/README.md) - Authentication strategy
- [docs/storybook/README.md](../docs/storybook/README.md) - Storybook setup

## Questions or Improvements?

If you have suggestions for improving these instructions, please open an issue or submit a pull request.
