# Web Vault Agent Guide

## Scope

Browser vault implementation using WebCrypto and web storage/client sync helpers.

## Commands

- Test: `yarn nx test web-vault`.
- Lint: `yarn nx lint web-vault`.

## Do

- Keep plaintext only in client memory while unlocked.
- Store and sync encrypted blobs for `addresses`, `mobileNumbers`, `subscriptions`, and `todos`.
- Validate ciphertext bundle shape and size before import.

## Do Not

- Do not send decrypted vault data to backend APIs.
- Do not persist master keys, passphrases, or recovery keys in plaintext.
