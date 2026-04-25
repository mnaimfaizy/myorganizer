# Vault Core Agent Guide

## Scope

Platform-agnostic vault types and interfaces for encrypted user data.

## Commands

- Test: `yarn nx test vault-core`.
- Lint: `yarn nx lint vault-core`.

## Do

- Keep this library free of browser, React, Next.js, and backend framework APIs.
- Version vault wire formats and migration-facing types carefully.

## Do Not

- Do not add platform-specific storage or crypto implementations here.
- Do not weaken ciphertext-only assumptions.
