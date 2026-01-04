# Mobile-app Spike: Crypto parity, key storage, and enrollment

Status: spike / decision doc

## Goal

Ensure the encrypted vault design can be carried to a future mobile app without weakening E2EE or introducing incompatible crypto.

This doc focuses on:

- Crypto primitive parity across web + mobile
- Storage of sensitive key material on-device
- Multi-device onboarding options
- Migration approach from the current WebCrypto prototype

## Current state (web prototype)

The current web implementation uses WebCrypto-friendly primitives:

- KDF: PBKDF2-SHA256
- AEAD: AES-256-GCM

This is OK for a web prototype, but is not ideal for long-term cross-platform parity.

## Recommendation (mobile parity target)

### Crypto primitives

Target a libsodium-based stack for cross-platform consistency:

- KDF: Argon2id (memory-hard)
- AEAD: XChaCha20-Poly1305

Why:

- Well-supported in mobile ecosystems
- Strong misuse resistance (nonce requirements are less error-prone than AES-GCM in practice)
- Easier to keep the exact same primitives across iOS/Android and (optionally) a future web build

### Libraries

- Mobile (iOS/Android): libsodium bindings
  - React Native: use a maintained sodium binding (or native module) that exposes Argon2id + XChaCha20-Poly1305
- Web:
  - Keep current WebCrypto prototype for now
  - If/when we want full parity on web, evaluate a WASM-backed libsodium build

## Key material and storage

### What should never be stored in plaintext

- Master Key (MK) in plaintext
- Passphrase-derived key (PK) in plaintext

### What can be persisted (encrypted)

- Wrapped Master Key (MK encrypted under PK)
- Wrapped Master Key (MK encrypted under Recovery Key)
- Encrypted blobs (addresses, mobile numbers, etc.)

### iOS

Use Keychain for secrets:

- Store a device-specific secret or key-encryption-key (KEK) in Keychain
- Use it to wrap and persist vault material (or to secure an app-local storage key)

### Android

Use Android Keystore similarly:

- Prefer hardware-backed keys when available
- Store an app KEK in Keystore and use it to wrap the vault’s persisted materials

## Multi-device onboarding options

### Option A: passphrase on each device (Phase 2A)

User enters the same vault passphrase on every device.

- Pros: simple; no device-to-device protocol
- Cons: user friction; requires user to remember/passphrase-manage well

### Option B: enrollment / QR transfer (Phase 2B)

Existing device enrolls a new device by transferring a wrapped MK.
A minimal approach:

- Existing device generates an ephemeral enrollment keypair
- Transfers a short-lived enrollment payload via QR (or local transport)
- New device obtains MK wrapped for itself (or unwraps and re-wraps under its device-secured KEK)

Tradeoffs:

- Pros: smoother UX; less passphrase entry
- Cons: more protocol complexity; additional threat modeling required

## Migration approach from current web prototype

### Compatibility strategy

- Treat “PBKDF2 + AES-GCM” vaults as versioned legacy format.
- Allow the backend to remain blind storage; migration happens client-side.

### Suggested migration flow

1. Unlock existing vault (legacy) using PBKDF2 + AES-GCM.
2. Derive a new key using Argon2id.
3. Re-encrypt vault metadata + blobs using XChaCha20-Poly1305.
4. Upload the new ciphertext bundle to the server using the existing `/vault` + `/vault/blob/*` API.

### Notes

- This migration is easiest when the client vault format is already versioned and exportable.
- Avoid server-side migrations; the backend should remain ciphertext-only.

## What remains E2EE vs plaintext

- E2EE: addresses, mobile numbers, provider-private notes/identifiers, any user-entered sensitive text
- Plaintext OK: provider catalog (names/categories/URLs), UI preferences, non-sensitive app settings

## Open questions

- Do we want web parity via libsodium WASM now, or keep WebCrypto until a mobile client is real?
- Is Option B (enrollment) required for Phase 2, or is passphrase-per-device acceptable initially?
