# The Drive escape hatch holds no token we could lose

## Status

accepted

The decision is made and it constrains work that has not been done yet. What exists today is the
implicit-flow provider this ADR keeps; what does not exist is the honest connection vocabulary and
the standalone reader that make the property useful
([ADR 0064](0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)).

## Context

MyOrganizer talks to Google twice, in two different ways, and the two sit close enough together to
invite a question.

The YouTube integration uses the server-side authorization-code flow. The backend exchanges the
code, holds a refresh token encrypted at rest in Postgres, and can therefore call Google on a cron
with nobody present. Vault Cloud Backup does the opposite: the browser obtains an access token
directly from Google Identity Services using the implicit token flow with the `drive.appdata` scope,
holds it in memory only, and the backend never sees it. The two can even share one Google Cloud
OAuth client.

Read as engineering, the implicit flow looks like the weaker choice, and
[#514](https://github.com/mnaimfaizy/myorganizer/issues/514) said so precisely: tokens last about an
hour, there is no refresh token, `canRunSilently()` depends on a live Google session through a
mechanism sitting in the path of third-party-cookie deprecation, and a scheduled backup therefore
degrades to "whenever the user happens to have the tab open and Google happens to co-operate". The
obvious repair is sitting in the same repository, already working, already documented. A future
reader will find the two flows side by side and assume Drive simply has not caught up yet.

It has not caught up on purpose, and the reason is not about tokens at all. It is about what the
feature is _for_.

Vault Cloud Backup is not the durability mechanism for a User's data. Since per-record convergence
landed ([#544](https://github.com/mnaimfaizy/myorganizer/issues/544),
[ADR 0054](0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)), the server already
holds every Vault Blob and the Vault Meta as Ciphertext, pushed as the ordinary consequence of an
edit, converged per record, and sufficient to bootstrap a new device from a sign-in and a
passphrase. That is automatic, device-independent, survives a closed tab, and needs no Google
account whatsoever. Drive adds nothing to it.

What Drive adds is the other thing: a copy of the User's Ciphertext, in storage the User controls,
that survives _us_ — our server losing data, our account deletion, our going away. The threat model
of Vault Cloud Backup is MyOrganizer itself.

## Decision

**The backend never holds a Google Drive token, and Vault Cloud Backup never adopts the
authorization-code flow.** This is a permanent constraint on the feature, not a stage it is
expected to grow out of.

An escape hatch from MyOrganizer that MyOrganizer's backend must open is not an escape hatch. If
the backend holding the refresh token is the failure being insured against, then the insurance and
the risk fail together: the token disappears with the service, and the copy sitting safely in the
User's own Drive becomes unreachable through the only tool that can reach it. The property the
authorization-code flow would buy — backups that run with nobody present — is a property of the
mechanism. The property it would spend is the entire point of the feature.

The exchange is therefore not close. It reads close only if Vault Cloud Backup is mistaken for the
durability mechanism, which it stopped being when convergence landed.

## Consequences

Three of the four constraints [#514](https://github.com/mnaimfaizy/myorganizer/issues/514) raises
are accepted rather than fixed, and that acceptance has to be visible in the product rather than
buried here. A cycle that cannot promise a clock must not use the words `daily`, `weekly`,
`monthly`; a link that was never tested must not be reported as `connected`
([ADR 0063](0063-a-restore-discards-the-evidence-it-holds-about-the-server.md) is a different
problem, but the same instinct). The honest signal is the age of the newest Escape Copy, displayed
where the User can see it rot.

Service Workers do not rescue the cycle and should not be attempted for this purpose. Periodic
Background Sync needs an installed PWA and there is no manifest or service worker in
`apps/myorganizer` at all; it is Chromium-only, so Safari and iOS are excluded outright; and a
service worker has no DOM and cannot open a popup, so `initTokenClient` could not run inside one
even if all of that were solved. The gap is closed at both ends.

Scheduled, unattended backup remains available to the mobile app, which can reach an OS scheduler
and already shares the crypto suite ([ADR 0039](0039-web-and-mobile-vaults-share-one-crypto-suite.md)).
That is a new feature with its own token story, not a repair of this one, and nothing here decides
it.
