# A mobile device may hold the Master Key behind a biometric gate

The Mobile App may keep a User's Master Key in the platform keystore, readable
only after a biometric check, so that a companion app used at a shop counter
does not ask for a long passphrase on every cold start. It is opt-in, bound to
one User, additive to the passphrase and the Recovery Key, and it authorizes
nothing a passphrase unlock does not.

## Status

accepted

## Context

Mobile keeps the Master Key in memory only and never persists vault data
(ADR 0047, ADR 0107 decision 5). Every cold start, and every lock, therefore
costs a typed passphrase and a PBKDF2 derivation. The mobile v1 scope is a
companion to the web app: Groceries in the shop, quick Task capture, and
looking up an Address or Mobile Number at a counter. Each of those is a
seconds-long visit, and a passphrase gate on each one is the reason such an
app stops being opened.

## Decision

1. **Biometric Unlock is opt-in.** After a successful passphrase unlock the
   app offers it once. Accepting stores the Master Key in the iOS Keychain or
   Android Keystore with an access control that requires a strong biometric
   and is **invalidated when the device's biometric enrolment changes**
   (`BIOMETRY_CURRENT_SET` or its Android equivalent). The Master Key is
   exported from memory for this one write and never written anywhere else.
2. **It is additive.** The passphrase and the Recovery Key always remain
   offered on the Unlock screen. A failed, cancelled, or invalidated biometric
   check falls back to them and never locks the User out.
3. **It is bound to one User.** The keystore item is keyed to the signed-in
   User. Logging out deletes it, and another User signing in on the same
   device never reads or is offered it — the same ownership rule a Local
   Vault follows.
4. **It grants nothing new.** It is a third Vault Unlock Secret, alongside
   passphrase and Recovery Key, and it never authorizes a passphrase reset.
   Only a Recovery Key unlock does that, and mobile does not offer reset.
5. **It survives a passphrase change and not a vault replacement.** A
   passphrase or Recovery Key rotation rewraps the same Master Key, so the
   stored key keeps working. If the stored key no longer decrypts the
   server's Ciphertext, the item is deleted and the passphrase is asked for.
6. **The app locks itself.** A privacy cover hides content whenever the app
   leaves the foreground, and the Vault locks after five minutes in the
   background by default, configurable from immediately to fifteen minutes.
   A lock clears the in-memory Master Key; the keystore item stays.
7. **The keystore is reached through a Platform Adapter.** Reading, writing,
   and deleting the keystore item, and learning whether enrolment has been
   invalidated, go through one Platform Adapter interface. The rules above —
   when to offer, when to fall back, when to delete, what a biometric unlock
   authorizes — are a pure policy over that interface, so they are tested
   against a fake keystore rather than on a device.

## Considered Options

- **Passphrase on every unlock.** Strongest, and what mobile does today.
  Rejected for v1 because it defeats the companion use it is built for.
- **Store the passphrase instead of the Master Key.** Rejected: it discloses
  a secret the User may reuse, and it still pays PBKDF2 on every unlock.
- **Defer to v1.1.** Rejected: the Unlock screen and the Account settings are
  designed now, and a gate added after users have learnt the flow is a
  redesign.

## Consequences

- The Master Key now rests on a device, under hardware-backed protection. A
  device compromise that defeats the platform biometric gate reads it; this
  is the accepted cost, and the reason the item is opt-in and dies with
  enrolment changes and logout.
- ADR 0047's and ADR 0107's "mobile persists no vault data" still holds for
  Ciphertext and plaintext. This ADR carves out the Master Key only.
- The Master Key must be created extractable on mobile so it can be written
  to the keystore once.
