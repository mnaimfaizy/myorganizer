# Hosting the MyOrganizer frontend on Vercel

This guide explains how to deploy the **frontend** (Next.js app) to Vercel for your own hosting.

It also explains the difference between **Preview** and **Production** environments on Vercel, and how to choose environment-variable values used by this repo.

## What you are deploying

- App: `apps/myorganizer`
- Framework: Next.js (App Router)
- Node version: use Node 22 (matches repo `package.json` engines)

## Prerequisites

- A running backend API (or any compatible API) reachable from the public internet.
- GitHub account (recommended) so Vercel can connect to the repo.

## Vercel environments: Preview vs Production

Vercel has two common deployment environments you’ll use:

- **Preview deployments**

  - Created for pull requests / non-production branches.
  - Great for testing changes safely.
  - Typically should point to a **staging** backend API.

- **Production deployments**
  - Created when you deploy from the production branch (often `main`) or when you run a production deploy.
  - Should point to your **production** backend API.

Recommended mapping for this project:

- Preview → staging API base URL
- Production → production API base URL

## Option A: Deploy via Vercel dashboard (recommended)

1. Create a new project in Vercel and import your Git repository.
2. When configuring the project:
   - **Root Directory**: `apps/myorganizer`
   - **Install Command**: `yarn install --frozen-lockfile`
   - **Build Command**: from the repo root, run `yarn build:myorganizer`
     - If Vercel forces running inside the root directory, use:
       - `cd ../.. && yarn build:myorganizer`
   - **Output Directory**: leave empty (Next.js defaults)
3. Set the environment variables (see below).
4. Deploy.

## Option B: Deploy via Vercel CLI

From the repo root:

- `npm i -g vercel`
- `vercel login`
- `cd apps/myorganizer`
- `vercel` (first deploy)

For a **Preview** deployment:

- `vercel`

For a **Production** deployment:

- `vercel --prod`

Note: This repo includes `apps/myorganizer/vercel.json` to ensure Vercel installs dependencies from the monorepo root, while building the Next.js app inside `apps/myorganizer` (so Vercel finds `.next` / `routes-manifest.json`).

If you have configured **Output Directory** in the Vercel Project settings, ensure it is either empty or set to `.next`. Do not set it to `dist/...` for this app.

## Environment variables

At minimum you must set the API base URL used by the frontend.

Recommended:

- `API_BASE_URL` = `https://your-api-domain.example.com/api/v1`

Fallback (still supported):

- `NEXT_PUBLIC_API_BASE_URL` = `https://your-api-domain.example.com/api/v1`

Notes:

- Prefer `API_BASE_URL` when you can set runtime env vars.
- `NEXT_PUBLIC_API_BASE_URL` is embedded into the client bundle (public) and is useful when the runtime environment cannot inject `API_BASE_URL`.

### Suggested env var values by Vercel environment

Set the values in **Vercel Project → Settings → Environment Variables** and apply them to:

- **Preview**: point to your staging backend
  - `API_BASE_URL=https://staging-api.your-domain.example.com/api/v1`
- **Production**: point to your production backend
  - `API_BASE_URL=https://api.your-domain.example.com/api/v1`

If you also set `NEXT_PUBLIC_API_BASE_URL`, keep it aligned with `API_BASE_URL` for each environment.

## Where to get the values (in our setup)

### `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`

You choose these based on where your backend is hosted:

- If your backend is hosted on cPanel under a domain like `https://api.example.com` and the backend router prefix is `/api/v1`, then:
  - `API_BASE_URL=https://api.example.com/api/v1`

If you change the backend prefix (`ROUTER_PREFIX`), the frontend value must match.

### Vercel CI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)

These are only needed if you want GitHub Actions (or your own CI) to deploy to Vercel.

- `VERCEL_TOKEN`
  - Create in Vercel: Account Settings → Tokens
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
  - Easiest way to obtain them is using the Vercel CLI:
    - `cd apps/myorganizer`
    - `npx vercel@latest link`
    - Then inspect `.vercel/project.json` (it contains `orgId` and `projectId`).

Notes on naming:

- Vercel’s UI often calls the workspace scope a **Team**, and you may see a **Team ID** even if you’re using a personal account.
- In the Vercel CLI/config, that same scope is commonly labeled `orgId`.
- In our GitHub Actions secrets we store this value as `VERCEL_ORG_ID`.

If you are hosting manually from the Vercel dashboard (no GitHub Actions deployment), you do not need those secrets.

## Common gotchas

- **CORS**: your backend must allow your Vercel domain as an origin (and allow credentials if your auth uses cookies).
- **Router prefix**: ensure the URL you set includes the backend prefix (example: `/api/v1`) if your backend uses it.
- **Auth cookies**: if your backend uses HTTP-only cookies for refresh tokens, ensure:
  - backend sets cookies for the correct domain,
  - CORS is configured with `credentials: true`,
  - frontend requests include credentials.

## Verifying the deployment

- Open the Vercel deployment URL.
- Try a login flow (if enabled) and confirm API calls succeed.
- If API calls fail:
  - verify `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`,
  - check backend CORS configuration,
  - check backend logs.
