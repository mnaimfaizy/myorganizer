#!/usr/bin/env bash
# Per-boot service reconciliation for the MyOrganizer Cloud Agent environment.
# Brings up PostgreSQL (port 5453, matching .env) and MailHog, then applies
# pending Prisma migrations. Idempotent and safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -n | tail -1)"
if [ -z "${PG_VER:-}" ]; then
  echo "PostgreSQL is not installed; run .cursor/install.sh first" >&2
  exit 1
fi

echo "==> Configuring PostgreSQL cluster ${PG_VER}/main on port 5453"
sudo sed -i "s/^port = .*/port = 5453/" "/etc/postgresql/${PG_VER}/main/postgresql.conf"

if ! sudo pg_lsclusters -h | awk '{print $4}' | grep -q online; then
  sudo pg_ctlcluster "${PG_VER}" main start || sudo pg_ctlcluster "${PG_VER}" main restart
else
  # Ensure the port change is applied even if it was already running.
  sudo pg_ctlcluster "${PG_VER}" main restart
fi

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -p 5453 >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> Ensuring role password and database"
sudo -u postgres psql -p 5453 -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD 'Admin@123';"
sudo -u postgres psql -p 5453 -tAc "SELECT 1 FROM pg_database WHERE datname='myorganizer'" | grep -q 1 \
  || sudo -u postgres psql -p 5453 -c "CREATE DATABASE myorganizer;"

echo "==> Starting MailHog (SMTP 1025 / UI 8025) if not already running"
if ! curl -fsS http://localhost:8025/api/v2/messages >/dev/null 2>&1; then
  nohup mailhog -smtp-bind-addr 0.0.0.0:1025 -ui-bind-addr 0.0.0.0:8025 -api-bind-addr 0.0.0.0:8025 \
    >/tmp/mailhog.log 2>&1 &
fi

echo "==> Applying database migrations"
corepack enable
corepack yarn nx run backend:migrate

echo "==> start.sh complete"
