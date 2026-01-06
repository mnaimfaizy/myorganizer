# Development Guide - MyOrganizer Monorepo

This guide provides comprehensive documentation for developing in the MyOrganizer monorepo. Whether you're a new contributor or a seasoned developer, this guide will help you get started and navigate the development workflow.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Initial Setup](#initial-setup)
- [Starting Local Development Dependencies and Services](#starting-local-development-dependencies-and-services)
  - [Starting Dependencies (Docker)](#starting-dependencies-docker)
  - [Starting the Backend](#starting-the-backend)
  - [Starting the Frontend](#starting-the-frontend)
  - [Starting Storybook](#starting-storybook)
  - [Accessing Services](#accessing-services)
- [Monorepo Structure](#monorepo-structure)
  - [Apps](#apps)
  - [Libraries (libs)](#libraries-libs)
  - [Documentation](#documentation)
  - [Tools & Configuration](#tools--configuration)
- [Development Workflow](#development-workflow)
  - [Creating a Feature](#creating-a-feature)
  - [Working with the Database](#working-with-the-database)
  - [Working with APIs](#working-with-apis)
  - [Code Quality](#code-quality)
- [Creating Issues and Pull Requests](#creating-issues-and-pull-requests)
  - [Creating an Issue](#creating-an-issue)
  - [Creating a Pull Request](#creating-a-pull-request)
  - [PR Review Process](#pr-review-process)
- [Testing](#testing)
  - [Unit Testing](#unit-testing)
  - [E2E Testing](#e2e-testing)
  - [Test Coverage](#test-coverage)
- [Building for Production](#building-for-production)
  - [Building the Backend](#building-the-backend)
  - [Building the Frontend](#building-the-frontend)
- [Common Tasks](#common-tasks)
  - [Adding a New Library](#adding-a-new-library)
  - [Adding a New Application](#adding-a-new-application)
  - [Updating Dependencies](#updating-dependencies)
  - [Visualizing Dependencies](#visualizing-dependencies)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

## Overview

MyOrganizer is a full-stack web application built as an Nx monorepo. It consists of:

- **Frontend**: Next.js application with React and Tailwind CSS
- **Backend**: Express.js REST API with TypeScript, Prisma ORM
- **Shared Libraries**: Reusable components, utilities, and API clients
- **Development Tools**: Storybook for UI development, Docker for local services

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Yarn** (v1.22 or higher) - Install via `npm install -g yarn`
- **Git** - [Download](https://git-scm.com/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/get-started)
- **Code Editor** - We recommend [VS Code](https://code.visualstudio.com/) with the Nx Console extension

### Initial Setup

1. **Clone the Repository**

   ```bash
   git clone https://github.com/mnaimfaizy/myorganizer.git
   cd myorganizer
   ```

2. **Install Dependencies**

   ```bash
   yarn install
   ```

   This will install all dependencies for all applications and libraries in the monorepo.

3. **Set Up Environment Variables**

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file and configure the environment variables. Key variables include:

   ```env
   # Application
   APP_NAME="My Organizer"
   APP_FRONTEND_URL=http://localhost:4200

   # Server
   NODE_ENV=development
   PORT=3000
   ROUTER_PREFIX=/api/v1

   # Security - Generate secure random strings for production
   SESSION_SECRET=your-session-secret
   ACCESS_JWT_SECRET=your-access-secret
   REFRESH_JWT_SECRET=your-refresh-secret
   VERIFY_JWT_SECRET=your-verify-secret
   RESET_JWT_SECRET=your-reset-secret

   # Database
   DATABASE_USER=postgres
   DATABASE_PASSWORD=Admin@123
   DATABASE_NAME=myorganizer
   DATABASE_URL=postgresql://postgres:Admin%40123@localhost:5453/myorganizer

   # PgAdmin (for database management GUI)
   PGADMIN_DEFAULT_EMAIL=admin@myorganizer.com
   PGADMIN_DEFAULT_PASSWORD=Admin@123

   # CORS - Comma-separated list
   CORS_ORIGINS=http://localhost:3000,http://localhost:4200

   # Mail - SMTP Configuration
   MAIL_SERVICE=smtp
   DEFAULT_EMAIL_PROVIDER=smtp
   MAIL_HOST=localhost
   MAIL_PORT=1025
   MAIL_SECURE=false
   MAIL_USERNAME=
   MAIL_PASSWORD=
   EMAIL_SENDER=no-reply@myorganizer.local

   # Frontend
   API_BASE_URL=http://localhost:3000/api/v1
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
   ```

   **Note**: For production, generate secure random secrets using:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
   ```

4. **Start Docker Dependencies**

   ```bash
   docker-compose up -d
   ```

   This starts PostgreSQL, MailHog (email testing), and PgAdmin.

5. **Set Up the Database**

   ```bash
   cd apps/backend/src
   npx prisma generate
   npx prisma migrate dev
   cd ../../..
   ```

   This generates the Prisma client and runs database migrations.

6. **Verify Installation**

   ```bash
   nx graph
   ```

   This opens a visual representation of your project structure and dependencies.

## Starting Local Development Dependencies and Services

### Starting Dependencies (Docker)

The application uses Docker Compose to run local development dependencies:

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d myorganizer_db
docker-compose up -d mailhog

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (caution: deletes data)
docker-compose down -v
```

**Services included**:
- **PostgreSQL** (myorganizer_db): Database server on port 5453
- **MailHog**: Email testing server on ports 1025 (SMTP) and 8025 (Web UI)
- **PgAdmin**: Database GUI on port 8888

### Starting the Backend

```bash
# From the root directory
yarn start:backend

# Or using Nx directly
nx serve backend

# The backend API will be available at http://localhost:3000
```

The development server features:
- Hot reload on file changes
- Automatic TypeScript compilation
- API documentation at http://localhost:3000/docs

### Starting the Frontend

```bash
# From the root directory
yarn start:myorganizer

# Or using Nx directly
nx serve myorganizer

# The frontend will be available at http://localhost:4200
```

The development server features:
- Fast refresh for React components
- Hot module replacement
- Next.js development features

### Starting Both Backend and Frontend

For the best development experience, run these in separate terminal windows:

**Terminal 1 - Backend:**
```bash
yarn start:backend
```

**Terminal 2 - Frontend:**
```bash
yarn start:myorganizer
```

### Starting Storybook

Storybook allows you to develop and test UI components in isolation:

```bash
yarn storybook

# This will open Storybook at http://localhost:6006
```

For more information, see [docs/storybook/README.md](docs/storybook/README.md).

### Accessing Services

Once everything is running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:4200 | Main application |
| Backend API | http://localhost:3000/api/v1 | REST API |
| API Docs | http://localhost:3000/docs | Swagger UI documentation |
| Storybook | http://localhost:6006 | UI component library |
| MailHog | http://localhost:8025 | Email testing interface |
| PgAdmin | http://localhost:8888 | Database management |

**PgAdmin Credentials** (from .env):
- Email: admin@myorganizer.com
- Password: Admin@123

## Monorepo Structure

This project uses Nx, a powerful monorepo build system. Understanding the structure is key to effective development.

```
myorganizer/
├── apps/                    # Applications
│   ├── backend/            # Express.js API server
│   ├── myorganizer/        # Next.js frontend
│   └── myorganizer-e2e/    # E2E tests for frontend
├── libs/                    # Shared libraries
│   ├── api-specs/          # OpenAPI specifications
│   ├── app-api-client/     # Generated API client
│   ├── auth/               # Authentication utilities
│   ├── core/               # Core utilities
│   └── web-ui/             # Shared UI components
├── docs/                    # Documentation
│   ├── authentication/     # Auth strategy docs
│   ├── backend/            # Backend docs
│   ├── deployment/         # Deployment guides
│   ├── internal/           # Internal planning docs
│   └── storybook/          # Storybook setup docs
├── tools/                   # Build and deployment scripts
├── .github/                 # GitHub workflows and templates
├── docker-compose.yml       # Local development services
├── nx.json                  # Nx workspace configuration
├── package.json             # Root package.json with scripts
├── tsconfig.base.json       # Base TypeScript configuration
└── README.md                # Main README
```

### Apps

#### Backend (`apps/backend`)
- Express.js REST API with TypeScript
- Prisma ORM for database operations
- TSOA for API documentation
- Passport.js for authentication
- See [apps/backend/README.md](apps/backend/README.md) for detailed documentation

#### Frontend (`apps/myorganizer`)
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Radix UI components
- React Hook Form for form handling

#### E2E Tests (`apps/myorganizer-e2e`)
- Playwright for end-to-end testing
- Tests for critical user flows

### Libraries (libs)

#### api-specs
- OpenAPI/Swagger specifications
- Source of truth for API contracts

#### app-api-client
- Auto-generated TypeScript API client
- Type-safe API calls for the frontend

#### auth
- Authentication utilities
- Token management
- Session handling

#### core
- Common utilities
- Shared types and interfaces

#### web-ui
- Shared React components
- UI library built with Storybook
- Reusable across applications

### Documentation

- `docs/authentication/` - JWT strategy and authentication flow
- `docs/backend/` - Backend-specific documentation
- `docs/storybook/` - Storybook and Chromatic setup
- `docs/deployment/` - Deployment guides for different platforms
- `docs/internal/` - Internal planning and architecture documents

### Tools & Configuration

- `.github/workflows/` - CI/CD pipelines
- `tools/scripts/` - Build and deployment scripts
- `eslint.config.js` - ESLint configuration
- `jest.config.ts` - Jest testing configuration
- `.prettierrc` - Code formatting rules
- `nx.json` - Nx workspace configuration

## Development Workflow

### Creating a Feature

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

   Branch naming conventions:
   - `feature/` - New features
   - `fix/` - Bug fixes
   - `docs/` - Documentation updates
   - `refactor/` - Code refactoring
   - `test/` - Test additions/updates

2. **Make Your Changes**

   - Follow the existing code style
   - Write tests for new features
   - Update documentation as needed

3. **Run Code Quality Checks**

   ```bash
   # Format code
   yarn format:write

   # Lint code
   nx lint

   # Run tests
   nx test
   ```

4. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Test updates
   - `chore:` - Build process or auxiliary tool changes

5. **Push Your Branch**

   ```bash
   git push origin feature/your-feature-name
   ```

### Working with the Database

#### Running Migrations

```bash
cd apps/backend/src

# Create a new migration
npx prisma migrate dev --name describe_your_changes

# Apply migrations
npx prisma migrate dev

# Generate Prisma Client (after schema changes)
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

#### Using Prisma Studio

Prisma Studio provides a GUI to view and edit database data:

```bash
cd apps/backend/src
npx prisma studio
```

This opens Prisma Studio at http://localhost:5555.

#### Schema Management

Prisma schemas are located in `apps/backend/src/prisma/schema/`:
- `schema.prisma` - Main configuration
- `user.prisma` - User model
- `todo.prisma` - Todo model

After modifying schemas, always run:
```bash
npx prisma format
npx prisma generate
npx prisma migrate dev --name your_change_description
```

### Working with APIs

#### Generating API Documentation

The backend uses TSOA to auto-generate API documentation from TypeScript:

```bash
# Generate JSON Swagger spec
yarn json-api:generate

# Generate YAML Swagger spec
yarn yaml-api:generate

# Generate both
yarn api-docs:generate
```

Generated files are in `apps/backend/src/swagger/`.

#### Syncing OpenAPI Specs

When you update API endpoints:

```bash
# Sync OpenAPI spec and regenerate TypeScript client
yarn openapi:sync

# Verify no drift (useful in CI)
yarn openapi:check
```

This ensures:
1. Backend spec is up-to-date
2. `libs/api-specs` contains the latest spec
3. `libs/app-api-client` is regenerated with new types

#### Generating API Client

The frontend uses an auto-generated TypeScript client for type-safe API calls:

```bash
yarn api:generate
```

This regenerates `libs/app-api-client` based on the OpenAPI spec.

### Code Quality

#### Linting

```bash
# Lint all code
nx lint

# Lint specific project
nx lint backend
nx lint myorganizer

# Auto-fix linting issues
nx lint --fix
```

#### Formatting

```bash
# Check formatting
yarn format:check

# Fix formatting issues
yarn format:write

# Format specific files
nx format:write --files=path/to/file.ts
```

#### Type Checking

TypeScript is checked automatically during build, but you can run it manually:

```bash
# Check types for backend
nx run backend:type-check

# Check types for frontend
nx run myorganizer:type-check
```

## Creating Issues and Pull Requests

### Creating an Issue

Good issues help maintainers understand and address problems quickly. Here's how to create effective issues:

1. **Navigate to the Repository**

   Go to https://github.com/mnaimfaizy/myorganizer/issues

2. **Click "New Issue"**

3. **Choose an Issue Type** (if templates are available)

   - Bug Report
   - Feature Request
   - Documentation
   - Question

4. **Provide a Clear Title**

   Good: `Backend API returns 500 error when creating todo with empty title`
   
   Bad: `API broken`

5. **Fill in the Description**

   For **Bug Reports**, include:
   - **Description**: What is the problem?
   - **Steps to Reproduce**:
     1. Start the backend
     2. Send POST request to /api/v1/todo with empty title
     3. Observe 500 error
   - **Expected Behavior**: Should return 400 with validation error
   - **Actual Behavior**: Returns 500 internal server error
   - **Environment**:
     - OS: macOS 13.0
     - Node.js: v18.16.0
     - Browser: Chrome 120 (if applicable)
   - **Screenshots/Logs**: Include relevant error messages or screenshots

   For **Feature Requests**, include:
   - **Description**: What feature do you want?
   - **Use Case**: Why is this feature needed?
   - **Proposed Solution**: How should it work?
   - **Alternatives**: What alternatives have you considered?

   For **Documentation**, include:
   - **Description**: What needs to be documented?
   - **Location**: Where should this documentation go?
   - **Current Gap**: What's missing or unclear?

6. **Add Labels** (if you have permission)

   - `bug` - Something isn't working
   - `enhancement` - New feature or request
   - `documentation` - Documentation improvements
   - `good first issue` - Good for newcomers
   - `help wanted` - Extra attention needed

7. **Submit the Issue**

### Creating a Pull Request

1. **Fork and Clone** (for external contributors)

   ```bash
   # Fork the repository on GitHub, then:
   git clone https://github.com/YOUR_USERNAME/myorganizer.git
   cd myorganizer
   git remote add upstream https://github.com/mnaimfaizy/myorganizer.git
   ```

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**

   - Write clean, readable code
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Test Your Changes**

   ```bash
   # Run all tests
   nx test

   # Run specific tests
   nx test backend
   nx test myorganizer

   # Run E2E tests
   nx e2e myorganizer-e2e

   # Check code quality
   yarn format:write
   nx lint
   ```

5. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: add user profile settings page"
   ```

   Use [Conventional Commits](https://www.conventionalcommits.org/) format.

6. **Keep Your Branch Up to Date**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

7. **Push Your Branch**

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create the Pull Request**

   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - **Write a Clear PR Title**: Same format as commits
     - `feat: add user profile settings`
     - `fix: resolve database connection timeout`
     - `docs: update API documentation`
   
   - **Fill in the PR Description**:
     ```markdown
     ## Description
     Brief description of what this PR does.

     ## Related Issue
     Closes #123

     ## Changes Made
     - Added user profile settings page
     - Updated user service to support profile updates
     - Added tests for profile update functionality

     ## Testing Done
     - [ ] Unit tests pass
     - [ ] E2E tests pass
     - [ ] Manual testing completed
     - [ ] Documentation updated

     ## Screenshots (if applicable)
     [Add screenshots of UI changes]

     ## Checklist
     - [ ] Code follows project style guidelines
     - [ ] Self-review completed
     - [ ] Comments added for complex code
     - [ ] Documentation updated
     - [ ] Tests added/updated
     - [ ] All tests passing
     - [ ] No new warnings introduced
     ```

   - **Request Reviewers** (if you have permission)
   - **Add Labels** (if you have permission)

9. **Submit the Pull Request**

### PR Review Process

1. **Automated Checks**
   - CI/CD pipeline runs automatically
   - Tests must pass
   - Linting must pass
   - Build must succeed

2. **Code Review**
   - Maintainers will review your code
   - Address feedback by pushing new commits
   - Engage in discussion if you disagree

3. **Making Changes After Review**
   ```bash
   # Make requested changes
   git add .
   git commit -m "fix: address review feedback"
   git push origin feature/your-feature-name
   ```

4. **Approval and Merge**
   - Once approved, a maintainer will merge your PR
   - You can delete your branch after merging

## Testing

### Unit Testing

The monorepo uses Jest for unit testing.

#### Running Tests

```bash
# Run all tests
nx test

# Run tests for specific project
nx test backend
nx test myorganizer
nx test web-ui

# Run tests in watch mode
nx test backend --watch

# Run tests with coverage
nx test backend --coverage
```

#### Writing Tests

Tests are located next to the source files with `.spec.ts` or `.test.ts` extensions.

**Example (Backend)**:
```typescript
// apps/backend/src/services/UserService.spec.ts
import { UserService } from './UserService';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  it('should create a user', async () => {
    const user = await userService.createUser({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

**Example (Frontend)**:
```typescript
// libs/web-ui/src/components/Button.spec.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText('Click me');
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Testing

End-to-end tests use Playwright and are located in `apps/myorganizer-e2e`.

```bash
# Run E2E tests
nx e2e myorganizer-e2e

# Run E2E tests in UI mode (interactive)
nx e2e myorganizer-e2e --ui

# Run E2E tests for CI
nx e2e-ci myorganizer-e2e
```

**Writing E2E Tests**:
```typescript
// apps/myorganizer-e2e/src/example.spec.ts
import { test, expect } from '@playwright/test';

test('user can log in', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Test Coverage

```bash
# Generate coverage report
nx test backend --coverage
nx test myorganizer --coverage

# View coverage in browser
# Reports are in coverage/ directory
open coverage/apps/backend/index.html
```

## Building for Production

### Building the Backend

```bash
# Build backend
yarn build:backend

# Or using Nx
nx run backend:build:production

# Output is in dist/apps/backend/
```

**Running Production Build**:
```bash
cd dist/apps/backend
npm install --production
node main.js
```

**Environment Requirements**:
- `NODE_ENV=production`
- All JWT secrets configured
- Production database URL
- SMTP configuration for emails

### Building the Frontend

```bash
# Build frontend
yarn build:myorganizer

# Or using Nx
nx run myorganizer:build:production

# Output is in dist/apps/myorganizer/
```

**Running Production Build**:
```bash
cd dist/apps/myorganizer
npm install --production
npm start
```

### Building Storybook

```bash
yarn build-storybook

# Output is in dist/storybook/web-ui/
```

## Common Tasks

### Adding a New Library

```bash
# React library
npx nx g @nx/react:lib my-new-lib

# Node.js library
npx nx g @nx/node:lib my-new-lib

# TypeScript library
npx nx g @nx/js:lib my-new-lib
```

### Adding a New Application

```bash
# Next.js application
npx nx g @nx/next:app my-new-app

# Express application
npx nx g @nx/express:app my-new-api
```

### Updating Dependencies

```bash
# Update Nx and plugins
nx migrate latest

# Apply migrations
nx migrate --run-migrations

# Update other dependencies
yarn upgrade-interactive

# Update specific package
yarn upgrade package-name@latest
```

### Visualizing Dependencies

```bash
# Open dependency graph
nx graph

# Show affected projects
nx affected:graph
```

## Troubleshooting

### Docker Issues

**Problem**: Containers not starting
```bash
# Solution: Check Docker is running
docker ps

# Restart containers
docker-compose down
docker-compose up -d

# View logs
docker-compose logs -f myorganizer_db
```

### Database Issues

**Problem**: Cannot connect to database
```bash
# Solution 1: Check database is running
docker ps | grep myorganizer_db

# Solution 2: Verify DATABASE_URL in .env
# Should match docker-compose.yml settings

# Solution 3: Recreate database
docker-compose down -v
docker-compose up -d
```

**Problem**: Prisma Client not found
```bash
# Solution: Generate Prisma Client
cd apps/backend/src
npx prisma generate
```

**Problem**: Migration fails
```bash
# Solution: Check migration files for errors
# Reset database (WARNING: deletes all data)
cd apps/backend/src
npx prisma migrate reset
```

### Port Conflicts

**Problem**: Port already in use
```bash
# Solution 1: Change ports in .env
# For backend, change PORT
# For frontend, change in nx.json or project.json

# Solution 2: Kill process using port
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

### Build Issues

**Problem**: Build fails with type errors
```bash
# Solution: Clean Nx cache and rebuild
nx reset
yarn install
nx build backend --skip-nx-cache
```

**Problem**: Out of memory errors
```bash
# Solution: Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
nx build backend
```

### Git Issues

**Problem**: Merge conflicts
```bash
# Solution: Resolve conflicts manually
git fetch upstream
git merge upstream/main

# Edit files to resolve conflicts
# Then:
git add .
git commit -m "chore: resolve merge conflicts"
```

### Common Errors

**Error**: `Cannot find module '@myorganizer/...'`
```bash
# Solution: Rebuild TypeScript paths
yarn install
nx reset
```

**Error**: `ENOSPC: System limit for number of file watchers reached`
```bash
# Solution (Linux): Increase inotify watchers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Error**: Husky hooks not working
```bash
# Solution: Reinstall Husky
yarn husky install
```

## Additional Resources

### Documentation

- [Main README](README.md) - Project overview and quick start
- [Backend Documentation](apps/backend/README.md) - Detailed backend guide
- [Authentication Guide](docs/authentication/README.md) - JWT strategy and auth flow
- [Storybook Guide](docs/storybook/README.md) - UI component development
- [Deployment Guides](docs/deployment/) - Platform-specific deployment instructions

### External Resources

- [Nx Documentation](https://nx.dev) - Monorepo tools and best practices
- [Next.js Documentation](https://nextjs.org/docs) - Frontend framework
- [Express.js Guide](https://expressjs.com/en/guide/routing.html) - Backend framework
- [Prisma Documentation](https://www.prisma.io/docs) - Database ORM
- [TSOA Documentation](https://tsoa-community.github.io/docs/) - API documentation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - TypeScript guide
- [React Documentation](https://react.dev) - React library
- [Tailwind CSS](https://tailwindcss.com/docs) - CSS framework
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format

### Community

- **GitHub Issues**: Report bugs and request features
- **Pull Requests**: Contribute code improvements
- **Discussions**: Ask questions and share ideas (if enabled)

### Getting Help

If you encounter issues not covered in this guide:

1. Check existing [GitHub Issues](https://github.com/mnaimfaizy/myorganizer/issues)
2. Search the documentation
3. Review recent Pull Requests for similar changes
4. Create a new issue with detailed information

---

**Happy coding!** 🚀

If you have questions or suggestions for improving this guide, please open an issue or submit a pull request.
