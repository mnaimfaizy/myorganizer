# Web app on cPanel

How the MyOrganizer web app (Next.js, standalone output) runs as a Node.js
application on Namecheap cPanel shared hosting.

Only Production's frontend runs on cPanel. Staging's frontend is deployed to
Vercel — see [Vercel hosting](VERCEL_FRONTEND_HOSTING.md). The backend it talks
to is described in [Backend API on cPanel](CPANEL_BACKEND_HOSTING.md).

> The repository is public. Host, user, and app-root values are GitHub
> Environment secrets, never text in this file
> ([ADR 0056](../adr/0056-ci-owns-host-apply-without-describing-the-jail.md)).
> `<WEB_APP_ROOT>` below means the directory the `FTP_PROD_FRONTEND_DIR` secret
> uploads to.

## What differs between environments

| Concern        | Staging                                                    | Production                                                         |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Frontend host  | Vercel                                                     | cPanel (this document)                                             |
| Web origin     | The domain of the Vercel project `VERCEL_PROJECT_ID` names | `https://myorganiser.app`                                          |
| `API_BASE_URL` | Staging's `API_ORIGIN` + `/api/v1`                         | `https://api.myorganiser.app/api/v1`                               |
| Bundle upload  | Vercel CLI, automatic after CI on `main`                   | FTP after Deploy Approval on a `release/vX.Y.Z` run                |
| Going live     | Vercel activates the deployment                            | Manual install and restart on the host ([below](#after-an-upload)) |

## The bundle

```bash
yarn package:myorganizer:web
```

Produces `dist/deploy/myorganizer-web/`:

1. Next.js built with `output: 'standalone'` through the Nx `myorganizer:package`
   target (`tools/scripts/package-myorganizer-web.mjs`).
2. A deploy-only `package.json` generated from `.next/standalone/node_modules`.
3. `.next/` and `public/` copied alongside.
4. A Linux-safe root `server.js` (avoids Windows path issues), and
   `CPANEL_STARTUP.md` naming it.

It contains no `node_modules`. CI builds and uploads this bundle; build it
locally only to inspect it.

The app reads its API location at **runtime** from `API_BASE_URL`, so changing
the API endpoint does not need a rebuild. `NEXT_PUBLIC_API_BASE_URL` is still
honoured as a build-time fallback for local development.

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vault Cloud Backup) is **not** a cPanel runtime
variable. Next inlines it when CI runs `yarn package:myorganizer:web`. Set it
as the GitHub Environment **variable** of the same name on `production` before
that package step; putting it only in this Node.js app panel leaves the baked
bundle unchanged. The value is sticky after first production enable — see
[Vault Cloud Backup](../features/vault-cloud-backup-google-drive.md#sticky-client-id).

## One-time setup

cPanel → **Setup Node.js App** → **Create Application**:

```
Node.js Version: 22.x
Application Mode: Production
Application Root: <WEB_APP_ROOT>
Application URL: https://myorganiser.app
Application Startup File: server.js
```

Environment variables:

```bash
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.myorganiser.app/api/v1
```

The backend must list this origin in `CORS_ORIGINS`.

If `www.myorganiser.app` should redirect to `myorganiser.app`, configure it in
cPanel **Domains** / **Redirects**.

## After an upload

The Production deploy uploads the bundle and stops; nothing on the host installs
or restarts the web app for it.

1. Click **Run NPM Install** in the Node.js app (required — the bundle has no
   `node_modules`).
2. Click **Restart**.
3. Load `https://myorganiser.app`, confirm API calls go to
   `https://api.myorganiser.app/api/v1/...`, and sign in once to confirm CORS
   and cookies.

## Troubleshooting

### App loads but API calls fail

- `API_BASE_URL` is missing or wrong in the app's environment variables.
- The backend's `CORS_ORIGINS` does not include `https://myorganiser.app` (and
  `https://www.myorganiser.app` if used).

### 404s for static assets

- `.next/static` and `public/` must exist directly under `<WEB_APP_ROOT>`.

### Node app won't start

- Read `stderr.log` / `stdout.log` in `<WEB_APP_ROOT>`.
- The startup file must be exactly `server.js`.
- Dependencies missing: **Run NPM Install**, then restart.

## Monitoring and maintenance

- cPanel **Metrics** → Resource Usage.
- External uptime monitoring on `https://myorganiser.app`.
- Keep a copy of the last deployed `dist/deploy/myorganizer-web/` bundle.
