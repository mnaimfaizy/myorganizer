# CI owns Host Apply; the public tree does not describe the jail

Issue #437 is owned in this repository: after FTP upload, CI executes and verifies **Host Apply** on both Staging and Production. The public clone must not learn how to open a shell on the box.

## Status

accepted

## Context

Deploy workflows already package the backend and FTP it. They then stop. The runbook’s go-live work — install, apply migrations, regenerate the Prisma client, restart the process, then prove nothing is pending — stayed on interactive SSH and failed twice in production (unapplied migrations; then a stale Prisma client). A green FTP job is not “live”; a Tag is a receipt that Production Host Apply succeeded.

The repository is public. Host identity, account name, SSH port, home paths, and the inventory of other apps on a shared hosting account are operator secrets. Putting them in git teaches the jail to anyone who clones. Putting `DATABASE_URL` in GitHub Actions would copy the production database credential into a second store. A private duplicate of this repo was considered as a hiding place and rejected: GitHub will not make a private fork of a public repository, a mirror splits Cut / Deploy Approval / Tag across two remotes, and a private git tree is still not a secret store.

Staging and Production are distinct app roots and distinct databases. They currently share one hosting account, so an SSH principal that can Host Apply Staging can reach Production’s tree. GitHub Environments do not isolate that home directory.

## Decision

- **This repository owns Host Apply** for Staging (after a green `main` deploy) and Production (after Deploy Approval). Execute and verify; do not verify-only.
- **The channel is SSH with a deploy key.** The account password is never a CI secret. Connection values (host, port, user, key) and on-host pins (`APP_ROOT`, activate path, selector app identity, `API_ORIGIN`) live only in GitHub Environment secrets.
- **`DATABASE_URL` is never a GitHub secret.** The SSH session loads it on the host from that environment’s Node.js selector store, for the secret app identity only. It does not enumerate sibling apps, print the value, or write a second copy as an app-root `.env` unless the selector has no key (then planting `.env` is a documented operator prerequisite, not a default).
- **Host Apply is a separable job** after upload: re-runnable without a second FTP, and not cancelled mid-migrate when a newer `main` lands (queue, do not kill).
- **Fail closed.** A failed Host Apply leaves the host as it is. No automated file or migrate-down rollback. Do not Tag. Cut requires Staging Host Apply green, not merely CI green.
- **Verify** with on-host migration status plus existing HTTP probes (`/docs`, cron rejected as `401` not `500` / HTML `403`). No readiness endpoint in #437.
- **Public git contains the algorithm and secret names only.** Workflows and deploy docs use placeholders. They do not hardcode host, user, port, home paths, or selector keys. Logs must not dump environment or connection strings.

Shared-account blast radius is accepted and written here: pin `APP_ROOT` per environment and refuse to run if it is missing or points at the other environment’s root. That is discipline, not isolation.

## Considered Options

- **Privileged HTTP apply endpoint** — rejected. New way to migrate and restart a vault-backed app; the running process must already be healthy enough to receive the call.
- **`DATABASE_URL` in GitHub Environment secrets** — rejected. Generate and restart already require a host channel; adding the database URL to Actions copies a secret that already lives on the box.
- **Password SSH / `sshpass`** — rejected. The human login credential would become a CI secret and would reach both app roots.
- **Verify-only (fail the job, humans still apply)** — rejected. SSH is the unreliable part; detection without execution leaves the v0.4.0 hole.
- **Private duplicate as the home of Host Apply or production-only features** — rejected for #437. Secrets already hide operator values. A second codebase is a product split and needs its own grill.
- **Plant app-root `.env` by default** — rejected while the selector store already has `DATABASE_URL`. A second copy drifts from the cPanel UI (the #438 failure mode).
- **Cancel-in-progress through migrate** — rejected. `prisma migrate deploy` is forward-only; killing it is how the schema matches neither release.

## Consequences

- Operator HITL before the first green Host Apply: install the deploy public key; confirm non-interactive SSH can `source` the Node activate script and load `DATABASE_URL` from the selector without printing it.
- Deploy documentation drops environment _values_ from the public tree (secret-name tables, not jail maps). Already-public site URLs that pre-exist in docs are not a reason to add new fingerprints.
- A readiness endpoint that reports migration status without SSH remains a follow-up, not this decision.
- Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy (Staging, Production, Host Apply, Deploy Approval, Tag).
