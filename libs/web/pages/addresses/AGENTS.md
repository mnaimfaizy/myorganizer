# Addresses Page Agent Guide

## Scope

Dashboard addresses page backed by the encrypted vault.

## Do

- Store address entries and usage locations inside the `addresses` encrypted blob.
- Keep validation and display logic in this page library.

## Do Not

- Do not add plaintext address endpoints or server-side search over sensitive fields.
