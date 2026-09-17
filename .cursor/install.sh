#!/usr/bin/env bash
# Idempotent repository bootstrap for the MyOrganizer Cloud Agent environment.
# Runs after checkout. Installs system deps (Postgres + MailHog) if missing,
# installs JS deps, creates a local .env, and generates the Prisma client.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

echo "==> Ensuring system dependencies (PostgreSQL, MailHog)"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends postgresql postgresql-client
fi

if ! command -v mailhog >/dev/null 2>&1 && [ ! -x /usr/local/bin/mailhog ]; then
  echo "==> Downloading MailHog"
  sudo curl -fsSL -o /usr/local/bin/mailhog \
    https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64
  sudo chmod +x /usr/local/bin/mailhog
fi

echo "==> Enabling Corepack + installing JS dependencies"
corepack enable
corepack yarn install --immutable

echo "==> Ensuring local .env exists"
if [ ! -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
  node -e '
    const fs = require("fs");
    const crypto = require("crypto");
    const p = process.argv[1];
    let s = fs.readFileSync(p, "utf8");
    const gen = () => crypto.randomBytes(32).toString("hex");
    for (const k of ["ACCESS_JWT_SECRET","REFRESH_JWT_SECRET","VERIFY_JWT_SECRET","RESET_JWT_SECRET"]) {
      s = s.replace(new RegExp("^" + k + "=.*$", "m"), k + "=" + gen());
    }
    s = s.replace(/^YOUTUBE_TOKEN_ENCRYPTION_KEY=.*$/m, "YOUTUBE_TOKEN_ENCRYPTION_KEY=" + gen());
    s = s.replace(/^YOUTUBE_CRON_SECRET=.*$/m, "YOUTUBE_CRON_SECRET=" + gen());
    fs.writeFileSync(p, s);
  ' "$REPO_ROOT/.env"
  echo "    Created .env with generated JWT secrets"
else
  echo "    .env already present; leaving it untouched"
fi

echo "==> Generating Prisma client"
corepack yarn nx run backend:generate-types

echo "==> install.sh complete"
